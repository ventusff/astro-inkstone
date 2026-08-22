/**
 * ui_probe — a render-layer probe. Loads every page of a built site at four
 * viewport widths in headless Chrome and reports what a machine can verify
 * about the rendered result, over the whole document — chrome, sidebar and
 * dialogs included: horizontal overflow of the page, elements wider than
 * their container with no scroll box to live in, classes no stylesheet rule
 * styles, skipped heading levels, duplicate ids, images without an alt
 * attribute, in-page anchors and aria-controls pointing at ids that do not
 * exist. It makes no aesthetic judgement.
 *
 * Usage (site-agnostic — everything site-specific arrives via args/env):
 *   node scripts/ui_probe.mjs [distDir] [baseUrl] [outFile]
 *     distDir  build output directory, default ./dist (relative to cwd)
 *     baseUrl  optional address of an already-running static server; when
 *              omitted the probe serves distDir itself on an ephemeral port
 *     outFile  report file, default ui-probe.txt
 *   Environment:
 *     CHROME_PATH  Chrome/Chromium executable, default /usr/bin/google-chrome
 * Green means the last line reads SAMPLES WITH FINDINGS: 0. A sample is one
 * route at one width; the line also names how many distinct pages the
 * findings touch.
 */
import puppeteer from 'puppeteer-core';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';

const DIST = process.argv[2] || resolve('dist');
const WIDTHS = [1440, 1024, 768, 430];

// Serve DIST ourselves unless the caller points us at a running server.
let server = null;
let BASE = process.argv[3];
if (!BASE) {
  const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
    '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  };
  server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    for (const candidate of [p, `${p}/index.html`]) {
      try {
        const buf = readFileSync(join(DIST, candidate));
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
  }
  return out.sort();
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--hide-scrollbars'],
});
const findings = [];
try {
const page = await browser.newPage();

for (const r of routes(DIST)) {
  for (const w of WIDTHS) {
    await page.setViewport({ width: w, height: 1200 });
    // 'load' + a capped quiet-period wait: strict networkidle0 can hang
    // forever on environments where some request never settles, and a probe
    // must never be the flaky part of CI.
    await page.goto(BASE + r, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForNetworkIdle({ idleTime: 400, timeout: 5_000 }).catch(() => {});
    const res = await page.evaluate(() => {
      const out = { hOverflow: null, wide: [], unstyled: [], headingJump: [], noAlt: [], dupId: [], deadAnchor: [], deadControl: [] };
      const de = document.documentElement;
      if (de.scrollWidth > de.clientWidth + 1)
        out.hOverflow = { doc: de.scrollWidth, view: de.clientWidth };

      const sel = (el) => {
        const cls = (el.className && typeof el.className === 'string') ? '.' + el.className.trim().split(/\s+/).join('.') : '';
        return el.tagName.toLowerCase() + cls;
      };
      // 1) Elements wider than their own container. An ancestor that scrolls
      //    (overflow auto/scroll) is the element's legitimate home; an
      //    ancestor that clips (overflow hidden) is not — clipped content is
      //    lost content. KaTeX's hidden MathML is screen-reader-only markup,
      //    excluded from visual judgement.
      const hasScrollAncestor = (el) => {
        for (let n = el.parentElement; n && n.tagName !== 'BODY'; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return true;
          // the visually-hidden idiom (a 1px clipped box for assistive technology)
          if (cs.overflow === 'hidden' && n.clientWidth <= 1 && n.clientHeight <= 1) return true;
        }
        return false;
      };
      for (const el of document.querySelectorAll('body *')) {
        const p = el.parentElement;
        if (!p) continue;
        if (el.closest('.katex-mathml, math, .katex')) continue;
        const a = el.getBoundingClientRect(), b = p.getBoundingClientRect();
        const intentionalBleed = el.classList.contains('wide');
        if (a.width > b.width + 2 && !intentionalBleed && !hasScrollAncestor(el))
          out.wide.push({ el: sel(el), w: Math.round(a.width), parent: sel(p), pw: Math.round(b.width) });
      }
      // 2) Classes no stylesheet rule styles: a used class must be mentioned
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
          // generated/stateful families: KaTeX internals, mermaid, shiki,
          // the CMS client's classes, copy-button states
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
      // 3) Heading level skips, over the whole document
      let last = 0;
      for (const h of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
        const lvl = +h.tagName[1];
        if (last && lvl > last + 1) out.headingJump.push({ from: 'h' + last, to: h.tagName.toLowerCase(), text: (h.textContent || '').slice(0, 30) });
        last = lvl;
      }
      // 4) Images without an alt attribute (alt="" is a declared decorative image)
      for (const img of document.querySelectorAll('img')) if (!img.hasAttribute('alt')) out.noAlt.push({ src: img.getAttribute('src') });
      // 5) Duplicate ids: an anchor must have one target
      const seenId = new Map();
      for (const el of document.querySelectorAll('[id]')) {
        const n = (seenId.get(el.id) ?? 0) + 1;
        seenId.set(el.id, n);
        if (n === 2) out.dupId.push({ id: el.id });
      }
      // 6) In-page anchors and aria-controls pointing at ids that do not exist
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
    });
    const hit =
      res.hOverflow || res.wide.length || res.unstyled.length || res.headingJump.length ||
      res.noAlt.length || res.dupId.length || res.deadAnchor.length || res.deadControl.length;
    if (hit) findings.push({ route: r, width: w, ...res });
  }
}
} finally {
  await browser.close();
  server?.close();
}

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
writeFileSync(process.argv[4] || 'ui-probe.txt', brief.join('\n') + `\n\n${tally}\n`);
console.log(brief.slice(0, 40).join('\n'));
console.log(`\n${tally}`);
process.exitCode = findings.length ? 1 : 0;
