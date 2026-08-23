/**
 * The demo's browser-playground wiring (PLAYGROUND builds only — see
 * components/PlaygroundMount.astro for the mount gate). The fragment
 * pipeline reuses the exact build plugins through sitePluginSets, with
 * whole-document concerns off: chapter numbering and reading time need the
 * full document, and the wikilink resolver comes from the manifest (the
 * engine mounts it itself).
 */
import { bootPlayground, type PlaygroundStrings } from 'astro-inkbrush/playground';
import { normalizeBase } from 'astro-inkstone/lib/base';

const BASE_PREFIX = normalizeBase(import.meta.env.BASE_URL);

const ZH_STRINGS: PlaygroundStrings = {
  tryIt: '试一试编辑',
  tryItHint: '编辑这一页——一切只存在你的浏览器里',
  activeHint: '把鼠标移到任意段落上就能编辑;触屏轻点段落',
  jsxEditedNote:
    '组件块已本地改写——静态页面无法重渲 Astro 组件,下方是素文呈现(或维持构建版原貌)。你的源码已保存;还原即恢复页面。',
  frontmatterEditedNote:
    '页面元信息已本地改写——静态页头无法据此重绘,显示仍是构建版。你的 YAML 已保存;还原即恢复页面。',
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
        site: sitePluginSets({
          math: true,
          callouts: true,
          gemoji: true,
          mermaid: true,
          base: BASE_PREFIX,
          numbering: false,
          readingTime: false,
        }),
        guard: { autoNumberedHeadings: true },
        urlFor: (id: string) => `${BASE_PREFIX}/${id}/`,
        noteIdOf: (path: string | undefined) => path?.match(/src\/content\/notes\/(.+)\/index\.mdx?$/)?.[1],
      };
    },
  });
}
