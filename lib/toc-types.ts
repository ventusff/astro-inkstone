/** ToC data structures produced at build time by the "chapters" numbering
 *  preset (./rehype-chapters.ts). The "sections" preset has its own, simpler
 *  shapes, inlined in ./rehype-sections.ts. */

export interface TocGroup {
  kind: 'group';
  /** e.g. "PART III" (roman), or "附录" for the appendix */
  num: string;
  /** group title, e.g. "Partitioning" */
  label: string;
}

export interface TocEntry {
  kind: 'entry';
  depth: 2 | 3;
  id: string;
  /** computed chapter number, e.g. "§3.2", "§A" — '' when unnumbered */
  num: string;
  /** ToC label; may contain inline `$…$` math (render via renderTocLabel) */
  label: string;
}

export type TocItem = TocGroup | TocEntry;

export interface TocData {
  items: TocItem[];
  /** map id → printed number, for cross-referencing */
  numbers: Record<string, string>;
}
