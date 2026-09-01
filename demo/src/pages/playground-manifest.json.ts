/**
 * Build-time index manifest for the browser playground: the locale table
 * (the site registry's) and every note's identity — id, title, brand,
 * aliases — what wikilink resolution and the note list need. Sources travel
 * with their pages: each note page's head carries its own (see
 * lib/playground-source.ts). Emitted with content only under PLAYGROUND=1;
 * a default build ships an empty shell, so the playground adds zero real
 * bytes there.
 */
import { cachedScan } from 'astro-inkbrush/wikilinks';

import { LOCALE_DEFS } from '../content/notes/_meta/locales';

const PLAYGROUND = Boolean(process.env.PLAYGROUND);
const scan = cachedScan('src/content/notes');

export function GET(): Response {
  if (!PLAYGROUND) return Response.json({ locales: [], notes: [] });
  return Response.json({
    locales: LOCALE_DEFS.map(({ code, prefix, label }) => ({ code, prefix, label })),
    notes: scan().map(({ id, title, brand, aliases }) => ({
      id,
      title,
      ...(brand ? { brand } : {}),
      aliases,
    })),
  });
}
