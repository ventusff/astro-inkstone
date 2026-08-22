import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * One page = one `<id>/index.mdx`, and the id IS the route.
 *
 *   src/content/docs/design/tokens/index.mdx     → /design/tokens/      (en, canonical)
 *   src/content/docs/zh/design/tokens/index.mdx  → /zh/design/tokens/   (zh)
 *
 * en is the default locale and its ids carry no prefix; zh ids carry `zh/`.
 * A page that exists only in en is still served at its zh route, with the en
 * text and a notice — so the zh tree is never full of holes. Chapter
 * membership and order live in `src/lib/book.ts`, not in frontmatter, so a
 * page cannot disagree with the table of contents.
 */
const docs = defineCollection({
  loader: glob({
    pattern: '**/index.mdx',
    base: './src/content/docs',
    generateId: ({ entry }) => entry.replace(/\/index\.mdx$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    /** dateline, for pages that record a specific day's work */
    date: z.string().optional(),
  }),
});

export const collections = { docs };
