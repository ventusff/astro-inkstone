// Hero clip: hover a paragraph → ✎ → type an inline formula → live preview →
// save → the page re-renders in place → flip to dark.
import * as L from './lib.mjs';

const OUT = process.argv[2] || 'hero.mp4';
const { browser, page } = await L.launch();
try {
  await L.login(page);
  await L.open(page, '/kitchen-sink/');
  await L.scrollToSel(page, '#math', 44);
  const cur = new L.Cursor(page);
  await cur.place(120, 620);

  const rec = await L.startRecording(page, OUT);
  await L.sleep(900);
  await L.openEditor(page, cur, 'formula ground is deliberately', { hoverAt: 0.3 });
  // park the cursor off the text while typing
  await cur.moveTo(980, 600, { duration: 300 });
  await L.focusEditorEnd(page);
  await L.sleep(250);
  await L.type(page, ' Inline math renders as you type: $e^{i\\pi} + 1 = 0$.', 48);
  await L.sleep(1500);
  await L.saveAndReload(page, cur);
  await L.sleep(1800);

  // dark theme, the same page
  const t = await L.centerOf(page, '.theme-toggle');
  await cur.moveTo(t.x, t.y, { duration: 700 });
  await L.sleep(150);
  await cur.click();
  await L.sleep(2600);
  await L.stopRecording(rec, { speed: Number(process.env.SPEED || 1.6) });
  await L.toGif(OUT, OUT.replace(/\.mp4$/, '.gif'));
} finally {
  await browser.close();
}
