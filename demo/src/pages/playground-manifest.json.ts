/**
 * Build-time sources manifest for the browser playground: every note's raw
 * file (frontmatter included) plus the locale registry — the browser-local
 * backend serves /meta, /notes and block reads from it. Emitted with content
 * only under PLAYGROUND=1; a default build ships an empty shell, so the
 * playground adds zero real bytes there.
 */
import { existsSync, readFileSync } from 'node:fs';

import { cachedScan } from 'astro-inkbrush/wikilinks';

const PLAYGROUND = Boolean(process.env.PLAYGROUND);
const NOTES_DIR = 'src/content/notes';
const scan = cachedScan(NOTES_DIR);

export function GET(): Response {
  if (!PLAYGROUND) return Response.json({ locales: [], notes: [] });
  const notes = scan().map((n) => {
    const dir = `${NOTES_DIR}/${n.id}`;
    const file = existsSync(`${dir}/index.mdx`) ? `${dir}/index.mdx` : `${dir}/index.md`;
    return {
      id: n.id,
      file,
      title: n.title,
      brand: n.brand,
      aliases: n.aliases,
      source: readFileSync(file, 'utf8'),
      mdx: file.endsWith('.mdx'),
    };
  });
  return Response.json({
    locales: [
      { code: 'en', prefix: '', label: 'English' },
      { code: 'zh', prefix: 'zh/', label: '中文' },
    ],
    notes,
  });
}
