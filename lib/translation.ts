/**
 * translation.ts — is a translated note keeping up with its source?
 *
 * A translation records which version of its source it renders, as
 * frontmatter:
 *
 *   translatedFrom:
 *     locale: zh
 *     revision: 3f9a1c0b7d2e
 *
 * `revision` is a prefix (7–40 hex digits) of the source file's git blob id —
 * what `git hash-object <file>` prints — so it is computable from the file
 * bytes alone, with or without a repository: a live editing server, a static
 * build and a shell agree on it. Any change to the source file, frontmatter
 * included, moves the blob id; a translation whose recorded revision no
 * longer matches is `behind`.
 *
 * Node-only (node:crypto): call it at build or request time, never in the
 * browser.
 */
import { createHash } from 'node:crypto';

/** the frontmatter field a translation carries */
export interface TranslatedFrom {
  /** locale code of the source */
  locale: string;
  /** prefix of the source file's git blob id */
  revision: string;
}

/**
 * - `current`: the translation renders the source as it stands
 * - `behind`: the source changed after the recorded revision
 * - `unrecorded`: the translation does not say which revision it renders
 */
export type TranslationState = 'current' | 'behind' | 'unrecorded';

const REVISION = /^[0-9a-f]{7,40}$/;

/** git's blob id of a file's exact bytes — `git hash-object` */
export function gitBlobId(bytes: string | Uint8Array): string {
  const body = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : Buffer.from(bytes);
  return createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
}

/** the revision a translation made from this source file should record (12 hex) */
export function sourceRevision(bytes: string | Uint8Array): string {
  return gitBlobId(bytes).slice(0, 12);
}

/** where a translation stands against the current bytes of its source file */
export function translationState(
  translatedFrom: Partial<TranslatedFrom> | null | undefined,
  sourceBytes: string | Uint8Array,
): TranslationState {
  const revision = translatedFrom?.revision?.toLowerCase();
  if (!revision || !REVISION.test(revision)) return 'unrecorded';
  return gitBlobId(sourceBytes).startsWith(revision) ? 'current' : 'behind';
}
