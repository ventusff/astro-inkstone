/** Polski — Polish. */
import type { UIStrings } from './types';

/** Polish three-form plural: 1 → one; 2–4 outside 12–14 → few; else → many. */
const plural = (n: number, one: string, few: string, many: string): string => {
  if (n === 1) return one;
  const d = n % 10;
  const h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};

const notatki = (n: number) => plural(n, 'notatka', 'notatki', 'notatek');

export const strings: UIStrings = {
  searchPlaceholder: 'Przeszukaj ogród… (Esc zamyka)',
  searchHint: 'Tytuły, sekcje i treść — w tym języku.',
  searchEmpty: 'Brak pasujących notatek.',
  searchUnavailable: 'Nie udało się wczytać indeksu wyszukiwania.',
  searchUnit: 'str.',
  searchScopeAll: 'Wszystko',
  searchDialog: 'Wyszukiwanie w witrynie',
  searchInput: 'Przeszukaj podręcznik',
  searchResults: 'Wyniki wyszukiwania',
  searchButton: 'Szukaj (⌘K)',

  languages: 'Język',

  breadcrumb: 'Ścieżka nawigacyjna',
  contents: 'Spis treści',
  chapterNav: 'Nawigacja po rozdziałach',
  prev: '← poprzedni',
  next: 'następny →',
  hub: 'Przegląd',
  overview: 'Przegląd',
  updated: 'zaktualizowano',
  backlinks: 'Linki zwrotne',
  localGraph: 'Graf lokalny',
  lightbox: 'Podgląd obrazu',
  close: 'Zamknij',
  copied: 'Kod skopiowany do schowka',
  copyFailed: 'Nie udało się skopiować — schowek jest niedostępny',
  theme: 'Przełącz motyw jasny / ciemny',
  menu: 'Menu',
  skip: 'Przejdź do treści',
  partLabel: (roman) => `Część ${roman}`,
  readingTime: (min) => `${min} min czytania`,
  footer: 'Demo astro-inkstone · notatki są podręcznikiem, a podręcznik — demem',

  landingTitle: 'Ogród z papieru i tuszu',
  landingDesc: 'Demo astro-inkstone — ogród notatek z taksonomią, w którym notatki są podręcznikiem samego pakietu.',

  speakLabel: 'Po ludzku →',
  diffLabel: 'Względem poprzedników →',

  kinds: {
    guide: { label: 'Przewodnik', desc: 'Krok po kroku wzdłuż zadania: zacznij tutaj i podłącz całość' },
    reference: { label: 'Referencja', desc: 'Pełny obraz jednego podsystemu, na bieżąco aktualizowany' },
    pattern: { label: 'Wzorzec', desc: 'Decyzja projektowa warta własnej nazwy — wraz z uzasadnieniem' },
  },
  domains: {
    design: { label: 'Design', desc: 'Tokeny, motywy, wygląd „papieru i tuszu”' },
    pipeline: { label: 'Potok', desc: 'Potok Markdowna: dialekt, wtyczki, strażnik treści' },
    components: { label: 'Komponenty', desc: 'Zestaw komponentów i sposoby ich składania' },
    tooling: { label: 'Narzędzia', desc: 'Kontrole, sondy renderowania i konfiguracja CI' },
    editing: { label: 'Edycja', desc: 'Maszyna edycyjna: bloki, historia, AI, skrzynka odbiorcza' },
  },
  statuses: {
    seedling: { label: 'Siewka', desc: 'Zalążek — posadzony, jeszcze nie wyrósł' },
    growing: { label: 'Rosnąca', desc: 'Żywy dokument, wciąż w trakcie pisania' },
    evergreen: { label: 'Wiecznie zielona', desc: 'Dojrzała i utrzymywana' },
  },

  browse: {
    kicker: 'Ogród',
    kickerSub: 'podręcznik wyhodowany z notatek',
    title: 'Papier i tusz',
    titleSub: 'rosnący ogród notatek roboczych',
    lede: (notes, domains) =>
      `Podręcznik astro-inkstone, wyhodowany jak ogród — ${notes} ${notatki(notes)} w ${domains} ${domains === 1 ? 'obszarze' : 'obszarach'}, do przeglądania według rodzaju, obszaru i tagu. Każdy efekt renderowania na tych stronach to ten pakiet w działaniu.`,
    sep: ' ',
    stop: '.',
    source: 'Kod źródłowy:',
    thisPackage: 'ten pakiet',
    theEngine: 'silnik CMS —',
    editsThesePages: 'edytuje właśnie te strony',
    recent: 'Ostatnio aktualizowane',
    recentSub: 'trzy ostatnio zmienione',
    shelfCount: (n) => `${n} ${plural(n, 'główna', 'główne', 'głównych')} · wszystkie →`,
    allNotes: 'Wszystkie notatki →',
    byKind: 'Według rodzaju',
    byDomain: 'Według obszaru',
    byStatus: 'Według statusu',
    byTag: 'Według tagu',
    facetLede: (desc, n) => `${desc} — ${n} ${notatki(n)}.`,
    domainLede: (desc, n) =>
      `${desc} — ${n} ${plural(n, 'notatka, główna lub poboczna', 'notatki, główne lub poboczne', 'notatek, głównych lub pobocznych')}.`,
    tagLede: (n) => `${n} ${notatki(n)}.`,
    tagDesc: (tag, n) => `Notatki z tagiem ${tag} (${n})`,
    facetDesc: (desc, n) => `${desc} (${n} ${notatki(n)})`,
    all: 'Wszystkie notatki',
    allKicker: 'co do jednej',
    allEntries: (n) => `${n} ${plural(n, 'wpis', 'wpisy', 'wpisów')}`,
    allDesc: (n) => `Wszystkie notatki w ogrodzie (${n}), od najnowszych, z natychmiastowym filtrowaniem.`,
    allLede: 'Od najnowszych. Poniższe filtry działają na miejscu; bez JavaScriptu prowadzą do stron poszczególnych kategorii.',
    dimKind: 'Rodzaj',
    dimDomain: 'Obszar',
    dimStatus: 'Status',
    dimTag: 'Tagi',
    facetsAria: 'Indeks przeglądania',
    facetAll: 'Wszystkie →',
    clear: 'Wyczyść filtry',
    noMatch: 'Żadna notatka nie spełnia wszystkich wybranych filtrów.',
    allTags: 'Wszystkie tagi',
    chapters: (n) => `${n} ${plural(n, 'rozdział', 'rozdziały', 'rozdziałów')}`,
  },
};
