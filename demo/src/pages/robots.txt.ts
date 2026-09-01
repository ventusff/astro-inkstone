/** robots.txt — everything is crawlable; the sitemap the integration writes
 *  at the deploy root is announced against the deploy origin and base */
export function GET(): Response {
  const base = import.meta.env.BASE_URL;
  const root = new URL(base.endsWith('/') ? base : `${base}/`, import.meta.env.SITE).href;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${root}sitemap-index.xml\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
