# Contributing to astro-inkstone

Thank you for taking the time. This page is the short version; `AGENTS.md`
is the full working guide — boundaries, hard rules, how to verify — and it
applies to humans and coding agents alike.

## Before you start

- **Where things belong.** Inkstone is the appearance layer: design tokens,
  content styles, components, the Markdown pipeline preset, fonts and the
  render-layer checks. Editing features and the Markdown dialect live in the
  engine, [astro-inkbrush](https://github.com/ventusff/astro-inkbrush). Site
  identity — brand palette, layout chrome, routing, deployment — belongs to
  the consuming site (the demo is the reference). A change in the wrong
  layer is the most common reason a pull request is sent back.
- **Talk first about anything visible.** Open a
  [discussion](https://github.com/ventusff/astro-inkstone/discussions) or an
  issue before a design change; bug fixes and documentation fixes can go
  straight to a pull request.

## Setup

```bash
git clone --recurse-submodules https://github.com/ventusff/astro-inkstone
cd astro-inkstone && npm ci && npm test
cd demo && npm ci && npm run dev        # the manual site
```

## Verifying a change

- Library code (`lib/`): `npm test` at the repo root.
- Styles and components: from `demo/`, `npx astro check`, `npm run build`,
  `npm run check`, then `node scripts/probe.mjs ui` and
  `node scripts/probe.mjs contrast` (headless Chrome) — all green.
- Anything touching block stamping or the playground: `PLAYGROUND=1 npm run
  build` then `node ../scripts/playground_probe.mjs dist`.

## What pull requests are checked against

- The hard rules in `AGENTS.md`: two-tier tokens (no raw color in
  `base.css`, `browse.css` or a component), contrast measured against WCAG
  AA, light as the identity (dark styles only under `[data-theme='dark']`),
  the table double-wrapper, the code-block `.line` rule, the font subset
  recipe.
- Comments and documentation in English; commit messages entirely in
  English, a subject line and a body that says why.
- No build artifacts in a commit (`dist/`, `ui-probe.txt`,
  `contrast-probe.txt`, regenerated lockfiles you did not mean to change).
- The demo garden speaks 18 languages: a UI string or a note added in one
  locale needs its twins (the registry and the rules are in `AGENTS.md`).

## Reporting

Bugs and feature requests go through the issue templates; security problems
through [SECURITY.md](SECURITY.md).
