// Structured-data (JSON-LD) builders. Centralised so every page emits the same
// @id references — Google stitches Organization/WebSite/Article into one graph.
import { siteHref } from '../config/siteDeployment.mjs';

const SITE = siteHref('/').replace(/\/$/u, '');
const GITHUB = 'https://github.com/AwakenWorks';

const ORG_ID = `${SITE}/#organization`;

// The publishing entity — referenced by @id everywhere else so it stays a
// single node in the knowledge graph.
export const organization = {
  '@type': 'Organization',
  '@id': ORG_ID,
  name: 'AwakenWorks',
  url: SITE,
  logo: siteHref('/favicon.svg'),
  sameAs: [GITHUB],
};

const website = {
  '@type': 'WebSite',
  '@id': `${SITE}/#website`,
  name: 'AwakenWorks',
  url: SITE,
  publisher: { '@id': ORG_ID },
};

const awaken = {
  '@type': 'SoftwareApplication',
  '@id': `${SITE}/#awaken`,
  name: 'Awaken',
  url: SITE,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Cross-platform',
  publisher: { '@id': ORG_ID },
};

// Home page: declare the org + site once, as a graph.
export function homeLd() {
  return { '@context': 'https://schema.org', '@graph': [organization, website, awaken] };
}

// Product pages. `offers`/`aggregateRating` are intentionally omitted: some
// products are waitlist-only, and fabricating a price or rating would be a
// false claim. The markup still anchors the product as an entity.
export function softwareAppLd(opts: {
  name: string;
  description: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Cross-platform',
    publisher: { '@id': ORG_ID },
  };
}

// Blog posts: Article + a two-level breadcrumb, emitted as one graph.
export function blogPostLd(opts: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  blogIndexUrl: string;
}) {
  const article = {
    '@type': 'BlogPosting',
    '@id': `${opts.url}#article`,
    headline: opts.title,
    description: opts.description,
    url: opts.url,
    datePublished: opts.datePublished,
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
    author: { '@type': 'Organization', name: opts.author, url: SITE },
    publisher: { '@id': ORG_ID },
    mainEntityOfPage: opts.url,
  };
  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Blog', item: opts.blogIndexUrl },
      { '@type': 'ListItem', position: 2, name: opts.title, item: opts.url },
    ],
  };
  return { '@context': 'https://schema.org', '@graph': [article, breadcrumb] };
}
