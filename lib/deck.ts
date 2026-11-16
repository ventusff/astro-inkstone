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
 * Every slide is laid out on a fixed canvas of `CANVAS_W` × `CANVAS_H` CSS
 * pixels and scaled to the width it is shown at, so a slide looks the same in
 * the page column, on a projector and in print. The scale is `--deck-k` on the
 * deck; a canvas taller than the slide (too much on one slide) grows the slide
 * in the reading view and is clipped while presenting. Below `NARROW` CSS
 * pixels a slide is laid out at its own width, unscaled, so a phone reads it
 * as ordinary page text.
 *
 * A slide that holds one heading and at most one paragraph is a divider: it
 * opens a part, and the part's name is printed in the corner of every slide
 * of that part, beside the slide's number.
 *
 * Presenting shows one slide at a time over the whole viewport (the page goes
 * full screen when the browser grants it, so the page's own overlays, such as
 * the editor's toolbars, stay above the slide): → ↓ PageDown Space go
 * forward, ← ↑ PageUp go back, Home and End jump, Esc leaves; a horizontal
 * swipe turns the page on touch screens. Keys typed into an editor, and keys
 * the page has already handled, are left alone. While presenting, the slide
 * number is the location hash `#/<n>`, and a reload (an edit's save reloads
 * the page) comes back presenting the same slide. A page holds one deck.
 */

/** the canvas every slide is laid out on, in CSS pixels: 10 × 5.625 inches, a 16:9 print page */
export const CANVAS_W = 960;
export const CANVAS_H = 540;
/** below this shown width, in CSS pixels, a slide is laid out unscaled at its own width */
export const NARROW = 600;

export interface DeckWords {
  present: string;
  exit: string;
  previous: string;
  next: string;
  /** `{n}` and `{total}` are filled in */
  position: string;
  slide: string;
}

/** what a slide holds that a reader sees: neither edit anchors nor the break that ended the slide before */
function shownChildren(canvas: Element): Element[] {
  return [...canvas.children].filter((el) => el.tagName !== 'TEMPLATE' && el.tagName !== 'HR' && !el.classList.contains('slide-mark'));
}

/** group the content's top-level nodes into slides at every thematic break */
function groupSlides(host: HTMLElement): HTMLElement[] {
  const nodes = [...host.childNodes];
  const slides: HTMLElement[] = [];
  let canvas = document.createElement('div');
  const close = () => {
    if (shownChildren(canvas).length === 0 && slides.length > 0) {
      // a break right after a break, or trailing anchors: they belong to the slide before
      slides.at(-1)!.querySelector('.slide-canvas')!.append(...canvas.childNodes);
      return;
    }
    const slide = document.createElement('section');
    slide.className = 'slide';
    canvas.className = 'slide-canvas';
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

function isDivider(canvas: Element): boolean {
  const [first, second, ...rest] = shownChildren(canvas);
  return rest.length === 0 && /^H[12]$/.test(first?.tagName ?? '') && (second === undefined || second.tagName === 'P');
}

/** a heading's words without the section number the page pipeline prints into it */
function headingText(heading: Element): string {
  const copy = heading.cloneNode(true) as Element;
  for (const num of copy.querySelectorAll('.num')) num.remove();
  return (copy.textContent ?? '').trim();
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

interface Deck {
  root: HTMLElement;
  fit(): void;
  setPrinting(printing: boolean): void;
  isPresenting(): boolean;
  step(by: number): void;
  jump(to: 'first' | 'last'): void;
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
    const step: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, ' ': 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1 };
    if (e.key in step) deck.step(step[e.key]!);
    else if (e.key === 'Home') deck.jump('first');
    else if (e.key === 'End') deck.jump('last');
    else if (e.key === 'Escape') deck.leave();
    else return;
    e.preventDefault();
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) presenting()?.leave();
  });
  addEventListener('beforeprint', () => live().forEach((d) => d.setPrinting(true)));
  addEventListener('afterprint', () => live().forEach((d) => d.setPrinting(false)));
}

export function mountDeck(root: HTMLElement): void {
  const host = root.querySelector<HTMLElement>('[data-deck-slides]')!;
  const words = JSON.parse(root.dataset['words'] ?? '{}') as DeckWords;
  const slides = groupSlides(host);
  const total = slides.length;
  const position = (n: number) => words.position.replace('{n}', String(n)).replace('{total}', String(total));

  let part = '';
  slides.forEach((slide, i) => {
    const canvas = slide.querySelector('.slide-canvas')!;
    const n = i + 1;
    slide.id = `/${n}`;
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', words.slide);
    slide.setAttribute('aria-label', position(n));
    if (isDivider(canvas)) {
      slide.classList.add('slide--divider');
      part = headingText(shownChildren(canvas)[0]!);
    }
    const mark = document.createElement('a');
    mark.className = 'slide-mark';
    mark.href = `#/${n}`;
    if (part && !slide.classList.contains('slide--divider')) {
      const name = document.createElement('span');
      name.className = 'slide-part';
      name.textContent = part;
      mark.append(name);
    }
    const num = document.createElement('span');
    num.className = 'slide-num';
    num.textContent = String(n);
    mark.append(num);
    // first in the canvas (it is placed absolutely): an edit anchor at the slide's end binds to the next block, never to it
    canvas.prepend(mark);
  });

  const label = root.querySelector<HTMLElement>('[data-deck-position]')!;
  const progress = root.querySelector<HTMLElement>('[data-deck-progress]')!;

  // ---- scale ------------------------------------------------------------
  let showing = false;
  let printing = false;
  const fit = () => {
    const shown = printing
      ? CANVAS_W
      : showing
        ? Math.min(root.clientWidth, (root.clientHeight * CANVAS_W) / CANVAS_H)
        : slides[0]!.clientWidth;
    const narrow = !showing && !printing && shown < NARROW;
    root.classList.toggle('is-narrow', narrow);
    root.style.setProperty('--deck-k', String(narrow ? 1 : shown / CANVAS_W));
  };
  const heights = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const canvas = entry.target as HTMLElement;
      canvas.parentElement!.style.setProperty('--deck-h', `${Math.max(CANVAS_H, canvas.offsetHeight)}px`);
    }
  });
  for (const slide of slides) heights.observe(slide.querySelector('.slide-canvas')!);
  new ResizeObserver(fit).observe(root);

  // ---- which slide ------------------------------------------------------
  const storeKey = `deck:${location.pathname}`;
  let current = 0;
  const indexOfHash = () => {
    const m = /^#\/(\d+)$/.exec(location.hash);
    return m ? Math.min(Math.max(Number(m[1]) - 1, 0), total - 1) : -1;
  };
  const show = (i: number) => {
    current = Math.min(Math.max(i, 0), total - 1);
    slides.forEach((s, j) => s.classList.toggle('is-current', j === current));
    label.textContent = position(current + 1);
    progress.style.setProperty('--deck-progress', String((current + 1) / total));
    history.replaceState(history.state, '', `#/${current + 1}`);
  };
  /** the slide the reader is looking at in the reading view: the first whose bottom is below a third of the viewport */
  const inView = () => {
    const line = innerHeight / 3;
    const i = slides.findIndex((s) => s.getBoundingClientRect().bottom > line);
    return i < 0 ? total - 1 : i;
  };

  const enter = (i: number, fullscreen: boolean) => {
    showing = true;
    root.classList.add('is-presenting');
    document.documentElement.classList.add('deck-presenting');
    sessionStorage.setItem(storeKey, '1');
    show(i);
    fit();
    if (fullscreen && document.fullscreenEnabled) void document.documentElement.requestFullscreen().catch(() => undefined);
  };
  const leave = () => {
    if (!showing) return;
    showing = false;
    root.classList.remove('is-presenting');
    document.documentElement.classList.remove('deck-presenting');
    sessionStorage.removeItem(storeKey);
    if (document.fullscreenElement) void document.exitFullscreen();
    history.replaceState(history.state, '', location.pathname + location.search);
    fit();
    slides[current]!.scrollIntoView({ block: 'start' });
  };

  root.querySelector('[data-deck-present]')?.addEventListener('click', () => enter(inView(), true));
  root.querySelector('[data-deck-prev]')?.addEventListener('click', () => show(current - 1));
  root.querySelector('[data-deck-next]')?.addEventListener('click', () => show(current + 1));
  root.querySelector('[data-deck-exit]')?.addEventListener('click', leave);

  let touch: { x: number; y: number } | null = null;
  root.addEventListener('pointerdown', (e) => {
    if (showing && e.pointerType === 'touch') touch = { x: e.clientX, y: e.clientY };
  });
  root.addEventListener('pointercancel', () => {
    touch = null;
  });
  root.addEventListener('pointerup', (e) => {
    if (!touch) return;
    const dx = e.clientX - touch.x;
    const dy = e.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) show(current + (dx < 0 ? 1 : -1));
  });

  decks.add({
    root,
    fit,
    setPrinting: (on) => {
      printing = on;
      fit();
    },
    isPresenting: () => showing,
    step: (by) => show(current + by),
    jump: (to) => show(to === 'first' ? 0 : total - 1),
    leave,
  });
  listenOnce();

  fit();
  root.dataset['ready'] = '';
  const fromHash = indexOfHash();
  if (sessionStorage.getItem(storeKey) && isReload()) enter(Math.max(fromHash, 0), false);
  else {
    sessionStorage.removeItem(storeKey);
    if (fromHash >= 0) slides[fromHash]!.scrollIntoView({ block: 'start' });
  }
}

/** mount every deck on the page that is not mounted yet */
export function mountDecks(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-deck]:not([data-ready])')) mountDeck(root);
}
