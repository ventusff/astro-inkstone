// Static: the content guard refusing a save (an unpaired ** in the block) —
// the editor shell with the refusal, cropped.
import * as L from './lib.mjs';
const OUT = process.argv[2] || 'guard.png';
const { browser, page } = await L.launch();
try {
  await L.login(page);
  await L.open(page, '/kitchen-sink/');
  await L.scrollToSel(page, '#inline-marks', 44);
  const cur = new L.Cursor(page);
  await cur.place(120, 620);
  await L.openEditor(page, cur, 'Emphasis parsing is CJK-friendly', { hoverAt: 0.3 });
  await cur.hide();
  await L.focusEditorEnd(page);
  await L.type(page, ' A **bold claim without its closing marker.', 5);
  await L.sleep(800);
  await page.click('.wiki-editor-foot .wiki-btn-primary');
  await page.waitForSelector('.wiki-editor-error:not([hidden])', { timeout: 10000 });
  await L.sleep(500);
  const r = await page.evaluate(() => { const b = document.querySelector('.wiki-editor').getBoundingClientRect(); return { x: b.x + window.scrollX, y: b.y + window.scrollY, w: b.width, h: b.height }; });
  await page.screenshot({ path: OUT, captureBeyondViewport: true, clip: { x: r.x - 16, y: r.y - 16, width: r.w + 32, height: r.h + 32 } });
} finally {
  await browser.close();
}
