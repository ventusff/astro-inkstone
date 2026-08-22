/**
 * astro-inkstone — aggregate export of the shared layer.
 * Components are imported by path (astro-inkstone/components/Callout.astro),
 * styles via astro-inkstone/styles/{tokens,base,browse}.css; this barrel only
 * aggregates lib.
 */
export { siteMarkdown, type SiteMarkdownOptions } from './markdown-preset';
export { NOTES_BASE, normalizeBase, noteUrl } from './base';
export { rehypeChapters, slugify, roman, type ChaptersOptions } from './rehype-chapters';
export { rehypeSections, type TocData, type TocEntry } from './rehype-sections';
export { rehypeTblWrap } from './rehype-tbl-wrap';
export { rehypeBaseLinks } from './rehype-base-links';
export { rehypeMermaidClient } from './rehype-mermaid-client';
export { remarkHeadingAttrs } from './remark-heading-attrs';
export { remarkCallouts, type CalloutOptions } from './remark-callouts';
export { remarkReadingTime } from './remark-reading-time';
export { transformerCodeFrame, type CodeFrameLabels } from './code-frame';
export { buildSearchIndexEndpoint, type SearchIndexOptions, type SearchIndexSource } from './search-index';
export {
  createBacklinks,
  type BacklinkDoc,
  type BacklinkIndex,
  type BacklinkItem,
  type BacklinksOptions,
  type GraphNeighbor,
} from './backlinks';
export { secureFsDeny } from './vite-security';
