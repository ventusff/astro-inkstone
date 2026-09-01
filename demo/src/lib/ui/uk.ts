/** Українська — Ukrainian. */
import type { UIStrings } from './types';

/**
 * Three-form Slavic plural: 1 нотатка / 2 нотатки / 5 нотаток;
 * 11–14 always take the many form (11 нотаток, 21 нотатка).
 */
const plural = (n: number, one: string, few: string, many: string): string => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

/** count + «нотатка» in the right form */
const noteCount = (n: number): string => `${n} ${plural(n, 'нотатка', 'нотатки', 'нотаток')}`;

export const strings: UIStrings = {
  searchPlaceholder: 'Пошук у саду… (Esc — закрити)',
  searchHint: 'Заголовки, підрозділи й основний текст — цією мовою.',
  searchEmpty: 'Жодної нотатки не знайдено.',
  searchUnavailable: 'Не вдалося завантажити пошуковий індекс.',
  searchUnit: 'стор.',
  searchScopeAll: 'Усі',
  searchDialog: 'Пошук по сайту',
  searchInput: 'Пошук у посібнику',
  searchResults: 'Результати пошуку',
  searchButton: 'Пошук (⌘K)',

  languages: 'Мова',

  breadcrumb: 'Навігаційний ланцюжок',
  contents: 'Зміст',
  chapterNav: 'Навігація між розділами',
  prev: '← попередній',
  next: 'наступний →',
  hub: 'Огляд',
  overview: 'Огляд',
  updated: 'оновлено',
  backlinks: 'Зворотні посилання',
  localGraph: 'Локальний граф',
  lightbox: 'Переглядач зображень',
  close: 'Закрити',
  copied: 'Код скопійовано в буфер обміну',
  copyFailed: 'Не вдалося скопіювати — буфер обміну недоступний',
  theme: 'Перемкнути світлу / темну тему',
  menu: 'Меню',
  skip: 'Перейти до вмісту',
  partLabel: (roman) => `Частина ${roman}`,
  readingTime: (min) => `${min} хв читання`,
  footer: 'Демо astro-inkstone · нотатки — це посібник, а посібник — це демо',

  landingTitle: 'Сад із паперу й туші',
  landingDesc: "astro-inkstone — вікі на Astro, у якій можна писати. Паперово-чорнильна типографіка для документації, вікі та цифрових садів, з редагуванням на місці через astro-inkbrush. Це демо — посібник пакета, написаний самим пакетом.",

  speakLabel: 'Простими словами →',
  diffLabel: 'Відмінності від попередників →',

  kinds: {
    guide: { label: 'Інструкція', desc: 'Покрокові розбори під задачу: почніть тут і з’єднайте все разом' },
    reference: { label: 'Довідник', desc: 'Повна картина однієї підсистеми, завжди актуальна' },
    pattern: { label: 'Патерн', desc: 'Прийом дизайну, вартий власної назви, — разом із причинами' },
  },
  domains: {
    design: { label: 'Дизайн', desc: 'Токени, теми та образ «папір і туш»' },
    pipeline: { label: 'Пайплайн', desc: 'Конвеєр Markdown: діалект, плагіни й контроль вмісту' },
    components: { label: 'Компоненти', desc: 'Набір компонентів і способи їх поєднання' },
    tooling: { label: 'Інструменти', desc: 'Перевірки, зонди рендера та CI' },
    editing: { label: 'Редагування', desc: 'Машина редагування: блоки, історія, ШІ, вхідні' },
  },
  statuses: {
    seedling: { label: 'Паросток', desc: 'Заготовка: посаджена, та ще не виросла' },
    growing: { label: 'Росте', desc: 'Живий документ, який ще пишеться' },
    evergreen: { label: 'Вічнозелена', desc: 'Зріла нотатка, яку постійно доглядають' },
  },

  browse: {
    kicker: 'Сад',
    kickerSub: 'посібник, вирощений із нотаток',
    title: 'Папір і туш',
    titleSub: 'сад робочих нотаток, що все ще росте',
    lede: (notes, domains) =>
      `Посібник astro-inkstone, вирощений як сад: ${noteCount(notes)} у ${domains} ${plural(domains, 'напрямі', 'напрямах', 'напрямах')} — переглядайте за типом, напрямом і тегом. Кожен ефект рендерингу на цих сторінках — робота самого пакета.`,
    sep: ' ',
    stop: '.',
    source: 'Вихідний код:',
    thisPackage: 'цей пакет',
    theEngine: 'рушій CMS —',
    editsThesePages: 'редагує саме ці сторінки',
    recent: 'Нещодавно оновлені',
    recentSub: 'останніми змінилися ці три',
    shelfCount: (n) => `${n} ${plural(n, 'основна', 'основні', 'основних')} · усі →`,
    allNotes: 'Усі нотатки →',
    byKind: 'За типом',
    byDomain: 'За напрямом',
    byStatus: 'За зрілістю',
    byTag: 'За тегом',
    facetLede: (desc, n) => `${desc} — ${noteCount(n)}.`,
    domainLede: (desc, n) => `${desc} — ${noteCount(n)}, де цей напрям основний або додатковий.`,
    tagLede: (n) => `${noteCount(n)}.`,
    tagDesc: (tag, n) => `Нотатки з тегом ${tag} (${n})`,
    facetDesc: (desc, n) => `${desc} (${noteCount(n)})`,
    all: 'Усі нотатки',
    allKicker: 'до однієї',
    allEntries: (n) => `${n} ${plural(n, 'запис', 'записи', 'записів')}`,
    allDesc: (n) => `Усі нотатки саду (${n}) — найновіші згори, з миттєвими фільтрами.`,
    allLede:
      'Найновіші згори. Фільтри нижче діють на місці; без JavaScript вони ведуть на сторінки відповідних рубрик.',
    dimKind: 'Тип',
    dimDomain: 'Напрям',
    dimStatus: 'Статус',
    dimTag: 'Теги',
    facetsAria: 'Навігація за рубриками',
    facetAll: 'Усі →',
    clear: 'Скинути фільтри',
    noMatch: 'Жодна нотатка не відповідає всім вибраним фільтрам.',
    allTags: 'Усі теги',
    chapters: (n) => `${n} ${plural(n, 'розділ', 'розділи', 'розділів')}`,
  },
};
