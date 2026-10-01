import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseCookies, readerRedirect } from '../lib/reader-language.ts';

const options = {
  locales: [
    { code: 'zh', prefix: '' },
    { code: 'en', prefix: 'en/' },
    { code: 'de', prefix: 'de/' },
  ],
  defaultLocale: 'zh',
  cookie: 'chaser_lang',
};
const page = (url: string, cookie?: string, accept = 'text/html,application/xhtml+xml', method = 'GET') =>
  readerRedirect({ method, url, headers: { accept, cookie } }, options);

test('a page navigation goes to the reader’s language', () => {
  assert.equal(page('/en/ec2/launch/', 'x=1; chaser_lang=de'), '/de/ec2/launch/');
  assert.equal(page('/ec2/launch/', 'chaser_lang=en'), '/en/ec2/launch/');
  assert.equal(page('/de/ec2/launch/', 'chaser_lang=de'), null);
  assert.equal(page('/en/ec2/launch/'), '/ec2/launch/');
});

test('an .html address is a page like its directory route', () => {
  assert.equal(page('/en/ec2/launch/index.html', 'chaser_lang=de'), '/de/ec2/launch/index.html');
  assert.equal(page('/en/404.html', 'chaser_lang=zh'), '/404.html');
  assert.equal(page('/de/ec2/launch/index.html', 'chaser_lang=de'), null);
});

test('files, engine endpoints, non-GET and non-HTML requests pass through', () => {
  assert.equal(page('/en/search-index.json', 'chaser_lang=de'), null);
  assert.equal(page('/en/fig.svg', 'chaser_lang=de'), null);
  assert.equal(page('/api/wiki/save', 'chaser_lang=de'), null);
  assert.equal(page('/_astro/x', 'chaser_lang=de'), null);
  assert.equal(page('/@vite/client', 'chaser_lang=de'), null);
  assert.equal(page('/en/x/', 'chaser_lang=de', 'application/json'), null);
  assert.equal(page('/en/x/', 'chaser_lang=de', 'text/html', 'POST'), null);
});

test('a deploy base scopes the redirect', () => {
  const r = readerRedirect({ method: 'GET', url: '/wiki/en/icl/', headers: { accept: 'text/html', cookie: 'chaser_lang=de' } }, { ...options, base: '/wiki/' });
  assert.equal(r, '/wiki/de/icl/');
});

test('cookie parsing tolerates malformed percent-encoding', () => {
  assert.deepEqual(parseCookies('a=1; b=%E4%B8%AD; c=%zz; bare'), { a: '1', b: '中', c: '%zz' });
});
