/**
 * built-pages — the pages of a built site, as the routes a browser opens.
 *
 * Every `index.html` under the build directory is the route of its directory
 * (`/a/b/`), every other `.html` file a flat page (`/404.html`). An Astro
 * `redirects` entry is built as a stub whose only content is a meta refresh:
 * it navigates away as soon as it loads, tearing down the page under any
 * check, and renders nothing of its own, so it is no page here.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REDIRECT_STUB = /<meta\s+http-equiv=["']refresh["']/i;

/** @param {string} file an HTML file @returns {boolean} the file is a redirect stub */
const isRedirectStub = (file) => REDIRECT_STUB.test(readFileSync(file, 'utf8').slice(0, 2048));

/**
 * The routes of the built site in `dir`, sorted, redirect stubs left out.
 * @param {string} dir the build directory (`dist`)
 * @returns {string[]} routes such as `/`, `/guide/start/`, `/404.html`
 */
export function builtPages(dir, prefix = '/') {
  let out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = out.concat(builtPages(p, `${prefix}${e}/`));
    else if (e.endsWith('.html') && !isRedirectStub(p)) out.push(e === 'index.html' ? prefix : `${prefix}${e}`);
  }
  return out.sort();
}
