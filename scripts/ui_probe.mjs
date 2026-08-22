/**
 * ui_probe — a quantitative render-layer probe. Loads every page of a built
 * site at several viewport widths and reports real layout problems.
 *
 * Why it exists: source-level checks (links, ids, types) can all pass while
 * the rendered page is broken — an unstyled card row, a figure pushing the
 * page into horizontal scroll. Eyes and screenshots are not enough either:
 * a scrollable container always looks clipped in a static image. So this
 * probe reports only what a machine can verify, and makes no aesthetic
 * judgments — those belong to humans (or a separate review model).
 *
 * Usage (site-agnostic — everything site-specific arrives via args/env):
 *   node scripts/ui_probe.mjs [distDir] [baseUrl] [outFile]
 *     distDir  build output directory, default ./dist (relative to cwd)
 *     baseUrl  optional address of an already-running static server; when
 *              omitted the probe serves distDir itself on an ephemeral port
 *     outFile  report file, default ui-probe.txt
 *   Environment:
 *     CHROME_PATH  Chrome/Chromium executable, default /usr/bin/google-chrome
 * Green means the last line reads PAGES WITH FINDINGS: 0.
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
      const out = { hOverflow: null, wide: [], unstyled: [], lowContrast: [], headingJump: [], noAlt: [] };
      const de = document.documentElement;
      if (de.scrollWidth > de.clientWidth + 1)
        out.hOverflow = { doc: de.scrollWidth, view: de.clientWidth };

      const sel = (el) => {
        const cls = (el.className && typeof el.className === 'string') ? '.' + el.className.trim().split(/\s+/).join('.') : '';
        return el.tagName.toLowerCase() + cls;
      };
      // 1) Elements wider than their own container (the thing actually
      //    breaking the page). The scroll exemption walks the WHOLE ancestor
      //    chain, not just the direct parent (e.g. a shiki diff line lives in
      //    a scrollable <pre> with a wrapper in between). KaTeX's hidden
      //    MathML (.katex-mathml/<math>) is screen-reader-only markup and is
      //    excluded from visual judgment.
      const hasScrollAncestor = (el) => {
        for (let n = el.parentElement; n && n.tagName !== 'MAIN'; n = n.parentElement) {
          const o = getComputedStyle(n).overflowX;
          if (o === 'auto' || o === 'scroll' || o === 'hidden') return true;
        }
        return false;
      };
      for (const el of document.querySelectorAll('main *')) {
        const p = el.parentElement;
        if (!p) continue;
        if (el.closest('.katex-mathml, math, .katex')) continue;
        const a = el.getBoundingClientRect(), b = p.getBoundingClientRect();
        const intentionalBleed = el.classList.contains('wide');
        if (a.width > b.width + 2 && !intentionalBleed && !hasScrollAncestor(el))
          out.wide.push({ el: sel(el), w: Math.round(a.width), parent: sel(p), pw: Math.round(b.width) });
      }
      // 2) Classes no stylesheet rule actually styles. Evidence is the live
      //    document.styleSheets: a used class must be mentioned by some
      //    selector, and at least one mentioning selector must be able to
      //    apply — a mention behind a combinator that can never match still
      //    counts as unstyled.
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
      for (const el of document.querySelectorAll('main [class]')) {
        for (const cls of el.classList) {
          // Shiki-generated classes are colored via CSS variables, not class
          // selectors (the theme names it stamps on <pre> included); `.line` is
          // deliberately rule-free (a display:block rule would double every
          // line break inside <pre> — see base.css).
          // has-diff / is-collapsible / code-frame-body are structural markers
          // from the code-frame transformer — styled through element selectors
          // (details.code-frame …), so no class rule mentions them by name.
          // data-footnote-backref is GFM's marker class on footnote
          // back-links — deliberately rule-free.
          if (el.matches('pre.astro-code')) continue;
          const GENERATED = new Set(['line', 'has-diff', 'is-collapsible', 'code-frame-body', 'data-footnote-backref']);
          // Generated/stateful families that must not count as "unstyled":
          // KaTeX's internal classes (.mord etc. — katex.css does not style
          // them one by one), mermaid/shiki, and copy-button state classes.
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
          const matched = cands.some((s) => {
            try { return el.matches(s) || document.querySelector('main ' + s) || anchorsElsewhere(s); } catch { return true; }
          });
          if (!matched) { seenCls.add(cls); out.unstyled.push({ el: '.' + cls, why: 'mentioned but no selector matches (e.g. a > child combinator blocked by <p>)' }); }
        }
      }
      // 3) Heading level skips
      let last = 0;
      for (const h of document.querySelectorAll('main h1,main h2,main h3,main h4')) {
        const lvl = +h.tagName[1];
        if (last && lvl > last + 1) out.headingJump.push({ from: 'h' + last, to: h.tagName.toLowerCase(), text: (h.textContent || '').slice(0, 30) });
        last = lvl;
      }
      // 4) Images without alt
      for (const img of document.querySelectorAll('main img')) if (!img.getAttribute('alt')) out.noAlt.push({ src: img.getAttribute('src') });
      // 5) In-page anchors pointing at ids that do not exist
      out.deadAnchor = [];
      for (const a of document.querySelectorAll('main a[href^="#"]')) {
        const id = decodeURIComponent(a.getAttribute('href').slice(1));
        if (id && !document.getElementById(id)) out.deadAnchor.push({ href: a.getAttribute('href'), text: (a.textContent || '').slice(0, 20) });
      }
      return out;
    });
    const hit = res.hOverflow || res.wide.length || res.unstyled.length || res.headingJump.length || res.noAlt.length || res.deadAnchor?.length;
    if (hit) findings.push({ route: r, width: w, ...res });
  }
}
await browser.close();
server?.close();

const brief = findings.map((f) => {
  const bits = [];
  if (f.hOverflow) bits.push(`page overflows horizontally doc=${f.hOverflow.doc} > view=${f.hOverflow.view}`);
  if (f.wide.length) bits.push('breaks its container: ' + [...new Set(f.wide.map((x) => `${x.el}(${x.w}) > ${x.parent}(${x.pw})`))].slice(0, 4).join('; '));
  if (f.unstyled.length) bits.push('unstyled classes: ' + f.unstyled.map((x) => `${x.el}(${x.why})`).slice(0, 6).join(', '));
  if (f.headingJump.length) bits.push('heading level skips: ' + f.headingJump.map((x) => `${x.from}→${x.to}`).join(', '));
  if (f.noAlt.length) bits.push(`missing alt ×${f.noAlt.length}`);
  if (f.deadAnchor?.length) bits.push('dead anchors: ' + f.deadAnchor.map((x) => `${x.href}(${x.text})`).join(', '));
  return `${f.route} @${f.width}\n    ${bits.join('\n    ')}`;
});
writeFileSync(process.argv[4] || 'ui-probe.txt', brief.join('\n') + `\n\nPAGES WITH FINDINGS: ${findings.length}\n`);
console.log(brief.slice(0, 40).join('\n'));
console.log(`\nPAGES WITH FINDINGS: ${findings.length}`);
process.exitCode = findings.length ? 1 : 0;
