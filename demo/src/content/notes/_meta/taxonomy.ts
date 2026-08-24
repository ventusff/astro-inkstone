/**
 * Taxonomy registry — the single source of truth for this garden's
 * classification vocabulary. Pure data, zero imports (only erasable TS
 * syntax), so the content config, the site binding and plain Node scripts can
 * all import it directly.
 *
 * Adding a value = one line here + tagging notes with it + a display entry in
 * every `lib/ui/<locale>.ts` (the UIStrings type turns a missing entry into a
 * type error); the browse routes (`/kind/…`, `/domain/…`, `/tag/…`) are
 * value-parameterized, so the site needs no code change.
 *
 * `label`/`desc` here are the canonical (English) display strings; every
 * other language's live in its ui strings file, keyed by these ids.
 *
 * Convention: the first entry of a note's `domains` array is its primary
 * domain — the shelf it sits on on the landing page.
 */

export interface KindDef {
  id: string;
  /** display label in the garden's canonical language (English) */
  label: string;
  desc: string;
  order: number;
}

export const KINDS = [
  { id: 'guide', label: 'Guide', desc: 'Task-shaped walkthroughs: start here, wire it up', order: 1 },
  { id: 'reference', label: 'Reference', desc: 'The full picture of one subsystem, kept current', order: 2 },
  { id: 'pattern', label: 'Pattern', desc: 'A design stance worth naming, with its reasons', order: 3 },
] as const satisfies readonly KindDef[];

export type KindId = (typeof KINDS)[number]['id'];
export const KIND_IDS = KINDS.map((k) => k.id) as [KindId, ...KindId[]];

export interface DomainDef {
  id: string;
  label: string;
  desc: string;
  order: number;
  /** chip / shelf-header tone (low-saturation, warm-paper palette) */
  tone: { bg: string; fg: string };
}

export const DOMAINS = [
  { id: 'design', label: 'Design', desc: 'Tokens, theming, the paper-and-ink look', order: 1, tone: { bg: '#ece7f2', fg: '#5b4a8a' } },
  { id: 'pipeline', label: 'Pipeline', desc: 'The Markdown pipeline: dialect, plugins, guard', order: 2, tone: { bg: '#e3efec', fg: '#2a6f62' } },
  { id: 'components', label: 'Components', desc: 'The component set and how to compose it', order: 3, tone: { bg: '#f7e9dc', fg: '#98511a' } },
  { id: 'tooling', label: 'Tooling', desc: 'Checks, probes and the CI story', order: 4, tone: { bg: '#e2eaf4', fg: '#2f5687' } },
  { id: 'editing', label: 'Editing', desc: 'The editing machine: blocks, history, AI, inbox', order: 5, tone: { bg: '#f6e8ec', fg: '#8a3350' } },
] as const satisfies readonly DomainDef[];

export type DomainId = (typeof DOMAINS)[number]['id'];
export const DOMAIN_IDS = DOMAINS.map((d) => d.id) as [DomainId, ...DomainId[]];

export interface StatusDef {
  id: string;
  label: string;
  desc: string;
  /** status dot color */
  dot: string;
}

export const STATUSES = [
  { id: 'seedling', label: 'Seedling', desc: 'A stub — planted, not yet grown', dot: '#b8a24a' },
  { id: 'growing', label: 'Growing', desc: 'A living document, still being written', dot: '#5c8a3c' },
  { id: 'evergreen', label: 'Evergreen', desc: 'Mature and maintained', dot: '#1f5e46' },
] as const satisfies readonly StatusDef[];

export type StatusId = (typeof STATUSES)[number]['id'];
export const STATUS_IDS = STATUSES.map((s) => s.id) as [StatusId, ...StatusId[]];

/** First path segments reserved by browse routes — never valid note ids.
 *  The note route's getStaticPaths rejects a clashing note at build time,
 *  unioning this list with every locale prefix from `locales.ts`. */
export const RESERVED_SLUGS = ['kind', 'domain', 'status', 'tag', 'all'] as const;
