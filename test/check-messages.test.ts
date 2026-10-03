import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const SCRIPT = new URL('../scripts/check-messages.mjs', import.meta.url).pathname;

/** run the checker over catalogs given as locale → JSON value */
function check(catalogs: Record<string, unknown>, flags: string[] = []): { status: number | null; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'check-messages-'));
  try {
    for (const [locale, catalog] of Object.entries(catalogs)) writeFileSync(join(dir, `${locale}.json`), JSON.stringify(catalog));
    const r = spawnSync(process.execPath, [SCRIPT, dir, ...flags], { encoding: 'utf8' });
    return { status: r.status, out: r.stdout + r.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('catalogs with the same keys and arguments pass', () => {
  const r = check({ en: { a: 'A', n: '{n} pages' }, de: { a: 'B', n: '{n} Seiten' } });
  assert.equal(r.status, 0, r.out);
});

test('an absent key is still being translated: listed, not failed; a blank one is written', () => {
  const r = check({ en: { a: 'A', b: 'B' }, de: { a: '' } });
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /"a"/);
  assert.match(r.out, /de\.json: 1 key\(s\) still being translated: "b"/);
});

test('--complete fails an absent key', () => {
  const r = check({ en: { a: 'A', b: 'B' }, de: { a: '' } }, ['--complete']);
  assert.equal(r.status, 1);
  assert.match(r.out, /de\.json: missing "b"/);
});

test('options come first; `--` ends them, so a directory may start with `--`; an unknown option is refused', () => {
  const dir = mkdtempSync(join(tmpdir(), 'check-messages-'));
  try {
    const odd = join(dir, '--catalogs');
    mkdirSync(odd);
    writeFileSync(join(odd, 'en.json'), JSON.stringify({ a: 'A' }));
    writeFileSync(join(odd, 'de.json'), JSON.stringify({}));
    const run = (args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', cwd: dir });
    assert.equal(run(['--complete', '--', '--catalogs']).status, 1);
    assert.equal(run(['--', '--catalogs']).status, 0);
    assert.equal(run(['--catalogs']).status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a key must take the same arguments in every language', () => {
  const r = check({ en: { n: '{n} pages' }, de: { n: '{count} Seiten' } });
  assert.equal(r.status, 1);
  assert.match(r.out, /en\.json: "n" takes \{n\}, de\.json takes \{count\}/);
});
