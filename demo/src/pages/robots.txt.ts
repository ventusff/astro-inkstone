/** robots.txt — every page is crawlable; the two JSON endpoints (the search
 *  index and the playground manifest, raw note text) are kept out of search
 *  results; the sitemap the integration writes at the deploy root is
 *  announced against the deploy origin and base */
export function GET(): Response {
  const base = import.meta.env.BASE_URL;
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const root = new URL(prefix, import.meta.env.SITE).href;
  const lines = [
    'User-agent: *',
    'Allow: /',
    `Disallow: ${prefix}search-index.json`,
    `Disallow: ${prefix}playground-manifest.json`,
    '',
    `Sitemap: ${root}sitemap-index.xml`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
