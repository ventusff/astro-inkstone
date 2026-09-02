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
  (the demo has a reference implementation). The package owns the layout
  *skeleton* vocabulary the wiki shape is built on — `.layout`, `.sidebar`,
  `main.note-main`, `.col`, the shell width tokens, and their print rules —
  the same way it owns `.col`: sites compose these classes, restyle them
  through tokens, and hang their own chrome components inside them.

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
  clears the bar. `node scripts/probe.mjs contrast` (from `demo/`; `--all`
  for every locale's tree) samples the rendered demo in both themes
  (dialogs and marked popovers probed open) and must report
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
  `build_font_subset.py --scan <dir>`, then commit `extra-chars.txt`, the
  regenerated woff2 faces and `coverage.txt` together (the sidecar the
  font-coverage test reads; the build is deterministic under the pinned
  toolchain). The display serif and UI sans are not shipped:
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
  schema keeps inheritable arrays `.optional()`, never `.default([])`. The
  one exception is `aliases`: entry-local, never inherited (an alias must
  identify exactly one note — an inherited hub alias would make
  `[[alias]]` ambiguous), so a schema may default it to `[]`.
- Relative imports inside `lib/` carry the `.ts` extension: the library is
  consumed as source by Vite and run as source by `node --test`.
- `lib/site-plugins.ts` holds `sitePluginSets` — the site plugin arrays
  alone, browser-safe by construction (it imports the engine's
  `wikilinks/core` and `wiki-blocks` leaves, never its processor factory);
  `lib/markdown-preset.ts` wraps them with the engine's processor and shiki
  for the build and re-exports them. Browser code (the demo's playground)
  imports `site-plugins`; a site's `astro.config` imports the preset.
- `components/LocalToc.astro` accepts both ToC shapes (`entries`/`items`).
- Wiki components are presentational: sites bind data with
  `createTaxonomy()` from `lib/taxonomy.ts` and pass props (including label
  strings — defaults are English). `lib/backlinks.ts` ships the matching
  backlink-index builder (`createBacklinks`) on the engine's own resolver.
- The demo is the wiki-shape reference implementation: a taxonomy garden
  (registry in `demo/src/content/notes/_meta/`, browse routes under
  `demo/src/pages/`) whose notes are the package manual — and the engine's
  manual too: the engine repo carries no demo site of its own, its features
  are documented here as the `inkbrush` hub (tag `inkbrush`, domain
  `editing`), and this garden is the site its README points at. Notes open with
  `<Hero>` (chapters with `<PartHero kicker={props.partLabel}>`); the layout
  renders the taxonomy strip, the hub crumb, linked mentions, prev/next and
  the footer around them, and the sidebar carries the note's brand, the
  generated ToC and its local link graph.
- `components/DemoMount.astro` renders mount markup only; the demo-module
  loader is site-owned (call your `mountAllDemos()` from the site layout).
- The demo speaks every language in `_meta/locales.ts` — the locale registry
  that drives the routes, the nav bar's language menu (the site's ONE
  language control), the hreflang alternates, the wikilink resolver's locale
  table and the strict link check (`demo/scripts/check-links.mjs`).
  `demo/src/components/browse/` holds the landing, facet and all-notes pages
  as locale-parameterized components; the default locale's routes live at
  the `demo/src/pages/` root and a single `[lang]/` tree serves every other
  locale. UI strings live one file per locale in `demo/src/lib/ui/`, typed
  total by `UIStrings` — count-taking strings are functions so each language
  applies its own plural rules; taxonomy display strings for every language
  live there too, keyed by the registry's canonical ids (the registry itself
  carries only the English `label`/`desc`). Adding a language = one registry
  row + one ui strings file + one content directory; RTL languages need a
  mirrored appearance layer first and must not be added as a row alone.
- The README's GIFs and screenshots are recorded by `scripts/readme-clips/`
  against the demo in editing mode (see its README); re-record rather than
  hand-edit them.

## How to verify

```bash
npm ci && npm test                   # repo root: package deps + library unit tests
cd demo && npm ci
npx astro check                      # types (a build alone does not check them)
npm run build                        # build + engine check-dist (postbuild)
npm run dev                          # the manual site
npm run check                            # engine CLIs: content + wikilinks (strict)
node scripts/probe.mjs ui                # render-layer probe, en+zh trees (needs Chrome)
node scripts/probe.mjs contrast          # WCAG contrast, en+zh trees, both themes
node scripts/probe.mjs ui --all          # every locale's tree — before a release,
node scripts/probe.mjs contrast --all    #   and after any language-shaped change
PLAYGROUND=1 npm run build               # the Pages shape: block stamps, per-page source islands, the index manifest
node ../scripts/playground_probe.mjs dist    # the browser-local editor end to end, every note's block map
```

Library changes go through the unit tests; style/component changes through a
demo build + both probes — all green before committing. The probes default
to the en and zh trees (the registry-driven wrapper passes `--exclude` to
the package scripts); `--all` covers every locale and is the bar before a
release and after any language-shaped change — the locale registry, the ui
strings files, fonts, per-language CSS, a component that lays out
per-language labels — because the failures such a change causes live only
in the other locales' trees. Both probes load each page once and sweep it
in place, `PROBE_WORKERS` tabs at a time (default one per core), each tab
an incognito context: of one browser for ui_probe, of a few browser
processes (`PROBE_BROWSERS`, default 4) for contrast_probe, since
screenshots serialize inside a browser and a process costs hundreds of MB
of shared memory under the system temp dir. The full every-locale sweep is
under a minute for ui_probe and a few minutes for contrast_probe on a
24-core machine. CI runs ui_probe over everything and
the contrast probe over the en+zh trees on every push; the every-locale
contrast sweep runs there on manual dispatch (the `contrast` input). The
playground probe is the bar after
any change to the engine's block stamping, the playground, or a component
that renders note content: it drives the browser-local editor in headless
Chrome and, on every note page, verifies that activation leaves the build's
block map intact (each block keeps its source range). The Pages workflow
runs it on the artifact it deploys; a local run needs a `PLAYGROUND=1`
build (`--exclude` narrows the every-page sweep, as for the other probes;
the sweep runs `PROBE_WORKERS` tabs at a time, the editing flows in order
on one tab).
Comments and documentation are written in English; the README ships in
English and Simplified Chinese (`README.zh-CN.md`) — keep both in sync.
Commit messages: English, entirely — subject and body.
