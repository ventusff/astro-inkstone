// Recording harness for the README demo clips: a headless Chrome at 2x with a
// drawn cursor, eased pointer moves, helpers for the in-place editor, a
// frame-accurate screencast and the GIF encoder. Environment: BASE (the dev
// server), REC_USER (the dev-login name), CHROME_PATH.
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import puppeteer from 'puppeteer-core';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const BASE = process.env.BASE || 'http://127.0.0.1:4321';
export const USER = { name: process.env.REC_USER || 'Jeff', email: 'jeff@example.com' };

const CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30" viewBox="0 0 22 30">
  <path d="M2 1.5 L2 23 L7.2 18.3 L10.7 27.2 L14.3 25.7 L10.9 17 L18 17 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

const OVERLAY_SCRIPT = `
(() => {
  const mk = () => {
    if (document.getElementById('__rec-cursor')) return;
    const c = document.createElement('div');
    c.id = '__rec-cursor';
    c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:30px;z-index:2147483647;pointer-events:none;transform:translate(-9999px,-9999px);filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.35));';
    c.innerHTML = ${JSON.stringify(CURSOR_SVG)};
    const ring = document.createElement('div');
    ring.id = '__rec-ring';
    ring.style.cssText = 'position:fixed;left:0;top:0;width:34px;height:34px;border-radius:50%;border:2.5px solid rgba(191,72,33,.9);z-index:2147483646;pointer-events:none;opacity:0;transform:translate(-9999px,-9999px) scale(.4);';
    document.documentElement.append(c, ring);
    window.__recCursorMove = (x, y) => { c.style.transform = 'translate(' + (x - 2) + 'px,' + (y - 1.5) + 'px)'; };
    window.__recCursorClick = (x, y) => {
      ring.style.transition = 'none';
      ring.style.opacity = '0.9';
      ring.style.transform = 'translate(' + (x - 17) + 'px,' + (y - 17) + 'px) scale(.35)';
      void ring.offsetWidth;
      ring.style.transition = 'transform .38s ease-out, opacity .38s ease-out';
      ring.style.opacity = '0';
      ring.style.transform = 'translate(' + (x - 17) + 'px,' + (y - 17) + 'px) scale(1)';
    };
    window.__recCursorHide = () => { c.style.transform = 'translate(-9999px,-9999px)'; };
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mk, { once: true });
  else mk();
})();
`;

export async function launch({ width = 1040, height = 660 } = {}) {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--font-render-hinting=none',
      '--hide-scrollbars',
      '--force-device-scale-factor=2',
      '--disable-features=Translate',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument(OVERLAY_SCRIPT);
  // the demo remembers the theme per browser: every clip starts in light
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('inkstone-theme', 'light');
    } catch {}
  });
  return { browser, page };
}

export async function login(page, user = USER) {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  const status = await page.evaluate(async (u) => {
    const res = await fetch('/api/wiki/auth/dev', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(u),
    });
    return res.status;
  }, user);
  if (status !== 200) throw new Error(`dev login failed: ${status}`);
}

export async function open(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0' });
  await sleep(300);
}

/** instant scroll so that `selector` sits `offset` px below the viewport top */
export async function scrollToSel(page, selector, offset = 80) {
  await page.evaluate(
    (sel, off) => {
      const el = document.querySelector(sel);
      const y = el.getBoundingClientRect().top + window.scrollY - off;
      window.scrollTo({ top: y, behavior: 'instant' });
    },
    selector,
    offset,
  );
  await sleep(150);
}

/** eased scroll by dy over `duration` ms (visible in the recording) */
export async function smoothScrollBy(page, dy, duration = 600) {
  const steps = Math.max(6, Math.round(duration / 33));
  let done = 0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const target = Math.round(dy * eased);
    await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'instant' }), target - done);
    done = target;
    await sleep(duration / steps);
  }
}

export class Cursor {
  constructor(page) {
    this.page = page;
    this.x = -100;
    this.y = -100;
  }
  async place(x, y) {
    this.x = x;
    this.y = y;
    await this.page.mouse.move(x, y);
    await this.page.evaluate((x, y) => window.__recCursorMove?.(x, y), x, y);
  }
  /** re-draw at the last position (after a reload / navigation) */
  async restore() {
    await this.page.evaluate((x, y) => window.__recCursorMove?.(x, y), this.x, this.y);
  }
  async hide() {
    await this.page.evaluate(() => window.__recCursorHide?.());
  }
  async moveTo(x, y, { duration = 500 } = {}) {
    const x0 = this.x, y0 = this.y;
    const steps = Math.max(8, Math.round(duration / 25));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const cx = x0 + (x - x0) * e, cy = y0 + (y - y0) * e;
      await this.page.mouse.move(cx, cy);
      await this.page.evaluate((x, y) => window.__recCursorMove?.(x, y), cx, cy);
      await sleep(duration / steps);
    }
    this.x = x;
    this.y = y;
  }
  async click({ settle = 120 } = {}) {
    await this.page.evaluate((x, y) => window.__recCursorClick?.(x, y), this.x, this.y);
    await this.page.mouse.down();
    await sleep(70);
    await this.page.mouse.up();
    await sleep(settle);
  }
}

/** viewport-relative center of the first element matching `selector` */
export async function centerOf(page, selector, { dx = 0, dy = 0 } = {}) {
  const r = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }, selector);
  if (!r) throw new Error(`no element for ${selector}`);
  return { x: r.x + r.w / 2 + dx, y: r.y + r.h / 2 + dy, rect: r };
}

/** the block element that carries a given data-wiki-src range, by text match */
export async function blockRect(page, match) {
  const r = await page.evaluate((m) => {
    const re = new RegExp(m);
    for (const el of document.querySelectorAll('[data-wiki-src]')) {
      if (el.tagName === 'TEMPLATE') continue;
      if (re.test(el.textContent || '')) {
        const b = el.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      }
    }
    return null;
  }, match);
  if (!r) throw new Error(`no block matching ${match}`);
  return r;
}

/** hover a block (by text regex), glide to the ✎ handle, click, wait for the editor */
export async function openEditor(page, cursor, match, { hoverAt = 0.25 } = {}) {
  const b = await blockRect(page, match);
  await cursor.moveTo(b.x + b.w * hoverAt, b.y + Math.min(b.h / 2, 14), { duration: 650 });
  await sleep(500);
  const h = await centerOf(page, '.wiki-handle button:not([hidden])');
  await cursor.moveTo(h.x, h.y, { duration: 420 });
  await sleep(260);
  await cursor.click();
  await page.waitForSelector('.wiki-editor-cm .cm-content', { timeout: 8000 });
  await page.waitForFunction(() => {
    const p = document.querySelector('.wiki-editor-preview');
    return p && p.children.length > 0 && !p.querySelector('.empty');
  }, { timeout: 8000 });
  await sleep(350);
}

export async function focusEditorEnd(page) {
  await page.click('.wiki-editor-cm .cm-content');
  await page.keyboard.down('Control');
  await page.keyboard.press('End');
  await page.keyboard.up('Control');
}

export async function type(page, text, delay = 55) {
  await page.keyboard.type(text, { delay });
}

/** click Save with the cursor and wait for the page to come back re-rendered */
export async function saveAndReload(page, cursor) {
  // the source pane grows while typing: bring the foot back into view first
  const vh = page.viewport().height;
  const probe = await centerOf(page, '.wiki-editor-foot .wiki-btn-primary');
  if (probe.y > vh - 36) await smoothScrollBy(page, probe.y - (vh - 80), 500);
  const s = await centerOf(page, '.wiki-editor-foot .wiki-btn-primary');
  await cursor.moveTo(s.x, s.y, { duration: 520 });
  await sleep(200);
  const nav = page.waitForNavigation({ waitUntil: 'load', timeout: 20000 }).catch(() => null);
  await cursor.click();
  await nav;
  await page.waitForFunction(
    () => !document.querySelector('.wiki-editor') && document.readyState === 'complete',
    { timeout: 20000 },
  );
  await page.evaluate(() => document.fonts.ready);
  await sleep(500);
  await cursor.restore();
}


/**
 * Frame-accurate screencast: every frame Chrome paints is stored as PNG with
 * its real timestamp; stop() assembles the clip with ffmpeg from a concat
 * list carrying the true per-frame durations, so the output runs at the speed
 * the session actually ran.
 */
export async function startRecording(page, outPath, { fps = 15, width = null, crop = null, quality = 'gif' } = {}) {
  const dir = outPath.replace(/\.[a-z0-9]+$/i, '') + '.frames';
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const cdp = await page.createCDPSession();
  const frames = [];
  let n = 0;
  const pending = [];
  cdp.on('Page.screencastFrame', (ev) => {
    const i = n++;
    const file = path.join(dir, `f${String(i).padStart(5, '0')}.png`);
    frames.push({ file, t: ev.metadata.timestamp, w: Date.now() / 1000 });
    pending.push(writeFile(file, Buffer.from(ev.data, 'base64')));
    cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  await sleep(400);
  /** piecewise playback speed: from this wall-clock moment on, play at `speed` */
  const marks = [];
  return {
    setSpeed(speed) {
      marks.push({ w: Date.now() / 1000, speed });
    },
    async stop({ tail = 0.6, speed = 1 } = {}) {
      const tEnd = Date.now() / 1000;
      const speedAt = (w) => {
        let s = speed;
        for (const m of marks) if (m.w <= w) s = m.speed;
        return s;
      };
      await sleep(120);
      await cdp.send('Page.stopScreencast').catch(() => {});
      await Promise.all(pending);
      await cdp.detach().catch(() => {});
      if (frames.length < 2) throw new Error('no frames captured');
      // concat list with real durations; the last frame holds for `tail`
      const lines = ['ffconcat version 1.0'];
      for (let i = 0; i < frames.length; i++) {
        const d = (i + 1 < frames.length ? frames[i + 1].t - frames[i].t : Math.min(tail, tEnd - frames[i].w)) / speedAt(frames[i].w);
        lines.push(`file '${path.basename(frames[i].file)}'`, `duration ${Math.max(0.001, d).toFixed(4)}`);
      }
      lines.push(`file '${path.basename(frames[frames.length - 1].file)}'`);
      const list = path.join(dir, 'list.ffconcat');
      await writeFile(list, lines.join('\n') + '\n');
      const total = frames[frames.length - 1].t - frames[0].t;
      console.log(`[rec] ${frames.length} frames, ${total.toFixed(2)}s real time, ×${speed} → ${outPath}`);
      // intermediate: lossless-ish mp4 at the capture resolution (for cropping / later encodes)
      const vf = [];
      if (crop) vf.push(`crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`);
      if (width) vf.push(`scale=${width}:-2:flags=lanczos`);
      await run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-vsync', 'vfr', '-vf', [`fps=${fps}`, ...vf].join(',') , '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv444p', outPath]);
      return { dir, frames: frames.length, seconds: total };
    },
  };
}

export function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

export async function stopRecording(rec, opts) {
  return rec.stop(opts);
}

/** mp4 → GIF with a per-clip palette (diff stats, bayer dither) */
export async function toGif(mp4, gif, { fps = 15, width = 1040, colors = 224 } = {}) {
  const vf = `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff:max_colors=${colors}[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
  await run('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-vf', vf, '-loop', '0', gif]);
}

/** put the editor caret right after (or before) the first occurrence of `needle` */
export async function placeCaret(page, needle, { after = true } = {}) {
  const ok = await page.evaluate(
    (needle, after) => {
      const root = document.querySelector('.wiki-editor-cm .cm-content');
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const i = node.data.indexOf(needle);
        if (i < 0) continue;
        const r = document.createRange();
        r.setStart(node, after ? i + needle.length : i);
        r.collapse(true);
        const s = getSelection();
        s.removeAllRanges();
        s.addRange(r);
        root.focus();
        return true;
      }
      return false;
    },
    needle,
    after,
  );
  if (!ok) throw new Error(`caret target not found: ${needle}`);
  await sleep(150);
}
