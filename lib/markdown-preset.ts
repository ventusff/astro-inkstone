/**
 * siteMarkdown — the whole site markdown pipeline as one preset; a site
 * adopts it with a single line:
 *
 *   markdown: siteMarkdown({ wikiBlocks: WIKI_MODE, math: true, codeFrame: true }),
 *
 * Parsing rules (GFM, CJK-friendly emphasis/strikethrough, the content guard)
 * come from astro-inkbrush/markdown — the same dialect used for block-save
 * validation and editor preview. This module only assembles and orders the
 * site-side plugins. The pipeline order is a contract:
 * - remark: gemoji → math → headingAttrs → callouts → readingTime → wikilinks
 * - rehype: numbering (chapters/sections — must run before katex, so ToC
 *   labels keep their raw TeX) → katex → tblWrap → mermaidClient →
 *   (baseLinks) → wikiBlocks always last (inkbrush contract: stamp final
 *   top-level blocks with source line ranges; static builds stay untouched).
 * - Code-frame wrapping happens in a shiki transformer's root hook (Astro
 *   runs highlighting after user rehype plugins).
 */
import type { AstroUserConfig } from 'astro';
import rehypeKatex from 'rehype-katex';
import remarkGemoji from 'remark-gemoji';
import remarkMath from 'remark-math';
import {
  transformerMetaHighlight,
  transformerMetaWordHighlight,
  transformerNotationDiff,
  transformerNotationFocus,
  transformerNotationHighlight,
} from '@shikijs/transformers';

import { rehypeWikiBlocks } from 'astro-inkbrush';
import { type MarkdownProcessorOptions, markdownProcessor } from 'astro-inkbrush/markdown';
import { buildWikilinkResolver, remarkWikilinks } from 'astro-inkbrush/wikilinks';

import { normalizeBase } from './base';
import { type CodeFrameLabels, transformerCodeFrame } from './code-frame';
import { rehypeBaseLinks } from './rehype-base-links';
import { rehypeChapters, slugify } from './rehype-chapters';
import { rehypeMermaidClient } from './rehype-mermaid-client';
import { rehypeSections } from './rehype-sections';
import { rehypeTblWrap } from './rehype-tbl-wrap';
import { remarkCallouts } from './remark-callouts';
import { remarkHeadingAttrs } from './remark-heading-attrs';
import { remarkReadingTime } from './remark-reading-time';

type MarkdownConfig = NonNullable<AstroUserConfig['markdown']>;
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

export function siteMarkdown(opts: SiteMarkdownOptions = {}): MarkdownConfig {
  const {
    wikiBlocks = false,
    baseExempt = [],
    math = true,
    gemoji = false,
    callouts = false,
    calloutLabels,
    readingTime = false,
    mermaid = false,
    codeFrame = true,
    wikilinks = false,
    numbering = 'chapters',
    appendixLabel,
    guard,
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

  return {
    // The MDX integration inherits the processor's plugins automatically
    // (extendMarkdownConfig defaults to on).
    processor: markdownProcessor({
      smartypants: false,
      ...(guard !== undefined ? { guard } : {}),
      remarkPlugins: remark,
      rehypePlugins: rehype,
    }),
    // mermaid fences must be kept away from shiki: in the MDX pipeline,
    // highlighting runs before site rehype plugins, so by the time
    // rehypeMermaidClient looks, the fence is already an astro-code block and
    // the placeholder conversion would miss.
    ...(mermaid ? { syntaxHighlight: { type: 'shiki' as const, excludeLangs: ['math', 'mermaid'] } } : {}),
    // shikiConfig stays a top-level markdown option (it reaches the processor
    // via createRenderer(shared)).
    // Dual themes: defaultColor:false emits both --shiki-light/--shiki-dark;
    // the stylesheet picks one in a single place — no !important tug-of-war.
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      ...(codeFrame
        ? {
            transformers: [
              transformerCodeFrame(codeFrame === true ? {} : codeFrame),
              transformerMetaHighlight(),
              transformerMetaWordHighlight(),
              transformerNotationDiff(),
              transformerNotationHighlight(),
              transformerNotationFocus(),
            ],
          }
        : {}),
    },
  };
}
