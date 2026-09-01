/**
 * indexnow — tell the IndexNow engines (Bing, Yandex, Naver, Seznam, Yep)
 * which URLs of a deployed site exist now: every URL of the live sitemap,
 * one submission per 10 000 URLs, through api.indexnow.org, which fans out
 * to every participating engine. Google takes no IndexNow; it reads the
 * sitemap through Search Console.
 *
 *   node scripts/indexnow.mjs <site root URL> <key>
 *
 * The key must be served at <site root>/<key>.txt (the demo commits it
 * under demo/public/); IndexNow keys are public by design. Exit 0 when
 * every batch is accepted (200 or 202), 1 otherwise.
 */
const [root, key] = process.argv.slice(2);
if (!root || !key) {
  console.error('usage: node scripts/indexnow.mjs <site root URL> <key>');
  process.exit(2);
}
const site = new URL(root.endsWith('/') ? root : `${root}/`);

const locs = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
};
const index = await locs(new URL('sitemap-index.xml', site).href);
const urls = (await Promise.all(index.map(locs))).flat();
if (urls.length === 0) throw new Error('the sitemap lists no URLs');

let failed = false;
for (let i = 0; i < urls.length; i += 10000) {
  const batch = urls.slice(i, i + 10000);
  const res = await fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: site.host,
      key,
      keyLocation: new URL(`${key}.txt`, site).href,
      urlList: batch,
    }),
  });
  const ok = res.status === 200 || res.status === 202;
  if (!ok) failed = true;
  console.log(`IndexNow: ${batch.length} URLs → HTTP ${res.status}${ok ? '' : ` ${await res.text()}`}`);
}
process.exit(failed ? 1 : 0);
