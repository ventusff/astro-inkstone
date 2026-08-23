/**
 * Normalize a mount prefix: always '' or '/prefix' (one leading slash, no
 * trailing slash — repeated leading and trailing slashes collapse, so a
 * '//host'-shaped protocol-relative spelling cannot come back out). A value
 * carrying a query or fragment is rejected: a mount prefix is a path.
 */
export function normalizeBase(base: string | undefined): string {
  if (!base) return '';
  if (/[?#]/.test(base)) {
    throw new Error(`normalizeBase: a mount prefix is a path and cannot carry a query or fragment, got ${JSON.stringify(base)}`);
  }
  const trimmed = base.replace(/^\/+/, '/').replace(/\/+$/, '');
  if (!trimmed || trimmed === '/') return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}
