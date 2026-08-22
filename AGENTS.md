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
  to consuming sites (the editing-machine deployment shape is documented
  with the engine).
- **Sites**: override tokens for identity; own their Sidebar/Nav chrome
  (the demo has a reference implementation).

## Hard rules

- **Two-tier token discipline**: `base.css`, `browse.css` and components may
  only consume second-tier semantic tokens — `--color-*` (the reading
  column), `--wb-*` (the browse shelf), `--font-*`, `--radius`…. No rule and
  no component contains a raw color value, not even as a `var()` fallback
  (`tokens.css` is required). Identity customization happens in tier one
  (`--p-*`, the pigments) or by re-mapping tier two — both are supported
  paths. The one kind of color carried as data is tone data
  supplied by the site's registry — a domain's `{ bg, fg }` tone pair, a
  status dot, a per-category chip tone, a per-collection graph color. Tone
  data used as text must clear AA where it renders; the contrast probe
  measures it like any other run.
- **Two contexts, one palette**: note pages are the reading column
  (`--color-*`: cool paper, 石 burnt orange accent); landing and facet pages
  are the browse shelf (`body.wb-root` + `--wb-*`: warm paper, display serif,
  朱 wine-red mark). `browse.css` re-maps the chrome tokens inside
  `.wb-root`, so chrome written against `--color-*` works on both grounds.
- **Contrast is measured**: every text color must clear WCAG AA on the
  surface it actually renders on (small text 4.5:1; an accent used as small
  text has its own darkened `-text` tier), at the opacity it actually
  renders at — never dim text with `opacity`, use a token color that
  clears the bar. `node scripts/contrast_probe.mjs demo/dist` samples the
  rendered demo in both themes (dialogs probed open) and must report
  `TEXT BELOW AA: 0` before a style commit. Hover and focus states are the
  one surface reviewed by eye instead of probed.
- **Light is the identity**: never read `prefers-color-scheme`; dark styles
  activate only under `[data-theme='dark']`.
- The table double-wrapper (`.tbl-wrap` container-query container +
  `.tbl-scroll` scroll box) is deliberate — do not "simplify" it.
- Never add `.line { display: block }` to code blocks (it doubles line
  breaks).
- The font subset is a fixed recipe that lives in the repository
  (`fonts/build_font_subset.py` + `hanzi-3500.txt` + `extra-chars.txt`), cut
  from a source font pinned by SHA-256. Content needing glyphs beyond it:
  `build_font_subset.py --scan <dir>`, then commit `extra-chars.txt` and the
  regenerated woff2 together. The display serif and UI sans are not shipped:
  `--font-display` / `--font-ui` name the `@fontsource` families the demo
  self-hosts, and fall back to system faces.
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
  numbering, ToC into frontmatter). `lib/heading-core.ts` holds what they
  share: `slugify` (anchor consistency is load-bearing for wikilinks), the
  id rule (explicit ids unique, generated ids deduplicated), the heading
  attribute contract and the numeral helpers.
- Taxonomy inheritance is field-wise: a chapter or mirror inherits a field
  it leaves `undefined` and owns a field it sets, `[]` included — so a site
  schema keeps inheritable arrays `.optional()`, never `.default([])`.
- Relative imports inside `lib/` carry the `.ts` extension: the library is
  consumed as source by Vite and run as source by `node --test`.
- `components/LocalToc.astro` accepts both ToC shapes (`entries`/`items`).
- Wiki components are presentational: sites bind data with
  `createTaxonomy()` from `lib/taxonomy.ts` and pass props (including label
  strings — defaults are English). `lib/backlinks.ts` ships the matching
  backlink-index builder (`createBacklinks`) on the engine's own resolver.
- The demo is the wiki-shape reference implementation: a taxonomy garden
  (registry in `demo/src/content/notes/_meta/`, browse routes under
  `demo/src/pages/`) whose notes are the package manual. Notes open with
  `<Hero>` (chapters with `<PartHero kicker={props.partLabel}>`); the layout
  renders the taxonomy strip, the hub crumb, linked mentions, prev/next and
  the footer around them, and the sidebar carries the note's brand, the
  generated ToC and its local link graph.
- `components/DemoMount.astro` renders mount markup only; the demo-module
  loader is site-owned (call your `mountAllDemos()` from the site layout).

## How to verify

```bash
npm ci && npm test                   # repo root: package deps + library unit tests
cd demo && npm ci
npx astro check                      # types (a build alone does not check them)
npm run build                        # build + engine check-dist (postbuild)
npm run dev                          # the manual site
node ../scripts/ui_probe.mjs dist        # render-layer probe (needs Chrome)
node ../scripts/contrast_probe.mjs dist  # WCAG contrast of rendered text, both themes
```

Library changes go through the unit tests; style/component changes through a
demo build + both probes — all green before committing. CI runs the same.
Comments and documentation are written in English; the README ships in
English and Simplified Chinese (`README.zh-CN.md`) — keep both in sync.
Commit messages: English, entirely — subject and body.
