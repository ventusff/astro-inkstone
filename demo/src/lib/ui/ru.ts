/** Русский — Russian. */
import type { UIStrings } from './types';

/**
 * Three-form Slavic plural: 1 заметка / 2 заметки / 5 заметок;
 * 11–14 always take the many form (11 заметок, 21 заметка).
 */
const plural = (n: number, one: string, few: string, many: string): string => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

/** count + «заметка» in the right form */
const noteCount = (n: number): string => `${n} ${plural(n, 'заметка', 'заметки', 'заметок')}`;

export const strings: UIStrings = {
  searchPlaceholder: 'Поиск по саду… (Esc — закрыть)',
  searchHint: 'Заголовки, разделы и текст заметок — на этом языке.',
  searchEmpty: 'Ничего не найдено.',
  searchUnavailable: 'Не удалось загрузить поисковый индекс.',
  searchUnit: 'стр.',
  searchScopeAll: 'Все',
  searchDialog: 'Поиск по сайту',
  searchInput: 'Поиск по руководству',
  searchResults: 'Результаты поиска',
  searchButton: 'Поиск (⌘K)',

  languages: 'Язык',

  breadcrumb: 'Хлебные крошки',
  contents: 'Содержание',
  chapterNav: 'Навигация по главам',
  prev: '← предыдущая',
  next: 'следующая →',
  hub: 'Обзор',
  overview: 'Обзор',
  updated: 'обновлено',
  backlinks: 'Обратные ссылки',
  localGraph: 'Локальный граф',
  lightbox: 'Просмотр изображений',
  close: 'Закрыть',
  copied: 'Код скопирован в буфер обмена',
  copyFailed: 'Не удалось скопировать — буфер обмена недоступен',
  theme: 'Переключить светлую / тёмную тему',
  menu: 'Меню',
  skip: 'Перейти к содержимому',
  partLabel: (roman) => `Часть ${roman}`,
  readingTime: (min) => `${min} мин чтения`,
  footer: 'Демо astro-inkstone · заметки — это руководство, руководство — это демо',

  landingTitle: 'Сад из бумаги и туши',
  landingDesc: "astro-inkstone — вики на Astro, в которой можно писать. Бумажно-чернильная типографика для документации, вики и цифровых садов, с правкой на месте через astro-inkbrush. Это демо — руководство пакета, написанное самим пакетом.",

  speakLabel: 'Простыми словами →',
  diffLabel: 'Отличия от предшественников →',

  kinds: {
    guide: { label: 'Инструкция', desc: 'Пошаговые разборы под задачу: начните здесь и соберите всё вместе' },
    reference: { label: 'Справочник', desc: 'Полная картина одной подсистемы, всегда актуальная' },
    pattern: { label: 'Паттерн', desc: 'Приём дизайна, которому стоит дать имя, — и причины, почему так' },
  },
  domains: {
    design: { label: 'Дизайн', desc: 'Токены, темы и облик «бумага и тушь»' },
    pipeline: { label: 'Пайплайн', desc: 'Конвейер Markdown: диалект, плагины и контроль контента' },
    components: { label: 'Компоненты', desc: 'Набор компонентов и как их сочетать' },
    tooling: { label: 'Инструменты', desc: 'Проверки, зонды рендера и CI' },
    editing: { label: 'Редактирование', desc: 'Машина редактирования: блоки, история, ИИ, входящие' },
  },
  statuses: {
    seedling: { label: 'Росток', desc: 'Заготовка: посажена, но ещё не выросла' },
    growing: { label: 'Растёт', desc: 'Живой документ, который ещё пишется' },
    evergreen: { label: 'Вечнозелёная', desc: 'Зрелая заметка, за которой продолжают ухаживать' },
  },

  browse: {
    kicker: 'Сад',
    kickerSub: 'руководство, выращенное из заметок',
    title: 'Бумага и тушь',
    titleSub: 'растущий сад рабочих заметок',
    lede: (notes, domains) =>
      `Руководство astro-inkstone, выращенное как сад: ${noteCount(notes)} в ${domains} ${plural(domains, 'направлении', 'направлениях', 'направлениях')} — просматривайте по типу, направлению и тегу. Каждый эффект отрисовки на этих страницах — работа самого пакета.`,
    sep: ' ',
    stop: '.',
    source: 'Исходники:',
    thisPackage: 'этот пакет',
    theEngine: 'движок CMS —',
    editsThesePages: 'редактирует эти самые страницы',
    recent: 'Недавно обновлённые',
    recentSub: 'последними менялись эти три',
    shelfCount: (n) => `${n} ${plural(n, 'основная', 'основные', 'основных')} · все →`,
    allNotes: 'Все заметки →',
    byKind: 'По типу',
    byDomain: 'По направлению',
    byStatus: 'По зрелости',
    byTag: 'По тегу',
    facetLede: (desc, n) => `${desc} — ${noteCount(n)}.`,
    domainLede: (desc, n) => `${desc} — ${noteCount(n)}, где это направление основное или дополнительное.`,
    tagLede: (n) => `${noteCount(n)}.`,
    tagDesc: (tag, n) => `Заметки с тегом ${tag} (${n})`,
    facetDesc: (desc, n) => `${desc} (${noteCount(n)})`,
    all: 'Все заметки',
    allKicker: 'до единой',
    allEntries: (n) => `${n} ${plural(n, 'запись', 'записи', 'записей')}`,
    allDesc: (n) => `Все заметки сада (${n}) — новые сверху, с мгновенными фильтрами.`,
    allLede:
      'Новые сверху. Фильтры ниже работают на месте; без JavaScript они ведут на страницы соответствующих рубрик.',
    dimKind: 'Тип',
    dimDomain: 'Направление',
    dimStatus: 'Статус',
    dimTag: 'Теги',
    facetsAria: 'Навигация по рубрикам',
    facetAll: 'Все →',
    clear: 'Сбросить фильтры',
    noMatch: 'Ни одна заметка не подходит под все выбранные фильтры.',
    allTags: 'Все теги',
    chapters: (n) => `${n} ${plural(n, 'глава', 'главы', 'глав')}`,
  },
};
