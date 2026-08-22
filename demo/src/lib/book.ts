/**
 * book.ts — the table of contents. One source of truth for part/chapter
 * order, names in both languages, and which pages sit in which chapter.
 *
 * The manual has three PARTS: how to use the package (guide), what is in it
 * (reference), and how it is kept honest (ops). Chapter membership and order
 * live HERE, never in frontmatter — a page cannot disagree with the sidebar.
 *
 * Page ids are locale-free here (`design/tokens`); the locale prefix is
 * applied by `localeRoute()` in lib/i18n.ts.
 */

export interface BookSection {
  /** locale-free page id — the directory under src/content/docs/ */
  id: string;
  zh: string;
  en: string;
}

export interface BookChapter {
  /** chapter directory, and the first segment of every section id in it */
  dir: string;
  zh: string;
  en: string;
  /** one line under the chapter heading in the sidebar */
  blurbZh: string;
  blurbEn: string;
  sections: BookSection[];
}

export interface BookPart {
  key: 'guide' | 'reference' | 'ops';
  zh: string;
  en: string;
  chapters: BookChapter[];
}

export const PARTS: BookPart[] = [
  {
    key: 'guide',
    zh: '使用指南',
    en: 'Guide',
    chapters: [
      {
        dir: 'overview',
        zh: '总览',
        en: 'Overview',
        blurbZh: '本包是什么,引擎/纸面/站点三件套怎么分工',
        blurbEn: 'What this package is, and how engine / paper / site divide the work',
        sections: [{ id: 'overview/why', zh: '三件套的边界', en: 'The three-way split' }],
      },
      {
        dir: 'start',
        zh: '起步',
        en: 'Getting started',
        blurbZh: '一对 submodule,siteMarkdown 一行接入',
        blurbEn: 'A pair of submodules, one line of siteMarkdown',
        sections: [{ id: 'start/install', zh: '安装与接入', en: 'Install and wire up' }],
      },
    ],
  },
  {
    key: 'reference',
    zh: '参考',
    en: 'Reference',
    chapters: [
      {
        dir: 'design',
        zh: '设计 token',
        en: 'Design tokens',
        blurbZh: '两层色板、浅深主题与站点身份定制',
        blurbEn: 'The two-layer palette, light/dark themes, site identity',
        sections: [{ id: 'design/tokens', zh: '两层色板与主题', en: 'Two-layer palette and themes' }],
      },
      {
        dir: 'writing',
        zh: '内容写作',
        en: 'Writing',
        blurbZh: 'markdown 管线全要素:表格、callout、数学、代码框、mermaid',
        blurbEn: 'The whole pipeline: tables, callouts, math, code frames, mermaid',
        sections: [{ id: 'writing/kitchen-sink', zh: '全要素演示', en: 'Kitchen sink' }],
      },
      {
        dir: 'components',
        zh: '组件',
        en: 'Components',
        blurbZh: '组件陈列室:callout、步骤、卡片、统计、文献与交互演示',
        blurbEn: 'The gallery: callouts, steps, cards, stats, references, live demos',
        sections: [{ id: 'components/gallery', zh: '组件陈列室', en: 'Component gallery' }],
      },
    ],
  },
  {
    key: 'ops',
    zh: '运维',
    en: 'Operations',
    chapters: [
      {
        dir: 'checks',
        zh: '检查工具',
        en: 'Checks',
        blurbZh: '构建期与渲染层的三道守门',
        blurbEn: 'The three gates: content, dist, rendered UI',
        sections: [{ id: 'checks/overview', zh: '检查工具一览', en: 'The checks' }],
      },
    ],
  },
];

/** flat chapter list, in reading order — most consumers only need this */
export const BOOK: BookChapter[] = PARTS.flatMap((p) => p.chapters);

/** flat reading order of locale-free page ids */
export const READING_ORDER: string[] = BOOK.flatMap((c) => c.sections.map((s) => s.id));

/** chapter that owns a page id */
export function chapterOf(id: string): BookChapter | undefined {
  return BOOK.find((c) => c.sections.some((s) => s.id === id));
}

/** part that owns a page id */
export function partOf(id: string): BookPart | undefined {
  return PARTS.find((p) => p.chapters.some((c) => c.sections.some((s) => s.id === id)));
}

/* build-time invariant: ids are unique and live under their chapter's dir */
const seen = new Set<string>();
for (const c of BOOK) {
  for (const s of c.sections) {
    if (seen.has(s.id)) throw new Error(`book: duplicate section id "${s.id}"`);
    seen.add(s.id);
    if (!s.id.startsWith(`${c.dir}/`))
      throw new Error(`book: "${s.id}" must live under chapter dir "${c.dir}/"`);
  }
}
