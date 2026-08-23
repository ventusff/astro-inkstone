// AI clip: ✦ on a block → pick "Condense" → Claude works in a sandboxed copy
// (its tool lines stream into the popover) → the block comes back shorter.
import * as L from './lib.mjs';
const OUT = process.argv[2] || 'tour-ai.mp4';
const { browser, page } = await L.launch();
try {
  await L.login(page);
  await L.open(page, '/kitchen-sink/');
  await L.scrollToSel(page, '#inline-marks', 60);
  const cur = new L.Cursor(page);
  await cur.place(120, 620);
  const rec = await L.startRecording(page, OUT);
  await L.sleep(700);
  const b = await L.blockRect(page, 'Emphasis parsing is CJK-friendly');
  await cur.moveTo(b.x + b.w * 0.3, b.y + 14, { duration: 650 });
  await L.sleep(500);
  const ai = await L.centerOf(page, '.wiki-handle button.ai');
  await cur.moveTo(ai.x, ai.y, { duration: 420 });
  await L.sleep(260);
  await cur.click();
  await page.waitForSelector('.wiki-ai-quick button', { timeout: 8000 });
  await L.sleep(900);
  const chip = await page.evaluate(() => { const el = [...document.querySelectorAll('.wiki-ai-quick button')].find((b) => /condense/i.test(b.textContent)); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await cur.moveTo(chip.x, chip.y, { duration: 500 });
  await L.sleep(200);
  await cur.click();
  await L.sleep(1100);
  const run = await L.centerOf(page, '.wiki-ai-pop .wiki-btn-primary');
  await cur.moveTo(run.x, run.y, { duration: 500 });
  await L.sleep(250);
  await cur.click();
  await L.sleep(1200);
  // park the cursor and fast-forward while Claude works
  await cur.moveTo(990, 600, { duration: 300 });
  rec.setSpeed(14);
  const nav = page.waitForNavigation({ waitUntil: 'load', timeout: 240000 }).catch(() => null);
  await page.waitForFunction(() => !document.querySelector('.wiki-ai-pop'), { timeout: 240000 }).catch(() => null);
  await nav;
  await page.evaluate(() => document.fonts.ready);
  rec.setSpeed(1.6);
  await cur.restore();
  await L.sleep(3200);
  await L.stopRecording(rec, { speed: 1.6 });
  await L.toGif(OUT, OUT.replace(/\.mp4$/, '.gif'));
} finally {
  await browser.close();
}
