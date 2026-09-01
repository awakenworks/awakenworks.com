import type { CollectionEntry } from 'astro:content';
import type { Lang } from '../i18n/content';
import { parseId, publicDocsId, urlSlug } from './docsRoutes';
import { docsProductName } from './docsTaxonomy';
import { localePath } from '../i18n/locales';

export interface DocsSearchRecord {
  title: string;
  description: string;
  href: string;
  product: string;
  text: string;
}

function searchableText(markdown: string): string {
  return markdown
    .replace(/^---[\s\S]*?---\s*/u, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_|~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12_000);
}

// Cause/effect design for documentation search:
// C1: repository folders use platform, harness, and flow while site routes use
//     Agents, Objects, and Workforce; deriving labels from source folders would
//     omit two products and create a second taxonomy.
// C2: every current source page has exactly one mapping through publicDocsId.
// E1: href and product label derive from that same mapped identity.
// E2: archived versions remain outside the current search index.
// Decision table: current + mapped -> include under the mapped product; archived
// -> exclude; unmapped -> fail in publicDocsId instead of silently disappearing.
export function buildDocsSearchIndex(
  entries: CollectionEntry<'docs'>[],
  lang: Lang,
): DocsSearchRecord[] {
  return entries
    .filter((entry) => {
      const parsed = parseId(entry.id);
      return parsed.lang === lang && parsed.version === 'current';
    })
    .map((entry) => {
      const parsed = parseId(entry.id);
      const publicId = publicDocsId(parsed);
      return {
        title: entry.data.title,
        description: entry.data.description,
        href: `${localePath(lang, `/docs/${urlSlug(parsed)}`)}/`,
        product: docsProductName(publicId.product),
        text: searchableText(entry.body),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, lang));
}

export function buildDocsLlmIndex(
  entries: CollectionEntry<'docs'>[],
  lang: Lang,
  site?: URL,
): string {
  const records = buildDocsSearchIndex(entries, lang);
  const absoluteHref = (href: string) => site ? new URL(href, site).href : href;
  const { heading, purpose } = docsLlmLabels[lang];
  const sections = new Map<string, DocsSearchRecord[]>();
  for (const record of records) {
    if (!sections.has(record.product)) sections.set(record.product, []);
    sections.get(record.product)!.push(record);
  }
  const lines = [heading, '', purpose, ''];
  for (const [product, productRecords] of sections) {
    lines.push(`## ${product}`, '');
    for (const record of productRecords) {
      lines.push(`- [${record.title}](${absoluteHref(record.href)}): ${record.description}`);
    }
    lines.push('');
  }
  return `${lines.join('\n').trim()}\n`;
}

const docsLlmLabels: Record<Lang, { heading: string; purpose: string }> = {
  en: {
    heading: '# AwakenWorks documentation index',
    purpose: '> Machine-readable entry point for current documentation. Titles, descriptions, and URLs derive from the same Astro content collection.',
  },
  zh: {
    heading: '# AwakenWorks 文档索引',
    purpose: '> 当前文档的机器可读入口。标题、描述与 URL 直接来自同一个 Astro content collection。',
  },
};
