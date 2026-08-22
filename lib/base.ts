/** Normalize a mount prefix: '' or '/prefix' (no trailing slash). */
export function normalizeBase(base: string | undefined): string {
  if (!base) return '';
  const trimmed = base.replace(/\/+$/, '');
  if (!trimmed || trimmed === '/') return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}
