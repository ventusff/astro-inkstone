import assert from 'node:assert/strict';
import { test } from 'node:test';

import { languageSignal } from '../lib/language-status.ts';

test('a newer version on its way — queued, being translated or published — makes the trigger busy', () => {
  for (const kind of ['queued', 'updating', 'pushed']) {
    assert.equal(languageSignal([undefined, kind]), 'busy', kind);
  }
});

test('work under way outranks a failure, in any order', () => {
  assert.equal(languageSignal(['failed', 'pushed']), 'busy');
  assert.equal(languageSignal(['updating', 'failed']), 'busy');
});

test('a failure alone is a steady signal', () => {
  assert.equal(languageSignal(['missing', 'failed', undefined]), 'failed');
});

test('states that are not work under way signal nothing', () => {
  assert.equal(languageSignal([]), undefined);
  assert.equal(languageSignal([undefined, 'partial', 'missing', '']), undefined);
});
