/**
 * export-deck — a page's deck as a PDF and as images, one page and one image
 * per step, in a headless Chrome.
 *
 *   node node_modules/astro-inkstone/scripts/export-deck.mjs <page url> <out dir>
 *
 * writes `<out dir>/deck.pdf` (10 × 5.625 in pages) and
 * `<out dir>/slide-<n>-step-<k>.png` (1920 × 1080: the 960 × 540 canvas at
 * twice its size), the pages the deck prints (lib/deck.ts, "Print"): every
 * step of every slide, a slide's last step its own page. The page may be a
 * running site or a built one served from disk.
 *
 * Environment:
 *   CHROME_PATH   Chrome/Chromium executable, default /usr/bin/google-chrome
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: export-deck.mjs <page url> <out dir>');
  process.exit(2);
}
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-deck][data-ready]');
  await page.emulateMediaType('print');
  // the deck alone, laid out for print: a page of the slides and nothing around them
  const pages = await page.evaluate(() => {
    const root = document.querySelector('[data-deck]');
    document.body.replaceChildren(root);
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    dispatchEvent(new Event('beforeprint'));
    const seen = new Map();
    return [...root.querySelectorAll('[data-deck-slides] > .slide')].map((slide) => {
      const n = Number(slide.dataset.deckSlide);
      const step = seen.get(n) ?? 0;
      seen.set(n, step + 1);
      return { n, step };
    });
  });
  const slides = await page.$$('[data-deck-slides] > .slide');
  const width = String(Math.max(...pages.map((p) => p.n))).length;
  for (const [i, slide] of slides.entries()) {
    const { n, step } = pages[i];
    await slide.screenshot({ path: join(out, `slide-${String(n).padStart(width, '0')}-step-${step}.png`) });
  }
  await page.pdf({ path: join(out, 'deck.pdf'), preferCSSPageSize: true, printBackground: true });
  console.log(`${pages.length} pages: ${join(out, 'deck.pdf')} and ${pages.length} images in ${out}`);
} finally {
  await browser.close();
}
