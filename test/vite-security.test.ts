import assert from 'node:assert/strict';
import { test } from 'node:test';

import { VITE_DEFAULT_DENY, secureFsDeny } from '../lib/vite-security.ts';

test('the baseline is a strict superset of the installed Vite fs.deny defaults', async () => {
  const { fs } = secureFsDeny();
  assert.equal(fs?.strict, true);
  // the authority is the installed Vite: resolve its actual defaults
  const { resolveConfig } = await import('vite');
  const resolved = await resolveConfig({ configFile: false, logLevel: 'silent' }, 'serve');
  for (const entry of resolved.server.fs.deny) {
    assert.ok(fs?.deny?.includes(entry), `Vite default missing from the baseline: ${entry}`);
  }
  assert.deepEqual(VITE_DEFAULT_DENY, resolved.server.fs.deny);
});

test('the baseline denies the editing machine state and key material', () => {
  const { fs } = secureFsDeny();
  for (const entry of [
    '**/.wiki/**',
    '**/.ssh/**',
    '**/*.{db,sqlite,sqlite3}',
    '**/*.{db,sqlite,sqlite3}-wal',
    '**/*.{db,sqlite,sqlite3}-shm',
    '**/*.{db,sqlite,sqlite3}-journal',
  ]) {
    assert.ok(fs?.deny?.includes(entry), `baseline misses ${entry}`);
  }
});

test('extraDeny is appended and never replaces the baseline', () => {
  const base = secureFsDeny().fs!.deny!;
  const extended = secureFsDeny(['**/secrets/**']).fs!.deny!;
  assert.deepEqual(extended, [...base, '**/secrets/**']);
});
