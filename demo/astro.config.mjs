// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// The demo consumes the package one directory up via `file:..`; the package's
// own dependencies come from the REPO-ROOT npm install (Node/Vite resolve
// from the package's real path — the repo root — and hit the root
// node_modules; the engine is supplied through the root `workspaces` field).
// WIKI=1 astro dev → editing mode (the astro-inkbrush CMS activates). The
// static build never activates it: outside WIKI mode the engine's integration
// code is not even imported (dynamic import), so the output carries zero CMS
// bytes. The Markdown dialect and content guard, however, always come from
// the engine via siteMarkdown — what the editor accepts and what the page
// renders must be one grammar.
const WIKI_MODE = Boolean(process.env.WIKI);
const { siteMarkdown } = await import('astro-inkstone/lib/markdown-preset');
const inkbrush = WIKI_MODE ? (await import('astro-inkbrush')).inkbrush : null;

export default defineConfig({
  // Deploy target comes from env: on GitHub Pages the site lives under the
  // /astro-inkstone/ project path; local dev defaults to the root. Internal
  // links always go through import.meta.env.BASE_URL, so both mounts share
  // one codebase.
  site: process.env.DEMO_SITE || 'https://example.com',
  base: process.env.DEMO_BASE || '/',
  trailingSlash: 'ignore',
  integrations: [mdx(), ...(inkbrush ? [inkbrush()] : [])],

  // en is the default locale, served at root paths; zh mirrors live under
  // /zh/. Every page of both locales is materialized explicitly by
  // src/pages/[...slug].astro — a route with no translation renders the other
  // locale's original plus a notice bar. Astro's own fallback/fallbackType is
  // deliberately unused: route-level fallbacks can stack a locale prefix onto
  // already-prefixed paths and emit duplicate /xx/xx/ pages.
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    routing: { prefixDefaultLocale: false },
  },

  // The whole site markdown pipeline in one line from the package preset.
  // numbering: 'sections' → build-time heading numbers + ToC into frontmatter
  // (paired with guard.autoNumberedHeadings: a hand-typed number would stack
  // into a double number, so the guard rejects it at build time).
  markdown: {
    ...siteMarkdown({
      numbering: 'sections',
      math: true,
      codeFrame: true,
      mermaid: true,
      callouts: true,
      wikiBlocks: WIKI_MODE,
      guard: { autoNumberedHeadings: true },
    }),
  },

  vite: {
    server: {
      allowedHosts: process.env.SITE_HOST ? [process.env.SITE_HOST] : [],
    },
  },
});
