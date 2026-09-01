/**
 * llms.txt — the manual's index for language-model crawlers (llmstxt.org):
 * what the package is, where its source lives, every note of the default
 * locale with its description, and the other locales' landing pages.
 */
import { getCollection } from 'astro:content';

import {
  DEFAULT_LOCALE,
  ENGINE_URL,
  GITHUB_URL,
  href,
  localeOfId,
  LOCALES,
  routeOfId,
} from '../lib/i18n';

export async function GET(): Promise<Response> {
  const abs = (route: string): string => new URL(href(route), import.meta.env.SITE).href;
  const notes = (await getCollection('notes'))
    .filter((n) => localeOfId(n.id) === DEFAULT_LOCALE)
    .sort((a, b) => a.id.localeCompare(b.id));
  const lines = [
    '# astro-inkstone',
    '',
    "> The Astro wiki you can write in — paper-and-ink typography for documentation sites, wikis and digital gardens, paired with astro-inkbrush for in-place editing. This site is the package's manual, written with the package itself.",
    '',
    `- Source: ${GITHUB_URL}`,
    `- Editing engine: ${ENGINE_URL}`,
    `- Try editing in the browser: ${abs('/kitchen-sink/')}`,
    '',
    '## Manual',
    '',
    ...notes.map(
      (n) =>
        `- [${n.data.title}](${abs(routeOfId(n.id))})${n.data.description ? `: ${n.data.description}` : ''}`,
    ),
    '',
    '## Other languages',
    '',
    ...LOCALES.filter((l) => l.code !== DEFAULT_LOCALE).map((l) => `- [${l.englishName}](${abs(l.prefix)})`),
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
