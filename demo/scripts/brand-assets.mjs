/**
 * Brand assets for the demo's <head>, written under public/ and committed:
 * the inkstone mark as favicon.svg, rasterized to the PNG sizes search
 * results (48px) and home screens (180px) want, and the Open Graph card
 * (1200×600 — the 2:1 every card renderer accepts): the name, the promise,
 * and a slice of a note page, typeset in the site's own faces and rendered
 * by headless Chrome. Re-run after changing the mark, the copy or the
 * screenshot it quotes.
 *
 *   node scripts/brand-assets.mjs
 *   env CHROME_PATH   Chrome/Chromium executable, default /usr/bin/google-chrome
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));
const fontFile = (pkg, file) => fileURLToPath(new URL(`../node_modules/${pkg}/files/${file}`, import.meta.url));
/** the note-page screenshot the card quotes (the README's demo preview) */
const NOTE_SHOT = fileURLToPath(new URL('../../.github/assets/demo-preview.png', import.meta.url));

/** the mark: a diamond outline around a solid diamond, in 朱 (the browse
 *  shelf's wine-red); `ground` paints the paper behind it for raster sizes */
const mark = (ground) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">${
  ground ? `<rect width="20" height="20" rx="4" fill="${ground}"/>` : ''
}<path d="M10 2.2 17.8 10 10 17.8 2.2 10Z" fill="none" stroke="#7d3a3a" stroke-width="1.6"/><path d="M10 6.4 13.6 10 10 13.6 6.4 10Z" fill="#7d3a3a"/></svg>`;

writeFileSync(out('favicon.svg'), mark(null) + '\n');
for (const [name, size] of [
  ['favicon-48.png', 48],
  ['apple-touch-icon.png', 180],
]) {
  await sharp(Buffer.from(mark('#faf6ec'))).resize(size, size).png().toFile(out(name));
}

const dataUrl = (path, mime) => `data:${mime};base64,${readFileSync(path).toString('base64')}`;
const serif = dataUrl(fontFile('@fontsource-variable/source-serif-4', 'source-serif-4-latin-opsz-normal.woff2'), 'font/woff2');
const serifItalic = dataUrl(fontFile('@fontsource-variable/source-serif-4', 'source-serif-4-latin-opsz-italic.woff2'), 'font/woff2');
const sans = dataUrl(fontFile('@fontsource-variable/inter', 'inter-latin-wght-normal.woff2'), 'font/woff2');
const shot = dataUrl(NOTE_SHOT, 'image/png');

const card = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'Source Serif 4 Variable';src:url(${serif}) format('woff2');font-weight:200 900;font-style:normal}
@font-face{font-family:'Source Serif 4 Variable';src:url(${serifItalic}) format('woff2');font-weight:200 900;font-style:italic}
@font-face{font-family:'Inter Variable';src:url(${sans}) format('woff2');font-weight:100 900}
html,body{margin:0;width:1200px;height:600px;overflow:hidden}
body{background:#faf6ec;color:#2b2622;font-family:'Source Serif 4 Variable',Georgia,serif;position:relative}
.text{position:absolute;left:72px;top:64px;width:600px}
.name{display:flex;align-items:center;gap:14px;font-family:'Inter Variable',system-ui,sans-serif;font-weight:600;font-size:26px;letter-spacing:.01em}
.name svg{width:34px;height:34px}
h1{margin:34px 0 0;font-size:64px;line-height:1.06;font-weight:600;letter-spacing:-.01em}
h1 em{font-style:italic;font-weight:500;color:#7d3a3a}
p{margin:26px 0 0;font-size:25px;line-height:1.42;color:#4d4540}
.chips{position:absolute;left:72px;bottom:60px;display:flex;gap:10px;font-family:'Inter Variable',system-ui,sans-serif;font-size:16px;font-weight:500;color:#5b524b}
.chips span{border:1px solid #d9d0bf;border-radius:999px;padding:7px 13px;background:#fbf9f4}
.url{position:absolute;right:72px;bottom:60px;font-family:'Inter Variable',system-ui,sans-serif;font-size:17px;color:#7d3a3a;font-weight:500}
.shot{position:absolute;left:720px;top:96px;width:900px;border-radius:10px;box-shadow:0 24px 60px rgba(43,38,34,.22),0 0 0 1px rgba(43,38,34,.08);overflow:hidden;background:#fff}
.shot img{display:block;width:900px}
</style>
<div class="text">
  <div class="name">${mark(null)} astro-inkstone</div>
  <h1>The Astro wiki<br>you can <em>write in</em></h1>
  <p>Paper-and-ink typography for docs, wikis and digital gardens — edited on the page itself. Markdown stays the source, git the history.</p>
</div>
<div class="shot"><img src="${shot}" alt=""></div>
<div class="chips"><span>✎ in-place editing</span><span>[[wikilinks]]</span><span>KaTeX · Mermaid</span><span>18 languages</span></div>
<div class="url">ventusff.github.io/astro-inkstone</div>`;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 600, deviceScaleFactor: 1 });
await page.setContent(card, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out('og.png'), type: 'png' });
await browser.close();
console.log('brand assets written to public/');
