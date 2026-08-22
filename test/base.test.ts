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
