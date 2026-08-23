// Table clip: open the "Five gates" table, edit a cell in the source, the
// preview re-renders the table live, save → the page updates in place.
import * as L from './lib.mjs';
const OUT = process.argv[2] || 'tour-table.mp4';
const { browser, page } = await L.launch({ width: 1040, height: 800 });
try {
  await L.login(page);
  await L.open(page, '/checks/');
  await L.scrollToSel(page, '#five-gates-five-layers', 30);
  const cur = new L.Cursor(page);
  await cur.place(120, 740);
  const rec = await L.startRecording(page, OUT);
  await L.sleep(700);
  await L.openEditor(page, cur, 'Ships with', { hoverAt: 0.2 });
  await cur.moveTo(990, 740, { duration: 300 });
  await L.placeCaret(page, '`[[wikilink]]` graph');
  await L.sleep(300);
  await L.type(page, ' **and anchors**', 55);
  await L.sleep(1500);
  await L.saveAndReload(page, cur);
  await L.sleep(2200);
  await L.stopRecording(rec, { speed: Number(process.env.SPEED || 1.75) });
  await L.toGif(OUT, OUT.replace(/\.mp4$/, '.gif'));
} finally {
  await browser.close();
}
