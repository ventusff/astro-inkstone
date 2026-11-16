/**
 * page-demos.ts — the engine's loader for interactive figures kept beside
 * their pages.
 *
 * A DemoMount with `module="/src/content/…/<name>.ts"` renders
 * `section.demo[data-demo-module]`; this loader imports that module and calls
 * its default export with the mount's elements. Every `.ts` under the site's
 * `src/content/` is known to Vite at build time (`import.meta.glob`), each its
 * own lazily-loaded chunk, so a page fetches only the modules it shows.
 *
 * A module reads its words and data from a JSON beside it and puts the words
 * in the page's language with `inLocale(json, ctx.locale)` (lib/figure-file.ts):
 *
 *   import figure from './entry-paths.json';
 *   import { inLocale } from 'astro-inkstone/lib/figure-file';
 *   export default function mount(ctx: PageDemoContext) {
 *     const words = inLocale(figure, ctx.locale);
 *     …
 *     return () => { … };   // runs when the page is left
 *   }
 *
 * DemoMount's own script calls `mountPageDemos()`; the site wires nothing.
 * Mounts whose `data-demo` names an id stay the site loader's.
 */

/** what a page demo's `mount` is handed */
export interface PageDemoContext {
  /** the mount's `section.demo` */
  root: HTMLElement;
  /** the stage (`.demo-stage`): a DOM demo builds into it */
  stage: HTMLElement;
  /** the canvases DemoMount rendered, in order (none for a DOM demo) */
  canvases: HTMLCanvasElement[];
  /** the controls slot's box, when the page gave controls */
  controls: HTMLElement | null;
  /** the page's language, for the words the module shows */
  locale: string | undefined;
}

export type PageDemoCleanup = (() => void) | void;

type PageDemoModule = { default: (ctx: PageDemoContext) => PageDemoCleanup };

const modules = import.meta.glob<PageDemoModule>(['/src/content/**/*.ts', '!/src/content/**/*.d.ts']);

const cleanups: (() => void)[] = [];
let leaving = false;
let listening = false;

function leave(): void {
  leaving = true;
  for (const cleanup of cleanups.splice(0)) cleanup();
}

/** mount every page demo on the page that is not mounted yet; cleanups run when the page is left */
export function mountPageDemos(): void {
  if (!listening) {
    listening = true;
    addEventListener('pagehide', leave);
    document.addEventListener('astro:before-swap', leave);
    // a page restored from the back-forward cache had its demos cleaned up on the way out
    addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      for (const root of document.querySelectorAll<HTMLElement>('section.demo[data-demo-module]')) delete root.dataset['mounted'];
      mountPageDemos();
    });
  }
  leaving = false;
  for (const root of document.querySelectorAll<HTMLElement>('section.demo[data-demo-module]:not([data-mounted])')) {
    root.dataset['mounted'] = '';
    const path = root.dataset['demoModule']!;
    const stage = root.querySelector<HTMLElement>('.demo-stage')!;
    const load = modules[path];
    if (!load) {
      console.error(`[page-demos] no module ${path}: it must be a .ts file under src/content/, named by its path from the site root`);
      continue;
    }
    load()
      .then((mod) => {
        if (leaving) return;
        const cleanup = mod.default({
          root,
          stage,
          canvases: [...stage.querySelectorAll('canvas')],
          controls: root.querySelector<HTMLElement>('.demo-controls'),
          locale: root.dataset['locale'],
        });
        if (cleanup) cleanups.push(cleanup);
      })
      .catch((err: unknown) => console.error(`[page-demos] ${path} failed to load`, err));
  }
}
