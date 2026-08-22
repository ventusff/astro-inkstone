/**
 * astro-inkstone — aggregate export of the shared layer. The barrel is
 * engine-free by contract: no value export here may come from a module that
 * imports astro-inkbrush, so a pure-static site can import the barrel with
 * no engine installed. The engine-coupled values are imported by subpath —
 * siteMarkdown via 'astro-inkstone/markdown-preset', createBacklinks via
 * 'astro-inkstone/lib/backlinks'; their types stay re-exported here
 * (type-only re-exports are erased and load nothing).
 * Components are imported by path (astro-inkstone/components/Callout.astro),
 * styles via astro-inkstone/styles/{tokens,base,browse}.css; this barrel only
 * aggregates lib.
 */
export type { SiteMarkdownOptions } from './markdown-preset.ts';
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
export type {
  BacklinkDoc,
  BacklinkIndex,
  BacklinkItem,
  BacklinksOptions,
  GraphNeighbor,
} from './backlinks.ts';
export { secureFsDeny } from './vite-security.ts';
export type { DomainDisplay, KindDisplay, StatusDisplay, Tone } from './wiki-display.ts';
