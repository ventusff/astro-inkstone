// Heading clip: rename a heading; numbering and the sidebar ToC follow —
// numbers are the build's, never typed.
import * as L from './lib.mjs';
const OUT = process.argv[2] || 'tour-heading.mp4';
const { browser, page } = await L.launch();
try {
  await L.login(page);
  await L.open(page, '/kitchen-sink/');
  await L.scrollToSel(page, '#math', 130);
  const cur = new L.Cursor(page);
  await cur.place(120, 620);
  const rec = await L.startRecording(page, OUT);
  await L.sleep(700);
  await L.openEditor(page, cur, '^§2\\.2\\s*Math$', { hoverAt: 0.35 });
  await cur.moveTo(990, 600, { duration: 300 });
  await L.focusEditorEnd(page);
  await L.sleep(200);
  await L.type(page, ', inline and display', 55);
  await L.sleep(1200);
  await L.saveAndReload(page, cur);
  await L.sleep(2200);
  await L.stopRecording(rec, { speed: Number(process.env.SPEED || 1.75) });
  await L.toGif(OUT, OUT.replace(/\.mp4$/, '.gif'));
} finally {
  await browser.close();
}
