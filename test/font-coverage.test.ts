/**
 * The committed font subset must cover its recipe and the demo content.
 * fonts/coverage.txt is the sidecar build_font_subset.py writes from the
 * woff2's actual cmap; these tests hold it against the recipe files and
 * against every character the demo notes use, so a stale artifact fails
 * here instead of falling back silently in the browser.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const FONTS = fileURLToPath(new URL('../fonts', import.meta.url));
const NOTES = fileURLToPath(new URL('../demo/src/content/notes', import.meta.url));

const covered = new Set<number>();
const absentFromSource = new Set<number>();
let artifactSha: string | null = null;
for (const line of readFileSync(join(FONTS, 'coverage.txt'), 'utf8').split('\n')) {
  const t = line.trim();
  if (t.startsWith('U+')) covered.add(parseInt(t.slice(2), 16));
  else if (t.startsWith('absent ')) absentFromSource.add(parseInt(t.slice(7), 16));
  else if (t.startsWith('sha256 ')) artifactSha = t.slice(7);
}

test('coverage.txt describes the committed woff2 (artifact hash anchored)', () => {
  assert.ok(artifactSha, 'coverage.txt carries no sha256 line — regenerate the subset');
  const actual = createHash('sha256').update(readFileSync(join(FONTS, 'MapleMonoCN-subset.woff2'))).digest('hex');
  assert.equal(actual, artifactSha, 'the woff2 and coverage.txt were not committed together — regenerate both');
});

const label = (cp: number): string => `U+${cp.toString(16).toUpperCase().padStart(4, '0')} ${String.fromCodePoint(cp)}`;

test('the subset covers the full recipe (ASCII, hanzi-3500, extra-chars)', () => {
  const recipe = new Set<number>();
  for (let cp = 0x20; cp < 0x7f; cp++) recipe.add(cp);
  for (const line of readFileSync(join(FONTS, 'hanzi-3500.txt'), 'utf8').split('\n')) {
    if (line.startsWith('#')) continue;
    for (const c of line.trim()) recipe.add(c.codePointAt(0)!);
  }
  for (const line of readFileSync(join(FONTS, 'extra-chars.txt'), 'utf8').split('\n')) {
    const t = line.trim();
    if (t.startsWith('U+')) recipe.add(parseInt(t.slice(2).split(/\s/)[0]!, 16));
  }
  const missing = [...recipe].filter((cp) => !covered.has(cp));
  assert.deepEqual(missing.map(label), []);
});

test('every character the demo notes use is in the subset (or marked absent from the source)', () => {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(dir, e.name));
      else if (/\.(md|mdx)$/.test(e.name)) files.push(join(dir, e.name));
    }
  };
  walk(NOTES);
  assert.ok(files.length > 0);
  const used = new Set<number>();
  for (const f of files) {
    for (const c of readFileSync(f, 'utf8')) {
      const cp = c.codePointAt(0)!;
      // build_font_subset.py's printable filter (write_extra): combining
      // marks and zero-widths never enter the recipe, so they are exempt here
      if (cp < 0x20 || (cp >= 0x300 && cp <= 0x36f) || cp === 0x200b || cp === 0xfffd) continue;
      used.add(cp);
    }
  }
  const uncovered = [...used].filter((cp) => !covered.has(cp) && !absentFromSource.has(cp));
  assert.deepEqual(
    uncovered.map(label),
    [],
    'run: <fontenv>/bin/python fonts/build_font_subset.py --scan demo/src/content/notes, then commit extra-chars.txt, the woff2 and coverage.txt together',
  );
});
