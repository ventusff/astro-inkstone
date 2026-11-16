/**
 * Hover previews of [[wikilinks]]. Resting the pointer on a link to another
 * note of the site, or moving keyboard focus onto it, opens a card beside the
 * link: the note's title and its opening blocks, or, when the link names a
 * heading, that heading and the opening of its section. The blocks are the
 * target page's own rendered blocks, so emphasis, inline code and math look
 * as they do there.
 *
 * The card is a manual popover, so it sits in the top layer: above the page,
 * and above a deck presented over the whole screen. The pointer can move onto
 * the card and follow its links; leaving both the link and the card closes it,
 * as do Escape and scrolling.
 *
 * A target page is fetched once and kept for the life of the page. What a
 * card takes from it: the title is the page's `<h1>` inside `<main>` (else
 * the link's title attribute), the description is its `meta[name=description]`
 * when the opening does not already begin with it, and the opening is the
 * first paragraphs, lists and quotations of `<main>` outside navigation,
 * page chrome and speaker notes.
 */

/** how long the pointer rests on a link before its card opens, in ms */
const OPEN_DELAY_MS = 350;
/** how long after the pointer leaves the link and the card the card closes, in ms */
const CLOSE_DELAY_MS = 250;
/** the opening stops after this many blocks */
const MAX_BLOCKS = 3;
/** the opening stops once its text reaches this many characters */
const MAX_CHARS = 420;
/** the gap between the link and the card, in px */
const GAP_PX = 8;

/** the blocks an opening is made of */
const BLOCK = 'p, ul, ol, blockquote';
/** containers whose blocks are not part of a note's opening */
const NOT_OPENING =
  'nav, aside, header, footer, figcaption, .deck-notes, [data-deck-marker], .deck-bar, .deck-controls, .deck-presenter, .taxo-line, .crumb, .local-toc, .backlinks, .kicker, p.meta';

const pages = new Map<string, Promise<Document | null>>();

function fetchPage(path: string): Promise<Document | null> {
  let page = pages.get(path);
  if (!page) {
    page = fetch(path, { headers: { accept: 'text/html' } })
      .then((res) => (res.ok ? res.text() : null))
      .then((html) => (html === null ? null : new DOMParser().parseFromString(html, 'text/html')))
      .catch(() => null);
    pages.set(path, page);
  }
  return page;
}

/** the blocks of `scope` an opening shows, in document order, none nested in another */
function openingBlocks(scope: Element | Element[]): Element[] {
  const candidates = (Array.isArray(scope) ? scope : [scope]).flatMap((el) => (el.matches(BLOCK) ? [el] : [...el.querySelectorAll(BLOCK)]));
  const blocks: Element[] = [];
  let chars = 0;
  for (const el of candidates) {
    if (blocks.length >= MAX_BLOCKS || chars >= MAX_CHARS) break;
    if (el.closest(NOT_OPENING) || blocks.some((b) => b.contains(el)) || !el.textContent?.trim()) continue;
    blocks.push(el);
    chars += el.textContent.length;
  }
  return blocks;
}

/** the siblings after `heading` up to the next heading of its level or above */
function sectionAfter(heading: Element): Element[] {
  const level = Number(heading.tagName.slice(1));
  const section: Element[] = [];
  for (let el = heading.nextElementSibling; el; el = el.nextElementSibling) {
    if (/^H[1-6]$/.test(el.tagName) && Number(el.tagName.slice(1)) <= level) break;
    section.push(el);
  }
  return section;
}

/** a heading's words without the section number the numbering preset adds */
function headingText(heading: Element): string {
  const copy = heading.cloneNode(true) as Element;
  copy.querySelectorAll('.num').forEach((n) => n.remove());
  return copy.textContent?.trim() ?? '';
}

interface Preview {
  title: string;
  section: string | null;
  description: string | null;
  blocks: Element[];
}

function previewOf(page: Document, hash: string, linkTitle: string): Preview {
  const main = page.querySelector('main') ?? page.body;
  const title = main.querySelector('h1')?.textContent?.trim() || linkTitle;
  const target = hash ? page.getElementById(decodeURIComponent(hash.slice(1))) : null;
  if (target && /^H[1-6]$/.test(target.tagName)) {
    return { title, section: headingText(target), description: null, blocks: openingBlocks(sectionAfter(target)) };
  }
  const blocks = openingBlocks(target ?? main);
  const description = page.querySelector<HTMLMetaElement>('meta[name="description"]')?.content.trim() || null;
  const opening = blocks[0]?.textContent?.trim() ?? '';
  return { title, section: null, description: description && !opening.startsWith(description.slice(0, 24)) ? description : null, blocks };
}

function renderCard(card: HTMLElement, preview: Preview): void {
  const head = document.createElement('p');
  head.className = 'link-preview-title';
  head.textContent = preview.title;
  if (preview.section) {
    const section = document.createElement('span');
    section.className = 'link-preview-section';
    section.textContent = preview.section;
    head.append(section);
  }
  const body = document.createElement('div');
  body.className = 'col link-preview-body';
  if (preview.description) {
    const description = document.createElement('p');
    description.className = 'link-preview-description';
    description.textContent = preview.description;
    body.append(description);
  }
  for (const block of preview.blocks) {
    const copy = document.importNode(block, true) as Element;
    copy.removeAttribute('id');
    copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    body.append(copy);
  }
  card.replaceChildren(head, body);
}

/** places `card` under `link` (above it when the room below is short), inside the viewport */
function place(card: HTMLElement, link: HTMLElement): void {
  const r = link.getClientRects()[0] ?? link.getBoundingClientRect();
  const w = card.offsetWidth;
  const h = card.offsetHeight;
  const left = Math.min(Math.max(GAP_PX, r.left), innerWidth - w - GAP_PX);
  const below = r.bottom + GAP_PX;
  const top = below + h <= innerHeight - GAP_PX || r.top - GAP_PX - h < GAP_PX ? below : r.top - GAP_PX - h;
  card.style.left = `${Math.max(GAP_PX, left)}px`;
  card.style.top = `${Math.max(GAP_PX, top)}px`;
}

/** the link a preview is for: a wikilink to a page of this site */
function previewLink(target: EventTarget | null): HTMLAnchorElement | null {
  const link = target instanceof Element ? target.closest<HTMLAnchorElement>('a.wikilink[href]') : null;
  if (!link || link.closest('.link-preview')) return null;
  return new URL(link.href).origin === location.origin ? link : null;
}

/** mounts the hover previews on the page; mounting twice mounts once */
export function mountLinkPreviews(): void {
  if (document.querySelector('.link-preview')) return;
  const card = document.createElement('div');
  card.className = 'link-preview';
  card.id = 'link-preview';
  card.popover = 'manual';
  card.setAttribute('role', 'tooltip');
  document.body.append(card);

  let current: HTMLAnchorElement | null = null;
  let openTimer = 0;
  let closeTimer = 0;

  const close = () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    current?.removeAttribute('aria-describedby');
    current = null;
    if (card.matches(':popover-open')) card.hidePopover();
  };
  const closeSoon = () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    closeTimer = window.setTimeout(close, CLOSE_DELAY_MS);
  };
  const openFor = (link: HTMLAnchorElement, delay: number) => {
    clearTimeout(closeTimer);
    if (link === current) return;
    clearTimeout(openTimer);
    const url = new URL(link.href);
    const page = url.pathname === location.pathname ? Promise.resolve(document) : fetchPage(url.pathname);
    openTimer = window.setTimeout(async () => {
      const doc = await page;
      if (!doc || !link.isConnected || (!link.matches(':hover') && document.activeElement !== link)) return;
      close();
      current = link;
      renderCard(card, previewOf(doc, url.hash, link.title));
      link.setAttribute('aria-describedby', card.id);
      card.style.left = '0px';
      card.style.top = '0px';
      card.showPopover();
      place(card, link);
    }, delay);
  };

  document.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    const link = previewLink(event.target);
    if (link) openFor(link, OPEN_DELAY_MS);
    else if (event.target instanceof Node && card.contains(event.target)) clearTimeout(closeTimer);
  });
  document.addEventListener('pointerout', (event) => {
    const from = previewLink(event.target) ?? (event.target instanceof Node && card.contains(event.target) ? card : null);
    if (!from) return;
    const to = event.relatedTarget;
    if (to instanceof Node && (from.contains(to) || card.contains(to) || (current && current.contains(to)))) return;
    if (from === card || from === current) closeSoon();
    else clearTimeout(openTimer);
  });
  document.addEventListener('focusin', (event) => {
    const link = previewLink(event.target);
    if (link && link.matches(':focus-visible')) openFor(link, 0);
  });
  document.addEventListener('focusout', (event) => {
    if (event.target === current) closeSoon();
  });
  // Escape closes the card and nothing else: ahead of the deck and the editor, it goes no further
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || !current) return;
      event.stopPropagation();
      event.preventDefault();
      close();
    },
    { capture: true },
  );
  window.addEventListener('scroll', close, { passive: true, capture: true });
  window.addEventListener('hashchange', close);
}
