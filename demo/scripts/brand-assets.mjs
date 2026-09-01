/**
 * Brand assets for the demo's <head>, written under public/ and committed:
 * the inkstone mark as favicon.svg, rasterized to the PNG sizes search
 * results (48px) and home screens (180px) want, and the Open Graph card —
 * the repository's social preview at the 2:1 size every card renderer
 * accepts. Re-run after changing either source.
 *
 *   node scripts/brand-assets.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));
const SOCIAL_PREVIEW = fileURLToPath(new URL('../../.github/assets/social-preview.png', import.meta.url));

/** the mark: a diamond outline around a solid diamond, in 朱 (the browse
 *  shelf's wine-red); `ground` paints the paper behind it for raster sizes */
const mark = (ground) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">${
  ground ? `<rect width="20" height="20" rx="4" fill="${ground}"/>` : ''
}<path d="M10 2.2 17.8 10 10 17.8 2.2 10Z" fill="none" stroke="#7d3a3a" stroke-width="1.6"/><path d="M10 6.4 13.6 10 10 13.6 6.4 10Z" fill="#7d3a3a"/></svg>`;

writeFileSync(out('favicon.svg'), mark(null) + '\n');
for (const [name, size] of [
  ['favicon-48.png', 48],
  ['apple-touch-icon.png', 180],
]) {
  await sharp(Buffer.from(mark('#faf6ec'))).resize(size, size).png().toFile(out(name));
}
await sharp(SOCIAL_PREVIEW).resize(1200, 600).png({ compressionLevel: 9 }).toFile(out('og.png'));
console.log('brand assets written to public/');
