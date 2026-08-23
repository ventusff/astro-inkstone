/**
 * astro-inkstone — aggregate export of the shared layer. The barrel is
 * engine-free by contract: no export here — type re-exports included — may
 * come from a module that imports astro-inkbrush, so a pure-static site can
 * import and type-check the barrel with no engine installed (a type
 * re-export is erased at runtime but still makes TypeScript resolve the
 * engine-importing module). The engine-coupled surface lives on subpaths
 * only — siteMarkdown and SiteMarkdownOptions via
 * 'astro-inkstone/markdown-preset', createBacklinks and the Backlink* types
 * via 'astro-inkstone/lib/backlinks'.
 * Components are imported by path (astro-inkstone/components/Callout.astro),
 * styles via astro-inkstone/styles/{tokens,base,browse}.css; this barrel only
 * aggregates lib.
 */
export { normalizeBase } from './base.ts';
export { rehypeChapters, slugify, roman, type ChaptersOptions } from './rehype-chapters.ts';
export type { TocData, TocEntry, TocGroup, TocItem } from './toc-types.ts';
export { getToc, localTocRows, renderTocLabel, type LocalTocRow } from './toc.ts';
export {
  rehypeSections,
  getToc as getSectionsToc,
  type TocData as SectionsTocData,
  type TocEntry as SectionsTocEntry,
} from './rehype-sections.ts';
export { rehypeTblWrap } from './rehype-tbl-wrap.ts';
export { rehypeBaseLinks } from './rehype-base-links.ts';
export { rehypeMermaidClient } from './rehype-mermaid-client.ts';
export { remarkHeadingAttrs } from './remark-heading-attrs.ts';
export { remarkCallouts, type CalloutOptions } from './remark-callouts.ts';
export { remarkReadingTime } from './remark-reading-time.ts';
export { transformerCodeFrame, type CodeFrameLabels } from './code-frame.ts';
export { buildSearchIndexEndpoint, type SearchIndexOptions, type SearchIndexSource } from './search-index.ts';
export { secureFsDeny } from './vite-security.ts';
export type { DomainDisplay, KindDisplay, StatusDisplay, Tone } from './wiki-display.ts';
