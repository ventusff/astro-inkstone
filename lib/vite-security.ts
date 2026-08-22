/**
 * The price of "a permanent dev server is the production editing form":
 * Vite's `/@fs` endpoint will serve any file in the workspace as a module,
 * including session secrets, databases and key material. On such a
 * deployment that is not a theoretical concern — leaking the CMS session
 * secret alone is enough to forge sessions and defeat every authorization
 * check built on top of them. So the editing host must deny-list everything
 * the frontend has no business importing.
 *
 * `deny` takes precedence over `allow`; nothing below is ever a legitimate
 * frontend import.
 *
 * Site wiring (inside astro.config, spread into vite.server):
 *   import { secureFsDeny } from 'astro-inkstone/lib/vite-security';
 *   vite: { server: { allowedHosts: [...], ...secureFsDeny() } }
 * Add site-specific sensitive paths via `extraDeny`; never trim the baseline.
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
        '**/.wiki/**', // CMS session secret and drafts
        '**/.brain/**', // any co-located app's state directory
        '**/.ssh/**',
        '**/*.db',
        '**/*.db-wal',
        '**/*.db-shm',
        ...extraDeny,
      ],
    },
  };
}
