/**
 * language-status.ts — where a page stands in one of its languages, as the
 * language menu shows it, and what the menu's trigger signals for all of
 * them together.
 *
 * - `queued`: waiting for its turn to be translated
 * - `updating`: being translated now
 * - `pushed`: the new translation is published and goes live when the site
 *   next deploys
 * - `partial`: some of the page's text is not yet in this language
 * - `missing`: the page has no text in this language yet
 * - `failed`: bringing this language up to date failed
 *
 * Browser-safe: the menu's server render and its client script share it.
 */
export type LanguageStatus = 'updating' | 'queued' | 'pushed' | 'partial' | 'missing' | 'failed';

/** what the trigger's dot says: work under way (pulsing), a failure (steady), or nothing */
export type LanguageSignal = 'busy' | 'failed';

/** states in which a newer version of the page is on its way */
const BUSY: ReadonlySet<string> = new Set<LanguageStatus>(['updating', 'queued', 'pushed']);

/** the trigger's signal for the rows' states; work under way outranks a failure */
export function languageSignal(kinds: Iterable<string | undefined>): LanguageSignal | undefined {
  let failed = false;
  for (const kind of kinds) {
    if (kind === undefined) continue;
    if (BUSY.has(kind)) return 'busy';
    if (kind === 'failed') failed = true;
  }
  return failed ? 'failed' : undefined;
}
