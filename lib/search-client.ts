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

/**
 * Case fold with an index map back into the original string. Lowercasing
 * can change length ('İ' folds to two code units), so an offset found in
 * the folded string cannot slice the original directly: `map[i]` is the
 * original index of the character that produced folded position `i`, with
 * `map[folded.length]` = the original length as the end sentinel.
 */
function foldWithMap(s: string): { folded: string; map: number[] } {
  let folded = '';
  const map: number[] = [];
  let at = 0;
  for (const ch of s) {
    const low = ch.toLowerCase();
    for (let k = 0; k < low.length; k += 1) map.push(at);
    folded += low;
    at += ch.length;
  }
  map.push(s.length);
  return { folded, map };
}

/** An ellipsis marks each side of the snippet only where text is cut. */
function makeSnippet(text: string, term: string): string {
  const { folded, map } = foldWithMap(text);
  const at = folded.indexOf(term);
  if (at === -1) {
    return escapeHtml(text.slice(0, 120)) + (text.length > 120 ? '…' : '');
  }
  const start = map[at]!;
  // the match end, widened to a character boundary of the original: when the
  // folded match ends inside one character's expansion, the mark covers that
  // whole character
  let endAt = at + term.length;
  while (endAt < folded.length && map[endAt]! <= start) endAt += 1;
  const end = map[endAt]!;
  const from = Math.max(0, start - 44);
  const to = Math.min(text.length, Math.max(from + 168, end));
  return (
    (from > 0 ? '…' : '') +
    escapeHtml(text.slice(from, start)) +
    '<mark>' +
    escapeHtml(text.slice(start, end)) +
    '</mark>' +
    escapeHtml(text.slice(end, to)) +
    (to < text.length ? '…' : '')
  );
}

/** `limit` caps the returned hits and must be a positive integer. */
export function search(docs: SearchDoc[], query: string, locale: string, limit = 20): Hit[] {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`search: limit must be a positive integer, got ${String(limit)}`);
  }
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
