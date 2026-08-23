// Wikilink clip: type [[ → note completion → link in the preview → save →
// follow the link → the target's "Linked mentions" lists the new mention.
import * as L from './lib.mjs';
const OUT = process.argv[2] || 'tour-wikilink.mp4';
const { browser, page } = await L.launch({ width: 1040, height: 720 });
try {
  await L.login(page);
  await L.open(page, '/checks/');
  await L.scrollToSel(page, '#check-content-the-source-layer', 44);
  const cur = new L.Cursor(page);
  await cur.place(120, 620);
  const rec = await L.startRecording(page, OUT);
  await L.sleep(700);
  await L.openEditor(page, cur, 'Why this script must come from the engine', { hoverAt: 0.3 });
  await cur.moveTo(990, 600, { duration: 300 });
  await L.focusEditorEnd(page);
  await L.sleep(200);
  await L.type(page, ' Wiring it up is one line: [[get', 55);
  await page.waitForSelector('.cm-tooltip-autocomplete', { timeout: 5000 });
  await L.sleep(1100);
  await page.keyboard.press('Enter');
  await L.type(page, '.', 55);
  await L.sleep(1400);
  await L.saveAndReload(page, cur);
  await L.sleep(1200);
  // follow the new link
  const link = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find((a) => /getting-started\/?$/.test(a.getAttribute('href') || '') && /getting-started/i.test(a.textContent));
    if (!a) return null;
    const b = a.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  if (!link) throw new Error('new link not found');
  await cur.moveTo(link.x, link.y, { duration: 600 });
  await L.sleep(250);
  const nav = page.waitForNavigation({ waitUntil: 'load', timeout: 20000 });
  await cur.click();
  await nav;
  await page.evaluate(() => document.fonts.ready);
  await L.sleep(300);
  await cur.restore();
  await L.sleep(600);
  // down to the linked mentions: jump to just above the panel, then slide
  // the new mention into view
  const target = await page.evaluate(() => {
    const panel = [...document.querySelectorAll('section, aside, div')].find((e) => /^\s*Linked mentions/i.test(e.textContent || '') && e.querySelector('a'));
    const item = panel && [...panel.querySelectorAll('a, li, article, div')].find((e) => /The checks/i.test(e.textContent || '') && e.getBoundingClientRect().height < 200);
    if (!panel) return null;
    const p = panel.getBoundingClientRect();
    const it = item ? item.getBoundingClientRect() : p;
    return { panelTop: p.top + window.scrollY, itemTop: it.top + window.scrollY, itemH: it.height, panelH: p.height };
  });
  if (!target) throw new Error('linked mentions panel not found');
  const vh = 720;
  // final position: the panel head near the top third, the new item visible
  const finalTop = Math.min(target.panelTop - 70, target.itemTop + target.itemH - vh + 40);
  await page.evaluate((y) => window.scrollTo({ top: y - 420, behavior: 'instant' }), finalTop);
  await L.sleep(350);
  await L.smoothScrollBy(page, 420, 800);
  await L.sleep(2600);
  await L.stopRecording(rec, { speed: Number(process.env.SPEED || 1.75) });
  await L.toGif(OUT, OUT.replace(/\.mp4$/, '.gif'));
} finally {
  await browser.close();
}
