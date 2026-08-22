/**
 * Display-ready taxonomy data — the shapes the wiki components
 * (components/wiki/*) take. A site maps its registry definitions (labels in
 * the page's language, tones, routes) onto these once, in its display
 * binding, and every component reads the same objects.
 */

/** a domain's color pair, tuned for the light ground */
export interface Tone {
  bg: string;
  fg: string;
}

/** a kind (the note's form factor) */
export interface KindDisplay {
  id: string;
  label: string;
  desc?: string | undefined;
}

/** a domain, with its tone and optionally its browse route */
export interface DomainDisplay extends KindDisplay {
  tone: Tone;
  href?: string | undefined;
}

/** a maturity status, with its dot color */
export interface StatusDisplay extends KindDisplay {
  /** dot color, e.g. "#7d9c6a" */
  dot: string;
}
