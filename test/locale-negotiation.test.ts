import assert from 'node:assert/strict';
import { test } from 'node:test';

import { negotiateLocale, relocalize } from '../lib/locale-negotiation.ts';

const locales = [
  { code: 'zh', prefix: '' },
  { code: 'en', prefix: 'en/' },
  { code: 'de', prefix: 'de/' },
] as const;
const options = { locales, defaultLocale: 'zh', cookie: 'chaser_lang' };
const ask = (href: string, lang?: string, page = true, localized = true) =>
  negotiateLocale(
    { url: new URL(href, 'https://x.hub.example'), cookies: lang ? { chaser_lang: lang } : {}, page, localized },
    options,
  );

test('the reader’s language decides; without it, the site default', () => {
  assert.equal(ask('/a/', 'de').locale, 'de');
  assert.equal(ask('/a/').locale, 'zh');
  assert.equal(ask('/a/', 'fr').locale, 'zh');
});

test('no address overrides the reader’s language: every localized page moves to it', () => {
  assert.equal(ask('/ec2/launch/', 'de').redirect, '/de/ec2/launch/');
  assert.equal(ask('/en/ec2/launch/', 'de').redirect, '/de/ec2/launch/');
  assert.equal(ask('/en/ec2/launch/?q=1#s', 'zh').redirect, '/ec2/launch/?q=1#s');
  assert.equal(ask('/de/', 'zh').redirect, '/');
  assert.equal(ask('/', 'en').redirect, '/en/');
  assert.equal(ask('/de/ec2/launch/', 'de').redirect, null);
});

test('signed-out readers and machine clients get the site default addresses', () => {
  assert.equal(ask('/en/ec2/launch/').redirect, '/ec2/launch/');
});

test('assets, APIs and routes not served per locale are never moved', () => {
  assert.deepEqual(ask('/book.json', 'de', false), { locale: 'de', redirect: null });
  assert.deepEqual(ask('/compute/', 'de', true, false), { locale: 'de', redirect: null });
});

test('relocalize respects a deploy base and leaves paths outside it alone', () => {
  assert.equal(relocalize('/wiki/en/icl/', 'de', locales, '/wiki/'), '/wiki/de/icl/');
  assert.equal(relocalize('/wiki/icl/', 'en', locales, 'wiki'), '/wiki/en/icl/');
  assert.equal(relocalize('/cards/x/', 'en', locales, '/wiki/'), '/cards/x/');
  assert.equal(relocalize('/english/x/', 'de', locales), '/de/english/x/');
});
