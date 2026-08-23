// Frontmatter clip: the meta strip is a block too — ✎ opens the note's
// frontmatter as YAML; change the status, save, the strip re-renders.
import * as L from './lib.mjs';
const OUT = process.argv[2] || 'tour-frontmatter.mp4';
const { browser, page } = await L.launch();
try {
  await L.login(page);
  await L.open(page, '/kitchen-sink/');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  const cur = new L.Cursor(page);
  await cur.place(120, 620);
  const rec = await L.startRecording(page, OUT);
  await L.sleep(700);
  // hover the strip (its text is the kind/domain/status line)
  const b = await page.evaluate(() => { const r = document.querySelector('.taxo-line').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await cur.moveTo(b.x + 160, b.y + b.h / 2, { duration: 650 });
  await L.sleep(500);
  const h = await L.centerOf(page, '.wiki-handle button:not([hidden])');
  await cur.moveTo(h.x, h.y, { duration: 420 });
  await L.sleep(260);
  await cur.click();
  await page.waitForSelector('.wiki-editor-cm .cm-content', { timeout: 8000 });
  await L.sleep(600);
  await cur.moveTo(990, 600, { duration: 300 });
  await L.placeCaret(page, 'status: ');
  await page.keyboard.down('Shift'); await page.keyboard.press('End'); await page.keyboard.up('Shift');
  await L.sleep(350);
  await L.type(page, 'growing', 70);
  await L.sleep(1100);
  await L.saveAndReload(page, cur);
  await L.sleep(2400);
  await L.stopRecording(rec, { speed: Number(process.env.SPEED || 1.75) });
  await L.toGif(OUT, OUT.replace(/\.mp4$/, '.gif'));
} finally {
  await browser.close();
}
