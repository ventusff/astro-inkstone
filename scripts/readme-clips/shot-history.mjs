// Static: the ⟲ block-history popover on a block, cropped around the
// popover (history records come from earlier saves on that block).
import * as L from './lib.mjs';
const OUT = process.argv[2] || 'history.png';
const { browser, page } = await L.launch();
try {
  await L.login(page);
  await L.open(page, '/kitchen-sink/');
  await L.scrollToSel(page, '#math', 44);
  const cur = new L.Cursor(page);
  await cur.place(120, 620);
  const b = await L.blockRect(page, 'formula ground is deliberately');
  await cur.moveTo(b.x + b.w * 0.3, b.y + 14, { duration: 300 });
  await L.sleep(500);
  const hist = await L.centerOf(page, '.wiki-handle button:nth-of-type(3)');
  await cur.moveTo(hist.x, hist.y, { duration: 300 });
  await cur.click();
  await page.waitForSelector('.wiki-popover.show', { timeout: 8000 });
  await L.sleep(900);
  await cur.hide();
  // the popover and a margin of page around it (CSS px → the 2x capture)
  const r = await page.evaluate(() => {
    const p = document.querySelector('.wiki-popover.show').getBoundingClientRect();
    // page coordinates: the clip is taken from the full page
    return { x: Math.max(0, p.x - 110) + window.scrollX, y: Math.max(0, p.y - 90) + window.scrollY, w: p.width + 220, h: p.height + 120 };
  });
  await page.screenshot({ path: OUT, captureBeyondViewport: true, clip: { x: r.x, y: r.y, width: r.w, height: Math.min(r.h, 420) } });
} finally {
  await browser.close();
}
