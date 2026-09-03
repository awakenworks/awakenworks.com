// Structured-data (JSON-LD) builders. Centralised so every page emits the same
// @id references — Google stitches Organization/WebSite/Article into one graph.
import { siteHref } from '../config/siteDeployment.mjs';
import { canonicalEntities } from '../i18n/content';

const SITE = siteHref('/').replace(/\/$/u, '');
const GITHUB = 'https://github.com/AwakenWorks';
const AWAKEN_REPOSITORY = `${GITHUB}/awaken`;

const ORG_ID = `${SITE}/#organization`;
const WEBSITE_ID = `${SITE}/#website`;
const AGENTS_ID = `${SITE}/#awaken-agents`;
const RUNTIME_ID = `${SITE}/#awaken-runtime`;

// The publishing entity — referenced by @id everywhere else so it stays a
// single node in the knowledge graph.
export const organization = {
  '@type': 'Organization',
  '@id': ORG_ID,
  name: 'AwakenWorks',
  description: canonicalEntities.en.company,
  url: SITE,
  logo: siteHref('/favicon.svg'),
  sameAs: [GITHUB],
};

const website = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: 'AwakenWorks',
  url: SITE,
  publisher: { '@id': ORG_ID },
};

const awakenRuntime = {
  '@type': 'SoftwareSourceCode',
  '@id': RUNTIME_ID,
  name: 'Awaken Runtime',
  description: canonicalEntities.en.runtime,
  codeRepository: AWAKEN_REPOSITORY,
  programmingLanguage: 'Rust',
  runtimePlatform: 'Rust',
  isPartOf: { '@id': AGENTS_ID },
  publisher: { '@id': ORG_ID },
};

const awakenAgents = {
  '@type': 'SoftwareApplication',
  '@id': AGENTS_ID,
  name: 'Awaken Agents',
  alternateName: 'Awaken',
  description: canonicalEntities.en.agents,
  url: siteHref('/agents/'),
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Cross-platform',
  sameAs: [AWAKEN_REPOSITORY],
  hasPart: { '@id': RUNTIME_ID },
  publisher: { '@id': ORG_ID },
};

// Home page: make company, product, and Runtime separate connected entities.
export function homeLd() {
  return { '@context': 'https://schema.org', '@graph': [organization, website, awakenAgents, awakenRuntime] };
}

// Product pages. `offers`/`aggregateRating` are intentionally omitted: some
// products are waitlist-only, and fabricating a price or rating would be a
// false claim. The markup still anchors the product as an entity.
export function softwareAppLd(opts: {
  name: string;
  description: string;
  url: string;
}) {
  const appId = opts.name === 'Awaken Agents'
    ? AGENTS_ID
    : `${SITE}/#${opts.name.toLowerCase().replaceAll(' ', '-')}`;
  const app = {
    '@type': 'SoftwareApplication',
    '@id': appId,
    name: opts.name,
    description: opts.description,
    url: opts.url,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Cross-platform',
    publisher: { '@id': ORG_ID },
  };
  if (opts.name !== 'Awaken Agents') {
    return { '@context': 'https://schema.org', '@graph': [organization, website, app] };
  }
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      website,
      { ...awakenAgents, description: opts.description, url: opts.url },
      awakenRuntime,
    ],
  };
}

export function docsPageLd(opts: {
  title: string;
  description: string;
  url: string;
  lang: string;
  product: string;
  dateModified?: string;
}) {
  const localePrefix = opts.lang.startsWith('zh') ? '/zh' : '';
  const productSlug = opts.product.replace('Awaken ', '').toLowerCase();
  const productId = opts.product === 'Awaken Agents'
    ? AGENTS_ID
    : `${SITE}/#${opts.product.toLowerCase().replaceAll(' ', '-')}`;
  const productEntity = opts.product === 'Awaken Agents'
    ? awakenAgents
    : {
        '@type': 'SoftwareApplication',
        '@id': productId,
        name: opts.product,
        url: siteHref(`/${productSlug}/`),
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Cross-platform',
        publisher: { '@id': ORG_ID },
      };
  const article = {
    '@type': 'TechArticle',
    '@id': `${opts.url}#article`,
    headline: opts.title,
    description: opts.description,
    url: opts.url,
    inLanguage: opts.lang,
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    mainEntityOfPage: opts.url,
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': productId },
  };
  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: opts.lang.startsWith('zh') ? '文档' : 'Documentation', item: siteHref(`${localePrefix}/docs/`) },
      { '@type': 'ListItem', position: 2, name: opts.product, item: siteHref(`${localePrefix}/docs/${productSlug}/`) },
      { '@type': 'ListItem', position: 3, name: opts.title, item: opts.url },
    ],
  };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      website,
      productEntity,
      ...(opts.product === 'Awaken Agents' ? [awakenRuntime] : []),
      article,
      breadcrumb,
    ],
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
