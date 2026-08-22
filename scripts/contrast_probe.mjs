/**
 * contrast_probe — measures the WCAG contrast of rendered text on every page
 * of a built site, in both themes and at two viewport widths, against the
 * ground the text actually renders on.
 *
 * What is measured: every text node with a rendered box (HTML text and SVG
 * <text>), and every ::before / ::after pseudo-element that carries text.
 * The ground is sampled from pixels, not read from stylesheets (gradients,
 * color-mix(), translucent layers and images all defeat that): the page is
 * rendered with every glyph made transparent and screenshotted, and the
 * pixel under each run's first line box is its ground. The foreground is the
 * computed `color` (SVG: `fill`), composited over that ground when
 * translucent. Rendering waits for fonts and for client-rendered diagrams.
 *
 * What is not measured, by design: text in aria-hidden subtrees and
 * visually-hidden helper text (.sr-only), closed dialogs and closed
 * <details>, and hover/focus states. A run whose color cannot be parsed or
 * whose ground cannot be sampled is a finding, never a skip.
 *
 * Thresholds are WCAG 2.2 AA: 4.5:1 for text, 3:1 for large text (24px, or
 * 18.66px at weight 700).
 *
 * Usage (site-agnostic):
 *   node scripts/contrast_probe.mjs [distDir] [baseUrl] [outFile]
 *     distDir  build output directory, default ./dist
 *     baseUrl  optional address of a running static server; when omitted the
 *              probe serves distDir itself on an ephemeral port
 *     outFile  report file, default contrast-probe.txt
 *   Environment:
 *     CHROME_PATH   Chrome/Chromium executable, default /usr/bin/google-chrome
 *     PROBE_THEMES  comma-separated data-theme values, default "light,dark"
 *     PROBE_WIDTHS  comma-separated viewport widths, default "1440,430"
 * Green means the last line reads TEXT BELOW AA: 0.
 */
import puppeteer from 'puppeteer-core';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

const DIST = process.argv[2] || resolve('dist');
const THEMES = (process.env.PROBE_THEMES || 'light,dark').split(',').map((s) => s.trim()).filter(Boolean);
const WIDTHS = (process.env.PROBE_WIDTHS || '1440,430').split(',').map((s) => Number(s.trim())).filter(Boolean);
const SLICE = 8000; // screenshot height per slice (well under Chrome's texture cap)
const OVERLAP = 120; // sticky chrome at a slice's top is sampled from the previous slice

/* ---------------------------------------------------------------- serve */
let server = null;
let BASE = process.argv[3];
if (!BASE) {
  const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
    '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  };
  server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    for (const candidate of [p, `${p}/index.html`]) {
      try {
        const buf = readFileSync(join(DIST, candidate));
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

function routes(dir, prefix = '') {
  let out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = out.concat(routes(p, `${prefix}/${e}`));
    else if (e === 'index.html') out.push(`${prefix}/`);
  }
  return out;
}

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
  const at = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    const i = y * stride + x * bpp;
    return bpp >= 3 ? [px[i], px[i + 1], px[i + 2]] : [px[i], px[i], px[i]];
  };
  return { width, height, at };
}

/* ---------------------------------------------------------------- color */
const lum = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
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

/* ---------------------------------------------------------------- probe */
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--font-render-hinting=none'],
});
const page = await browser.newPage();

const findings = [];
let measured = 0;
for (const r of routes(DIST)) {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
      await page.goto(BASE + r, { waitUntil: 'load', timeout: 60000 });
      // theme by attribute, transitions off, every glyph transparent: what
      // remains in the screenshot is exactly the ground each text sits on
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
        const st = document.createElement('style');
        st.id = '__probe';
        st.textContent = `*,*::before,*::after{transition:none!important;animation:none!important}`;
        document.head.append(st);
      }, theme);
      await page.evaluate(() => document.fonts.ready);
      // client-rendered diagrams: every mermaid placeholder must have become an svg
      await page.waitForFunction(
        () => [...document.querySelectorAll('pre.mermaid')].every((b) => b.querySelector('svg')),
        { timeout: 15000 },
      ).catch(() => {
        findings.push({ route: r, theme, width, text: '(mermaid diagram)', selector: 'pre.mermaid', color: '', fontSize: 0, fontWeight: 0, x: 0, y: 0, fg: 'diagram not rendered within 15s', bg: '-', ratio: 0, min: 4.5 });
      });
      await new Promise((res) => setTimeout(res, 120));

      // 1) collect text runs in document coordinates (scrollY = 0)
      const runs = await page.evaluate(() => {
        const out = [];
        const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE', 'OPTION', 'TEXTAREA']);
        const hiddenScope = '[aria-hidden="true"], .sr-only, dialog:not([open])';
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
        // A run scrolled out of view inside a horizontal scroll box (a long
        // code line on a phone) has that box's ground: its sample point is
        // the box's visible interior at the run's own line.
        const groundX = (el, x) => {
          if (x >= 1 && x <= window.innerWidth - 1) return x;
          for (let n = el.parentElement; n; n = n.parentElement) {
            const o = getComputedStyle(n).overflowX;
            if (o === 'auto' || o === 'scroll') {
              const b = n.getBoundingClientRect();
              return Math.min(Math.max(b.left + b.width / 2, 1), window.innerWidth - 2);
            }
          }
          return x;
        };
        const isSvgText = (el) => el.namespaceURI === 'http://www.w3.org/2000/svg';
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const text = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
          if (!text) continue;
          const el = n.parentElement;
          if (!el || skipTags.has(el.tagName)) continue;
          if (el.closest(hiddenScope)) continue;
          const cs = getComputedStyle(el);
          if (!visible(cs)) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          const rect = range.getClientRects()[0];
          if (!rect || rect.width < 1 || rect.height < 1) continue;
          out.push({
            text: text.slice(0, 40),
            selector: sel(el),
            color: isSvgText(el) ? cs.fill : cs.color,
            fontSize: parseFloat(cs.fontSize),
            fontWeight: +cs.fontWeight || 400,
            x: groundX(el, rect.left + rect.width / 2) + window.scrollX,
            y: rect.top + rect.height / 2 + window.scrollY,
          });
        }
        // ::before / ::after text: measured at the start / end of the owner's
        // box, where the generated text sits
        for (const el of document.body.querySelectorAll('*')) {
          if (skipTags.has(el.tagName) || el.closest(hiddenScope)) continue;
          for (const pseudo of ['::before', '::after']) {
            const cs = getComputedStyle(el, pseudo);
            const content = cs.content;
            if (!content || content === 'none' || content === 'normal' || !/^["']/.test(content)) continue;
            const text = content.slice(1, -1).replace(/\\(["'])/g, '$1').trim();
            if (!text || !visible(cs)) continue;
            const box = el.getBoundingClientRect();
            if (box.width < 1 || box.height < 1) continue;
            const inset = Math.min(parseFloat(cs.fontSize) * 0.6, box.width / 2);
            out.push({
              text: text.slice(0, 40),
              selector: sel(el) + pseudo,
              color: cs.color,
              fontSize: parseFloat(cs.fontSize),
              fontWeight: +cs.fontWeight || 400,
              x: (pseudo === '::before' ? box.left + inset : box.right - inset) + window.scrollX,
              y: box.top + Math.min(box.height / 2, parseFloat(cs.lineHeight) / 2 || box.height / 2) + window.scrollY,
            });
          }
        }
        return out;
      });

      // 2) hide every glyph and screenshot the document in slices
      await page.evaluate(() => {
        const st = document.getElementById('__probe');
        st.textContent += `*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}svg text{fill:transparent!important}`;
      });
      const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      const shots = [];
      for (let top = 0; top < docHeight; top += SLICE - OVERLAP) {
        const h = Math.min(SLICE, docHeight - top);
        await page.setViewport({ width, height: h, deviceScaleFactor: 1 });
        await page.evaluate((y) => window.scrollTo(0, y), top);
        await new Promise((res) => setTimeout(res, 60));
        const actualTop = await page.evaluate(() => window.scrollY);
        const png = decodePng(await page.screenshot({ type: 'png' }));
        shots.push({ top: actualTop, height: h, png });
        if (actualTop + h >= docHeight) break;
      }
      await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });

      const sample = (x, y) => {
        // prefer the slice where the point is not in the sticky band at the top
        for (let i = shots.length - 1; i >= 0; i--) {
          const s = shots[i];
          const localY = y - s.top;
          if (localY < 0 || localY >= s.height) continue;
          if (i > 0 && localY < OVERLAP) continue;
          return s.png.at(Math.round(x), Math.round(localY));
        }
        const s = shots.find((s) => y >= s.top && y < s.top + s.height);
        return s ? s.png.at(Math.round(x), Math.round(y - s.top)) : null;
      };

      for (const run of runs) {
        const fg = parseColor(run.color);
        const bg = sample(run.x, run.y);
        measured += 1;
        const large = run.fontSize >= 24 || (run.fontSize >= 18.66 && run.fontWeight >= 700);
        const min = large ? 3 : 4.5;
        if (!fg || !bg) {
          findings.push({ route: r, theme, width, ...run, fg: fg ? hex(fg) : `unparsed: ${run.color}`, bg: bg ? hex(bg) : 'unsampled', ratio: 0, min });
          continue;
        }
        const fgOn = fg[3] < 1 ? over(fg, bg) : fg.slice(0, 3);
        const c = ratio(fgOn, bg);
        if (c < min - 0.005) {
          findings.push({ route: r, theme, width, ...run, fg: hex(fgOn), bg: hex(bg), ratio: c, min });
        }
      }
    }
  }
}
await browser.close();
server?.close();

/* --------------------------------------------------------------- report */
const lines = [];
let last = '';
for (const f of findings.sort((a, b) => a.route.localeCompare(b.route) || a.theme.localeCompare(b.theme) || a.width - b.width || a.ratio - b.ratio)) {
  const head = `${f.route} [${f.theme} @${f.width}]`;
  if (head !== last) { lines.push(head); last = head; }
  lines.push(`    ${f.ratio.toFixed(2)}:1 < ${f.min}  ${f.fg} on ${f.bg}  ${f.fontSize}px/${f.fontWeight}  ${f.selector}  "${f.text}"`);
}
lines.push('', `text runs measured: ${measured}`, `TEXT BELOW AA: ${findings.length}`);
writeFileSync(process.argv[4] || 'contrast-probe.txt', lines.join('\n') + '\n');
console.log(lines.slice(0, 80).join('\n'));
if (lines.length > 80) console.log(`… (${lines.length - 80} more lines in the report)`);
process.exitCode = findings.length ? 1 : 0;
