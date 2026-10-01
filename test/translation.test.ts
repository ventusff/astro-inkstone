import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { gitBlobId, sourceRevision, translationState } from '../lib/translation.ts';

const SAMPLES = [
  '',
  'plain ascii\n',
  '---\ntitle: 价格表\n---\n\n正文,含全角标点与 emoji 🧪。\n',
  'no trailing newline',
  'crlf\r\nline endings\r\n',
];

test('gitBlobId matches `git hash-object` byte for byte', () => {
  const dir = mkdtempSync(join(tmpdir(), 'inkstone-translation-'));
  SAMPLES.forEach((text, i) => {
    const file = join(dir, `s${i}.mdx`);
    writeFileSync(file, text);
    const expected = execFileSync('git', ['hash-object', '--no-filters', file], { encoding: 'utf8' }).trim();
    assert.equal(gitBlobId(text), expected, JSON.stringify(text));
    assert.equal(gitBlobId(new TextEncoder().encode(text)), expected);
  });
});

test('sourceRevision is the 12-digit prefix', () => {
  const text = SAMPLES[2]!;
  assert.equal(sourceRevision(text), gitBlobId(text).slice(0, 12));
  assert.match(sourceRevision(text), /^[0-9a-f]{12}$/);
});

test('a recorded revision prefix of the current source is current', () => {
  const src = SAMPLES[2]!;
  const id = gitBlobId(src);
  assert.equal(translationState({ locale: 'zh', revision: id.slice(0, 12) }, src), 'current');
  assert.equal(translationState({ locale: 'zh', revision: id.slice(0, 7) }, src), 'current');
  assert.equal(translationState({ locale: 'zh', revision: id }, src), 'current');
  assert.equal(translationState({ locale: 'zh', revision: id.slice(0, 12).toUpperCase() }, src), 'current');
});

test('any change to the source puts the translation behind', () => {
  const src = SAMPLES[2]!;
  const revision = sourceRevision(src);
  assert.equal(translationState({ locale: 'zh', revision }, src.replace('价格表', '价目表')), 'behind');
  assert.equal(translationState({ locale: 'zh', revision }, `${src}\n`), 'behind');
});

test('a missing or malformed revision is unrecorded, never current', () => {
  const src = SAMPLES[1]!;
  assert.equal(translationState(undefined, src), 'unrecorded');
  assert.equal(translationState(null, src), 'unrecorded');
  assert.equal(translationState({ locale: 'zh' }, src), 'unrecorded');
  assert.equal(translationState({ locale: 'zh', revision: '' }, src), 'unrecorded');
  assert.equal(translationState({ locale: 'zh', revision: 'abc' }, src), 'unrecorded');
  assert.equal(translationState({ locale: 'zh', revision: 'not-a-hash!' }, src), 'unrecorded');
});
