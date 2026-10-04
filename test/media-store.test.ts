import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

import { MEDIA_ADDRESS, VIDEO_EXTENSIONS, filesToStore, mediaStore } from '../lib/media-store.ts';

function site(files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'media-store-'));
  for (const file of files) {
    mkdirSync(join(root, file, '..'), { recursive: true });
    writeFileSync(join(root, file), '');
  }
  return root;
}

type Hooks = Record<string, (arg: never) => void>;
const hooksOf = (origin: string): Hooks => mediaStore({ origin }).hooks as unknown as Hooks;
const dirs = (root: string) => ({
  config: {
    root: pathToFileURL(`${root}/`),
    publicDir: pathToFileURL(`${root}/public/`),
    srcDir: pathToFileURL(`${root}/src/`),
  },
});

test('the proxy key matches a store address and nothing else', () => {
  const address = new RegExp(MEDIA_ADDRESS);
  assert.ok(address.test(`/media/${'a1'.repeat(32)}.mp4`));
  for (const other of ['/media/clip.mp4', `/media/${'a1'.repeat(32)}`, `/media/${'A1'.repeat(32)}.mp4`, `/wiki/media/${'a1'.repeat(32)}.mp4`, `/media/${'a1'.repeat(32)}.mp4/x`]) {
    assert.ok(!address.test(other), other);
  }
});

test('dev and preview hand store addresses to the origin', () => {
  let config: { vite: { server: { proxy: Record<string, unknown> }; preview: { proxy: Record<string, unknown> } } } | undefined;
  hooksOf('http://origin.test:8480')['astro:config:setup']!({ updateConfig: (c: typeof config) => { config = c; } } as never);
  const want = { [MEDIA_ADDRESS]: { target: 'http://origin.test:8480', changeOrigin: true } };
  assert.deepEqual(config!.vite.server.proxy, want);
  assert.deepEqual(config!.vite.preview.proxy, want);
});

test('filesToStore lists video files under the given directories, whatever their case, and nothing else', () => {
  const root = site(['public/videos/a.MP4', 'public/images/poster.webp', 'src/content/docs/x/clip.webm', 'src/content/docs/x/index.mdx', 'scripts/render.mp4']);
  assert.deepEqual(filesToStore(root, [join(root, 'public'), join(root, 'src'), join(root, 'absent')], VIDEO_EXTENSIONS), [
    'public/videos/a.MP4',
    'src/content/docs/x/clip.webm',
  ]);
});

test('a build refuses a site carrying video files and names them; a dev server warns', () => {
  const root = site(['public/videos/a.mp4', 'src/pages/index.astro']);
  const hooks = hooksOf('http://origin.test');
  hooks['astro:config:done']!(dirs(root) as never);
  assert.throws(() => hooks['astro:build:start']!(undefined as never), /1 file in the site belongs in the media store[^]*public\/videos\/a\.mp4/);
  const warnings: string[] = [];
  hooks['astro:server:setup']!({ logger: { warn: (m: string) => warnings.push(m) } } as never);
  assert.match(warnings[0]!, /public\/videos\/a\.mp4/);
});

test('a site without video files builds and starts quietly', () => {
  const root = site(['public/images/poster.webp', 'src/pages/index.astro']);
  const hooks = hooksOf('http://origin.test');
  hooks['astro:config:done']!(dirs(root) as never);
  hooks['astro:build:start']!(undefined as never);
  hooks['astro:server:setup']!({ logger: { warn: () => assert.fail('warned') } } as never);
});
