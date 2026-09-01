/**
 * playground_probe — an end-to-end probe of the browser-local playground on
 * a built demo, driven in headless Chrome over a throwaway static server:
 * the badge on a clean visit, activation, the block editor with its local
 * preview, save → reload → persistence, revision history, reset, component
 * blocks (dev parity, honest display), the frontmatter block (YAML in, kept
 * and reopened, body stamps re-based, the slot's note), a footnote
 * definition (a block of its own, edited where it renders — document order
 * is not source order), zh strings on a zh page, and then EVERY note page:
 * activation must leave the build's block map exactly as built (each
 * stamped node keeps its range, ranges well-formed, disjoint and within the
 * note's source, every anchor bound to the element it precedes) and every
 * page must carry its own source island. The click path is measured on the
 * wire (the server gzips what a static host gzips): activation must stay
 * within its byte budget, the index manifest must carry no sources, and
 * the editor chunk must be prefetched in the idle time after activation.
 * Every check is PASS/FAIL; any FAIL fails the process.
 *
 *   node scripts/playground_probe.mjs <root> [base] [--exclude <route regex>]
 *
 *     root       directory to serve (the demo's probe-root, or dist for base /)
 *     base       URL prefix the site was built for, default "/"
 *     --exclude  note pages whose route matches are left out of the
 *                every-page sweep (a local run over a locale subset)
 *
 *   env CHROME_PATH   Chrome/Chromium executable, default /usr/bin/google-chrome
 *
 * The demo's getting-started note (en and its zh mirror) is the fixture
 * for the editing flows: its taxonomy strip is the frontmatter slot, its
 * body has paragraphs and a Hero component; the zh kitchen-sink note
 * carries the footnote.
 */
import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

import puppeteer from 'puppeteer-core';

const argv = process.argv.slice(2);
const excludeAt = argv.indexOf('--exclude');
const EXCLUDE = excludeAt >= 0 ? new RegExp(argv.splice(excludeAt, 2)[1]) : null;
const ROOT = resolve(argv[0] || 'dist');
const BASE = (argv[1] || '/').replace(/\/?$/, '/');
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const PORT = 4980;
/** wire bytes a first activation may transfer (its chunk, the index manifest);
 *  the site's plugin graph and the editor are idle-time loads, never part of it */
const ACTIVATION_BUDGET = 96 * 1024;
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
  const body = readFileSync(file);
  const gzip = /gzip/.test(req.headers['accept-encoding'] ?? '') && /\.(?:html|js|mjs|css|json|svg|txt)$/.test(file);
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', ...(gzip ? { 'content-encoding': 'gzip' } : {}) });
  res.end(gzip ? gzipSync(body) : body);
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
/** the network between the click and the badge turning active: wire bytes and requests */
const measureActivation = async () => {
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  const requests = new Map();
  cdp.on('Network.requestWillBeSent', (e) => requests.set(e.requestId, { url: e.request.url, bytes: 0 }));
  cdp.on('Network.loadingFinished', (e) => { const r = requests.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
  const t0 = Date.now();
  await activate();
  const ms = Date.now() - t0;
  await cdp.detach();
  const rows = [...requests.values()];
  return { ms, bytes: rows.reduce((a, r) => a + r.bytes, 0), urls: rows.map((r) => r.url.replace(/^http:\/\/[^/]+/, '')) };
};
/** the source island a built note page carries: { file, source } */
const islandOf = (html) => {
  const m = /<script[^>]*data-inkbrush-source[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
};
/* the block is activated by focus (the keyboard path): a hover lands on
   whatever the pointer crosses on the way, focus names the block exactly */
const hoverAndEdit = async (handle) => {
  await page.evaluate((el) => { el.scrollIntoView({ block: 'center', behavior: 'instant' }); el.focus({ preventScroll: true }); }, handle);
  await page.waitForSelector('.wiki-handle.show', { timeout: 10000 });
  await sleep(200);
  await (await page.$('.wiki-handle button:first-child')).click();
  await page.waitForSelector('.wiki-editor .cm-content', { timeout: 20000 });
};
const editorText = () => page.evaluate(() => [...document.querySelectorAll('.wiki-editor .cm-line')].map((l) => l.textContent).join('\n'));
/** the block the editor replaced is the one that was activated: its
 *  handle is gone from the page and the editor sits where it stood */
const editorReplaced = (handle) => page.evaluate((el) => !el.isConnected || el.hidden || getComputedStyle(el).display === 'none', handle);
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
const firstActivation = await measureActivation();
ok('activation turns the badge on', true);
ok(`activation stays within its wire budget (${(firstActivation.bytes / 1024).toFixed(0)} KB in ${firstActivation.ms} ms, ${firstActivation.urls.length} requests)`, firstActivation.bytes <= ACTIVATION_BUDGET, firstActivation.urls.join(' '));
ok('blocks are stamped after activation', (await page.$$eval('[data-wiki-src]', (els) => els.length)) > 3);
ok('playground stylesheet is injected', await page.evaluate(() => !!document.getElementById('inkbrush-playground-style')));
ok('toolbar is fixed-positioned (styled)', await page.evaluate(() => { const h = document.querySelector('.wiki-handle'); return !!h && getComputedStyle(h).position === 'fixed'; }));
ok('a11y hint is visually collapsed', await page.evaluate(() => { const el = document.querySelector('.wiki-sr-only'); if (!el) return false; const r = el.getBoundingClientRect(); return r.width <= 2 && r.height <= 2; }));
ok('activation hint toast shows', await page.evaluate(() => (document.querySelector('.wiki-toast-region')?.textContent ?? '').length > 0));
ok('editor chunk is prefetched in the idle time after activation', await page.waitForFunction(
  () => performance.getEntriesByType('resource').some((e) => /\/editor\.[^/]+\.js$/.test(e.name)),
  { timeout: 6000 },
).then(() => true).catch(() => false));

/* ---- a paragraph block: edit, preview, save, persist, history, reset ---- */
const target = await page.evaluateHandle(() => [...document.querySelectorAll('p[data-wiki-src]')].find((p) => (p.textContent ?? '').length > 40));
const originalText = await page.evaluate((el) => el.textContent, target);
await hoverAndEdit(target);
ok('the block editor opens', true);
ok('the editor opens on the activated block', await editorReplaced(target) && (await editorText()).length > 0);
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

/* ---- a footnote definition: its own block, edited where it renders ---- */
const SINK = url('/zh/kitchen-sink/');
await page.goto(SINK, { waitUntil: 'networkidle2' });
await activate();
const fnItem = await page.$('section[data-footnotes] li[data-wiki-src]');
ok('footnote item is a stamped block', !!fnItem);
const fnStamp = fnItem ? await fnItem.evaluate((el) => el.dataset.wikiSrc) : null;
ok('footnote section itself carries no stamp', await page.evaluate(() => !document.querySelector('section[data-footnotes][data-wiki-src]')));
// the keyboard path on a smooth-scrolling site: focus scrolls the block in
// after focusin fired, and the handle must appear once it has arrived
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.evaluate((el) => el.focus(), fnItem);
ok('a block focused from off-screen gets its handle once scrolled into view', await page.waitForSelector('.wiki-handle.show', { timeout: 5000 }).then(() => true).catch(() => false));
await hoverAndEdit(fnItem);
ok('footnote editor opens on its definition', /^\[\^src\]:/.test(await editorText()), (await editorText()).slice(0, 40));
await page.waitForFunction(() => document.querySelector('.wiki-editor-preview')?.textContent?.includes('脚注渲染在页脚'), { timeout: 20000 })
  .then(() => ok('footnote preview shows the definition text', true))
  .catch(() => ok('footnote preview shows the definition text', false));
await replaceEditorText('[^src]: 脚注在体验场里改过了,回跳链接照旧。');
await saveAndReload();
await waitActive();
ok('edited footnote renders in the footnote section', await page.evaluate(() => (document.querySelector('section[data-footnotes]')?.textContent ?? '').includes('脚注在体验场里改过了')));
ok('footnote item stays a stamped block after the edit', await page.evaluate((stamp) => document.querySelector('section[data-footnotes] li[data-wiki-src]')?.dataset.wikiSrc === stamp, fnStamp));
ok('footnote backreference survives the edit', await page.evaluate(() => !!document.querySelector('section[data-footnotes] a[data-footnote-backref]')));
const sinkHeading = await page.evaluateHandle(() => [...document.querySelectorAll('h2[data-wiki-src]')].find((h) => (h.textContent ?? '').includes('内容守门')));
await hoverAndEdit(sinkHeading);
ok('a heading written after the footnote definition opens its own source', (await editorText()).includes('## 内容守门在这页拦什么'), (await editorText()).slice(0, 40));
await page.keyboard.press('Escape');
await reset();
ok('reset restores the built footnote', await page.evaluate(() => (document.querySelector('section[data-footnotes]')?.textContent ?? '').includes('脚注渲染在页脚')));

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

/* ---- every note page: activation keeps the block map exactly as built ---- */
await page.setViewport({ width: 1280, height: 900 });
const manifest = JSON.parse(readFileSync(join(ROOT, BASE, 'playground-manifest.json'), 'utf8'));
ok('index manifest carries note identities, no sources', manifest.notes.length > 0 && manifest.notes.every((n) => typeof n.id === 'string' && typeof n.title === 'string' && !('source' in n)));
const notePages = [];
const walk = (dir, route) => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, `${route}${entry}/`);
    else if (entry === 'index.html') {
      const html = readFileSync(p, 'utf8');
      const id = /<meta name="inkbrush-note" content="([^"]+)"/.exec(html)?.[1];
      if (id && !(EXCLUDE && EXCLUDE.test(route))) notePages.push({ route, id, island: islandOf(html) });
    }
  }
};
walk(ROOT, '/');
const mapOf = () => page.evaluate(() => [...document.querySelectorAll('[data-wiki-src]')].map((n) => {
  let bound = null;
  if (n.tagName === 'TEMPLATE' && !('wikiFrontmatter' in n.dataset)) {
    const el = n.nextElementSibling;
    bound = el && !el.hasAttribute('data-wiki-src') ? el.tagName.toLowerCase() : null;
  }
  return { stamp: n.dataset.wikiSrc, tag: n.tagName.toLowerCase(), bound };
}));
const sweepFailures = [];
for (const { route, id, island } of notePages) {
  const problems = [];
  const lines = island && typeof island.source === 'string' ? island.source.split('\n').length : undefined;
  if (!island) problems.push('no source island in the page head');
  else if (!['md', 'mdx'].some((ext) => (island.file ?? '').endsWith(`/${id}/index.${ext}`))) problems.push(`source island names ${island.file}, not this note's file`);
  try {
    await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.inkbrush-playground-badge button', { timeout: 15000 });
    const before = await mapOf();
    await activate();
    const after = await mapOf();
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      const i = before.findIndex((b, k) => JSON.stringify(b) !== JSON.stringify(after[k]));
      problems.push(`stamp changed by activation: ${JSON.stringify(before[i])} → ${JSON.stringify(after[i])}`);
    }
    const ranges = [];
    for (const { stamp, tag, bound } of after) {
      const m = /^(\d+)-(\d+)$/.exec(stamp ?? '');
      const start = m ? Number(m[1]) : NaN;
      const end = m ? Number(m[2]) : NaN;
      if (!m || start < 1 || end < start) problems.push(`malformed stamp "${stamp}" on <${tag}>`);
      else if (lines !== undefined && end > lines) problems.push(`stamp ${stamp} on <${tag}> runs past the note's ${lines} lines`);
      else ranges.push({ start, end, tag });
      if (tag === 'template' && bound === null && !problems.some((p) => p.startsWith('anchor'))) {
        const fm = after.find((n) => n.stamp === stamp && n.tag === 'template');
        if (fm && !(await page.evaluate((s) => !!document.querySelector(`template[data-wiki-src="${s}"][data-wiki-frontmatter]`), stamp))) {
          problems.push(`anchor ${stamp} binds nothing (its component rendered nothing, or the next block is stamped)`);
        }
      }
    }
    ranges.sort((a, b) => a.start - b.start);
    for (let k = 1; k < ranges.length; k++) {
      if (ranges[k].start <= ranges[k - 1].end) problems.push(`stamps ${ranges[k - 1].start}-${ranges[k - 1].end} <${ranges[k - 1].tag}> and ${ranges[k].start}-${ranges[k].end} <${ranges[k].tag}> overlap`);
    }
    if (after.length === 0) problems.push('no stamped blocks at all');
  } catch (err) {
    problems.push(`probe error: ${String(err).split('\n')[0]}`);
  }
  if (problems.length > 0) sweepFailures.push(`${route}: ${problems.join('; ')}`);
}
ok(`every note page carries its source and keeps its block map through activation (${notePages.length} pages)`, sweepFailures.length === 0, sweepFailures.slice(0, 5).join(' | '));

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
server.close();
for (const [s, n, e] of results) console.log(`${s}  ${n}${e ? ` — ${e}` : ''}`);
console.log(process.exitCode ? 'PLAYGROUND PROBE FAILED' : 'PLAYGROUND PROBE PASSED');
