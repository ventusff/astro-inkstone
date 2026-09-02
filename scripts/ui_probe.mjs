/**
 * ui_probe — a render-layer probe. Loads every page of a built site (nested
 * index.html routes and flat pages, 404.html included) in headless Chrome,
 * lays it out at four viewport widths and reports what a machine can verify
 * about the rendered result, over the whole document — chrome, sidebar and
 * dialogs included (static dialog markup is part of every pass; on one
 * representative route each `<dialog data-probe-open>` is also opened and
 * its layout checked): horizontal overflow of the page, elements wider than
 * their container with no scroll box to live in, classes no stylesheet rule
 * styles, skipped heading levels, duplicate ids, images without an alt
 * attribute, in-page anchors and aria-controls pointing at ids that do not
 * exist. It makes no aesthetic judgement.
 *
 * A route is loaded once and re-laid out in place at every width. The
 * layout checks (page overflow, container breaks) run at every width; the
 * markup checks (classes, headings, alt, ids, anchors, aria-controls) do not
 * depend on the viewport and run once per route, reported with the last
 * width. Routes are probed concurrently, longest pages first, one browser
 * process per worker.
 *
 * Usage (site-agnostic — everything site-specific arrives via args/env):
 *   node scripts/ui_probe.mjs [distDir] [baseUrl] [outFile] [--exclude <route regex>]
 *     distDir  build output directory, default ./dist (relative to cwd)
 *     baseUrl  optional address of an already-running static server; when
 *              omitted the probe serves distDir itself on an ephemeral port
 *     outFile  report file, default ui-probe.txt
 *   Environment:
 *     CHROME_PATH    Chrome/Chromium executable, default /usr/bin/google-chrome
 *     PROBE_WORKERS  tabs probing concurrently, default half the machine's cores
 * Green means the last line reads SAMPLES WITH FINDINGS: 0. A sample is one
 * route at one width; the line also names how many distinct pages the
 * findings touch. Progress is written to stderr.
 */
import puppeteer from 'puppeteer-core';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { availableParallelism } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';

// --exclude <regex>: routes matching it are not probed. A site with many
// locale trees probes a representative subset by default and passes nothing
// here for the full run.
const __argv = process.argv.slice(2);
const __ex = __argv.indexOf('--exclude');
const EXCLUDE = __ex >= 0 ? new RegExp(__argv.splice(__ex, 2)[1]) : null;

const DIST = __argv[0] || resolve('dist');
const WIDTHS = [1440, 1024, 768, 430];
const WORKERS = Math.max(1, Number(process.env.PROBE_WORKERS) || Math.floor(availableParallelism() / 2));

// Serve DIST ourselves unless the caller points us at a running server.
let server = null;
let BASE = __argv[1];
if (!BASE) {
  const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
    '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  };
  // requests are confined to DIST: no traversal segments, and every resolved
  // path must stay inside it
  const root = resolve(DIST);
  server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    for (const candidate of [p, `${p}/index.html`]) {
      const abs = resolve(root, `.${candidate}`);
      if (candidate.split('/').includes('..') || abs !== root && !abs.startsWith(root + sep)) break;
      try {
        const buf = readFileSync(abs);
        res.setHeader('content-type', MIME[extname(candidate)] ?? 'application/octet-stream');
        return res.end(buf);
      } catch { /* try next */ }
    }
    res.statusCode = 404;
    res.end('not found');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  BASE = `http://127.0.0.1:${server.address().port}`;
}

function routes(dir, prefix = '') {
  let out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = out.concat(routes(p, `${prefix}${e}/`));
    else if (e === 'index.html') out.push(`/${prefix}`);
    else if (e.endsWith('.html')) out.push(`/${prefix}${e}`); // flat pages, 404.html
  }
  return out.sort();
}

/* ------------------------------------------------------ page-side checks */
// Evaluated inside the page: each function is self-contained.

/** Viewport-dependent: the page's horizontal overflow, and elements wider
 *  than their container. `scope` is 'document' (everything under body) or
 *  'dialogs' (the contents of the open dialogs). */
const layoutChecks = (scope) => {
  const out = { hOverflow: null, wide: [] };
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1)
    out.hOverflow = { doc: de.scrollWidth, view: de.clientWidth };

  const sel = (el) => {
    const cls = (el.className && typeof el.className === 'string') ? '.' + el.className.trim().split(/\s+/).join('.') : '';
    return el.tagName.toLowerCase() + cls;
  };
  // An ancestor that scrolls (overflow auto/scroll) is the element's
  // legitimate home; an ancestor that clips (overflow hidden) is not —
  // clipped content is lost content. KaTeX's hidden MathML is
  // screen-reader-only markup, excluded from visual judgement.
  const hasScrollAncestor = (el) => {
    for (let n = el.parentElement; n && n.tagName !== 'BODY'; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return true;
      // the visually-hidden idiom (a 1px clipped box for assistive technology)
      if (cs.overflow === 'hidden' && n.clientWidth <= 1 && n.clientHeight <= 1) return true;
    }
    return false;
  };
  // A `display: contents` parent generates no box (its rect is empty by
  // spec) — the containment reference is the nearest ancestor that does.
  const boxedParent = (el) => {
    let n = el.parentElement;
    while (n && n.tagName !== 'BODY' && getComputedStyle(n).display === 'contents') n = n.parentElement;
    return n;
  };
  const elements = document.querySelectorAll(scope === 'dialogs' ? 'dialog[open] *' : 'body *');
  for (const el of elements) {
    const p = boxedParent(el);
    if (!p) continue;
    if (el.closest('.katex-mathml, math, .katex')) continue;
    const a = el.getBoundingClientRect(), b = p.getBoundingClientRect();
    const intentionalBleed = el.classList.contains('wide');
    if (a.width > b.width + 2 && !intentionalBleed && !hasScrollAncestor(el))
      out.wide.push({ el: sel(el), w: Math.round(a.width), parent: sel(p), pw: Math.round(b.width) });
  }
  return out;
};

/** Viewport-independent: classes without a rule, heading level skips,
 *  images without alt, duplicate ids, dead anchors and aria-controls. */
const markupChecks = () => {
  const out = { unstyled: [], headingJump: [], noAlt: [], dupId: [], deadAnchor: [], deadControl: [] };
  const sel = (el) => {
    const cls = (el.className && typeof el.className === 'string') ? '.' + el.className.trim().split(/\s+/).join('.') : '';
    return el.tagName.toLowerCase() + cls;
  };
  // 1) Classes no stylesheet rule styles: a used class must be mentioned
  //    by a selector in the live document.styleSheets, and at least one
  //    mentioning selector must be able to apply.
  const selectors = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin sheet, unreadable
    const walk = (list) => {
      for (const r of list) {
        if (r.selectorText) selectors.push(r.selectorText);
        if (r.cssRules) walk(r.cssRules); // rules inside @media / @supports
      }
    };
    walk(rules);
  }
  const mentions = (cls) => selectors.filter((s) => new RegExp('\\.' + cls.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&') + '(?![\\w-])').test(s));
  const seenCls = new Set();
  for (const el of document.querySelectorAll('body [class]')) {
    for (const cls of el.classList) {
      // Classes that carry no rule by contract: Shiki's theme markers on
      // <pre> and its `.line`; the code-frame transformer's structural
      // markers (styled through element selectors); GFM's footnote
      // back-reference marker.
      if (el.matches('pre.astro-code')) continue;
      const GENERATED = new Set(['line', 'has-diff', 'is-collapsible', 'code-frame-body', 'data-footnote-backref']);
      // vendor-generated class families (Astro scoped-style hashes, KaTeX
      // internals, mermaid, shiki, the CMS client, copy-button states):
      // site-authored classes never start with these, so the exemption
      // cannot mask a site typo
      const GEN_PREFIX = ['astro-', 'wiki-', 'katex', 'shiki', 'code-copy', 'mermaid'];
      if (seenCls.has(cls) || GEN_PREFIX.some((p) => cls.startsWith(p)) || GENERATED.has(cls)) continue;
      if (el.closest && el.closest('.katex, .mermaid-block')) { seenCls.add(cls); continue; }
      const cands = mentions(cls);
      if (!cands.length) { seenCls.add(cls); out.unstyled.push({ el: '.' + cls, why: 'no stylesheet rule mentions it' }); continue; }
      // A mention inside a non-subject compound (`.item + .item`,
      // `.list .item > a`) styles structure and needs no live match;
      // subject-position mentions must match a real element.
      const clsRe = new RegExp('\\.' + cls.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&') + '(?![\\w-])');
      const anchorsElsewhere = (s) => s.split(',').some((one) => {
        const compounds = one.trim().split(/\s*[>+~]\s*|\s+/);
        return compounds.slice(0, -1).some((c) => clsRe.test(c));
      });
      // a selector the browser cannot parse matches nothing
      const matched = cands.some((s) => {
        try { return el.matches(s) || document.querySelector(s) || anchorsElsewhere(s); } catch { return false; }
      });
      if (!matched) { seenCls.add(cls); out.unstyled.push({ el: '.' + cls, why: 'mentioned but no selector matches (e.g. a > child combinator blocked by <p>)' }); }
    }
  }
  // 2) Heading level skips, over the whole document
  let last = 0;
  for (const h of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    const lvl = +h.tagName[1];
    if (last && lvl > last + 1) out.headingJump.push({ from: 'h' + last, to: h.tagName.toLowerCase(), text: (h.textContent || '').slice(0, 30) });
    last = lvl;
  }
  // 3) Images without an alt attribute (alt="" is a declared decorative image)
  for (const img of document.querySelectorAll('img')) if (!img.hasAttribute('alt')) out.noAlt.push({ src: img.getAttribute('src') });
  // 4) Duplicate ids: an anchor must have one target
  const seenId = new Map();
  for (const el of document.querySelectorAll('[id]')) {
    const n = (seenId.get(el.id) ?? 0) + 1;
    seenId.set(el.id, n);
    if (n === 2) out.dupId.push({ id: el.id });
  }
  // 5) In-page anchors and aria-controls pointing at ids that do not exist
  for (const a of document.querySelectorAll('a[href^="#"]')) {
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (id && !document.getElementById(id)) out.deadAnchor.push({ href: a.getAttribute('href'), text: (a.textContent || '').slice(0, 20) });
  }
  for (const el of document.querySelectorAll('[aria-controls]')) {
    for (const id of el.getAttribute('aria-controls').split(/\s+/)) {
      if (id && !document.getElementById(id)) out.deadControl.push({ el: sel(el), id });
    }
  }
  return out;
};

/** Open every marked dialog; a search box inside gets a query so result
 *  rows render and are laid out too. Returns how many were opened. */
const openDialogs = () => {
  const dialogs = [...document.querySelectorAll('dialog[data-probe-open]:not([open])')];
  for (const d of dialogs) {
    try { d.showModal(); } catch { d.setAttribute('open', ''); }
    const input = d.querySelector('input[type="search"], input[type="text"], input:not([type])');
    if (input) {
      input.value = 'the';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  return dialogs.length;
};
const closeDialogs = () => {
  for (const d of document.querySelectorAll('dialog[data-probe-open][open]')) {
    try { d.close(); } catch { /* not a dialog the UA can close */ }
    d.removeAttribute('open');
  }
};

/** Two animation frames: resize handlers and container queries have run. */
const twoFrames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

/* ------------------------------------------------------------- the sweep */
const empty = () => ({ hOverflow: null, wide: [], unstyled: [], headingJump: [], noAlt: [], dupId: [], deadAnchor: [], deadControl: [] });
const hit = (s) =>
  s.hOverflow || s.wide.length || s.unstyled.length || s.headingJump.length ||
  s.noAlt.length || s.dupId.length || s.deadAnchor.length || s.deadControl.length;

/**
 * One route on one tab: load, lay out at every width, then the markup
 * checks once; on the representative route the marked dialogs are opened
 * at every width and their layout checked. Returns the samples with
 * findings.
 */
async function probeRoute(page, quiet, route, order) {
  const samples = [];
  const settle = async () => {
    await page.evaluate(twoFrames);
    await quiet(150, 2_000); // anything the new width fetched
  };
  await page.setViewport({ width: WIDTHS[0], height: 1200 });
  // 'load' + a capped quiet-period wait: strict networkidle0 can hang
  // forever on environments where some request never settles, and a probe
  // must never be the flaky part of CI.
  await page.goto(BASE + route, { waitUntil: 'load', timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await quiet(400, 5_000);
  for (const [i, width] of WIDTHS.entries()) {
    await page.setViewport({ width, height: 1200 });
    await settle();
    samples.push({ order, route, width, dlg: 0, ...empty(), ...(await page.evaluate(layoutChecks, 'document')) });
    // the markup checks see the document as every width left it
    if (i === WIDTHS.length - 1) Object.assign(samples[samples.length - 1], await page.evaluate(markupChecks));
  }
  // marked dialogs get their geometry checked open, on one representative
  // route (their static markup — ids, anchors, classes — is already part of
  // the normal pass; only layout needs them open)
  if (order === 0) {
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: 1200 });
      await settle();
      if (!(await page.evaluate(openDialogs))) break;
      await quiet(300, 5_000);
      const res = await page.evaluate(layoutChecks, 'dialogs');
      await page.evaluate(closeDialogs);
      samples.push({ order, route: `${route} (dialogs open)`, width, dlg: 1, ...empty(), ...res });
    }
  }
  return samples.filter(hit);
}

const routeList = routes(DIST).filter((r) => !EXCLUDE || !EXCLUDE.test(r));
// the work list: longest pages first, so no worker is left on a long page
// alone at the end (the representative route stays the first route in
// sorted order, and findings are reported in that order)
const size = (r) => statSync(join(DIST, r.endsWith('/') ? `${r}index.html` : r)).size;
const work = [...routeList].sort((a, b) => size(b) - size(a));
const findings = [];
const t0 = Date.now();
let next = 0;
let done = 0;
const progress = () => {
  done += 1;
  const step = Math.max(1, Math.ceil(routeList.length / 10));
  if (done % step === 0 || done === routeList.length)
    console.error(`ui_probe: ${done}/${routeList.length} routes · ${Math.round((Date.now() - t0) / 1000)}s`);
};

try {
  // A worker is a browser of its own, taking routes off the shared work
  // list until it is empty.
  const worker = async () => {
    const browser = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--hide-scrollbars'],
    });
    const page = await browser.newPage();
    // Quiet-period wait keyed on request ARRIVALS, not on the in-flight
    // count: puppeteer's waitForNetworkIdle can be poisoned by a request a
    // navigation interrupted (it stays "in flight" forever), after which
    // every later page pays the full cap. A request that never settles must
    // cost its own page at most once — never the whole run.
    let lastRequest = Date.now();
    page.on('request', () => { lastRequest = Date.now(); });
    const quiet = async (idleMs, capMs) => {
      const start = Date.now();
      while (Date.now() - lastRequest < idleMs && Date.now() - start < capMs) {
        await new Promise((res) => setTimeout(res, 50));
      }
    };
    try {
      for (let i = next++; i < work.length; i = next++) {
        findings.push(...(await probeRoute(page, quiet, work[i], routeList.indexOf(work[i]))));
        progress();
      }
    } finally {
      await browser.close();
    }
  };
  await Promise.all(Array.from({ length: Math.min(WORKERS, work.length) }, worker));
} finally {
  server?.close();
}

/* --------------------------------------------------------------- report */
findings.sort((a, b) => a.order - b.order || WIDTHS.indexOf(a.width) - WIDTHS.indexOf(b.width) || a.dlg - b.dlg);
const brief = findings.map((f) => {
  const bits = [];
  if (f.hOverflow) bits.push(`page overflows horizontally doc=${f.hOverflow.doc} > view=${f.hOverflow.view}`);
  if (f.wide.length) bits.push('breaks its container: ' + [...new Set(f.wide.map((x) => `${x.el}(${x.w}) > ${x.parent}(${x.pw})`))].slice(0, 4).join('; '));
  if (f.unstyled.length) bits.push('unstyled classes: ' + f.unstyled.map((x) => `${x.el}(${x.why})`).slice(0, 6).join(', '));
  if (f.headingJump.length) bits.push('heading level skips: ' + f.headingJump.map((x) => `${x.from}→${x.to}`).join(', '));
  if (f.noAlt.length) bits.push(`images without alt ×${f.noAlt.length}`);
  if (f.dupId.length) bits.push('duplicate ids: ' + f.dupId.map((x) => `#${x.id}`).join(', '));
  if (f.deadAnchor.length) bits.push('dead anchors: ' + f.deadAnchor.map((x) => `${x.href}(${x.text})`).join(', '));
  if (f.deadControl.length) bits.push('aria-controls without target: ' + f.deadControl.map((x) => `${x.el}→#${x.id}`).join(', '));
  return `${f.route} @${f.width}\n    ${bits.join('\n    ')}`;
});
const pages = new Set(findings.map((f) => f.route)).size;
const tally = `SAMPLES WITH FINDINGS: ${findings.length} (${pages} pages)`;
writeFileSync(__argv[2] || 'ui-probe.txt', brief.join('\n') + `\n\n${tally}\n`);
console.log(brief.slice(0, 40).join('\n'));
console.log(`\n${tally}`);
process.exitCode = findings.length ? 1 : 0;
