#!/usr/bin/env node
/**
 * Page audit — open every given URL in a real (headless) Chrome and report
 * what a reader would see broken: figures and interactive demos first.
 *
 *   node scripts/page_audit.mjs --base http://127.0.0.1:4321 --paths paths.txt [--out audit.json]
 *   node scripts/page_audit.mjs --base http://127.0.0.1:4321 --crawl / [--max 500] [--out audit.json]
 *        [--width 1280] [--settle 2500] [--shots dir] [--shots-all 1] [--concurrency 4] [--chrome google-chrome]
 *        [--lang-cookie chaser_lang --langs zh,en,de] [--cookie name=value]
 *
 * `paths.txt` holds one path per line (`/wiki/foo/`); `#` starts a comment.
 * `--crawl <start>` needs no list: it starts at that path and follows every
 * same-origin page link it meets (files, API and asset paths left out), up to `--max` pages.
 *
 * A site that picks the reader's language from a cookie redirects `/en/…` to the default
 * language for a reader without it, so the other languages would never be looked at:
 * `--lang-cookie <name>` sets that cookie for every page to the language its path names (the
 * first path segment found in `--langs`, else the first of `--langs`). `--cookie name=value`
 * adds a fixed cookie. A page whose document was redirected is reported, with where it went.
 * Chrome is driven over the DevTools protocol with Node's own WebSocket, so
 * the script has no dependencies.
 *
 * Per page it records:
 *   - status: the HTTP status of the document; redirect: where it was sent, when it was;
 *   - reloads: main-frame navigations after the first (a reload loop shows as many);
 *   - console: errors and uncaught exceptions (deduplicated, with counts);
 *   - failed: same-origin requests that failed or answered 4xx/5xx;
 *   - demos: `.demo[data-demo]` stages that stayed empty (the module never mounted);
 *   - flows: `.flow-grid` diagrams with no wire drawn although they have edges;
 *   - svgText: hand-drawn `<svg>` `<text>` that leaves its `<svg>` viewport, or runs
 *     past the right edge of the `<rect>` it starts in (the "words out of the box" defect);
 *   - images: `<img>` that did not load;
 *   - math: KaTeX error nodes; mermaid: fences that did not render;
 *   - overflowX: the page scrolls sideways;
 *   - errorPage: the page answered 200 but shows an error in place of its content —
 *     the dev server's error overlay (`vite-error-overlay`, Astro's `astro-dev-overlay`
 *     error window) or a site's own "this page has a problem" block (`[data-page-trouble]`).
 * A page with none of these is `ok`. `--shots` saves a full-page screenshot of
 * every page that is not ok (PNG, named by path), `--shots-all 1` of every page.
 * Exit code 1 when any page is not ok.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
if (!args.base || (!args.paths && !args.crawl)) {
  console.error('usage: page_audit.mjs --base <origin> (--paths <file> | --crawl <start path>) [--max n] [--out file] [--width n] [--settle ms] [--shots dir] [--shots-all 1] [--concurrency n] [--chrome bin]');
  process.exit(2);
}
const BASE = args.base.replace(/\/$/, '');
const WIDTH = Number(args.width ?? 1280);
const SETTLE = Number(args.settle ?? 2500);
const CONCURRENCY = Number(args.concurrency ?? 4);
const MAX = Number(args.max ?? 500);
const paths = args.crawl
  ? [args.crawl]
  : readFileSync(args.paths, 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
const seen = new Set(paths);
const LANGS = (args.langs ?? 'zh,en,de').split(',').map((l) => l.trim()).filter(Boolean);
/** the cookies a page is opened with: the language its path names, and any fixed one */
function cookiesFor(path) {
  const out = [];
  if (args['lang-cookie']) {
    const seg = path.split('/').find((s) => LANGS.includes(s));
    out.push([args['lang-cookie'], seg ?? LANGS[0]]);
  }
  if (args.cookie) {
    const i = args.cookie.indexOf('=');
    out.push([args.cookie.slice(0, i), args.cookie.slice(i + 1)]);
  }
  return out;
}
/** a link worth following: a page on this origin, not a file, an API route or a dev-server internal */
function pagePath(href) {
  let u;
  try { u = new URL(href); } catch { return null; }
  if (u.origin !== new URL(BASE).origin) return null;
  const p = u.pathname;
  if (/\.[a-z0-9]{1,8}$/i.test(p) || /^\/(api|_|@|node_modules|src)\b/.test(p) || p.includes('/api/')) return null;
  return p;
}
if (args.shots) mkdirSync(args.shots, { recursive: true });

/** what runs inside the page once it has settled */
const PROBE = `(() => {
  const out = { demos: [], flows: [], svgText: [], images: [], math: 0, mermaid: 0, overflowX: 0 };
  for (const d of document.querySelectorAll('.demo[data-demo]')) {
    const stage = d.querySelector('.demo-stage');
    if (!stage) continue;
    if (stage.children.length === 0) out.demos.push(d.dataset.demo);
  }
  for (const g of document.querySelectorAll('.flow-grid[data-flow]')) {
    let edges = 0; try { edges = JSON.parse(g.dataset.flow).edges.length; } catch {}
    if (edges && g.querySelectorAll('svg.flow-wires .wire').length === 0) out.flows.push(g.closest('figure')?.querySelector('.flow-title')?.textContent ?? 'flow');
  }
  for (const svg of document.querySelectorAll('svg')) {
    if (svg.closest('.flow-grid, .mermaid, .mermaid-block, .katex, button, nav, header, a') || svg.getAttribute('aria-hidden') === 'true') continue;
    const texts = [...svg.querySelectorAll('text')];
    if (!texts.length) continue;
    const vb = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal : null;
    const rects = [...svg.querySelectorAll('rect')].map((r) => { try { return r.getBBox(); } catch { return null; } }).filter(Boolean);
    const label = (svg.getAttribute('aria-label') || svg.closest('figure')?.querySelector('figcaption')?.textContent || '').trim().slice(0, 60);
    for (const t of texts) {
      let b; try { b = t.getBBox(); } catch { continue; }
      if (!b.width) continue;
      const words = (t.textContent || '').trim().slice(0, 40);
      if (vb) {
        const by = Math.max(b.x + b.width - (vb.x + vb.width), vb.x - b.x, b.y + b.height - (vb.y + vb.height), vb.y - b.y);
        if (by > 2) { out.svgText.push({ kind: 'viewport', by: Math.round(by), words, figure: label }); continue; }
      }
      // the smallest rect that holds the point where the text starts
      const anchor = t.getAttribute('text-anchor');
      const px = anchor === 'middle' ? b.x + b.width / 2 : anchor === 'end' ? b.x + b.width - 1 : b.x + 1;
      const py = b.y + b.height / 2;
      let box = null;
      for (const r of rects) {
        if (r.width < 24 || r.height < 12) continue;
        if (px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height && (!box || r.width * r.height < box.width * box.height)) box = r;
      }
      if (box) {
        const by = Math.max(b.x + b.width - (box.x + box.width), box.x - b.x);
        if (by > 2) out.svgText.push({ kind: 'box', by: Math.round(by), words, figure: label });
      }
    }
  }
  for (const img of document.querySelectorAll('img')) {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) out.images.push(img.getAttribute('src'));
  }
  out.math = document.querySelectorAll('.katex-error').length;
  for (const m of document.querySelectorAll('pre.mermaid, .mermaid-block')) {
    if (!m.querySelector('svg') || /Syntax error/i.test(m.textContent || '')) out.mermaid += 1;
  }
  const de = document.documentElement;
  out.overflowX = Math.max(0, de.scrollWidth - de.clientWidth);
  const overlay = document.querySelector('vite-error-overlay');
  const astroErr = document.querySelector('astro-dev-toolbar')?.shadowRoot?.querySelector('astro-dev-toolbar-window[data-error], .error-window');
  const trouble = document.querySelector('[data-page-trouble]');
  out.errorPage = overlay ? ('overlay: ' + (overlay.shadowRoot?.querySelector('.message')?.textContent || '').trim().slice(0, 200))
    : astroErr ? 'astro error window'
    : trouble ? ('trouble block: ' + (trouble.textContent || '').trim().slice(0, 120)) : '';
  return out;
})()`;

const profile = mkdtempSync(join(tmpdir(), 'page-audit-'));
const chrome = spawn(args.chrome ?? 'google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, `--window-size=${WIDTH},1000`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  chrome.stderr.on('data', (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) resolve(m[1]);
  });
  chrome.on('exit', () => reject(new Error('chrome exited before the DevTools endpoint came up')));
});

/** one DevTools connection: request/response by id, events by method */
function connect(url) {
  const ws = new WebSocket(url);
  let seq = 0;
  const waiting = new Map();
  const listeners = new Set();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiting.has(msg.id)) {
      const { resolve, reject } = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    } else if (msg.method) for (const l of listeners) l(msg);
  });
  return new Promise((resolve) => ws.addEventListener('open', () => resolve({
    send: (method, params = {}, sessionId) => new Promise((res, rej) => {
      const id = ++seq;
      waiting.set(id, { resolve: res, reject: rej });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    }),
    on: (fn) => listeners.add(fn),
    off: (fn) => listeners.delete(fn),
    close: () => ws.close(),
  })));
}

const browser = await connect(wsUrl);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function audit(path) {
  const url = BASE + path;
  // a browser context of its own: cookies (the reader's language among them) never leak between pages open at once
  const { browserContextId } = await browser.send('Target.createBrowserContext', { disposeOnDetach: true });
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (m, p) => browser.send(m, p, sessionId);
  const rec = { path, status: 0, reloads: 0, console: {}, failed: [], ok: false };
  let navigations = 0;
  const requests = new Map();
  const onEvent = (msg) => {
    if (msg.sessionId !== sessionId) return;
    const p = msg.params;
    if (msg.method === 'Page.frameNavigated' && !p.frame.parentId && p.frame.url !== 'about:blank') navigations += 1;
    if (msg.method === 'Network.requestWillBeSent') {
      requests.set(p.requestId, p.request.url);
      if (p.redirectResponse && p.type === 'Document') rec.redirect = `${rec.redirect ? rec.redirect + ' ' : ''}${p.redirectResponse.status} → ${p.request.url.startsWith(BASE) ? p.request.url.slice(BASE.length) : p.request.url}`;
    }
    if (msg.method === 'Network.responseReceived') {
      // the first document response is the page itself (the main frame's id is not known until it commits)
      if (p.type === 'Document' && !rec.status) rec.status = p.response.status;
      if (p.response.status >= 400 && p.response.url.startsWith(BASE)) rec.failed.push(`${p.response.status} ${p.response.url.slice(BASE.length)}`);
    }
    if (msg.method === 'Network.loadingFailed' && !p.canceled) {
      const u = requests.get(p.requestId) ?? '';
      if (u.startsWith(BASE)) rec.failed.push(`${p.errorText} ${u.slice(BASE.length)}`);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const t = (p.exceptionDetails.exception?.description ?? p.exceptionDetails.text ?? '').split('\n')[0].slice(0, 240);
      rec.console[t] = (rec.console[t] ?? 0) + 1;
    }
    if (msg.method === 'Runtime.consoleAPICalled' && p.type === 'error') {
      const t = p.args.map((a) => a.value ?? a.description ?? '').join(' ').split('\n')[0].slice(0, 240);
      rec.console[t] = (rec.console[t] ?? 0) + 1;
    }
  };
  browser.on(onEvent);
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 1000, deviceScaleFactor: 1, mobile: false });
    for (const [name, value] of cookiesFor(path)) await send('Network.setCookie', { name, value, url: BASE + '/' });
    const loaded = new Promise((resolve) => {
      const l = (msg) => { if (msg.sessionId === sessionId && msg.method === 'Page.loadEventFired') { browser.off(l); resolve(); } };
      browser.on(l);
    });
    await send('Page.navigate', { url });
    await Promise.race([loaded, sleep(45_000)]);
    await sleep(SETTLE);
    // scroll through the page so lazily mounted demos and images come in
    await send('Runtime.evaluate', { expression: `(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); })()`, awaitPromise: true });
    await sleep(800);
    const { result } = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
    Object.assign(rec, result.value ?? {});
    if (args.crawl) {
      const links = await send('Runtime.evaluate', { expression: `[...document.querySelectorAll('a[href]')].map((a) => a.href)`, returnByValue: true });
      for (const href of links.result.value ?? []) {
        const next = pagePath(href);
        if (next && !seen.has(next) && seen.size < MAX) { seen.add(next); paths.push(next); }
      }
    }
    rec.reloads = Math.max(0, navigations - 1);
    rec.ok = rec.status < 400 && rec.status > 0 && !rec.redirect && rec.reloads < 2 && !Object.keys(rec.console).length && !rec.failed.length
      && !rec.demos?.length && !rec.flows?.length && !rec.svgText?.length && !rec.images?.length && !rec.math && !rec.mermaid && !(rec.overflowX > 4) && !rec.errorPage;
    if (args.shots && (!rec.ok || args['shots-all'])) {
      const { cssContentSize } = await send('Page.getLayoutMetrics');
      await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: Math.min(Math.ceil(cssContentSize.height), 16000), deviceScaleFactor: 1, mobile: false });
      await sleep(400);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const file = join(args.shots, `${path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root'}.png`);
      writeFileSync(file, Buffer.from(shot.data, 'base64'));
      rec.shot = file;
    }
  } catch (err) {
    rec.error = String(err.message ?? err);
  } finally {
    browser.off(onEvent);
    await browser.send('Target.closeTarget', { targetId }).catch(() => undefined);
    await browser.send('Target.disposeBrowserContext', { browserContextId }).catch(() => undefined);
  }
  return rec;
}

const results = [];
let next = 0;
let active = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  // a crawl grows the list while pages are open: a worker with nothing to take waits for the busy ones
  while (next < paths.length || active > 0) {
    if (next >= paths.length) { await sleep(200); continue; }
    const path = paths[next++];
    active += 1;
    const rec = await audit(path).finally(() => { active -= 1; });
    results.push(rec);
    const flags = [
      rec.error && `error: ${rec.error}`, rec.status >= 400 && `HTTP ${rec.status}`, rec.redirect && `redirected ${rec.redirect}`, rec.reloads >= 2 && `reloads ${rec.reloads}`,
      Object.keys(rec.console).length && `console ${Object.keys(rec.console).length}`, rec.failed.length && `failed requests ${rec.failed.length}`,
      rec.demos?.length && `demos not mounted ${rec.demos.length}`, rec.flows?.length && `flow wires missing ${rec.flows.length}`,
      rec.svgText?.length && `svg text out of box ${rec.svgText.length}`, rec.images?.length && `broken images ${rec.images.length}`,
      rec.math && `math errors ${rec.math}`, rec.mermaid && `mermaid ${rec.mermaid}`, rec.overflowX > 4 && `page overflows sideways ${rec.overflowX}px`,
      rec.errorPage && `error shown instead of content (${rec.errorPage})`,
    ].filter(Boolean);
    console.log(`${rec.ok ? '✓' : '✗'} ${path}${flags.length ? '  — ' + flags.join(' · ') : ''}`);
  }
}));
results.sort((a, b) => paths.indexOf(a.path) - paths.indexOf(b.path));
if (args.out) writeFileSync(args.out, JSON.stringify(results, null, 1));
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length} pages, ${bad.length} with findings`);
browser.close();
// the profile directory can only go once Chrome has let go of it
await new Promise((resolve) => { chrome.once('exit', resolve); chrome.kill(); });
rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
process.exit(bad.length ? 1 : 0);
