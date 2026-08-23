/**
 * demo-loader.ts — the site side of the DemoMount contract.
 *
 * The package's DemoMount component renders the mount markup only
 * (`section.demo[data-demo]` with optional canvases and slots); loading and
 * running the interactive module is the site's job, because the modules are
 * site content. This site keeps them under `src/demos/<id>.ts`; each module
 * default-exports `mount(ctx)` and returns a cleanup function, which runs
 * when the page is left.
 *
 * `import.meta.glob` gives Vite the full module list at build time, so each
 * demo is its own lazily-loaded chunk — pages without a demo load none of
 * this beyond the loader itself.
 */

export interface DemoCtx {
  /** the stage element (`.demo-stage`) — DOM demos build into it */
  stage: HTMLElement;
  /** canvases rendered by DemoMount, in order (empty for DOM demos) */
  canvases: HTMLCanvasElement[];
}

export type DemoCleanup = (() => void) | void;

type DemoModule = { default: (ctx: DemoCtx) => DemoCleanup };

const modules = import.meta.glob<DemoModule>('../demos/**/*.ts');

/** Mount every `[data-demo]` on the page; cleanups run on pagehide. A
 *  module whose load resolves after pagehide does not mount, and a cleanup
 *  registered after disposal runs immediately instead of leaking. */
export function mountAllDemos(): void {
  const cleanups: (() => void)[] = [];
  let disposed = false;
  const register = (cleanup: () => void): void => {
    if (disposed) cleanup();
    else cleanups.push(cleanup);
  };
  for (const el of document.querySelectorAll<HTMLElement>('section.demo[data-demo]')) {
    const id = el.dataset['demo'];
    const stage = el.querySelector<HTMLElement>('.demo-stage');
    if (!id || !stage) continue;
    const load = modules[`../demos/${id}.ts`];
    if (!load) {
      console.warn(`[demo-loader] no module for demo id "${id}"`);
      continue;
    }
    load()
      .then((mod) => {
        if (disposed) return; // the page is gone — nothing to mount into
        const cleanup = mod.default({ stage, canvases: [...stage.querySelectorAll('canvas')] });
        if (cleanup) register(cleanup);
      })
      .catch((err: unknown) => {
        console.error(`[demo-loader] demo "${id}" failed to load`, err);
      });
  }
  window.addEventListener('pagehide', () => {
    disposed = true;
    for (const cleanup of cleanups.splice(0)) cleanup();
  });
}
