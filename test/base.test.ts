import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeBase } from '../lib/base.ts';

test('every spelling of a mount prefix normalizes to "" or "/prefix"', () => {
  assert.equal(normalizeBase(undefined), '');
  assert.equal(normalizeBase(''), '');
  assert.equal(normalizeBase('/'), '');
  assert.equal(normalizeBase('docs'), '/docs');
  assert.equal(normalizeBase('/docs'), '/docs');
  assert.equal(normalizeBase('docs/'), '/docs');
  assert.equal(normalizeBase('/docs/'), '/docs');
  assert.equal(normalizeBase('/docs//'), '/docs');
  assert.equal(normalizeBase('/a/b/'), '/a/b');
});

test('repeated leading slashes collapse — no protocol-relative shape survives', () => {
  assert.equal(normalizeBase('//docs'), '/docs');
  assert.equal(normalizeBase('///docs//'), '/docs');
  assert.equal(normalizeBase('//'), '');
  assert.equal(normalizeBase('///'), '');
});

test('a query or fragment is rejected: a mount prefix is a path', () => {
  assert.throws(() => normalizeBase('/docs?x=1'), /cannot carry a query or fragment/);
  assert.throws(() => normalizeBase('/docs#frag'), /cannot carry a query or fragment/);
});
