import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

import { DOMAIN_IDS, KIND_IDS, STATUS_IDS } from './content/notes/_meta/taxonomy';

/**
 * One note = one `<id>/index.mdx`, and the id IS the route.
 *
 *   notes/design-tokens/index.mdx        → /design-tokens/        (en, canonical)
 *   notes/components/index.mdx           → /components/           (a hub note)
 *   notes/components/content/index.mdx   → /components/content/   (hub chapter)
 *   notes/zh/design-tokens/index.mdx     → /zh/design-tokens/     (zh mirror)
 *
 * en is the primary locale and its ids carry no prefix; zh mirrors carry
 * `zh/`. Taxonomy fields are validated against the registry in
 * `_meta/taxonomy.ts` — a typo in `kind:` fails the build instead of
 * silently dropping the note from its shelf.
 */
const notes = defineCollection({
  loader: glob({
    pattern: ['**/index.mdx', '!_meta/**'],
    base: './src/content/notes',
    generateId: ({ entry }) => entry.replace(/\/index\.mdx$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    /** sidebar brand line; falls back to title */
    brand: z.string().optional(),
    subtitle: z.string().optional(),
    /** classification (see _meta/taxonomy.ts); chapters inherit the hub's */
    kind: z.enum(KIND_IDS).optional(),
    domains: z.array(z.enum(DOMAIN_IDS)).default([]),
    tags: z.array(z.string()).default([]),
    status: z.enum(STATUS_IDS).optional(),
    created: z.coerce.date().optional(),
    updated: z.coerce.date().optional(),
    aliases: z.array(z.string()).default([]),
    sources: z.array(z.object({ title: z.string(), href: z.string().optional() })).default([]),
    /** hubs only: chapter membership and order (ids relative to the hub) */
    nav: z.array(z.object({ group: z.string(), pages: z.array(z.string()) })).optional(),
    /** hub chapters: 1-based position — must match the hub's nav order */
    part: z.number().int().positive().optional(),
    /** sidebar row label for hub chapters; falls back to title */
    navLabel: z.string().optional(),
    /** how deep the sidebar ToC goes */
    tocDepth: z.union([z.literal(2), z.literal(3)]).default(2),
    /** `false` switches chapter numbering off (a hub's overview page) */
    chapters: z.boolean().default(true),
  }),
});

export const collections = { notes };
