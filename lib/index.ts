/**
 * astro-inkstone — aggregate export of the shared layer.
 * Components are imported by path (astro-inkstone/components/Callout.astro),
 * styles via astro-inkstone/styles/{tokens,base,browse}.css; this barrel only
 * aggregates lib.
 */
export { siteMarkdown, type SiteMarkdownOptions } from './markdown-preset.ts';
export { normalizeBase } from './base.ts';
export { rehypeChapters, slugify, roman, type ChaptersOptions } from './rehype-chapters.ts';
export type { TocData, TocEntry, TocGroup, TocItem } from './toc-types.ts';
export { getToc, renderTocLabel } from './toc.ts';
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
export {
  createBacklinks,
  type BacklinkDoc,
  type BacklinkIndex,
  type BacklinkItem,
  type BacklinksOptions,
  type GraphNeighbor,
} from './backlinks.ts';
export { secureFsDeny } from './vite-security.ts';
export type { DomainDisplay, KindDisplay, StatusDisplay, Tone } from './wiki-display.ts';
