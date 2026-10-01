/**
 * locale-negotiation.ts — every page a reader opens is in the reader's language.
 *
 * The reader's language is one value, set by the identity provider in a
 * cookie shared by every site under the parent domain (the account's
 * language). Nothing in an address overrides it: a page request whose path
 * carries another locale's prefix — a shared link, a stale bookmark, a typed
 * URL — is redirected to the same page under the reader's prefix. Without the
 * cookie (signed out, a machine client) the site's default locale applies.
 * Only page navigations are moved: callers pass `page: false` for assets,
 * APIs and machine endpoints, and `localized: false` for routes that are not
 * served once per locale (those render in the reader's language in place).
 */

export interface NegotiationOptions {
  /** locale codes with their route prefixes; exactly one prefix is '' */
  locales: readonly { code: string; prefix: string }[];
  defaultLocale: string;
  /** name of the cookie holding the reader's language */
  cookie: string;
  /** deploy base the prefixes sit under, e.g. '/' or '/wiki/' */
  base?: string;
}

export interface NegotiationInput {
  url: URL;
  /** cookie name → value */
  cookies: Readonly<Record<string, string | undefined>>;
  /** a page navigation (HTML document), not an asset or API call */
  page: boolean;
  /** this route serves a page per locale under the prefixes */
  localized: boolean;
}

export interface Negotiation {
  locale: string;
  /** where to send the reader instead; null to answer here */
  redirect: string | null;
}

export function negotiateLocale(input: NegotiationInput, options: NegotiationOptions): Negotiation {
  const { locales, defaultLocale, cookie } = options;
  if (!locales.some((l) => l.code === defaultLocale)) {
    throw new Error(`negotiateLocale: defaultLocale "${defaultLocale}" is not a locale`);
  }
  const wanted = input.cookies[cookie];
  const locale = locales.some((l) => l.code === wanted) ? wanted! : defaultLocale;
  if (!input.page || !input.localized) return { locale, redirect: null };
  const pathname = relocalize(input.url.pathname, locale, locales, options.base);
  return {
    locale,
    redirect: pathname === input.url.pathname ? null : `${pathname}${input.url.search}${input.url.hash}`,
  };
}

/** the same page under another locale's prefix */
export function relocalize(
  pathname: string,
  locale: string,
  locales: readonly { code: string; prefix: string }[],
  base = '/',
): string {
  const b = normalizeBase(base);
  if (!pathname.startsWith(b)) return pathname;
  let rest = pathname.slice(b.length);
  for (const l of locales) {
    if (!l.prefix) continue;
    const seg = l.prefix.replace(/\/$/, '');
    if (rest === seg || rest.startsWith(`${seg}/`)) {
      rest = rest.slice(seg.length).replace(/^\//, '');
      break;
    }
  }
  const prefix = locales.find((l) => l.code === locale)?.prefix ?? '';
  return `${b}${prefix}${rest}`;
}

function normalizeBase(base: string): string {
  const trimmed = `/${base}`.replace(/\/{2,}/g, '/');
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}
