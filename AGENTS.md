# AGENTS.md — working on astro-inkstone

Guidance for coding agents (and humans) contributing to this repo.

## What this is

astro-inkstone is the **appearance layer** for Astro documentation/wiki
sites — design tokens, content styles, components, a Markdown pipeline
preset, fonts, and render-layer check tooling. It pairs with the CMS engine
[astro-inkbrush](https://github.com/ventusff/astro-inkbrush). The repo root
is the package; `demo/` is a deployable site that consumes the package and
whose content is the package's own manual.

## Boundaries (the three-layer split)

- **Engine (astro-inkbrush)**: CMS features + the Markdown dialect and
  content guard. Never add styling to the engine.
- **This package**: shared appearance & pipeline. It must not contain *site
  identity* — brand palettes, layout chrome, routing and deployment belong
  to consuming sites.
- **Sites**: override tokens for identity; own their Sidebar/Nav chrome
  (the demo has a reference implementation).

## Hard rules

- **Two-tier token discipline**: `base.css` and components may only consume
  second-tier semantic tokens (`--color-*`, `--font-*`, `--radius`…). New
  rules must not contain raw color values. Identity customization happens in
  tier one (`--p-*`) or by re-mapping tier two — both are supported paths.
- **Contrast is audited**: token values are chosen for WCAG AA on every
  background they appear on (body text 4.5:1 minimum; accent-colored text
  has its own darkened text-tier). When changing a color, check every
  surface it sits on.
- **Light is the identity**: never read `prefers-color-scheme`; dark styles
  activate only under `[data-theme='dark']`.
- The table double-wrapper (`.tbl-wrap` container-query container +
  `.tbl-scroll` scroll box) is deliberate — do not "simplify" it.
- Never add `.line { display: block }` to code blocks (it doubles line
  breaks).
- The font subset is a fixed recipe (constants at the top of
  `fonts/build_font_subset.py`). If content needs glyphs beyond coverage,
  re-run the script and commit the regenerated woff2.
- The engine dependency is deliberately **not** a peerDependency: the engine
  is distributed as a git submodule, not on npm, and a peer declaration
  would send package managers to the registry for a package that isn't
  there. Consuming sites declare `astro-inkbrush` themselves; pure-static
  sites that skip the engine must not import `siteMarkdown` (it imports the
  engine's dialect).
- The root `package.json` must not declare dependencies or devDependencies
  on in-repo paths. The engine used by the demo is supplied via the npm
  `workspaces` field (`demo/vendor/astro-inkbrush`), which only this repo's
  root install reads — pnpm/npm consumers never see it.

## Structure notes

- The two heading-numbering presets (`lib/rehype-chapters.ts` and
  `lib/rehype-sections.ts`) are both intentional product shapes — chapters
  (part/chapter numbering, site reads the ToC) vs sections (auto section
  numbering, ToC into frontmatter). `lib/heading-core.ts` is the single
  source of truth for `slugify` (anchor consistency is load-bearing for
  wikilinks) — both presets re-export it.
- `components/LocalToc.astro` accepts both ToC shapes (`entries`/`items`).
- Wiki components are presentational: sites bind data with
  `createTaxonomy()` from `lib/taxonomy.ts` and pass props (including label
  strings — defaults are English).
- `components/DemoMount.astro` renders mount markup only; the demo-module
  loader is site-owned (call your `mountAllDemos()` from the site layout).

## How to verify

```bash
npm install                          # repo root: package deps
cd demo && npm install
npm run build                        # build + engine check-dist (postbuild)
npm run dev                          # the manual site
node ../scripts/ui_probe.mjs dist    # render-layer probe (needs Chrome)
```

Style/component changes go through a demo build + probe before committing.
Comments and documentation are written in English; the README ships in
English and Simplified Chinese (`README.zh-CN.md`) — keep both in sync.
Commit messages: English subject line; a Chinese mirror line in the body is
welcome.
