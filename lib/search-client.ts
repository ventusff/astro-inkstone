/**
 * Client-side search over the build-time index (lib/search-index.ts).
 *
 * Substring matching on normalized text, not a tokenizer: bilingual content
 * mixes CJK prose (no word boundaries) with identifiers such as
 * `mixed_precision_training` (partial matches must hit). A query is split on
 * whitespace; every word must occur somewhere in a document (title, headings
 * or body) for it to match, and the whole phrase, when it occurs, scores a
 * bonus. A linear scan per keystroke is imperceptible up to a few hundred
 * pages.
 */

export interface SearchDoc {
  id: string;
  route: string;
  /** the site's own locale code; 'any' is reserved — such a document
   *  matches queries in every locale */
  locale: string;
  title: string;
  crumb: string;
  headings: string[];
  text: string;
}

export interface Hit {
  doc: SearchDoc;
  score: number;
  /** body excerpt around the first match, with the match wrapped in <mark> */
  snippet: string;
}

const W_TITLE = 24;
const W_HEADING = 8;
const W_BODY = 1;
/** a document containing the whole query as one phrase ranks above one that only has the words */
const W_PHRASE = 16;
/** separator between joined headings; never occurs in prose, so no term spans two headings */
const HEADING_SEP = ' \u0001 ';

const norm = (s: string): string => s.toLowerCase();

/** query → { words (all required), phrase (the whole query, when multi-word) } */
function termsOf(query: string): { words: string[]; phrase: string | null } {
  const q = norm(query).trim();
  if (!q) return { words: [], phrase: null };
  const words = q.split(/\s+/).filter(Boolean);
  return { words, phrase: words.length > 1 ? q : null };
}

function countOf(haystack: string, term: string): number {
  if (!term) return 0;
  let n = 0;
  let i = haystack.indexOf(term);
  while (i !== -1 && n < 50) {
    n += 1;
    i = haystack.indexOf(term, i + term.length);
  }
  return n;
}

const escapeHtml = (s: string): string =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function makeSnippet(text: string, term: string): string {
  const at = norm(text).indexOf(term);
  if (at === -1) return escapeHtml(text.slice(0, 120));
  const from = Math.max(0, at - 44);
  const raw = text.slice(from, from + 168);
  const rel = at - from;
  return (
    (from > 0 ? '…' : '') +
    escapeHtml(raw.slice(0, rel)) +
    '<mark>' +
    escapeHtml(raw.slice(rel, rel + term.length)) +
    '</mark>' +
    escapeHtml(raw.slice(rel + term.length)) +
    '…'
  );
}

export function search(docs: SearchDoc[], query: string, locale: string, limit = 20): Hit[] {
  const { words, phrase } = termsOf(query);
  if (words.length === 0) return [];

  const hits: Hit[] = [];
  for (const doc of docs) {
    if (doc.locale !== 'any' && doc.locale !== locale) continue;
    const title = norm(doc.title);
    const headings = norm(doc.headings.join(HEADING_SEP));
    const text = norm(doc.text);
    const has = (t: string): boolean => title.includes(t) || headings.includes(t) || text.includes(t);

    // AND across words: a two-word query must not behave like OR
    if (!words.every(has)) continue;

    let score = 0;
    for (const word of words) {
      score += countOf(title, word) * W_TITLE + countOf(headings, word) * W_HEADING + countOf(text, word) * W_BODY;
    }
    const phraseHit = phrase !== null && has(phrase);
    if (phraseHit) score += W_PHRASE;
    // the snippet centres on the phrase when the body has it, else on the first word the body has
    const focus = phraseHit && text.includes(phrase) ? phrase : (words.find((w) => text.includes(w)) ?? words[0]!);
    hits.push({ doc, score, snippet: makeSnippet(doc.text, focus) });
  }

  hits.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title));
  return hits.slice(0, limit);
}
