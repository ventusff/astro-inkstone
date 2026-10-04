/**
 * mediaStore — a content-addressed media store mounted at /media/.
 *
 * Large files (video, big images, models) live outside the repository, each
 * under the SHA-256 of its bytes: `/media/<sha256>.<ext>`. In production the
 * deployment's reverse proxy answers those addresses in front of the site, so
 * a page cites them as written and never learns where the bytes rest. This
 * integration covers the two places that proxy is not:
 *
 *  - `astro dev` and `astro preview` hand such a request to the store's
 *    origin, so a page shows its media on a workstation as it does deployed;
 *  - `astro build` refuses a site whose `public/` or `src/` carries video
 *    files of its own, naming each one (`astro dev` warns): a video belongs
 *    in the store.
 *
 * Site wiring (astro.config):
 *   import { mediaStore } from 'astro-inkstone/lib/media-store';
 *   integrations: [mediaStore({ origin: 'http://media-origin.example:8480' })]
 */
import { readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AstroIntegration } from 'astro';

/** a store address, as a Vite proxy key (a key beginning with `^` is a pattern) */
export const MEDIA_ADDRESS = '^/media/[0-9a-f]{64}\\.[a-z0-9]{1,8}$';

/** the kinds of file that never belong in the site's own tree */
export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4v', 'mkv', 'avi', 'ogv', 'm3u8', 'm4s'];

export interface MediaStoreOptions {
  /** base URL of the store's origin, which answers `/media/<sha256>.<ext>` */
  origin: string;
  /** extensions refused in `public/` and `src/`. Default: VIDEO_EXTENSIONS */
  refuse?: string[];
}

/** files under `directories` whose extension is in `extensions`, as paths relative to `root` */
export function filesToStore(root: string, directories: string[], extensions: string[]): string[] {
  const refused = new Set(extensions.map((ext) => `.${ext.toLowerCase()}`));
  const found: string[] = [];
  const walk = (directory: string): void => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return; // a site without that directory
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && refused.has(extname(entry.name).toLowerCase())) found.push(relative(root, path));
    }
  };
  for (const directory of directories) walk(directory);
  return found.sort();
}

export function mediaStore({ origin, refuse = VIDEO_EXTENSIONS }: MediaStoreOptions): AstroIntegration {
  const proxy = { [MEDIA_ADDRESS]: { target: origin, changeOrigin: true } };
  let stray: string[] = [];
  const complaint = (): string =>
    `${stray.length} file${stray.length === 1 ? '' : 's'} in the site belong${stray.length === 1 ? 's' : ''} in the media store ` +
    `(put each there and cite its /media/<sha256>.<ext> address):\n${stray.map((file) => `  ${file}`).join('\n')}`;
  return {
    name: 'inkstone:media-store',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({ vite: { server: { proxy }, preview: { proxy } } });
      },
      'astro:config:done': ({ config }) => {
        const root = fileURLToPath(config.root);
        stray = filesToStore(root, [fileURLToPath(config.publicDir), fileURLToPath(config.srcDir)], refuse);
      },
      'astro:server:setup': ({ logger }) => {
        if (stray.length) logger.warn(complaint());
      },
      'astro:build:start': () => {
        if (stray.length) throw new Error(complaint());
      },
    },
  };
}
