/**
 * playground_probe — an end-to-end probe of the browser-local playground on
 * a built demo, driven in headless Chrome over a throwaway static server:
 * the badge on a clean visit, activation, the block editor with its local
 * preview, save → reload → persistence, revision history, reset, component
 * blocks (dev parity, honest display), the frontmatter block (YAML in, kept
 * and reopened, body stamps re-based, the slot's note), and zh strings on a
 * zh page. Every check is PASS/FAIL; any FAIL fails the process.
 *
 *   node scripts/playground_probe.mjs <root> [base]
 *
 *     root   directory to serve (the demo's probe-root, or dist for base /)
 *     base   URL prefix the site was built for, default "/"
 *
 *   env CHROME_PATH   Chrome/Chromium executable, default /usr/bin/google-chrome
 *
 * The demo's getting-started note (en and its zh mirror) is the fixture:
 * its taxonomy strip is the frontmatter slot, its body has paragraphs and a
 * Hero component.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

import puppeteer from 'puppeteer-core';

const ROOT = resolve(process.argv[2] || 'dist');
const BASE = (process.argv[3] || '/').replace(/\/?$/, '/');
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const PORT = 4980;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.txt': 'text/plain',
};

const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(ROOT, p);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, r));

const url = (path) => `http://127.0.0.1:${PORT}${BASE}${path.replace(/^\//, '')}`;
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); if (!cond) process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const badgeText = () => page.$eval('.inkbrush-playground-badge button', (b) => b.textContent ?? '');
const waitActive = () => page.waitForFunction(
  () => /Editing locally|本地编辑中/.test(document.querySelector('.inkbrush-playground-badge button')?.textContent ?? ''),
  { timeout: 30000 },
);
const activate = async () => { await page.click('.inkbrush-playground-badge button'); await waitActive(); };
const hoverAndEdit = async (handle) => {
  await page.evaluate((el) => el.scrollIntoView({ block: 'center' }), handle);
  await handle.asElement().hover();
  await page.waitForSelector('.wiki-handle.show', { timeout: 10000 });
  await sleep(200);
  await (await page.$('.wiki-handle button:first-child')).click();
  await page.waitForSelector('.wiki-editor .cm-content', { timeout: 20000 });
};
const editorText = () => page.evaluate(() => [...document.querySelectorAll('.wiki-editor .cm-line')].map((l) => l.textContent).join('\n'));
const replaceEditorText = async (text) => {
  await page.click('.wiki-editor .cm-content');
  await page.evaluate((t) => { const el = document.querySelector('.wiki-editor .cm-content'); el.focus(); document.execCommand('selectAll'); document.execCommand('insertText', false, t); }, text);
  await sleep(300);
};
const saveAndReload = async () => {
  await (await page.$('.wiki-editor .wiki-btn-primary')).click();
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
};
const reset = async () => {
  await page.click('.inkbrush-playground-badge .pg-reset');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
page.on('dialog', (d) => void d.accept());
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const NOTE = url('/getting-started/');
await page.goto(NOTE, { waitUntil: 'networkidle2' });

/* ---- badge, activation, chrome ---- */
await page.waitForSelector('.inkbrush-playground-badge button', { timeout: 15000 });
ok('badge shows try-it on a clean visit', (await badgeText()).includes('Try editing'));
ok('reset is hidden before activation', await page.evaluate(() => {
  const r = document.querySelector('.inkbrush-playground-badge .pg-reset');
  return !!r && getComputedStyle(r).display === 'none';
}));
await activate();
ok('activation turns the badge on', true);
ok('blocks are stamped after activation', (await page.$$eval('[data-wiki-src]', (els) => els.length)) > 3);
ok('playground stylesheet is injected', await page.evaluate(() => !!document.getElementById('inkbrush-playground-style')));
ok('toolbar is fixed-positioned (styled)', await page.evaluate(() => { const h = document.querySelector('.wiki-handle'); return !!h && getComputedStyle(h).position === 'fixed'; }));
ok('a11y hint is visually collapsed', await page.evaluate(() => { const el = document.querySelector('.wiki-sr-only'); if (!el) return false; const r = el.getBoundingClientRect(); return r.width <= 2 && r.height <= 2; }));
ok('activation hint toast shows', await page.evaluate(() => (document.querySelector('.wiki-toast-region')?.textContent ?? '').length > 0));

/* ---- a paragraph block: edit, preview, save, persist, history, reset ---- */
const target = await page.evaluateHandle(() => [...document.querySelectorAll('p[data-wiki-src]')].find((p) => (p.textContent ?? '').length > 40));
const originalText = await page.evaluate((el) => el.textContent, target);
await hoverAndEdit(target);
ok('the block editor opens', true);
ok('editor shell is styled (has border)', await page.evaluate(() => { const e = document.querySelector('.wiki-editor'); return !!e && getComputedStyle(e).borderTopWidth !== '0px'; }));
const NEW_TEXT = 'This paragraph was rewritten locally in the playground, and **stays in this browser**.';
await replaceEditorText(NEW_TEXT);
await page.waitForFunction(() => document.querySelector('.wiki-editor-preview')?.textContent?.includes('rewritten locally'), { timeout: 20000 });
ok('live preview renders locally (bold parsed)', (await page.evaluate(() => document.querySelector('.wiki-editor-preview strong')?.textContent ?? '')).includes('stays in this browser'));
await saveAndReload();
await page.waitForFunction(() => document.body.textContent?.includes('rewritten locally in the playground'), { timeout: 30000 });
ok('saved edit renders on the page after reload', await page.evaluate(() => [...document.querySelectorAll('strong')].some((s) => s.textContent.includes('stays in this browser'))));
await page.goto(NOTE, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.body.textContent?.includes('rewritten locally in the playground'), { timeout: 30000 });
ok('edit persists across a fresh visit', true);
ok('badge counts local edits', /local edit/.test(await badgeText()));
const edited = await page.evaluateHandle(() => [...document.querySelectorAll('[data-wiki-src]')].find((p) => (p.textContent ?? '').includes('rewritten locally')));
await page.evaluate((el) => el.scrollIntoView({ block: 'center' }), edited);
await edited.asElement().hover();
await page.waitForSelector('.wiki-handle.show', { timeout: 10000 });
ok('history button is present', await page.evaluate(() => { const btns = [...document.querySelectorAll('.wiki-handle button')].filter((b) => !b.hidden); const h = btns[btns.length - 1]; if (!h) return false; h.click(); return true; }));
await page.waitForFunction(() => (document.querySelector('.wiki-popover, [class*="history"]')?.textContent?.length ?? 0) > 0, { timeout: 15000 })
  .then(() => ok('history panel opens with content', true))
  .catch(() => ok('history panel opens with content', false));
await reset();
ok('reset restores the original text', await page.evaluate((t) => document.body.textContent?.includes(t.slice(0, 60)), originalText));
ok('badge is back to try-it after reset', (await badgeText()).includes('Try editing'));

/* ---- a component block: source-level edit, honest display, reset ---- */
await page.goto(NOTE, { waitUntil: 'networkidle2' });
await activate();
ok('hero anchor keeps its stamp', await page.evaluate(() => !!document.querySelector('template[data-wiki-jsx="Hero"][data-wiki-src]')));
const heroBound = await page.evaluateHandle(() => { const t = document.querySelector('template[data-wiki-jsx="Hero"]'); let el = t?.nextElementSibling; while (el && el.tagName === 'TEMPLATE') el = el.nextElementSibling; return el; });
await hoverAndEdit(heroBound);
ok('hero editor opens on component source', (await editorText()).includes('<Hero'));
await replaceEditorText((await editorText()) + '\n\njsx-playground-edit-marker');
await saveAndReload();
await waitActive();
ok('hero edit shows note + honest display (built kept when nested, fallback otherwise)', await page.evaluate(() => {
  const note = document.querySelector('.pg-jsx-note');
  const builtKept = !!document.querySelector('section .hero, .hero');
  const fallbackShown = (document.body.textContent ?? '').includes('jsx-playground-edit-marker');
  return !!note && (builtKept || fallbackShown);
}));
ok('nested hero stays editable after reload', await page.evaluate(() => !!document.querySelector('template[data-wiki-jsx="Hero"][data-wiki-src]')));
await reset();
ok('reset clears the jsx note', await page.evaluate(() => !document.querySelector('.pg-jsx-note')));

/* ---- the frontmatter block: YAML in, kept, re-based stamps, the slot's note ---- */
await page.goto(NOTE, { waitUntil: 'networkidle2' });
await activate();
await page.waitForSelector('.wiki-handle', { timeout: 15000 });
const SLOT = '[data-inkbrush-slot="frontmatter"]';
const anchor = await page.$eval('template[data-wiki-frontmatter]', (t) => t.dataset.wikiSrc).catch(() => null);
ok('frontmatter anchor present', !!anchor, anchor ?? 'none');
ok('frontmatter slot is a bound block', await page.$eval(SLOT, (el) => el.classList.contains('wiki-block')).catch(() => false));
const slotEl = await page.$(SLOT);
await hoverAndEdit(slotEl);
ok('frontmatter editor is titled as such', /frontmatter|元信息/i.test(await page.$eval('.wiki-editor-head span', (s) => s.textContent ?? '')));
const yaml0 = await editorText();
ok('frontmatter editor holds the YAML', yaml0.startsWith('---') && yaml0.includes('title:'));
ok('frontmatter has no preview, says so', /preview|预览/.test(await page.$eval('.wiki-editor-preview', (p) => p.textContent ?? '')));
const MARK = 'pgcheck: frontmatter-edited-locally';
const lines = yaml0.split('\n'); lines.splice(lines.lastIndexOf('---'), 0, MARK);
await replaceEditorText(lines.join('\n'));
ok('frontmatter edit landed in the editor', (await editorText()).includes(MARK));
await saveAndReload();
await waitActive();
ok('frontmatter edit counts as a local edit', /local edit/.test(await badgeText()));
ok('frontmatter note shown under the slot', await page.evaluate(() => { const n = document.querySelector('[data-inkbrush-slot="frontmatter"] + .pg-jsx-note'); return !!n && /Frontmatter edited locally|元信息/.test(n.textContent ?? ''); }));
ok('body stamps re-based after the frontmatter grew', await page.evaluate((a) => { const first = document.querySelector('[data-wiki-src]:not(template)'); const [, end] = a.split('-').map(Number); return !!first && Number(first.dataset.wikiSrc.split('-')[0]) > end; }, anchor ?? '0-0'));
await hoverAndEdit(await page.$(SLOT));
ok('reopened frontmatter editor holds the edited YAML', (await editorText()).includes(MARK));
await page.keyboard.press('Escape');
await reset();
ok('reset clears the frontmatter edit', !/local edit/.test(await badgeText()));

/* ---- zh mirror ---- */
await page.goto(url('/zh/getting-started/'), { waitUntil: 'networkidle2' });
await page.waitForSelector('.inkbrush-playground-badge button', { timeout: 15000 });
ok('zh page badge is localized', (await badgeText()).includes('试一试'));

/* ---- phone viewport: the entry point stays reachable ---- */
await page.setViewport({ width: 390, height: 844 });
await page.goto(NOTE, { waitUntil: 'networkidle2' });
await page.waitForSelector('.inkbrush-playground-badge button', { timeout: 15000 });
ok('phone badge floats fixed inside the viewport', await page.evaluate(() => {
  const b = document.querySelector('.inkbrush-playground-badge');
  if (!b || !b.classList.contains('pg-floating')) return false;
  if (getComputedStyle(b).position !== 'fixed') return false;
  const r = b.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;
}));
await activate();
ok('phone activation works from the floating badge', true);

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
server.close();
for (const [s, n, e] of results) console.log(`${s}  ${n}${e ? ` — ${e}` : ''}`);
console.log(process.exitCode ? 'PLAYGROUND PROBE FAILED' : 'PLAYGROUND PROBE PASSED');
