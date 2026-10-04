import assert from 'node:assert/strict';
import { test } from 'node:test';

import { busy, isSyncAnswer, lineText } from '../lib/translation-sync.ts';

const answer = (phase: 'queued' | 'running' | 'done' | 'failed' | null) => ({
  can: true,
  sync: phase ? { phase } : null,
  words: { action: 'Sync translations now', busy: 'Syncing…', state: null, next: { text: 'Next automatic sync: {time}', at: '2026-10-04T01:00:00.000Z' } },
});

test('an answer carries the button, its busy form, the state line and the next-sync line', () => {
  assert.equal(isSyncAnswer(answer(null)), true);
  assert.equal(isSyncAnswer({ ...answer(null), words: { ...answer(null).words, state: { text: 'Queued' } } }), true);
  assert.equal(isSyncAnswer({ error: 'not found' }), false);
  assert.equal(isSyncAnswer({ ...answer(null), can: 'yes' }), false);
  assert.equal(isSyncAnswer({ ...answer(null), words: { action: 'x', busy: 'y', state: null } }), false);
  assert.equal(isSyncAnswer({ ...answer(null), sync: undefined }), false);
  assert.equal(isSyncAnswer({ ...answer(null), sync: { phase: 'paused' } }), false);
  assert.equal(isSyncAnswer({ ...answer(null), words: { ...answer(null).words, next: { text: 'x', at: 5 } } }), false);
});

test('an answer may carry a heading, a status word, when translations last went live and the wait before pressing again', () => {
  const w = answer(null).words;
  const full = { ...w, title: 'Translations', status: { text: 'Up to date', kind: 'ok' }, last: { text: 'Last {time}', at: '2026-10-03T01:00:00.000Z' }, wait: null };
  assert.equal(isSyncAnswer({ ...answer(null), words: full }), true);
  assert.equal(isSyncAnswer({ ...answer(null), words: { ...full, last: null, wait: { text: 'From {time}', at: '2026-10-03T09:07:00.000Z' } } }), true);
  assert.equal(isSyncAnswer({ ...answer(null), words: { ...full, status: { text: 'x', kind: 'paused' } } }), false);
  assert.equal(isSyncAnswer({ ...answer(null), words: { ...full, title: 3 } }), false);
  assert.equal(isSyncAnswer({ ...answer(null), words: { ...full, last: 'yesterday' } }), false);
});

test('a sync is on its way while queued or running', () => {
  assert.deepEqual(['queued', 'running', 'done', 'failed', null].map((p) => busy(answer(p as never))), [true, true, false, false, false]);
});

test('{time} is the clock time of `at`, with the weekday within a week and the date beyond', () => {
  const now = new Date(2026, 9, 3, 10, 0);
  const at = (d: Date) => ({ text: 'at {time}', at: d.toISOString() });
  assert.equal(lineText(at(new Date(2026, 9, 3, 14, 5)), 'en-GB', now), 'at 14:05');
  assert.equal(lineText(at(new Date(2026, 9, 4, 3, 0)), 'en-GB', now), 'at Sun 03:00');
  assert.equal(lineText(at(new Date(2026, 9, 20, 3, 0)), 'en-GB', now), 'at 20 Oct, 03:00');
  assert.equal(lineText(at(new Date(2026, 9, 4, 3, 0)), 'zh-CN', now), 'at 周日 03:00');
  assert.equal(lineText(at(new Date(2026, 9, 20, 3, 0)), 'zh-CN', now), 'at 10月20日 03:00');
  assert.equal(lineText({ text: 'no time here' }, 'en', now), 'no time here');
  assert.equal(lineText({ text: 'at {time}', at: 'never' }, 'en', now), 'at {time}');
});
