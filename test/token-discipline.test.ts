/**
 * The two-tier token rule, executable: outside styles/tokens.css, no rule
 * and no component carries a raw color value — colors come from tokens (or
 * tone data passed as props). The identity-neutral keywords `transparent`,
 * `currentColor` and `inherit` are exempt; so are `var()` fallbacks that
 * are themselves tokens.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const files: string[] = [];
const walk = (dir: string): void => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(join(dir, e.name));
    else files.push(join(dir, e.name));
  }
};
walk(join(ROOT, 'styles'));
walk(join(ROOT, 'components'));

const LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|hwb)\(/;

test('no raw color literal outside tokens.css', () => {
  const offenders: string[] = [];
  for (const file of files) {
    const rel = relative(ROOT, file);
    if (rel === join('styles', 'tokens.css')) continue;
    if (!/\.(css|astro)$/.test(file)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      // color-mix over tokens is a token expression, not a literal
      const stripped = line.replace(/color-mix\([^)]*\)/g, (m) => (LITERAL.test(m.replace(/color-mix\(/, '')) ? m : ''));
      // ids in anchors/hrefs are not colors
      const candidate = stripped.replace(/(?:href|id|aria-\w+)="[^"]*"/g, '').replace(/url\([^)]*\)/g, '');
      if (LITERAL.test(candidate)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, []);
});
