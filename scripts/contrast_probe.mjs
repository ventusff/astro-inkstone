/**
 * contrast_probe — measures the WCAG contrast of rendered text on every page
 * of a built site, in both themes and at two viewport widths, against the
 * ground the text actually renders on.
 *
 * What is measured: every text node with a rendered box (HTML text and SVG
 * <text>), and every ::before / ::after pseudo-element that carries text.
 * The ground is sampled from pixels, not read from stylesheets (gradients,
 * color-mix(), translucent layers and images all defeat that): the page is
 * rendered with every glyph made transparent and screenshotted by scrolling
 * a constant-size viewport (so nothing viewport-anchored moves between
 * collection and sampling), and the pixel under each of a run's line boxes
 * is that line's ground. The foreground is the
 * computed `color` (SVG: `fill`), composited over that ground when
 * translucent. Rendering waits for fonts and for client-rendered diagrams.
 *
 * Translucency is part of the measurement: a run's foreground alpha is its
 * color's alpha times the accumulated `opacity` of the element and its
 * ancestors, composited over the sampled ground. (Exact when the translucent
 * ancestors paint no background of their own — the common text-dimming case;
 * a translucent group with its own background composites its glyphs a step
 * earlier, which this model approximates.) A fixed-position overlay (a
 * floating chip, a corner badge) is measured in place from a dedicated
 * shot and hidden while the document is swept: its opaque face is the
 * ground of its own text, never of the text it happens to occlude at some
 * scroll offset — occluded text is invisible there, not low-contrast.
 * Dialogs and popovers are probed
 * too: on one representative route per theme and width the probe opens
 * every `<dialog data-probe-open>` (typing a query into a search box it
 * finds there) and, in a separate pass, every `[popover][data-probe-open]`
 * (a language menu, say), and measures the text inside. The marker is the
 * site's declaration that the surface is complete as authored; one whose
 * real state the probe cannot construct (a lightbox that only ever opens
 * holding an image) carries no marker and is reviewed by eye.
 *
 * What is not measured, by design: visually-hidden helper text (.sr-only,
 * .visually-hidden), closed <details>, and hover/focus states — those are
 * reviewed, not probed. aria-hidden text IS measured when it renders:
 * hiding from the accessibility tree does not hide from sighted readers. A
 * run whose color cannot be parsed or whose ground cannot be sampled is a
 * finding, never a skip.
 *
 * A route is loaded once per tab and re-measured in place: the theme is
 * switched by attribute, the viewport resized, the glyph-hiding rules
 * removed again after each sweep. Routes are probed concurrently, longest
 * pages first: each worker is a browser process of its own (screenshots
 * serialize inside one browser) with a thread decoding its screenshots.
 *
 * Thresholds are WCAG 2.2 AA: 4.5:1 for text, 3:1 for large text (24px, or
 * 18.66px at weight 700).
 *
 * Usage (site-agnostic):
 *   node scripts/contrast_probe.mjs [distDir] [baseUrl] [outFile] [--exclude <route regex>]
 *     distDir  build output directory, default ./dist
 *     baseUrl  optional address of a running static server; when omitted the
 *              probe serves distDir itself on an ephemeral port
 *     outFile  report file, default contrast-probe.txt
 *   Environment:
 *     CHROME_PATH    Chrome/Chromium executable, default /usr/bin/google-chrome
 *     PROBE_THEMES   comma-separated data-theme values, default "light,dark"
 *     PROBE_WIDTHS   comma-separated viewport widths, default "1440,430"
 *     PROBE_WORKERS  tabs probing concurrently, default one per core
 * Green means the last line reads TEXT BELOW AA: 0. Progress is written to
 * stderr.
 */
import puppeteer from 'puppeteer-core';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { availableParallelism } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { inflateSync } from 'node:zlib';

// --exclude <regex>: routes matching it are not probed. A site with many
// locale trees probes a representative subset by default and passes nothing
// here for the full run.
const __argv = process.argv.slice(2);
const __ex = __argv.indexOf('--exclude');
const EXCLUDE = __ex >= 0 ? new RegExp(__argv.splice(__ex, 2)[1]) : null;

const DIST = __argv[0] || resolve('dist');
const THEMES = (process.env.PROBE_THEMES || 'light,dark').split(',').map((s) => s.trim()).filter(Boolean);
const WIDTHS = (process.env.PROBE_WIDTHS || '1440,430').split(',').map((s) => Number(s.trim())).filter(Boolean);
// one worker per core: a tab's work is latency-bound, so fewer leaves cores
// idle; many more starves the renderers
const WORKERS = Math.max(1, Number(process.env.PROBE_WORKERS) || availableParallelism());
const VIEW = 900; // the one viewport height: collection and screenshots share it
const OVERLAP = 120; // sticky chrome at a shot's top is sampled from the previous shot
// the address pages are loaded from: an already-running server, or the one
// the main thread starts over DIST
let BASE = null;

/* ------------------------------------------------------------ png decode */
/** Minimal PNG decoder for Chrome screenshots (8-bit RGB/RGBA, non-interlaced). */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8;
  let width = 0, height = 0, colorType = 0, bitDepth = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (bitDepth !== 8 || data[12] !== 0) throw new Error(`unsupported PNG (depth ${bitDepth}, interlace ${data[12]})`);
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const bpp = { 2: 3, 6: 4, 0: 1, 4: 2 }[colorType];
  if (!bpp) throw new Error(`unsupported PNG color type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const px = Buffer.alloc(stride * height);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = px.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      switch (filter) {
        case 0: break;
        case 1: v += a; break;
        case 2: v += b; break;
        case 3: v += (a + b) >> 1; break;
        case 4: { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; break; }
        default: throw new Error(`bad PNG filter ${filter}`);
      }
      cur[x] = v & 0xff;
    }
    prev = cur;
  }
  return { width, height, bpp, px };
}

/** A decoded shot: `at(x, y)` is the pixel's [r, g, b], null outside. */
const image = ({ width, height, bpp, px }) => ({
  at: (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    const i = (y * width + x) * bpp;
    return bpp >= 3 ? [px[i], px[i + 1], px[i + 2]] : [px[i], px[i], px[i]];
  },
});

/** A decode thread: PNG bytes in, the pixel buffer out (transferred). */
function decoder() {
  const thread = new Worker(new URL(import.meta.url));
  const pending = new Map();
  let seq = 0;
  thread.on('message', (m) => {
    const p = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) p.reject(new Error(m.error));
    else p.resolve(image(m));
  });
  thread.on('error', (e) => {
    for (const p of pending.values()) p.reject(e);
    pending.clear();
  });
  return {
    decode: (png) => new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      thread.postMessage({ id, png });
    }),
    close: () => thread.terminate(),
  };
}

if (!isMainThread) {
  parentPort.on('message', ({ id, png }) => {
    try {
      const { width, height, bpp, px } = decodePng(Buffer.from(png.buffer, png.byteOffset, png.byteLength));
      parentPort.postMessage({ id, width, height, bpp, px }, [px.buffer]);
    } catch (e) {
      parentPort.postMessage({ id, error: String(e) });
    }
  });
}

/* ---------------------------------------------------------------- color */
const lum = ([r, g, b]) => {
  // sRGB linearization (IEC 61966-2-1 breakpoint 0.04045)
  const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
/** "rgb(…)" / "rgba(…)" / "color(srgb …)" → [r,g,b,a] */
function parseColor(s) {
  let m = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(s);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  m = /^rgba?\(([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\)$/.exec(s);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]];
  m = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\)$/.exec(s);
  if (m) return [+m[1] * 255, +m[2] * 255, +m[3] * 255, m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]];
  return null;
}
const over = (fg, bg) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]));

/* ------------------------------------------------------- page-side steps */
// Evaluated inside the page: each function is self-contained.

/** The probe's stylesheet, by state. `base` is in force for the whole
 *  visit; `glyphs` is appended for a sweep (-webkit-text-fill-color hides
 *  glyphs while `color` still paints currentColor borders and icons — the
 *  ground keeps every non-text ink); `fixed` hides the marked overlays. */
const RULES = {
  base: '*,*::before,*::after{transition:none!important;animation:none!important}',
  glyphs: '*{-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}svg text{fill:transparent!important}',
  fixed: '[data-probe-fixed]{visibility:hidden!important}',
};
const setTheme = (t, base) => {
  document.documentElement.dataset.theme = t;
  // theme-reactive renderers (canvas demos, mermaid) listen for this
  window.dispatchEvent(new CustomEvent('themechange', { detail: t }));
  let st = document.getElementById('__probe');
  if (!st) {
    st = document.createElement('style');
    st.id = '__probe';
    document.head.append(st);
  }
  st.textContent = base;
};
const appendRule = (rule) => { document.getElementById('__probe').textContent += rule; };
const resetRules = (base) => { document.getElementById('__probe').textContent = base; };
const mermaidRendered = () => [...document.querySelectorAll('pre.mermaid')].every((b) => b.querySelector('svg'));
const twoFrames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const scrollTop = () => window.scrollTo(0, 0);

/** open every marked dialog; a search box inside gets a query so result
 *  rows render and are measured too */
const openDialogs = () => {
  const dialogs = [...document.querySelectorAll('dialog[data-probe-open]:not([open])')];
  for (const d of dialogs) {
    try { d.showModal(); } catch { d.setAttribute('open', ''); }
    const input = d.querySelector('input[type="search"], input[type="text"], input:not([type])');
    if (input) {
      input.value = 'the';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  return dialogs.length;
};
const closeDialogs = () => {
  for (const d of document.querySelectorAll('dialog[data-probe-open][open]')) {
    try { d.close(); } catch { /* not a dialog the UA can close */ }
    d.removeAttribute('open');
  }
};
/** open every marked popover (in its own pass — a modal dialog would sit
 *  in the same top layer and shadow the sample points) */
const openPopovers = () => {
  const pops = [...document.querySelectorAll('[popover][data-probe-open]')];
  for (const p of pops) {
    try { p.showPopover(); } catch { /* unsupported or already open */ }
  }
  return pops.length;
};
const closePopovers = () => {
  for (const p of document.querySelectorAll('[popover][data-probe-open]')) {
    try { p.hidePopover(); } catch { /* not open */ }
  }
};

/** Fixed-position overlays float over whatever scrolls past — their face
 *  is the ground of their own text only. Marked (outermost element only)
 *  so their runs are sampled from a dedicated shot and the sweep hides
 *  them; re-marked per sample, since a rule can fix an element at one
 *  width only. Returns how many are marked. */
const markFixed = () => {
  for (const el of document.querySelectorAll('[data-probe-fixed]')) el.removeAttribute('data-probe-fixed');
  let n = 0;
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('dialog, [popover], [data-probe-fixed]')) continue;
    if (getComputedStyle(el).position !== 'fixed') continue;
    el.setAttribute('data-probe-fixed', '');
    n++;
  }
  return n;
};

/** collect text runs in document coordinates (scrollY = 0) */
const collectRuns = (scope) => {
  const out = [];
  const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE', 'OPTION', 'TEXTAREA']);
  const hiddenScope =
    scope === 'dialogs' ? '.sr-only, .visually-hidden' : '.sr-only, .visually-hidden, dialog:not([open])';
  const inScope = (el) =>
    scope === 'dialogs'
      ? Boolean(el.closest('dialog[open]'))
      : scope === 'popovers'
        ? Boolean(el.closest('[popover]'))
        : true;
  // effective opacity: the product over the element and its ancestors
  const alphaCache = new Map();
  const effAlpha = (el) => {
    if (!el || el === document.documentElement) return 1;
    let a = alphaCache.get(el);
    if (a === undefined) {
      a = (+getComputedStyle(el).opacity || 0) * effAlpha(el.parentElement);
      alphaCache.set(el, a);
    }
    return a;
  };
  const sel = (el) => {
    const parts = [];
    let e = el;
    while (e && e !== document.body && parts.length < 4) {
      let s = e.tagName.toLowerCase();
      if (e.classList.length) s += '.' + [...e.classList].slice(0, 2).join('.');
      parts.unshift(s);
      e = e.parentElement;
    }
    return parts.join(' > ');
  };
  const visible = (cs) => cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0;
  // A run scrolled out of view inside a scroll box (a long code line on
  // a phone, a result row below a palette's list) has that box's
  // ground: its sample point is clamped into the box's visible
  // interior, on each scrolling axis.
  const groundPoint = (el, x, y) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const b = n.getBoundingClientRect();
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && (x < b.left + 1 || x > b.right - 1)) {
        x = Math.min(Math.max(b.left + b.width / 2, 1), window.innerWidth - 2);
      }
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && (y < b.top + 1 || y > b.bottom - 1)) {
        y = Math.min(Math.max(y, b.top + 8), b.bottom - 8);
      }
    }
    return [x, y];
  };
  const isSvgText = (el) => el.namespaceURI === 'http://www.w3.org/2000/svg';
  // The visible portion of a rect: its intersection with every
  // clipping ancestor's content box (client metrics — borders and
  // classic scrollbars excluded). A glyph a scroll box or an
  // ellipsis clipped away is not rendered text, and a sample offset
  // stepping past the clip edge lands on border hairlines — the rect
  // that gets sampled must be the rect the reader can see.
  const visibleRect = (el, rect) => {
    let L = rect.left, T = rect.top, R = rect.right, B = rect.bottom;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = getComputedStyle(n);
      const clips =
        c.overflowX !== 'visible' || c.overflowY !== 'visible' || c.clip !== 'auto' || c.clipPath !== 'none';
      if (!clips) continue;
      const b = n.getBoundingClientRect();
      const cl = b.left + n.clientLeft;
      const ct = b.top + n.clientTop;
      if (c.overflowX !== 'visible' || c.clip !== 'auto' || c.clipPath !== 'none') {
        L = Math.max(L, cl);
        R = Math.min(R, cl + n.clientWidth);
      }
      if (c.overflowY !== 'visible' || c.clip !== 'auto' || c.clipPath !== 'none') {
        T = Math.max(T, ct);
        B = Math.min(B, ct + n.clientHeight);
      }
    }
    return { left: L, top: T, width: R - L, height: B - T };
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const el = n.parentElement;
    if (!el || skipTags.has(el.tagName)) continue;
    if (el.closest(hiddenScope) || !inScope(el)) continue;
    const cs = getComputedStyle(el);
    if (!visible(cs)) continue;
    const alpha = effAlpha(el);
    if (alpha === 0) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    // every line box is a sample: wrapped text can cross grounds
    for (const raw of range.getClientRects()) {
      if (raw.width < 1 || raw.height < 1) continue;
      const rect = visibleRect(el, raw);
      if (rect.width < 1 || rect.height < 1) continue;
      out.push({
        text: text.slice(0, 40),
        selector: sel(el),
        color: isSvgText(el) ? cs.fill : cs.color,
        alpha,
        fontSize: parseFloat(cs.fontSize),
        fontWeight: +cs.fontWeight || 400,
        fixd: Boolean(el.closest('[data-probe-fixed]')),
        ...(() => {
          const cx = rect.left + rect.width / 2;
          const [gx, gy] = groundPoint(el, cx, rect.top + rect.height / 2);
          // a clamped point sits in a scroll box: only its own pixel is
          // safe; the sweep width shrinks past the clip edges too
          return { x: gx + window.scrollX, y: gy + window.scrollY, w: gx === cx ? rect.width - 2 : 0 };
        })(),
      });
    }
  }
  // ::before / ::after text: measured at the start / end of the owner's
  // box, where the generated text sits
  for (const el of document.body.querySelectorAll('*')) {
    if (skipTags.has(el.tagName) || el.closest(hiddenScope) || !inScope(el)) continue;
    for (const pseudo of ['::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      const content = cs.content;
      if (!content || content === 'none' || content === 'normal' || !/^["']/.test(content)) continue;
      const text = content.slice(1, -1).replace(/\\(["'])/g, '$1').trim();
      if (!text || !visible(cs)) continue;
      const alpha = (+cs.opacity || 0) * effAlpha(el);
      if (alpha === 0) continue;
      const box = visibleRect(el, el.getBoundingClientRect());
      if (box.width < 1 || box.height < 1) continue;
      const inset = Math.min(parseFloat(cs.fontSize) * 0.6, box.width / 2);
      out.push({
        text: text.slice(0, 40),
        selector: sel(el) + pseudo,
        color: cs.color,
        alpha,
        fontSize: parseFloat(cs.fontSize),
        fontWeight: +cs.fontWeight || 400,
        fixd: Boolean(el.closest('[data-probe-fixed]')),
        ...(() => {
          const [gx, gy] = groundPoint(
            el,
            pseudo === '::before' ? box.left + inset : box.left + box.width - inset,
            box.top + Math.min(box.height / 2, parseFloat(cs.lineHeight) / 2 || box.height / 2),
          );
          return { x: gx + window.scrollX, y: gy + window.scrollY, w: 0 };
        })(),
      });
    }
  }
  return out;
};

/* ---------------------------------------------------------- measurement */
/** every run against the ground under it; findings go to `push` */
function measure(runs, shots, fixedShot, where, push) {
  const sample = (x, y) => {
    // prefer the slice where the point is not in the sticky band at the top
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      const localY = y - s.top;
      if (localY < 0 || localY >= s.height) continue;
      if (i > 0 && localY < OVERLAP) continue;
      return s.png.at(Math.round(x), Math.min(Math.round(localY), s.height - 1));
    }
    const s = shots.find((s) => y >= s.top && y < s.top + s.height);
    return s ? s.png.at(Math.round(x), Math.min(Math.round(y - s.top), s.height - 1)) : null;
  };
  let measured = 0;
  for (const run of runs) {
    const fg = parseColor(run.color);
    measured += 1;
    const large = run.fontSize >= 24 || (run.fontSize >= 18.66 && run.fontWeight >= 700);
    const min = large ? 3 : 4.5;
    // the worst pixel wins: a line box over a gradient or a seam is
    // sampled at several points across its width
    const half = Math.max((run.w ?? 0) / 2 - 2, 0);
    const offsets = half > 4 ? [-half, -half / 2, 0, half / 2, half] : [0];
    // a fixed overlay's runs come from its dedicated shot (viewport
    // coordinates — the collection scroll was 0)
    const px = (x, y) =>
      run.fixd && fixedShot
        ? fixedShot.at(Math.round(x), Math.min(Math.round(y), VIEW - 1))
        : sample(x, y);
    let worst = null;
    let worstBg = null;
    for (const dx of offsets) {
      const bg = px(run.x + dx, run.y);
      if (!bg) continue;
      worstBg = bg;
      if (!fg) break;
      const a = fg[3] * (run.alpha ?? 1);
      const fgOn = a < 1 ? over([fg[0], fg[1], fg[2], a], bg) : fg.slice(0, 3);
      const c = ratio(fgOn, bg);
      if (worst === null || c < worst.ratio) worst = { ratio: c, fgOn, bg };
    }
    if (!fg || worst === null) {
      push({ ...where, ...run, fg: fg ? hex(fg) : `unparsed: ${run.color}`, bg: worstBg ? hex(worstBg) : 'unsampled', ratio: 0, min });
      continue;
    }
    if (worst.ratio < min) {
      push({ ...where, ...run, fg: hex(worst.fgOn), bg: hex(worst.bg), ratio: worst.ratio, min });
    }
  }
  return measured;
}

/* ---------------------------------------------------------------- probe */
/**
 * One route on one tab: load once, then for every theme and width sweep
 * the document — and, on the representative route, the open dialogs and
 * the open popovers in passes of their own. Returns the number of runs
 * measured; findings go to `push`.
 */
async function probeRoute(page, tools, route, isFirst) {
  const { quiet, decode, push } = tools;
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  // a slice is captured before the tab scrolls on; the decode thread works
  // on it while the next slice is captured
  const shoot = () => page.screenshot({ type: 'png', optimizeForSpeed: true });
  const scopes = isFirst ? ['document', 'dialogs', 'popovers'] : ['document'];
  let measured = 0;

  await page.setViewport({ width: WIDTHS[0], height: VIEW, deviceScaleFactor: 1 });
  await page.goto(BASE + route, { waitUntil: 'load', timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  for (const theme of THEMES) {
    await page.evaluate(setTheme, theme, RULES.base);
    // client-rendered diagrams: every mermaid placeholder must have become an svg
    await page.waitForFunction(mermaidRendered, { timeout: 15_000 }).catch(() => {
      push({ route, theme, width: WIDTHS[0], text: '(mermaid diagram)', selector: 'pre.mermaid', color: '', fontSize: 0, fontWeight: 0, x: 0, y: 0, fg: 'diagram not rendered within 15s', bg: '-', ratio: 0, min: 4.5 });
    });
    // theme-reactive renderers redraw on the event with no completion signal
    await sleep(150);
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: VIEW, deviceScaleFactor: 1 });
      await page.evaluate(twoFrames);
      await quiet(150, 2_000);
      for (const scope of scopes) {
        await page.evaluate(scrollTop);
        if (scope === 'dialogs') {
          if (!(await page.evaluate(openDialogs))) continue;
          // a search box fetches its index and renders rows: wait for the
          // network to settle instead of guessing a delay
          await quiet(300, 5_000);
          await sleep(150);
        } else if (scope === 'popovers') {
          if (!(await page.evaluate(openPopovers))) continue;
          await sleep(150);
        }
        const overlays = await page.evaluate(markFixed);
        const runs = await page.evaluate(collectRuns, scope);

        // hide every glyph and screenshot the document in slices
        await page.evaluate(appendRule, RULES.glyphs);
        // fixed overlays: one shot with them in place — the ground of their
        // own text — then hidden for the sweep, so their face never stands
        // in as the ground of text they merely occlude
        let fixedShot = null;
        if (overlays > 0) {
          await page.evaluate(scrollTop);
          await page.evaluate(twoFrames);
          fixedShot = decode(await shoot());
          await page.evaluate(appendRule, RULES.fixed);
        }
        // a modal dialog sits in the top layer at viewport coordinates: its
        // pass keeps the collection viewport so nothing moves between the
        // run collection and the screenshot
        const docHeight = scope === 'dialogs' ? VIEW : await page.evaluate(() => document.documentElement.scrollHeight);
        const shots = [];
        for (let top = 0; top < docHeight; top += VIEW - OVERLAP) {
          await page.evaluate((y) => window.scrollTo(0, y), top);
          await page.evaluate(twoFrames);
          const actualTop = await page.evaluate(() => window.scrollY);
          shots.push({ top: actualTop, height: VIEW, png: decode(await shoot()) });
          if (actualTop + VIEW >= docHeight) break;
        }
        await page.evaluate(resetRules, RULES.base);
        if (scope === 'dialogs') await page.evaluate(closeDialogs);
        else if (scope === 'popovers') await page.evaluate(closePopovers);

        for (const s of shots) s.png = await s.png;
        measured += measure(runs, shots, await fixedShot, { route, theme, width }, push);
      }
    }
  }
  return measured;
}

if (isMainThread) {
  /* -------------------------------------------------------------- serve */
  let server = null;
  BASE = __argv[1];
  if (!BASE) {
    const MIME = {
      '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
      '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
      '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
      '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
    };
    // requests are confined to DIST: no traversal segments, and every resolved
    // path must stay inside it
    const root = resolve(DIST);
    server = createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      for (const candidate of [p, `${p}/index.html`]) {
        const abs = resolve(root, `.${candidate}`);
        if (candidate.split('/').includes('..') || abs !== root && !abs.startsWith(root + sep)) break;
        try {
          const buf = readFileSync(abs);
          res.setHeader('content-type', MIME[extname(candidate)] ?? 'application/octet-stream');
          return res.end(buf);
        } catch { /* try next */ }
      }
      res.statusCode = 404;
      res.end('not found');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    BASE = `http://127.0.0.1:${server.address().port}`;
  }

  const routes = (dir, prefix = '') => {
    let out = [];
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) out = out.concat(routes(p, `${prefix}/${e}`));
      else if (e === 'index.html') out.push(`${prefix}/`);
      else if (e.endsWith('.html')) out.push(`${prefix}/${e}`); // flat pages, 404.html
    }
    return out.sort(); // deterministic order — the dialog pass runs on the first route
  };

  /* -------------------------------------------------------------- sweep */
  const routeList = routes(DIST).filter((r) => !EXCLUDE || !EXCLUDE.test(r));
  // the work list: longest pages first, so no worker is left sweeping a
  // long page alone at the end (the representative route stays the first
  // route in sorted order)
  const size = (r) => statSync(join(DIST, r.endsWith('/') ? `${r}index.html` : r)).size;
  const work = [...routeList].sort((a, b) => size(b) - size(a));
  const findings = [];
  const push = (f) => { findings.push(f); };
  let measured = 0;
  const t0 = Date.now();
  let next = 0;
  let done = 0;
  const progress = () => {
    done += 1;
    const step = Math.max(1, Math.ceil(routeList.length / 10));
    if (done % step === 0 || done === routeList.length)
      console.error(`contrast_probe: ${done}/${routeList.length} routes · ${Math.round((Date.now() - t0) / 1000)}s`);
  };

  try {
    // A worker is a browser of its own plus one decode thread, taking
    // routes off the shared work list until it is empty.
    const worker = async () => {
      const browser = await puppeteer.launch({
        executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--font-render-hinting=none'],
      });
      const page = await browser.newPage();
      const dec = decoder();
      // Quiet-period wait keyed on request ARRIVALS, not on the in-flight
      // count: a request that never settles must cost its own page at most
      // once — never the whole run.
      let lastRequest = Date.now();
      page.on('request', () => { lastRequest = Date.now(); });
      const quiet = async (idleMs, capMs) => {
        const start = Date.now();
        while (Date.now() - lastRequest < idleMs && Date.now() - start < capMs) {
          await new Promise((res) => setTimeout(res, 50));
        }
      };
      const tools = { quiet, decode: dec.decode, push };
      try {
        for (let i = next++; i < work.length; i = next++) {
          const n = await probeRoute(page, tools, work[i], work[i] === routeList[0]);
          measured += n;
          progress();
        }
      } finally {
        await dec.close();
        await browser.close();
      }
    };
    await Promise.all(Array.from({ length: Math.min(WORKERS, work.length) }, worker));
  } finally {
    server?.close();
  }

  /* ------------------------------------------------------------- report */
  const lines = [];
  let last = '';
  for (const f of findings.sort((a, b) => a.route.localeCompare(b.route) || a.theme.localeCompare(b.theme) || a.width - b.width || a.ratio - b.ratio)) {
    const head = `${f.route} [${f.theme} @${f.width}]`;
    if (head !== last) { lines.push(head); last = head; }
    lines.push(`    ${f.ratio.toFixed(2)}:1 < ${f.min}  ${f.fg} on ${f.bg}  ${f.fontSize}px/${f.fontWeight}  ${f.selector}  "${f.text}"`);
  }
  lines.push('', `text runs measured: ${measured}`, `TEXT BELOW AA: ${findings.length}`);
  writeFileSync(__argv[2] || 'contrast-probe.txt', lines.join('\n') + '\n');
  console.log(lines.slice(0, 80).join('\n'));
  if (lines.length > 80) console.log(`… (${lines.length - 80} more lines in the report)`);
  process.exitCode = findings.length ? 1 : 0;
}
