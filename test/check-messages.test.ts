import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const SCRIPT = new URL('../scripts/check-messages.mjs', import.meta.url).pathname;

/** run the checker over catalogs given as locale → JSON value */
function check(catalogs: Record<string, unknown>): { status: number | null; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'check-messages-'));
  try {
    for (const [locale, catalog] of Object.entries(catalogs)) writeFileSync(join(dir, `${locale}.json`), JSON.stringify(catalog));
    const r = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });
    return { status: r.status, out: r.stdout + r.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('catalogs with the same keys and arguments pass', () => {
  const r = check({ en: { a: 'A', n: '{n} pages' }, de: { a: 'B', n: '{n} Seiten' } });
  assert.equal(r.status, 0, r.out);
});

test('an absent or blank key is missing', () => {
  const r = check({ en: { a: 'A', b: 'B' }, de: { a: ' ' } });
  assert.equal(r.status, 1);
  assert.match(r.out, /de\.json: missing "a" \(blank\)/);
  assert.match(r.out, /de\.json: missing "b"/);
});

test('a key must take the same arguments in every language', () => {
  const r = check({ en: { n: '{n} pages' }, de: { n: '{count} Seiten' } });
  assert.equal(r.status, 1);
  assert.match(r.out, /en\.json: "n" takes \{n\}, de\.json takes \{count\}/);
});
