/**
 * Vite `server.fs` settings for a permanently running editing host. Vite's
 * `/@fs` route serves any file of the workspace as a module; on a
 * long-lived dev server that includes the CMS session secret, databases
 * and key material. Supplying `fs.deny` REPLACES Vite's default list, so
 * the baseline here is a strict superset of it (VITE_DEFAULT_DENY, asserted
 * by the unit test against the installed Vite) plus the state and key
 * patterns an editing machine carries. `deny` takes precedence over
 * `allow`.
 *
 * Site wiring (inside astro.config, spread into vite.server):
 *   import { secureFsDeny } from 'astro-inkstone/lib/vite-security';
 *   vite: { server: { allowedHosts: [...], ...secureFsDeny() } }
 * `extraDeny` adds site-specific paths — a co-located app's state
 * directory, a private data folder; the baseline is never trimmed.
 */
import type { AstroUserConfig } from 'astro';

type ViteServerConfig = NonNullable<NonNullable<AstroUserConfig['vite']>['server']>;

/** Vite's own `server.fs.deny` defaults — kept, never replaced */
export const VITE_DEFAULT_DENY = [
  '.env',
  '.env.*',
  '*.{crt,pem,key,p12,pfx,cer,der}',
  '.npmrc',
  '.yarnrc.yml',
  '**/.git/**',
];

export function secureFsDeny(extraDeny: string[] = []): Pick<ViteServerConfig, 'fs'> {
  return {
    fs: {
      strict: true,
      deny: [
        ...VITE_DEFAULT_DENY,
        '**/.wiki/**', // CMS state: session secret, revisions, comments
        '**/.ssh/**',
        // databases and their recoverable sidecars
        '**/*.{db,sqlite,sqlite3}',
        '**/*.{db,sqlite,sqlite3}-wal',
        '**/*.{db,sqlite,sqlite3}-shm',
        '**/*.{db,sqlite,sqlite3}-journal',
        ...extraDeny,
      ],
    },
  };
}
