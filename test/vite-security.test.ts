import assert from 'node:assert/strict';
import { test } from 'node:test';

import { secureFsDeny } from '../lib/vite-security.ts';

test('the baseline denies env files, key material, VCS and state directories', () => {
  const { fs } = secureFsDeny();
  assert.equal(fs?.strict, true);
  for (const entry of ['.env', '.env.*', '*.{crt,pem,key,p12,pfx}', '**/.git/**', '**/.wiki/**', '**/*.db']) {
    assert.ok(fs?.deny?.includes(entry), `baseline misses ${entry}`);
  }
});

test('extraDeny is appended and never replaces the baseline', () => {
  const base = secureFsDeny().fs!.deny!;
  const extended = secureFsDeny(['**/secrets/**']).fs!.deny!;
  assert.deepEqual(extended, [...base, '**/secrets/**']);
});
