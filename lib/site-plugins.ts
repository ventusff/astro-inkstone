/**
 * sitePluginSets — the site-side remark/rehype plugin arrays alone,
 * everything siteMarkdown mounts beyond the engine dialect, in the
 * contractual order:
 * - remark: gemoji → math → headingAttrs → callouts → readingTime → wikilinks
 * - rehype: numbering (chapters/sections — before katex, so ToC labels keep
 *   their raw TeX) → katex → tblWrap → mermaidClient → (baseLinks) →
 *   wikiBlocks always last (inkbrush contract: stamp final top-level blocks
 *   with source line ranges).
 *
 * siteMarkdown (markdown-preset.ts) consumes this on the server. A browser
 * consumer — the playground's fragment renderer — imports THIS module: it
 * carries only the plugins themselves, never the engine's processor factory
 * or the content guard, so a browser bundle built from it ships the plugin
 * graph and nothing of the build tooling.
 */
import rehypeKatex from 'rehype-katex';
import remarkGemoji from 'remark-gemoji';
import remarkMath from 'remark-math';

import type { MarkdownProcessorOptions } from 'astro-inkbrush/markdown';
import type { SitePluginSet } from 'astro-inkbrush/render-pipeline';
import { rehypeWikiBlocks } from 'astro-inkbrush/wiki-blocks';
import { type buildWikilinkResolver, remarkWikilinks } from 'astro-inkbrush/wikilinks/core';

import { normalizeBase } from './base.ts';
import type { CodeFrameLabels } from './code-frame.ts';
import { rehypeBaseLinks } from './rehype-base-links.ts';
import { rehypeChapters, slugify } from './rehype-chapters.ts';
import { rehypeMermaidClient } from './rehype-mermaid-client.ts';
import { rehypeSections } from './rehype-sections.ts';
import { rehypeTblWrap } from './rehype-tbl-wrap.ts';
import { remarkCallouts } from './remark-callouts.ts';
import { remarkHeadingAttrs } from './remark-heading-attrs.ts';
import { remarkReadingTime } from './remark-reading-time.ts';

type RemarkPlugin = NonNullable<MarkdownProcessorOptions['remarkPlugins']>[number];
type RehypePlugin = NonNullable<MarkdownProcessorOptions['rehypePlugins']>[number];

export interface SiteMarkdownOptions {
  /** WIKI editing mode: mounts rehypeWikiBlocks last (inkbrush contract) */
  wikiBlocks?: boolean;
  /** subpath mount prefix (astro base): rewrites root-absolute links in prose */
  base?: string;
  /** baseLinks exemptions: prefixes of other mount points, left untouched */
  baseExempt?: string[];
  /** math (remark-math + KaTeX htmlAndMathml). Default on */
  math?: boolean;
  /** :emoji: shortcodes. Default off */
  gemoji?: boolean;
  /** Obsidian-style `> [!note]` callout syntax. Default off (the <Callout>
   *  component is always available) */
  callouts?: boolean;
  /** default callout titles per variant keyword (see remark-callouts) */
  calloutLabels?: Record<string, string>;
  /** inject reading minutes into frontmatter. Default off */
  readingTime?: boolean;
  /** turn mermaid fences into client-rendered placeholders. Default off */
  mermaid?: boolean;
  /** code frames (title bar / copy / collapse) + line-annotation
   *  transformers. Pass an object to localize the copy/expand labels.
   *  Default on */
  codeFrame?: boolean | CodeFrameLabels;
  /**
   * [[wikilinks]]: enabled as soon as the site supplies a resolution scope.
   * Build `resolve` with buildWikilinkResolver (notes come from the site's
   * entity scan; urlFor is the site's routing). Default off.
   */
  wikilinks?:
    | false
    | {
        resolve: ReturnType<typeof buildWikilinkResolver>;
        noteIdOf?: (path: string | undefined) => string | undefined;
        onBroken?: (info: { file?: string | undefined; target: string; kind: string }) => void;
      };
  /**
   * Heading-numbering preset: 'chapters' (part/chapter numbering — §1.2,
   * appendix letters, Part markers; the site reads the ToC from frontmatter)
   * | 'sections' (plain auto section numbering + ToC into frontmatter; pair
   * with guard.autoNumberedHeadings so hand-typed numbers fail the build)
   * | false. Default 'chapters'.
   */
  numbering?: 'chapters' | 'sections' | false;
  /** banner text for an untitled `<Part appendix />` under
   *  numbering:'chapters'. Default 'Appendix' */
  appendixLabel?: string;
  /** site-level content-guard options (renderedProps / autoNumberedHeadings),
   *  passed through to the engine */
  guard?: MarkdownProcessorOptions['guard'];
  /** site plugins appended after the preset's remark plugins */
  remarkPlugins?: RemarkPlugin[];
  /** site plugins appended after the preset's rehype plugins, before baseLinks */
  rehypePlugins?: RehypePlugin[];
}

/**
 * The site-side plugin arrays alone. A browser-side consumer (the
 * playground's fragment renderer) calls it with fragment-appropriate
 * options (numbering/readingTime off, wikilinks false — the playground
 * mounts the resolver itself).
 */
export function sitePluginSets(opts: SiteMarkdownOptions = {}): SitePluginSet {
  const {
    wikiBlocks = false,
    baseExempt = [],
    math = true,
    gemoji = false,
    callouts = false,
    calloutLabels,
    readingTime = false,
    mermaid = false,
    wikilinks = false,
    numbering = 'chapters',
    appendixLabel,
    remarkPlugins = [],
    rehypePlugins = [],
  } = opts;
  const base = normalizeBase(opts.base);

  const remark: RemarkPlugin[] = [
    ...(gemoji ? [remarkGemoji as RemarkPlugin] : []),
    ...(math ? [remarkMath as RemarkPlugin] : []),
    remarkHeadingAttrs as RemarkPlugin,
    ...(callouts
      ? [
          (calloutLabels
            ? [remarkCallouts, { labels: calloutLabels }]
            : remarkCallouts) as unknown as RemarkPlugin,
        ]
      : []),
    ...(readingTime ? [remarkReadingTime as RemarkPlugin] : []),
    ...(wikilinks
      ? [
          [
            remarkWikilinks,
            {
              slugifyAnchor: slugify,
              onBroken: ({ file, target, kind }: { file?: string | undefined; target: string; kind: string }) =>
                console.warn(`[wikilinks] ${kind}: [[${target}]] ← ${file ?? '(unknown)'}`),
              ...wikilinks,
            },
          ] as unknown as RemarkPlugin,
        ]
      : []),
    ...remarkPlugins,
  ];

  const rehype: RehypePlugin[] = [
    ...(numbering === 'chapters'
      ? [
          (appendixLabel !== undefined
            ? [rehypeChapters, { appendixLabel }]
            : rehypeChapters) as unknown as RehypePlugin,
        ]
      : []),
    ...(numbering === 'sections' ? [rehypeSections as RehypePlugin] : []),
    ...(math ? [[rehypeKatex, { output: 'htmlAndMathml' }] as RehypePlugin] : []),
    rehypeTblWrap as RehypePlugin,
    ...(mermaid ? [rehypeMermaidClient as RehypePlugin] : []),
    ...rehypePlugins,
    ...(base ? [[rehypeBaseLinks, { base, exempt: baseExempt }] as RehypePlugin] : []),
    ...(wikiBlocks ? [rehypeWikiBlocks as RehypePlugin] : []),
  ];

  // Astro's plugin type admits bare plugin names; these arrays never carry
  // them — every entry is a plugin function or a [plugin, options] pair,
  // which is exactly what the engine's pipeline factory takes.
  return { remarkPlugins: remark, rehypePlugins: rehype } as unknown as SitePluginSet;
}
