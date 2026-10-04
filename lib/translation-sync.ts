/**
 * translation-sync.ts — the "sync translations now" action: a reader sees
 * where the site's translations stand (up to date, N waiting, syncing,
 * failed), when they last went live and when the next automatic sync runs,
 * asks the site's translation service to bring every language up to date
 * at once, and follows the sync from queued to running to done (or failed,
 * and why).
 *
 * The site names an endpoint; the component (components/TranslationSync)
 * renders an empty, hidden block and this module binds it. The endpoint
 * answers GET with the repository's state and POST by pressing, both in one
 * shape (`SyncAnswer`) whose words are already in the reader's language, so
 * the package itself carries none: a line's `{time}` is the one thing written
 * here — the clock time of its `at`, in the reader's own time zone. While a
 * sync is queued or running the block reads the endpoint again every few
 * seconds until it settles; pressing again meanwhile only shows the
 * progress. An endpoint that cannot be reached, refuses, or answers in
 * another shape leaves the block hidden, and the page is as it was.
 *
 * Browser-safe: the components' client scripts and the unit tests share it.
 */

/** one line of words; `{time}` in `text` stands for `at` */
export interface SyncLine {
  text: string;
  at?: string;
}

/** what the endpoint answers to GET and to POST */
export interface SyncAnswer {
  /** whether this reader may press */
  can: boolean;
  /** the last sync a reader asked for; null when none */
  sync: { phase: 'queued' | 'running' | 'done' | 'failed' } | null;
  words: {
    /** the button */
    action: string;
    /** the button while a sync is queued or running */
    busy: string;
    /** where the sync the reader asked for stands, or why it failed */
    state: SyncLine | null;
    /** when the next automatic sync runs (while syncing: when this one started) */
    next: SyncLine;
    /** the block's heading; an endpoint without one shows no heading */
    title?: string;
    /** one word on where the translations stand, and its kind */
    status?: SyncStatus;
    /** when the translations last went live; null when never */
    last?: SyncLine | null;
    /** the button while the reader must wait before pressing again: it stays disabled with these words */
    wait?: SyncLine | null;
  };
}

/** one word on where the translations stand */
export interface SyncStatus {
  text: string;
  kind: 'ok' | 'waiting' | 'busy' | 'failed';
}

const KINDS: ReadonlySet<unknown> = new Set(['ok', 'waiting', 'busy', 'failed']);

const status = (v: unknown): v is SyncStatus => {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o['text'] === 'string' && KINDS.has(o['kind']);
};

const line = (v: unknown): v is SyncLine => {
  if (!v || typeof v !== 'object') return false;
  const l = v as Record<string, unknown>;
  return typeof l['text'] === 'string' && (l['at'] === undefined || typeof l['at'] === 'string');
};

const PHASES: ReadonlySet<unknown> = new Set(['queued', 'running', 'done', 'failed']);

export function isSyncAnswer(v: unknown): v is SyncAnswer {
  if (!v || typeof v !== 'object') return false;
  const a = v as Record<string, unknown>;
  const s = a['sync'];
  const w = a['words'] as Record<string, unknown> | undefined;
  return (
    typeof a['can'] === 'boolean' &&
    (s === null || (!!s && typeof s === 'object' && PHASES.has((s as Record<string, unknown>)['phase']))) &&
    !!w &&
    typeof w['action'] === 'string' &&
    typeof w['busy'] === 'string' &&
    line(w['next']) &&
    (w['state'] === null || line(w['state'])) &&
    (w['title'] === undefined || typeof w['title'] === 'string') &&
    (w['status'] === undefined || status(w['status'])) &&
    (w['last'] === undefined || w['last'] === null || line(w['last'])) &&
    (w['wait'] === undefined || w['wait'] === null || line(w['wait']))
  );
}

/** a sync the reader asked for is on its way */
export const busy = (a: SyncAnswer): boolean => a.sync?.phase === 'queued' || a.sync?.phase === 'running';

const DAY = 86_400_000;

/**
 * `line.text` with `{time}` written as the clock time of `line.at` in `lang`:
 * just the time today, with the weekday within a week, with the date beyond.
 */
export function lineText(l: SyncLine, lang: string, now: Date = new Date()): string {
  if (!l.at || !l.text.includes('{time}')) return l.text;
  const at = new Date(l.at);
  if (Number.isNaN(at.getTime())) return l.text;
  const sameDay = at.toDateString() === now.toDateString();
  const near = Math.abs(at.getTime() - now.getTime()) < 6 * DAY;
  const options: Intl.DateTimeFormatOptions = sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : near
      ? { weekday: 'short', hour: '2-digit', minute: '2-digit' }
      : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return l.text.replaceAll('{time}', new Intl.DateTimeFormat(lang, options).format(at));
}

/** how often a running sync is read again */
const POLL_MS = 3_000;
/** a sync that has not settled after this long stops being followed */
const FOLLOW_MS = 60 * 60_000;

/**
 * Bind one block (`[data-translation-sync]`): the endpoint is its value, the
 * reader's language its `data-lang`. Inside a popover it reads the endpoint
 * each time the popover opens; elsewhere at once.
 */
export function bindTranslationSync(root: HTMLElement): void {
  const endpoint = root.dataset.translationSync;
  if (!endpoint) return;
  const lang = root.dataset.lang || document.documentElement.lang || 'en';
  const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}lang=${encodeURIComponent(lang)}`;
  const head = root.querySelector<HTMLElement>('[data-sync-head]');
  const title = root.querySelector<HTMLElement>('[data-sync-title]');
  const status = root.querySelector<HTMLElement>('[data-sync-status]');
  const bar = root.querySelector<HTMLElement>('[data-sync-bar]');
  const last = root.querySelector<HTMLElement>('[data-sync-last]');
  const next = root.querySelector<HTMLElement>('[data-sync-next]');
  const state = root.querySelector<HTMLElement>('[data-sync-state]');
  const button = root.querySelector<HTMLButtonElement>('[data-sync-press]');
  let timer: ReturnType<typeof setTimeout> | null = null;
  let followSince = 0;
  /** the last answer said a sync is on its way: keep reading */
  let following = false;

  const schedule = (): void => {
    if (timer) clearTimeout(timer);
    timer = following && Date.now() - followSince < FOLLOW_MS ? setTimeout(() => void read(), POLL_MS) : null;
  };

  const show = (a: SyncAnswer): void => {
    const w = a.words;
    root.hidden = false;
    if (head) head.hidden = !w.title;
    if (title) title.textContent = w.title ?? '';
    if (status) {
      status.textContent = w.status?.text ?? '';
      if (w.status) status.dataset.kind = w.status.kind;
      else delete status.dataset.kind;
    }
    if (bar) bar.hidden = !busy(a);
    if (last) last.textContent = w.last ? lineText(w.last, lang) : '';
    if (next) next.textContent = lineText(w.next, lang);
    if (state) state.textContent = w.state ? lineText(w.state, lang) : '';
    if (button) {
      button.hidden = !a.can;
      button.disabled = busy(a) || !!w.wait;
      button.textContent = busy(a) ? w.busy : w.wait ? lineText(w.wait, lang) : w.action;
      if (busy(a)) button.dataset.busy = '';
      else delete button.dataset.busy;
    }
    following = busy(a);
    schedule();
  };

  /** the newest request: an answer to an older one (a read started before a press) is dropped */
  let latest = 0;
  const STALE = Symbol('stale');
  const ask = async (method: 'GET' | 'POST'): Promise<SyncAnswer | null | typeof STALE> => {
    const id = ++latest;
    let answer: SyncAnswer | null = null;
    try {
      const res = await fetch(url, { method, credentials: 'include', cache: 'no-store' });
      const body: unknown = await res.json();
      if (isSyncAnswer(body)) answer = body;
    } catch {
      answer = null;
    }
    return id === latest ? answer : STALE;
  };

  /** a failed read keeps the last words (a block never shown stays hidden) and, while following, tries again */
  const read = async (): Promise<void> => {
    const a = await ask('GET');
    if (a === STALE) return;
    if (a) show(a);
    else schedule();
  };

  button?.addEventListener('click', async () => {
    button.disabled = true;
    followSince = Date.now();
    const a = await ask('POST');
    if (a === STALE) return;
    if (a) show(a);
    else button.disabled = false;
  });

  const popover = root.closest<HTMLElement>('[popover]');
  if (popover) {
    popover.addEventListener('toggle', (e) => {
      if ((e as ToggleEvent).newState === 'open') {
        followSince = Date.now();
        void read();
      }
    });
  } else {
    followSince = Date.now();
    void read();
  }
}
