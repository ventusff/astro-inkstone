/**
 * Mount prefix and URL factory for note routes. The mount point is
 * env-configured (this file lives in the shared package; sites don't edit
 * it): set `PUBLIC_NOTES_BASE` in astro.config or .env (e.g. '/wiki',
 * '/docs'; default '/wiki'). The wiki components and siteMarkdown all read
 * it from here.
 */
export const NOTES_BASE: string = normalizeBase(import.meta.env?.PUBLIC_NOTES_BASE) || '/wiki';

/** note id → site URL (mount prefix + trailing slash) */
export function noteUrl(id: string): string {
  return `${NOTES_BASE}/${id}/`.replace(/\/{2,}/g, '/');
}

/** normalize a mount prefix: '' or '/prefix' (no trailing slash) */
export function normalizeBase(base: string | undefined): string {
  if (!base) return '';
  const trimmed = base.replace(/\/+$/, '');
  if (!trimmed || trimmed === '/') return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}
