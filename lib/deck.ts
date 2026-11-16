/**
 * deck.ts — a slide deck made of one note's own content.
 *
 * The note is written and rendered like any other: its blocks stay the
 * top-level blocks of the page, so in-place editing, wikilinks and every
 * component work inside a slide as they do on a page. A thematic break
 * (`---` on a line of its own) ends a slide. At mount the flat content is
 * grouped into `<section class="slide">` elements, the blocks and their edit
 * anchors moved in document order, so an anchor still precedes the element
 * it binds to.
 *
 * A slide is shaped by markers, self-closing components that render a
 * `[data-deck-marker]` block the deck reads here: `<Layout name="…" />` names
 * the slide's layout (`SLIDE_LAYOUTS`), `<Column />` starts the next column,
 * `<Build />` makes the blocks after it appear one click at a time, and
 * `<Stretch />` grows the block after it to the height the slide has left.
 * Being blocks of their own, markers never wrap the content they shape, so
 * every block of the slide stays editable on its own.
 *
 * Every slide (`[data-deck-slide]`, its number) is laid out on a fixed canvas
 * (`[data-deck-canvas]`, its size: `960x540`) of `CANVAS_W` × `CANVAS_H` CSS
 * pixels and scaled to the width it is shown at, so a slide looks the same in
 * the page column, on a projector and in print. The scale is `--deck-k` on the
 * deck; a canvas taller than the slide (too much on one slide) grows the slide
 * in the reading view and is clipped while presenting. Below `NARROW` CSS
 * pixels a slide is laid out at its own width, unscaled, so a phone reads it
 * as ordinary page text.
 *
 * A section slide (laid out `section`, or holding only one heading and at
 * most one paragraph) opens a part, and the part's name is printed in the
 * corner of every slide of that part, beside the slide's number.
 *
 * Clicks. A slide's clicks are counted once, at mount, in document order:
 * after a `<Build />`, every block is one click and a list one click per
 * item; an element that declares `data-deck-steps="N"` (a FlowDiagram with
 * `steps`) takes the N clicks after its own appearance, and is told where they
 * start in `data-deck-from`. Step 0 shows the slide before its first click.
 * Each time a slide's step changes the deck dispatches `deck:step` on the
 * slide (it bubbles; `detail` is `DeckStep`), and a component follows its own
 * clicks with `onDeckStep`. Its parts that a click lights declare it in
 * `data-deck-lit` and are lit by `lightDeckParts`, so a still copy of the
 * slide at another step (the presenter view's next click) is lit as that step
 * shows it. The reading view shows every slide at its last step; so do the
 * slides around the one being presented.
 *
 * Presenting shows one slide at a time over the whole viewport (the page goes
 * full screen when the browser grants it, so the page's own overlays, such as
 * the editor's toolbars, stay above the slide): → ↓ PageDown Space go one
 * click forward, ← ↑ PageUp one back (to the previous slide's last step), Home
 * and End jump, O shows every slide as a grid (a section slide opens each
 * row) to pick one from, F switches full screen on and off, Esc leaves; a
 * horizontal swipe turns the page on touch screens. Keys typed into an
 * editor, and keys the page has already handled, are left alone. Leaving full
 * screen leaves the show, unless a presenter view this window opened is open.
 * Changes of slide and step run as view transitions: a heading or an image a
 * slide shares with the one before keeps its place and morphs, everything
 * else crossfades. A presented slide shows its content and nothing else: the
 * controls sit in the band under the slide when it holds them, and otherwise
 * leave, with the progress line, an editor's handle and the page's floating
 * tools, once the pointer has rested for `IDLE_MS`; markers and notes are not
 * drawn on it (a marker's chip shows while the pointer is on it or on the
 * block it shapes, or while a block of the slide is being edited).
 *
 * The presenter view. P opens the same page in a second window with
 * `?presenter` (`PRESENTER_PARAM`) in its address, and that window presents
 * the deck as the presenter sees it: the slide, a still copy of what the next
 * click shows, the slide's speaker notes and a clock (time since the view
 * opened, and the time of day). Every window presenting the deck follows
 * every other: a window that changes slide or step on its own announces the
 * place on a `BroadcastChannel` named `deck:<path>`, and the others go there
 * without announcing it again. A slide's notes are a hidden
 * `[data-deck-marker="notes"]` block (lib/remark-deck-notes.ts).
 *
 * The location hash is the place: `#/<slide>` in the reading view (the slide
 * in view), `#/<slide>.<step>` while presenting (`.0` left out). A link opens
 * at its slide; a reload comes back presenting the same slide at the same
 * step. A page holds one deck.
 *
 * Time. Each slide is planned a time (`plannedSeconds`: its `<Time>`
 * marker's, or its words at a speaking pace); the bar beside "Present" gives
 * the deck's sum, and the presenter view the time on the slide against its
 * plan and how far the talk is ahead of or behind the plan up to there.
 *
 * Print. A printed deck has one 10 × 5.625 in page for every step: before
 * each slide's own page (its last step), a still copy of each earlier step.
 * "Print or PDF" opens the browser's print dialog, which saves a PDF.
 *
 * A docked panel. A panel docked at the window's right edge (an editor's)
 * declares its width as `--deck-inset-inline-end` on the root element; the
 * deck fits beside it, presented or in the reading view, its bar and its
 * slides in view.
 *
 * Saved edits. An editing host that re-renders the page after a save
 * (astro-inkbrush offers the fresh page as the cancelable `inkbrush:content`
 * event, its `detail.doc` a Document) has the deck take it in place: every
 * window showing the deck swaps the slides whose content changed, keeps the
 * others and its place, and goes on presenting. The deck mounts before the
 * components inside it (its script comes first in the component), so the
 * content it compares is the content as served.
 */

import type { ComponentWords } from './component-words.ts';

/** the canvas every slide is laid out on, in CSS pixels: 10 × 5.625 inches, a 16:9 print page */
export const CANVAS_W = 960;
export const CANVAS_H = 540;
/** below this shown width, in CSS pixels, a slide is laid out unscaled at its own width */
export const NARROW = 600;
/** the least height, in canvas pixels, a stretched block is given when the slide has no room left */
const STRETCH_MIN = 80;
/** the search parameter that opens a page as the presenter view of its deck */
export const PRESENTER_PARAM = 'presenter';
/** how long, in milliseconds, the pointer rests before the controls and the page's floating tools leave a presented slide */
const IDLE_MS = 2500;
/** the least space, in CSS pixels, between the controls and the slide or the window's edge when they sit in the band under a slide */
const BAND_MARGIN = 4;
/** the space, in CSS pixels, between a deck in the reading view and a panel docked at the window's right edge */
const PANEL_GAP = 16;
/** the speaking pace a slide that names no time is planned at: words per minute of a measured talk */
const SPOKEN_WORDS_PER_MIN = 140;
/** the same pace in Chinese and Japanese characters per minute */
const SPOKEN_CJK_PER_MIN = 250;
/** the least time, in seconds, a slide is planned for: showing it and saying its title */
const SLIDE_MIN_S = 15;
/** how far, in seconds, the talk may be from its plan and still read as keeping to it */
const ON_PLAN_S = 15;

/** the layouts a slide can name with `<Layout name="…" />` */
export const SLIDE_LAYOUTS = [
  'cover',
  'section',
  'center',
  'default',
  'full',
  'image',
  'image-left',
  'image-right',
  'two-cols',
  'quote',
  'fact',
  'statement',
  'end',
] as const;
export type SlideLayout = (typeof SLIDE_LAYOUTS)[number];

/** the words the deck's script prints: the component's words but the deck's own label (lib/component-words.ts) */
export type DeckWords = Omit<ComponentWords['deck'], 'deck'>;

/** `detail` of the `deck:step` event */
export interface DeckStep {
  /** the slide's number, from 1 */
  slide: number;
  /** the step it shows: 0 before its first click, `steps` after its last */
  step: number;
  /** the slide's clicks */
  steps: number;
  /** whether the deck is presenting this slide (false: it is shown complete) */
  presenting: boolean;
}

/** a place in a deck: slide index from 0 and step */
export interface DeckPlace {
  slide: number;
  step: number;
}

/** the place a location hash names (`#/3`, `#/3.2`), or null when it names none */
export function parsePlace(hash: string): DeckPlace | null {
  const m = /^#\/(\d+)(?:\.(\d+))?$/.exec(hash);
  if (!m || Number(m[1]) < 1) return null;
  return { slide: Number(m[1]) - 1, step: Number(m[2] ?? 0) };
}

/** the location hash of a place */
export function formatPlace({ slide, step }: DeckPlace): string {
  return `#/${slide + 1}${step > 0 ? `.${step}` : ''}`;
}

/**
 * Follow the clicks of an element that declared `data-deck-steps="N"`: `show`
 * is called at once and at every step of its slide with how many of its N
 * clicks are done (0 … N), and whether its slide is the one being presented.
 * Outside a deck, and wherever its slide is shown complete, that is N.
 * Returns the function that stops following.
 */
export function onDeckStep(el: HTMLElement, show: (done: number, presented: boolean) => void): () => void {
  const done = () => clicksDone(el, el.closest<HTMLElement>('.slide')?.dataset['step']);
  const presented = () => el.closest('.deck.is-presenting:not(.is-overview) .slide.is-current') !== null;
  const listener = (e: Event) => {
    if (e.target instanceof Element && e.target.contains(el)) show(done(), presented());
  };
  document.addEventListener('deck:step', listener);
  show(done(), presented());
  return () => document.removeEventListener('deck:step', listener);
}

/** how many of the clicks `el` declared (`data-deck-steps`) are done when its slide shows `step`; all of them outside a deck */
function clicksDone(el: HTMLElement, step: string | number | undefined): number {
  const total = Number(el.dataset['deckSteps'] ?? 0);
  const from = Number(el.dataset['deckFrom']);
  if (step === undefined || Number.isNaN(from)) return total;
  return Math.min(Math.max(Number(step) - from + 1, 0), total);
}

/**
 * Light the parts of an element that follows clicks: a part declaring
 * `data-deck-lit="k"` (lit by the element's k-th click; 0, lit from the
 * element's appearance) is unlit (`is-unlit`) while fewer than k clicks are
 * done, and, while `presented`, marked as lit by the click just made
 * (`is-lit-now`) when k is the last one done.
 */
export function lightDeckParts(el: Element, done: number, presented: boolean): void {
  for (const part of el.querySelectorAll<HTMLElement | SVGElement>('[data-deck-lit]')) {
    const at = Number(part.dataset['deckLit']);
    part.classList.toggle('is-unlit', at > done);
    part.classList.toggle('is-lit-now', presented && at > 0 && at === done);
  }
}

/** a top-level block of a slide and the nodes that travel with it: its edit anchors and the whitespace before it */
interface Unit {
  el: Element;
  nodes: Node[];
}

const markerOf = (el: Element): string | undefined => (el as HTMLElement).dataset?.['deckMarker'];
/** a block a reader sees: not a marker, an edit anchor, the break that ended the slide before, or the corner */
const isShown = (el: Element): boolean =>
  el.tagName !== 'TEMPLATE' && el.tagName !== 'HR' && markerOf(el) === undefined && !el.classList.contains('slide-corner');

/** split a canvas's nodes into blocks, each carrying the anchors and whitespace before it */
function unitsOf(canvas: Element): Unit[] {
  const units: Unit[] = [];
  let pending: Node[] = [];
  for (const node of [...canvas.childNodes]) {
    pending.push(node);
    if (node instanceof Element && node.tagName !== 'TEMPLATE') {
      units.push({ el: node, nodes: pending });
      pending = [];
    }
  }
  if (pending.length) units.at(-1)?.nodes.push(...pending);
  return units;
}

/** group the content's top-level nodes into slides at every thematic break */
function groupSlides(host: HTMLElement): HTMLElement[] {
  const nodes = [...host.childNodes];
  const slides: HTMLElement[] = [];
  let canvas = document.createElement('div');
  const close = () => {
    if (![...canvas.children].some(isShown) && slides.length > 0) {
      // a break right after a break, or trailing anchors: they belong to the slide before
      slides.at(-1)!.querySelector('.slide-canvas')!.append(...canvas.childNodes);
      return;
    }
    const slide = document.createElement('section');
    slide.className = 'slide';
    canvas.className = 'slide-canvas';
    canvas.dataset['deckCanvas'] = `${CANVAS_W}x${CANVAS_H}`;
    slide.append(canvas);
    slides.push(slide);
  };
  for (const node of nodes) {
    if (node instanceof HTMLHRElement) {
      close();
      canvas = document.createElement('div');
    }
    canvas.append(node);
  }
  close();
  host.replaceChildren(...slides);
  return slides;
}

/** the dataset key of an editing host's source stamp on a block (astro-inkbrush: the block's source lines) */
const EDIT_STAMP = 'wikiSrc';

/**
 * A slide's content as the page serves it, read before the deck or anything
 * inside the slide has touched it: what tells the slides a re-rendered page
 * changed. Edit stamps (`EDIT_STAMP`, source line numbers that every edit
 * above shifts) and island ids (new at every render) are left out.
 */
function servedContent(slide: HTMLElement): string {
  const canvas = slide.querySelector('.slide-canvas')!.cloneNode(true) as HTMLElement;
  for (const el of editStamped(canvas)) delete el.dataset[EDIT_STAMP];
  for (const island of canvas.querySelectorAll('astro-island')) island.removeAttribute('uid');
  return canvas.innerHTML;
}

/** the elements under `root` carrying an edit stamp, in document order */
function editStamped(root: Element): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('*')].filter((el) => el.dataset?.[EDIT_STAMP] !== undefined);
}

/** one heading and at most one paragraph of words */
function isSectionShaped(shown: Element[]): boolean {
  const [first, second, ...rest] = shown;
  return (
    rest.length === 0 &&
    /^H[12]$/.test(first?.tagName ?? '') &&
    (second === undefined || (second.tagName === 'P' && !isMedia(second)))
  );
}

/** an image, a video, a figure, a diagram or a demo: what an image layout puts on its side */
function isMedia(el: Element): boolean {
  if (/^(FIGURE|IMG|PICTURE|VIDEO|IFRAME|CANVAS|SVG)$/i.test(el.tagName)) return true;
  if (el.matches('.demo, .flow')) return true;
  if (el.tagName !== 'P') return false;
  const only = el.children.length === 1 ? el.children[0]! : null;
  const media = only?.matches('img, picture, video, a:has(> img:only-child)') ?? false;
  return media && (el.textContent ?? '').trim() === (only?.textContent ?? '').trim();
}

/** a heading's words without the section number the page pipeline prints into it */
function headingText(heading: Element): string {
  const copy = heading.cloneNode(true) as Element;
  for (const num of copy.querySelectorAll('.num')) num.remove();
  return (copy.textContent ?? '').trim();
}

const wrap = (className: string, units: Unit[]): HTMLElement => {
  const region = document.createElement('div');
  region.className = className;
  for (const u of units) region.append(...u.nodes);
  return region;
};

/**
 * Lay one slide out from its markers: name its layout, gather its columns or
 * its media into regions, count its clicks. Returns the slide's layout and
 * its clicks.
 */
function planSlide(slide: HTMLElement): { layout: SlideLayout; steps: number } {
  const canvas = slide.querySelector<HTMLElement>('.slide-canvas')!;
  const units = unitsOf(canvas);
  const shown = units.filter((u) => isShown(u.el));
  const named = units.find((u) => markerOf(u.el) === 'layout')?.el as HTMLElement | undefined;
  const layout = (named?.dataset['layout'] as SlideLayout | undefined) ?? (isSectionShaped(shown.map((u) => u.el)) ? 'section' : 'default');
  slide.dataset['layout'] = layout;

  // clicks, in document order
  let steps = 0;
  let building = false;
  let stretchNext = false;
  for (const u of units) {
    const marker = markerOf(u.el);
    if (marker === 'build') building = true;
    if (marker === 'stretch') stretchNext = true;
    if (!isShown(u.el)) continue;
    if (stretchNext) u.el.classList.add('deck-stretch');
    stretchNext = false;
    if (building) {
      const items = /^(UL|OL)$/.test(u.el.tagName) ? [...u.el.children] : [u.el];
      for (const item of items) (item as HTMLElement).dataset['deckAt'] = String((steps += 1));
    }
    const declared = [u.el, ...u.el.querySelectorAll('[data-deck-steps]')].filter((el): el is HTMLElement => el instanceof HTMLElement && 'deckSteps' in el.dataset);
    for (const el of declared) {
      el.dataset['deckFrom'] = String(steps + 1);
      steps += Number(el.dataset['deckSteps']) || 0;
    }
  }
  slide.dataset['steps'] = String(steps);

  // regions: the media of an image layout, else the columns
  const content = units.filter((u) => isShown(u.el) || markerOf(u.el) === 'column' || markerOf(u.el) === 'build' || markerOf(u.el) === 'stretch');
  const anchored = units.filter((u) => !content.includes(u));
  if (layout === 'image' || layout === 'image-left' || layout === 'image-right') {
    const media = shown.find((u) => isMedia(u.el));
    if (media) {
      canvas.append(...anchored.flatMap((u) => u.nodes), wrap('slide-body', content.filter((u) => u !== media)), wrap('slide-media', [media]));
    }
  } else if (content.some((u) => markerOf(u.el) === 'column')) {
    const lead = /^H[1-3]$/.test(content[0]!.el.tagName) ? [content[0]!] : [];
    const columns: Unit[][] = [[]];
    for (const u of content.slice(lead.length)) {
      if (markerOf(u.el) === 'column') columns.push([]);
      columns.at(-1)!.push(u);
    }
    const cols = document.createElement('div');
    cols.className = 'slide-cols';
    cols.style.setProperty('--deck-cols', String(columns.length));
    cols.append(...columns.map((c) => wrap('slide-col', c)));
    canvas.append(...anchored.flatMap((u) => u.nodes), ...lead.flatMap((u) => u.nodes), cols);
  }
  return { layout, steps };
}

/** a still copy of a slide shown at a step, as presenting shows it: no ids and no view-transition names of its own, its later blocks hidden, its stepping parts lit as of that step */
function slideCopy(slide: HTMLElement, at: number): HTMLElement {
  const copy = slide.cloneNode(true) as HTMLElement;
  copy.classList.remove('is-current');
  copy.classList.add('slide-copy');
  for (const attribute of ['role', 'aria-roledescription', 'aria-label']) copy.removeAttribute(attribute);
  for (const el of [copy, ...copy.querySelectorAll<HTMLElement>('*')]) {
    el.removeAttribute('id');
    el.style?.removeProperty('view-transition-name');
  }
  for (const el of copy.querySelectorAll<HTMLElement>('[data-deck-at]')) el.classList.toggle('deck-later', Number(el.dataset['deckAt']) > at);
  for (const el of copy.querySelectorAll<HTMLElement>('[data-deck-steps]')) lightDeckParts(el, clicksDone(el, at), true);
  return copy;
}

const CJK = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/g;

/**
 * The time, in seconds, a slide is planned to take: its `<Time minutes>`
 * marker's, else its words spoken at `SPOKEN_WORDS_PER_MIN` (Chinese and
 * Japanese characters at `SPOKEN_CJK_PER_MIN`): its speaker notes when it
 * has them, else the words it shows. At least `SLIDE_MIN_S`.
 */
function plannedSeconds(slide: HTMLElement): number {
  const named = slide.querySelector<HTMLElement>('[data-deck-marker="time"]');
  if (named) return Number(named.dataset['minutes']) * 60;
  const notes = slide.querySelector('.deck-notes');
  let text: string;
  if (notes) text = notes.textContent ?? '';
  else {
    const canvas = slide.querySelector('.slide-canvas')!.cloneNode(true) as HTMLElement;
    for (const el of canvas.querySelectorAll('[data-deck-marker], .slide-corner, template')) el.remove();
    text = canvas.textContent ?? '';
  }
  const characters = text.match(CJK)?.length ?? 0;
  const words = text.replace(CJK, ' ').split(/\s+/).filter((w) => /\p{L}|\p{N}/u.test(w)).length;
  return Math.max(SLIDE_MIN_S, (words / SPOKEN_WORDS_PER_MIN + characters / SPOKEN_CJK_PER_MIN) * 60);
}

/** elapsed time as m:ss, or h:mm:ss from an hour on */
function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** switch the page's full screen on or off */
function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else if (document.fullscreenEnabled) void document.documentElement.requestFullscreen().catch(() => undefined);
}

/** an event aimed at something the reader is typing into */
function isTyping(e: Event): boolean {
  const t = e.target;
  return t instanceof HTMLElement && (t.isContentEditable || !!t.closest('input, textarea, select, .cm-editor'));
}

/** the page was reloaded (not reached by a link, the history or a new tab) */
function isReload(): boolean {
  const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  return entry?.type === 'reload';
}

/** what a slide shares with another that should keep its place across the change: headings by their words, images by their source, anything by `data-morph` */
function morphKey(el: Element): string | null {
  const morph = (el as HTMLElement).dataset?.['morph'];
  if (morph) return `m:${morph}`;
  if (/^H[1-3]$/.test(el.tagName)) return `h:${headingText(el)}`;
  if (el.tagName === 'IMG') return `i:${(el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src}`;
  return null;
}
const morphables = (slide: Element): Map<string, HTMLElement> => {
  const out = new Map<string, HTMLElement>();
  for (const el of slide.querySelectorAll<HTMLElement>('[data-morph], h1, h2, h3, img')) {
    const key = morphKey(el);
    if (key && !out.has(key)) out.set(key, el);
  }
  return out;
};

/**
 * Run a change of what the deck shows as a view transition: what the slide
 * before and the slide after share (`morphKey`) is named alike, so it keeps its
 * place and morphs; a slide shown before and after (the overview opening and
 * closing) morphs as a whole; the rest crossfades. Without view transitions,
 * or when the reader asks for reduced motion, the change happens at once.
 */
function transition(from: HTMLElement | null, to: HTMLElement | null, change: () => void): void {
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    change();
    return;
  }
  const pairs: Array<[HTMLElement, HTMLElement]> = [];
  if (from && from === to) pairs.push([from, to]);
  else if (from && to) {
    const after = morphables(to);
    for (const [key, old] of morphables(from)) {
      const el = after.get(key);
      if (el) pairs.push([old, el]);
    }
  }
  // the outgoing elements are named before the old state is captured, the incoming ones once the change is made
  pairs.forEach(([old], i) => (old.style.viewTransitionName = `deck-morph-${i}`));
  const run = document.startViewTransition(() => {
    pairs.forEach(([old, el], i) => {
      old.style.viewTransitionName = '';
      el.style.viewTransitionName = `deck-morph-${i}`;
    });
    change();
  });
  void run.finished.finally(() => pairs.forEach(([, el]) => (el.style.viewTransitionName = '')));
}

interface Deck {
  root: HTMLElement;
  fit(): void;
  setPrinting(printing: boolean): void;
  isPresenting(): boolean;
  /** a presenter view this window opened is open */
  hasPresenterView(): boolean;
  forward(): void;
  back(): void;
  jump(to: 'first' | 'last'): void;
  goTo(place: DeckPlace): void;
  toggleOverview(): void;
  openPresenterView(): void;
  leave(): void;
}

/** the decks on the page now; one listener per document event serves them all */
const decks = new Set<Deck>();
const live = (): Deck[] => [...decks].filter((d) => d.root.isConnected || (decks.delete(d), false));
const presenting = (): Deck | undefined => live().find((d) => d.isPresenting());

let listening = false;
function listenOnce(): void {
  if (listening) return;
  listening = true;
  // on window, so it runs after handlers on the document (an editor's keys) and sees what they took
  addEventListener('keydown', (e) => {
    const deck = presenting();
    if (!deck || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTyping(e)) return;
    const key = e.key;
    if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown' || key === ' ') deck.forward();
    else if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp') deck.back();
    else if (key === 'Home') deck.jump('first');
    else if (key === 'End') deck.jump('last');
    else if (key === 'o' || key === 'O') deck.toggleOverview();
    else if (key === 'p' || key === 'P') deck.openPresenterView();
    else if (key === 'f' || key === 'F') toggleFullscreen();
    else if (key === 'Escape') deck.leave();
    else return;
    e.preventDefault();
  });
  // a link to a place (`#/3`, a slide's corner) followed while presenting goes there
  addEventListener('hashchange', () => {
    const place = parsePlace(location.hash);
    if (place) presenting()?.goTo(place);
  });
  document.addEventListener('fullscreenchange', () => {
    const deck = presenting();
    if (!document.fullscreenElement && deck && !deck.hasPresenterView()) deck.leave();
  });
  // a panel docked at the window's right edge declares its width on the root element (`--deck-inset-inline-end`)
  new MutationObserver(() => live().forEach((d) => d.fit())).observe(document.documentElement, { attributeFilter: ['style'] });
  addEventListener('beforeprint', () => live().forEach((d) => d.setPrinting(true)));
  addEventListener('afterprint', () => live().forEach((d) => d.setPrinting(false)));
}

export function mountDeck(root: HTMLElement): void {
  root.dataset['deckMounted'] = '';
  const host = root.querySelector<HTMLElement>('[data-deck-slides]')!;
  const words = JSON.parse(root.dataset['words'] ?? '{}') as DeckWords;
  const slides = groupSlides(host);
  const total = slides.length;
  const position = (n: number) => words.position.replace('{n}', String(n)).replace('{total}', String(total));
  /** each slide's content as served, and its edit stamps in served order (`takeRendering`) */
  const served = slides.map(servedContent);
  const stamps = slides.map(editStamped);
  const clicks = slides.map((slide) => planSlide(slide).steps);
  /** each slide's planned time, in seconds (`plannedSeconds`) */
  const planned = slides.map(plannedSeconds);
  const plannedLabel = root.querySelector<HTMLElement>('[data-deck-planned]')!;
  const writePlan = () => {
    const minutes = Math.max(1, Math.round(planned.reduce((a, b) => a + b, 0) / 60));
    plannedLabel.textContent = words.planned.replace('{minutes}', String(minutes));
  };
  writePlan();

  /** number and label every slide, and give each its corner: its number, and the part it belongs to */
  const dress = () => {
    let part = '';
    slides.forEach((slide, i) => {
      const canvas = slide.querySelector('.slide-canvas')!;
      const n = i + 1;
      const layout = slide.dataset['layout'];
      slide.id = `/${n}`;
      slide.dataset['deckSlide'] = String(n);
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', words.slide);
      slide.setAttribute('aria-label', position(n));
      canvas.querySelector(':scope > .slide-corner')?.remove();
      if (layout === 'section') {
        const heading = canvas.querySelector('h1, h2');
        part = heading ? headingText(heading) : '';
      }
      if (layout === 'cover' || layout === 'end') return;
      const corner = document.createElement('a');
      corner.className = 'slide-corner';
      corner.href = `#/${n}`;
      if (part && layout !== 'section') {
        const name = document.createElement('span');
        name.className = 'slide-part';
        name.textContent = part;
        corner.append(name);
      }
      const num = document.createElement('span');
      num.className = 'slide-num';
      num.textContent = String(n);
      corner.append(num);
      // first in the canvas (it is placed absolutely): an edit anchor at the slide's end binds to the next block, never to it
      canvas.prepend(corner);
    });
  };
  dress();

  const label = root.querySelector<HTMLElement>('[data-deck-position]')!;
  const progress = root.querySelector<HTMLElement>('[data-deck-progress]')!;
  const nextView = root.querySelector<HTMLElement>('[data-deck-next-view]')!;
  const notesView = root.querySelector<HTMLElement>('[data-deck-notes]')!;
  const controls = root.querySelector<HTMLElement>('.deck-controls')!;
  /** this window is the presenter view of the deck */
  let presenterView = new URLSearchParams(location.search).has(PRESENTER_PARAM);

  // ---- scale ------------------------------------------------------------
  let showing = false;
  let overview = false;
  let printing = false;
  const fit = () => {
    // in the reading view the deck, its bar and its slides, ends where a panel docked at the window's right edge begins
    root.style.removeProperty('margin-inline-end');
    if (!showing && !printing) {
      const inset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--deck-inset-inline-end')) || 0;
      const over = inset > 0 ? root.getBoundingClientRect().right - (innerWidth - inset) + PANEL_GAP : 0;
      if (over > 0) root.style.marginInlineEnd = `${over}px`;
    }
    // presenting, the slide fits the viewport; in the presenter view, the room the panel leaves it
    const stage = presenterView ? host : root;
    const shown = printing
      ? CANVAS_W
      : showing
        ? Math.min(stage.clientWidth, (stage.clientHeight * CANVAS_W) / CANVAS_H)
        : slides[0]!.clientWidth;
    const narrow = !showing && !printing && shown < NARROW;
    root.classList.toggle('is-narrow', narrow);
    root.style.setProperty('--deck-k', String(narrow ? 1 : shown / CANVAS_W));
    // the overview fits about five slides across, at most a third of the canvas each
    const across = Math.max(2, Math.min(5, Math.floor(root.clientWidth / 260)));
    host.style.setProperty('--deck-thumb-k', String(Math.min(1 / 3, (root.clientWidth - 48 - (across - 1) * 20) / across / CANVAS_W)));
    nextView.style.setProperty('--deck-k', String(nextView.clientWidth / CANVAS_W));
    // the controls sit in the middle of the band under a presented slide when the band holds them with
    // BAND_MARGIN above and below, and rest over the slide otherwise
    const band = (root.clientHeight - (shown * CANVAS_H) / CANVAS_W) / 2;
    const roomBelow = showing && !presenterView && band >= controls.offsetHeight + 2 * BAND_MARGIN;
    root.classList.toggle('has-room-below', roomBelow);
    root.style.setProperty('--deck-band-bottom', `${roomBelow ? (band - controls.offsetHeight) / 2 : 0}px`);
    for (const slide of slides) stretch(slide);
  };
  /** grow a slide's `<Stretch />`ed block to the height the canvas has left below its content */
  const stretch = (slide: HTMLElement) => {
    const el = slide.querySelector<HTMLElement>('.deck-stretch');
    const canvas = slide.querySelector<HTMLElement>('.slide-canvas')!;
    if (!el) return;
    if (root.classList.contains('is-narrow')) {
      el.style.height = '';
      return;
    }
    const box = canvas.getBoundingClientRect();
    const k = canvas.offsetWidth > 0 ? box.width / canvas.offsetWidth : 1;
    if (k === 0) return;
    const limit = CANVAS_H - Number.parseFloat(getComputedStyle(canvas).paddingBottom);
    const bottom = Math.max(
      ...[...canvas.children]
        .filter((c) => getComputedStyle(c).position !== 'absolute' && (c as HTMLElement).offsetParent !== null)
        .map((c) => (c.getBoundingClientRect().bottom - box.top) / k + Number.parseFloat(getComputedStyle(c).marginBottom)),
    );
    const height = el.getBoundingClientRect().height / k;
    const want = Math.max(STRETCH_MIN, height + limit - bottom);
    if (Math.abs(want - height) > 1) el.style.height = `${want}px`;
  };
  const heights = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const canvas = entry.target as HTMLElement;
      const slide = canvas.parentElement!;
      slide.style.setProperty('--deck-h', `${Math.max(CANVAS_H, canvas.offsetHeight)}px`);
      stretch(slide);
    }
  });
  for (const slide of slides) heights.observe(slide.querySelector('.slide-canvas')!);
  new ResizeObserver(fit).observe(root);

  // ---- which slide, which step -------------------------------------------
  const storeKey = `deck:${location.pathname}`;
  /** the windows presenting this deck tell each other the place */
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(storeKey) : null;
  let current = 0;
  let step = 0;
  /** show a slide at a step: later blocks hidden while presenting, the slide's components told */
  const setStep = (i: number, at: number) => {
    const slide = slides[i]!;
    const presented = showing && i === current;
    slide.dataset['step'] = String(at);
    for (const el of slide.querySelectorAll<HTMLElement>('[data-deck-at]')) el.classList.toggle('deck-later', presented && Number(el.dataset['deckAt']) > at);
    const detail: DeckStep = { slide: i + 1, step: at, steps: clicks[i]!, presenting: presented };
    slide.dispatchEvent(new CustomEvent('deck:step', { bubbles: true, detail }));
  };
  const writePlace = (place: DeckPlace | null) => {
    const hash = place ? formatPlace(place) : '';
    if (hash === location.hash || (!place && !parsePlace(location.hash))) return;
    history.replaceState(history.state, '', hash || location.pathname + location.search);
  };
  /** the presenter view's panel: the next click's look and the slide's notes */
  const showPanel = () => {
    const notes = slides[current]!.querySelector('.deck-notes');
    const emptyLine = (text: string) => Object.assign(document.createElement('p'), { className: 'deck-presenter-empty', textContent: text });
    notesView.replaceChildren(...(notes ? [...notes.cloneNode(true).childNodes] : [emptyLine(words.noNotes)]));
    const next = step < clicks[current]! ? { slide: current, step: step + 1 } : current < total - 1 ? { slide: current + 1, step: 0 } : null;
    nextView.replaceChildren(next ? slideCopy(slides[next.slide]!, next.step) : emptyLine(words.end));
  };
  /** present slide `i` at step `at`; `announce`: tell the other windows presenting the deck */
  const show = (i: number, at: number, announce: boolean) => {
    const was = current;
    current = Math.min(Math.max(i, 0), total - 1);
    step = Math.min(Math.max(at, 0), clicks[current]!);
    if (was !== current) {
      setStep(was, clicks[was]!);
      enteredAt = Date.now();
    }
    slides.forEach((s, j) => s.classList.toggle('is-current', j === current));
    setStep(current, step);
    label.textContent = position(current + 1);
    progress.style.setProperty('--deck-progress', String((current + 1) / total));
    writePlace({ slide: current, step });
    if (presenterView) showPanel();
    if (announce) channel?.postMessage({ slide: current, step } satisfies DeckPlace);
  };
  const go = (i: number, at: number, announce = true) => {
    const target = Math.min(Math.max(i, 0), total - 1);
    if (target === current && at === step) return;
    transition(slides[current]!, slides[target]!, () => show(target, at, announce));
  };
  const forward = () => (step < clicks[current]! ? go(current, step + 1) : current < total - 1 && go(current + 1, 0));
  const back = () => (step > 0 ? go(current, step - 1) : current > 0 && go(current - 1, clicks[current - 1]!));

  /** the slide the reader is looking at in the reading view: the first whose bottom is below a third of the viewport */
  const inView = () => {
    const line = innerHeight / 3;
    const i = slides.findIndex((s) => s.getBoundingClientRect().bottom > line);
    return i < 0 ? total - 1 : i;
  };
  // the reading view writes the slide crossing a third of the viewport into the location
  const reading = new IntersectionObserver(
    (entries) => {
      if (showing) return;
      for (const entry of entries) if (entry.isIntersecting) writePlace({ slide: slides.indexOf(entry.target as HTMLElement), step: 0 });
      if (!slides.some((s) => { const r = s.getBoundingClientRect(); return r.top < innerHeight / 3 && r.bottom > innerHeight / 3; })) writePlace(null);
    },
    { rootMargin: '-33% 0px -67% 0px' },
  );

  const setOverview = (on: boolean) => {
    if (overview === on) return;
    transition(slides[current]!, slides[current]!, () => {
      overview = on;
      root.classList.toggle('is-overview', on);
      if (on) slides[current]!.scrollIntoView({ block: 'center' });
    });
  };

  // ---- the pointer at rest -------------------------------------------------
  // while a slide is presented, a pointer that rests for IDLE_MS marks the page idle (html.deck-idle):
  // the controls, the progress line, an editor's handle and the page's floating tools leave the slide; moving it brings them back
  let idleTimer = 0;
  const wake = () => {
    document.documentElement.classList.remove('deck-idle');
    clearTimeout(idleTimer);
    if (showing) idleTimer = window.setTimeout(() => document.documentElement.classList.add('deck-idle'), IDLE_MS);
  };
  addEventListener('pointermove', () => {
    if (showing) wake();
  });

  const enter = (place: DeckPlace, fullscreen: boolean) => {
    showing = true;
    reading.disconnect();
    root.classList.add('is-presenting');
    document.documentElement.classList.add('deck-presenting');
    sessionStorage.setItem(storeKey, '1');
    show(place.slide, place.step, true);
    fit();
    wake();
    if (fullscreen && document.fullscreenEnabled) void document.documentElement.requestFullscreen().catch(() => undefined);
  };
  const leave = () => {
    if (!showing) return;
    if (overview) {
      setOverview(false);
      return;
    }
    if (presenterView) {
      // the presenter view closes; a window that was not opened as one stays, as an ordinary page
      window.close();
      presenterView = false;
      root.classList.remove('is-presenter');
      clearInterval(clock);
    }
    showing = false;
    root.classList.remove('is-presenting');
    document.documentElement.classList.remove('deck-presenting');
    wake();
    sessionStorage.removeItem(storeKey);
    if (document.fullscreenElement) void document.exitFullscreen();
    setStep(current, clicks[current]!);
    fit();
    slides[current]!.scrollIntoView({ block: 'start' });
    writePlace({ slide: current, step: 0 });
    for (const slide of slides) reading.observe(slide);
  };

  /** go to a place; from the overview, the slide grows back into the show */
  const goTo = (place: DeckPlace, announce = true) => {
    if (!overview) return go(place.slide, place.step, announce);
    const i = Math.min(Math.max(place.slide, 0), total - 1);
    transition(slides[i]!, slides[i]!, () => {
      overview = false;
      root.classList.remove('is-overview');
      show(i, place.step, announce);
    });
  };
  channel?.addEventListener('message', (e: MessageEvent<DeckPlace>) => {
    if (showing) goTo(e.data, false);
  });

  // ---- the presenter view ------------------------------------------------
  let presenterWindow: Window | null = null;
  const openPresenterView = () => {
    if (presenterView) return;
    const url = new URL(location.href);
    url.searchParams.set(PRESENTER_PARAM, '');
    url.hash = formatPlace({ slide: current, step });
    presenterWindow = window.open(url, `deck-presenter:${location.pathname}`, 'popup,width=1280,height=800');
  };
  const clockKey = `deck-clock:${location.pathname}`;
  let clockStart = Number(sessionStorage.getItem(clockKey)) || Date.now();
  let clock = 0;
  /** when the current slide was shown, in ms since the epoch */
  let enteredAt = Date.now();
  const pace = root.querySelector<HTMLElement>('[data-deck-pace]')!;
  const tick = () => {
    const now = Date.now();
    root.querySelector('[data-deck-elapsed]')!.textContent = formatElapsed(now - clockStart);
    root.querySelector('[data-deck-time]')!.textContent = new Date().toLocaleTimeString(document.documentElement.lang || undefined, { hour: '2-digit', minute: '2-digit' });
    // how late the talk is: the time spent against the plan of the slides before this one and as much of this one's as has passed
    const onSlide = now - enteredAt;
    const plan = planned[current]! * 1000;
    const late = now - clockStart - planned.slice(0, current).reduce((a, b) => a + b, 0) * 1000 - Math.min(onSlide, plan);
    const slideLine = Object.assign(document.createElement('span'), {
      className: onSlide > plan ? 'is-over' : '',
      textContent: words.slideTime.replace('{elapsed}', formatElapsed(onSlide)).replace('{planned}', formatElapsed(plan)),
    });
    const paceLine = Object.assign(document.createElement('span'), {
      className: late > ON_PLAN_S * 1000 ? 'is-over' : '',
      textContent: Math.abs(late) <= ON_PLAN_S * 1000 ? words.onPlan : (late > 0 ? words.behind : words.ahead).replace('{t}', formatElapsed(Math.abs(late))),
    });
    pace.replaceChildren(slideLine, paceLine);
  };
  root.querySelector('[data-deck-clock-restart]')?.addEventListener('click', () => {
    clockStart = Date.now();
    sessionStorage.setItem(clockKey, String(clockStart));
    tick();
  });

  root.querySelector('[data-deck-present]')?.addEventListener('click', () => enter({ slide: inView(), step: 0 }, true));
  root.querySelector('[data-deck-export]')?.addEventListener('click', () => print());
  root.querySelector('[data-deck-prev]')?.addEventListener('click', back);
  root.querySelector('[data-deck-next]')?.addEventListener('click', forward);
  root.querySelector('[data-deck-overview]')?.addEventListener('click', () => setOverview(!overview));
  root.querySelector('[data-deck-presenter-open]')?.addEventListener('click', openPresenterView);
  root.querySelector('[data-deck-exit]')?.addEventListener('click', () => {
    setOverview(false);
    leave();
  });
  // in the overview a click on a slide presents it
  host.addEventListener('click', (e) => {
    if (!overview) return;
    const slide = (e.target as Element).closest<HTMLElement>('.slide');
    if (!slide) return;
    e.preventDefault();
    goTo({ slide: slides.indexOf(slide), step: 0 });
  });

  let touch: { x: number; y: number } | null = null;
  root.addEventListener('pointerdown', (e) => {
    if (showing && !overview && e.pointerType === 'touch') touch = { x: e.clientX, y: e.clientY };
  });
  root.addEventListener('pointercancel', () => {
    touch = null;
  });
  root.addEventListener('pointerup', (e) => {
    if (!touch) return;
    const dx = e.clientX - touch.x;
    const dy = e.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) (dx < 0 ? forward : back)();
  });

  /**
   * Take a re-rendering of the page (`detail.doc`, the page as the server now
   * renders it) in place: each slide whose content changed is swapped for its
   * new rendering, laid out and mounted anew; the others keep their nodes and
   * take the new edit stamps. Returns false, leaving the page as it is, when
   * the slides were added or removed or the page around the deck changed
   * (its title, its frontmatter's rendering).
   */
  const takeRendering = (doc: Document): boolean => {
    const freshHost = doc.querySelector<HTMLElement>('[data-deck] [data-deck-slides]');
    const head = (d: Document) => `${d.title}\n${d.querySelector('[data-inkbrush-slot="frontmatter"]')?.textContent ?? ''}`;
    if (!freshHost || head(doc) !== head(document)) return false;
    const fresh = groupSlides(document.importNode(freshHost, true));
    if (fresh.length !== total) return false;
    let swapped = false;
    fresh.forEach((next, i) => {
      const nextStamps = editStamped(next);
      const content = servedContent(next);
      if (content === served[i]) {
        stamps[i]!.forEach((el, k) => (el.dataset[EDIT_STAMP] = nextStamps[k]!.dataset[EDIT_STAMP]));
        return;
      }
      const slide = slides[i]!;
      const canvas = next.querySelector<HTMLElement>('.slide-canvas')!;
      heights.unobserve(slide.querySelector('.slide-canvas')!);
      slide.replaceChildren(canvas);
      heights.observe(canvas);
      served[i] = content;
      stamps[i] = nextStamps;
      clicks[i] = planSlide(slide).steps;
      planned[i] = plannedSeconds(slide);
      swapped = true;
    });
    if (!swapped) return true;
    dress();
    writePlan();
    step = Math.min(step, clicks[current]!);
    slides.forEach((_, i) => setStep(i, showing && i === current ? step : clicks[i]!));
    fit();
    // the components on the new slides mount as on a page the router swapped in, before the presenter view copies them
    document.dispatchEvent(new Event('astro:page-load'));
    if (presenterView) showPanel();
    return true;
  };
  document.addEventListener('inkbrush:content', (event) => {
    if (root.isConnected && takeRendering((event as CustomEvent<{ doc: Document }>).detail.doc)) event.preventDefault();
  });

  decks.add({
    root,
    fit,
    setPrinting: (on) => {
      printing = on;
      // a printed deck has a page for every step: still copies of each step before a slide's last, which the slide itself shows
      for (const copy of host.querySelectorAll(':scope > .deck-print-step')) copy.remove();
      if (on) {
        slides.forEach((slide, i) => {
          for (let at = 0; at < clicks[i]!; at += 1) {
            const copy = slideCopy(slide, at);
            copy.classList.add('deck-print-step');
            slide.before(copy);
          }
        });
      }
      fit();
    },
    isPresenting: () => showing,
    hasPresenterView: () => presenterWindow !== null && !presenterWindow.closed,
    forward,
    back,
    jump: (to) => go(to === 'first' ? 0 : total - 1, 0),
    goTo,
    toggleOverview: () => setOverview(!overview),
    openPresenterView,
    leave,
  });
  listenOnce();

  // the first step shown, the first copies for the presenter view and the place the page opens at
  afterPageScripts(() => {
    slides.forEach((_, i) => setStep(i, clicks[i]!));
    fit();
    root.dataset['ready'] = '';
    const linked = parsePlace(location.hash);
    const at = linked ? { slide: Math.min(linked.slide, total - 1), step: linked.step } : null;
    if (presenterView) {
      root.classList.add('is-presenter');
      sessionStorage.setItem(clockKey, String(clockStart));
      tick();
      clock = window.setInterval(tick, 1000);
      enter(at ?? { slide: 0, step: 0 }, false);
    } else if (sessionStorage.getItem(storeKey) && isReload()) enter(at ?? { slide: 0, step: 0 }, false);
    else {
      sessionStorage.removeItem(storeKey);
      if (at && !isReload()) slides[at.slide]!.scrollIntoView({ block: 'start' });
      for (const slide of slides) reading.observe(slide);
    }
  });
}

/**
 * Run `then` once every script of the page has run, so the components on the
 * slides are mounted before the deck shows a step or copies a slide for the
 * presenter view (the deck mounts first, to read its slides as served): at
 * DOMContentLoaded on a page's first load, and after the task that mounted
 * the deck on a page the router swapped in.
 */
function afterPageScripts(then: () => void): void {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (navigation && navigation.domContentLoadedEventStart > 0) setTimeout(then);
  else document.addEventListener('DOMContentLoaded', then, { once: true });
}

/** mount every deck on the page that is not mounted yet */
export function mountDecks(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-deck]:not([data-deck-mounted])')) mountDeck(root);
}
