/**
 * reader-language.ts — an Astro integration that sends every page request to
 * the reader's language (lib/locale-negotiation.ts).
 *
 * The redirect sits on the dev server's own request pipeline, in front of
 * Astro: a live wiki serves its pages as prerendered routes, and Astro hands
 * a prerendered route a request without headers, so an Astro middleware
 * never sees the reader's cookie. The static build renders pages for no
 * reader and is untouched.
 *
 * Only page navigations move: GET requests that accept HTML, under the
 * deploy base, for paths that are neither files (an extension) nor engine
 * and CMS endpoints (`_…`, `@…`, `api/…`).
 */
import type { AstroIntegration } from 'astro';

import { negotiateLocale, type NegotiationOptions } from './locale-negotiation.ts';

/** the cookies of a Cookie header; a value that is not valid percent-encoding is kept as sent */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

/** the redirect for one request, or null to let it through */
export function readerRedirect(
  req: { method?: string | undefined; url?: string | undefined; headers: { accept?: string | undefined; cookie?: string | undefined } },
  options: NegotiationOptions,
): string | null {
  const root = `/${options.base ?? '/'}/`.replace(/\/{2,}/g, '/');
  const url = new URL(req.url ?? '/', 'http://reader.invalid');
  const rest = url.pathname.startsWith(root) ? url.pathname.slice(root.length) : null;
  const page =
    req.method === 'GET' &&
    (req.headers.accept ?? '').includes('text/html') &&
    rest !== null &&
    !/\.[A-Za-z0-9]+$/.test(rest) &&
    !/^(?:[_@]|api\/)/.test(rest);
  return negotiateLocale({ url, cookies: parseCookies(req.headers.cookie), page, localized: true }, { ...options, base: root })
    .redirect;
}

export function readerLanguage(options: NegotiationOptions): AstroIntegration {
  return {
    name: 'astro-inkstone/reader-language',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, res, next) => {
          const to = readerRedirect(req, options);
          if (!to) return next();
          res.statusCode = 302;
          res.setHeader('location', to);
          res.setHeader('cache-control', 'no-store');
          res.end();
        });
      },
    },
  };
}
