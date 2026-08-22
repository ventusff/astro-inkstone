/**
 * Vite `server.fs` settings for a permanently running editing host. Vite's
 * `/@fs` route serves any file of the workspace as a module; on a
 * long-lived dev server that includes the CMS session secret, databases
 * and key material, so everything the frontend never imports is denied.
 * `deny` takes precedence over `allow`.
 *
 * Site wiring (inside astro.config, spread into vite.server):
 *   import { secureFsDeny } from 'astro-inkstone/lib/vite-security';
 *   vite: { server: { allowedHosts: [...], ...secureFsDeny() } }
 * `extraDeny` adds site-specific paths; the baseline is never trimmed.
 */
import type { AstroUserConfig } from 'astro';

type ViteServerConfig = NonNullable<NonNullable<AstroUserConfig['vite']>['server']>;

export function secureFsDeny(extraDeny: string[] = []): Pick<ViteServerConfig, 'fs'> {
  return {
    fs: {
      strict: true,
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem,key,p12,pfx}',
        '**/.git/**',
        '**/.wiki/**', // CMS state: session secret, revisions, comments
        '**/.brain/**', // a co-located app's state directory
        '**/.ssh/**',
        '**/*.db',
        '**/*.db-wal',
        '**/*.db-shm',
        ...extraDeny,
      ],
    },
  };
}
