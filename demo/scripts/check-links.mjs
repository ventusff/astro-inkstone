#!/usr/bin/env node
/**
 * Run the engine's strict wikilink check with the locale table taken from
 * the site's locale registry — one --locale-prefix per non-default locale —
 * so the CLI and the site can never disagree about the mirror namespaces.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { LOCALE_DEFS } from '../src/content/notes/_meta/locales.ts';

const demoDir = fileURLToPath(new URL('..', import.meta.url));
const localeFlags = LOCALE_DEFS.filter((l) => l.prefix !== '').flatMap((l) => [
  '--locale-prefix',
  l.prefix,
]);
const result = spawnSync(
  process.execPath,
  [
    'vendor/astro-inkbrush/scripts/check-wikilinks.mjs',
    'src/content/notes',
    ...localeFlags,
    '--strict',
  ],
  { cwd: demoDir, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
