/**
 * siteMarkdown — the whole site markdown pipeline as one preset; a site
 * adopts it with a single line:
 *
 *   markdown: siteMarkdown({ wikiBlocks: WIKI_MODE, math: true, codeFrame: true }),
 *
 * Parsing rules (GFM, CJK-friendly emphasis/strikethrough, the content guard)
 * come from astro-inkbrush/markdown — the same dialect used for block-save
 * validation and editor preview. This module assembles the engine's
 * processor around the site plugin arrays of ./site-plugins.ts (the
 * pipeline order is documented there) and adds what only the build knows:
 * shiki's dual themes and the code-frame transformers (code-frame wrapping
 * happens in a shiki transformer's root hook — Astro runs highlighting after
 * user rehype plugins). Server-only: it imports the engine's processor
 * factory; browser code imports ./site-plugins.ts.
 */
import type { AstroUserConfig } from 'astro';
import {
  transformerMetaHighlight,
  transformerMetaWordHighlight,
  transformerNotationDiff,
  transformerNotationFocus,
  transformerNotationHighlight,
} from '@shikijs/transformers';

import { markdownProcessor } from 'astro-inkbrush/markdown';

import { transformerCodeFrame } from './code-frame.ts';
import { type SiteMarkdownOptions, sitePluginSets } from './site-plugins.ts';

export { type SiteMarkdownOptions, sitePluginSets };

type MarkdownConfig = NonNullable<AstroUserConfig['markdown']>;

export function siteMarkdown(opts: SiteMarkdownOptions = {}): MarkdownConfig {
  const { mermaid = false, codeFrame = true, guard } = opts;
  const { remarkPlugins: remark, rehypePlugins: rehype } = sitePluginSets(opts);

  return {
    // The MDX integration inherits the processor's plugins automatically
    // (extendMarkdownConfig defaults to on).
    processor: markdownProcessor({
      smartypants: false,
      ...(guard !== undefined ? { guard } : {}),
      remarkPlugins: remark,
      rehypePlugins: rehype,
    }),
    // mermaid fences stay out of shiki: highlighting runs before the site's
    // rehype plugins, and rehypeMermaidClient needs the raw fence
    ...(mermaid ? { syntaxHighlight: { type: 'shiki' as const, excludeLangs: ['math', 'mermaid'] } } : {}),
    // shikiConfig is a top-level markdown option
    // Dual themes: defaultColor:false emits both --shiki-light/--shiki-dark;
    // the stylesheet picks one in a single place — no !important tug-of-war.
    shikiConfig: {
      // the pair whose token colors all clear AA on the paper and dusk code
      // grounds (the plain github-light/dark keywords and comments do not)
      themes: { light: 'github-light-high-contrast', dark: 'github-dark-default' },
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
