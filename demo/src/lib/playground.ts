/**
 * The demo's browser-playground wiring (PLAYGROUND builds only — see
 * components/PlaygroundMount.astro for the mount gate). The fragment
 * pipeline reuses the exact build plugins through sitePluginSets, with
 * whole-document concerns off: chapter numbering and reading time need the
 * full document, and the wikilink resolver comes from the manifest (the
 * engine mounts it itself).
 */
import { bootPlayground, type PlaygroundStrings } from 'astro-inkbrush/playground';
import type { SitePluginSet } from 'astro-inkbrush/render-pipeline';
import { normalizeBase } from 'astro-inkstone/lib/base';

const BASE_PREFIX = normalizeBase(import.meta.env.BASE_URL);

const ZH_STRINGS: PlaygroundStrings = {
  tryIt: '试一试编辑',
  tryItHint: '编辑这一页——一切只存在你的浏览器里',
  active: '本地编辑中',
  edits: '#n 处本地修改',
  reset: '还原',
  resetConfirm: '丢弃这个 demo 的全部本地修改(所有页面)?',
  activateFailed: '这个页面开不了体验编辑',
};

export function mountPlayground(): void {
  const zh = (document.documentElement.lang || '').toLowerCase().startsWith('zh');
  void bootPlayground({
    manifestUrl: `${BASE_PREFIX}/playground-manifest.json`,
    guestName: zh ? '体验访客' : 'Playground visitor',
    ...(zh ? { strings: ZH_STRINGS } : {}),
    configure: async () => {
      // the plugin graph (katex and friends) loads only on activation — a
      // static import here would land it in the boot chunk of every page
      const { sitePluginSets } = await import('astro-inkstone/lib/markdown-preset');
      return {
        // Astro's plugin type admits bare string names; these arrays never
        // carry them — every entry is a plugin function or a [plugin, options]
        // pair, which is what the engine's pipeline factory takes.
        site: sitePluginSets({
          math: true,
          callouts: true,
          gemoji: true,
          mermaid: true,
          base: BASE_PREFIX,
          numbering: false,
          readingTime: false,
        }) as SitePluginSet,
        guard: { autoNumberedHeadings: true },
        urlFor: (id: string) => `${BASE_PREFIX}/${id}/`,
        noteIdOf: (path: string | undefined) => path?.match(/src\/content\/notes\/(.+)\/index\.mdx?$/)?.[1],
      };
    },
  });
}
