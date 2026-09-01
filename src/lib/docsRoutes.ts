import type { CollectionEntry } from 'astro:content';
import { DOC_SECTIONS, docAudience, type DocsAudience } from './docsTaxonomy';

// A docs entry id looks like: <product>/<version>/<lang>/<...slug>
export interface DocsId {
  product: string;
  version: string;
  lang: string;
  parts: string[];
}

export type PublicDocsProduct = 'agents' | 'objects' | 'workforce';

const OBJECT_CONCEPT_SLUGS = new Set([
  'connectors',
  'object-model',
  'permissions-resources',
  'resource-model',
  'type-system',
]);

export function parseId(id: string): DocsId {
  const [product, version, lang, ...rest] = id.split('/');
  const parts = rest[rest.length - 1] === 'index' ? rest.slice(0, -1) : rest;
  return { product, version, lang, parts };
}

// Public product paths are independent from repository folders. Platform and
// Harness form one Agents journey; object-owned Flow concepts enter Objects;
// the remaining Flow material belongs to Workforce. This is the only mapping
// authority, so content stays in its current source owner without cloned docs.
export function publicDocsId(p: DocsId): DocsId & { product: PublicDocsProduct } {
  if (p.product === 'platform') return { ...p, product: 'agents' };
  if (p.product === 'harness') return { ...p, product: 'agents', parts: ['runtime', ...p.parts] };
  if (p.product === 'flow' && p.parts[0] === 'concepts' && OBJECT_CONCEPT_SLUGS.has(p.parts[1])) {
    return { ...p, product: 'objects' };
  }
  if (p.product === 'flow') return { ...p, product: 'workforce' };
  throw new Error(`No documentation product mapping for ${p.product}`);
}

// URL slug after /docs/ (base, no locale). `current` version is unversioned.
export function urlSlug(p: DocsId): string {
  const publicId = publicDocsId(p);
  const verSeg = p.version === 'current' ? [] : [p.version];
  return [publicId.product, ...verSeg, ...publicId.parts].join('/');
}

// Page slug after product+version (used by the version selector to keep the page).
export function pageSlug(p: DocsId): string {
  return p.parts.join('/');
}

export interface NavItem {
  label: string;
  href: string;
}
// A sidebar node is either a direct link or a collapsible sub-group. Nodes are
// ordered by source `order`, so a sub-group sits where its first item falls
// (e.g. right after the section's overview), not after all direct links.
export interface NavNode {
  kind: 'item' | 'sub';
  label: string;
  href?: string; // item
  items?: NavItem[]; // sub
}
export interface NavGroup {
  group: string;
  audience?: DocsAudience;
  nodes: NavNode[];
}

export interface DocsJourneyItem extends NavItem {
  group: string;
  audience?: DocsAudience;
}

export interface DocsNeighbors {
  previous?: DocsJourneyItem;
  next?: DocsJourneyItem;
}

const PRODUCT_SECTION_ORDER: Record<string, readonly string[]> = {
  agents: ['Start', 'Build', 'Connect', 'Govern', 'Operate', 'Understand', 'Reference'],
  objects: ['Start', 'Build', 'Use', 'Understand', 'Maintain', 'Reference'],
  workforce: ['Start', 'Use', 'Design', 'Operate', 'Understand', 'Maintain', 'Reference'],
};

interface Row {
  label: string;
  href: string;
  order: number;
  sub?: string;
  section: string;
  audience: DocsAudience;
}

// English frontmatter is the sole information-architecture authority. Localized
// peers own translated title, description, body, and matching evidence only.
export function canonicalDocsEntry(
  entries: CollectionEntry<'docs'>[],
  entry: CollectionEntry<'docs'>,
): CollectionEntry<'docs'> {
  const parsed = parseId(entry.id);
  if (parsed.lang === 'en') return entry;
  // Astro normalizes an index entry to `<product>/<version>/<lang>` while
  // retaining a slash after the locale for every non-index page.
  const canonicalId = entry.id.replace(new RegExp(`/${parsed.lang}(?=/|$)`), '/en');
  const canonical = entries.find((candidate) => candidate.id === canonicalId);
  if (!canonical) throw new Error(`Missing canonical English docs entry for ${entry.id}`);
  return canonical;
}

// Build the per-product, per-version sidebar (two levels: section → sub-group).
export function buildNav(
  entries: CollectionEntry<'docs'>[],
  product: PublicDocsProduct,
  version: string,
  lang: string,
): NavGroup[] {
  const groups = new Map<string, Row[]>();
  for (const e of entries) {
    const q = parseId(e.id);
    if (q.version !== version || q.lang !== lang) continue;
    const publicId = publicDocsId(q);
    if (publicId.product !== product) continue;
    const canonical = canonicalDocsEntry(entries, e);
    const sec = canonical.data.section ?? 'Docs';
    const audience = docAudience(q.product, sec, canonical.data.audience);
    const groupKey = `${audience}\u0000${sec}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push({
      label: e.data.title,
      href: '/docs/' + urlSlug(q),
      order: canonical.data.order ?? 0,
      sub: canonical.data.subsection,
      section: sec,
      audience,
    });
  }
  // Each product has one reader-oriented order. Page `order` only sorts items
  // inside a section; it must not accidentally reorder the reader journey.
  const minOrder = new Map<string, number>();
  for (const [key, rows] of groups) {
    minOrder.set(key, Math.min(...rows.map((r) => r.order)));
  }
  const order = PRODUCT_SECTION_ORDER[product] ?? DOC_SECTIONS;
  const tie = (s: string) => {
    const i = order.indexOf(s);
    return i < 0 ? 99 : i;
  };
  const audienceOrder: DocsAudience[] = ['manual', 'developer', 'operator', 'internals', 'reference'];
  const keys = [...groups.keys()].sort(
    (a, b) => {
      const aRow = groups.get(a)![0];
      const bRow = groups.get(b)![0];
      return tie(aRow.section) - tie(bRow.section)
        || audienceOrder.indexOf(aRow.audience) - audienceOrder.indexOf(bRow.audience)
        || (minOrder.get(a) ?? 0) - (minOrder.get(b) ?? 0);
    },
  );

  return keys.map((key) => {
    const rows = groups.get(key)!.sort((a, b) => a.order - b.order);
    const nodes: NavNode[] = [];
    const subNode = new Map<string, NavNode>();
    for (const r of rows) {
      if (r.sub) {
        let node = subNode.get(r.sub);
        if (!node) {
          node = { kind: 'sub', label: r.sub, items: [] };
          subNode.set(r.sub, node);
          nodes.push(node); // positioned at the sub-group's first item
        }
        node.items!.push({ label: r.label, href: r.href });
      } else {
        nodes.push({ kind: 'item', label: r.label, href: r.href });
      }
    }
    return { group: rows[0].section, audience: rows[0].audience, nodes };
  });
}

// The sidebar order is also the reading journey. Derive adjacency from that
// one authority so pages never maintain a second set of previous/next links.
export function flattenDocsJourney(groups: NavGroup[]): DocsJourneyItem[] {
  return groups.flatMap((group) => group.nodes.flatMap((node) => {
    const items = node.kind === 'sub' ? node.items ?? [] : [{ label: node.label, href: node.href! }];
    return items.map((item) => ({ ...item, group: group.group, audience: group.audience }));
  }));
}

export function docsNeighbors(groups: NavGroup[], currentHref: string): DocsNeighbors {
  const journey = flattenDocsJourney(groups);
  const matches = journey
    .map((item, index) => item.href === currentHref ? index : -1)
    .filter((index) => index >= 0);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one navigation entry for ${currentHref}; found ${matches.length}`);
  }
  const current = matches[0];
  return {
    previous: current > 0 ? journey[current - 1] : undefined,
    next: current < journey.length - 1 ? journey[current + 1] : undefined,
  };
}
