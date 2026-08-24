#!/usr/bin/env node
/**
 * Run a render-layer probe over the demo's dist with the locale set the
 * registry defines. Default: the default locale plus zh — the pair the
 * garden's content discipline is written in, and a fraction of the runtime.
 * --all probes every locale's tree: the bar before a release, and after any
 * language-shaped change (the locale registry, ui strings files, fonts,
 * per-language CSS) — the failures such a change causes live only in the
 * other locales' trees.
 *
 *   node scripts/probe.mjs <ui|contrast> [--all] [dist]
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { DEFAULT_LOCALE, LOCALE_DEFS } from '../src/content/notes/_meta/locales.ts';

const args = process.argv.slice(2);
const all = args.includes('--all');
const rest = args.filter((a) => a !== '--all');
const kind = rest.shift();
if (kind !== 'ui' && kind !== 'contrast') {
  console.error('usage: node scripts/probe.mjs <ui|contrast> [--all] [dist]');
  process.exit(2);
}
const dist = rest.shift() ?? 'dist';

const KEEP = new Set([DEFAULT_LOCALE, 'zh']);
const excluded = LOCALE_DEFS.filter((l) => l.prefix !== '' && !KEEP.has(l.code)).map((l) => l.code);
const flags = all || excluded.length === 0 ? [] : ['--exclude', `^/(${excluded.join('|')})/`];
if (flags.length > 0) {
  console.log(`probing the ${[...KEEP].join('+')} trees (--all covers every locale)`);
}

const demoDir = fileURLToPath(new URL('..', import.meta.url));
const script = kind === 'ui' ? '../scripts/ui_probe.mjs' : '../scripts/contrast_probe.mjs';
const result = spawnSync(process.execPath, [script, dist, ...flags], {
  cwd: demoDir,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
