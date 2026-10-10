// Structured-data (JSON-LD) builders. Centralised so every page emits the same
// @id references — Google stitches Organization/WebSite/Article into one graph.
import { siteHref } from '../config/siteDeployment.mjs';
import { canonicalEntities } from '../i18n/content';
import { docsProductName } from './docsTaxonomy';

const SITE = siteHref('/').replace(/\/$/u, '');
const GITHUB = 'https://github.com/AwakenWorks';
const AWAKEN_REPOSITORY = `${GITHUB}/awaken`;

const ORG_ID = `${SITE}/#organization`;
const WEBSITE_ID = `${SITE}/#website`;
const AGENTS_ID = `${SITE}/#awaken-agents`;
const RUNTIME_ID = `${SITE}/#awaken-runtime`;
const WORKFORCE_ID = `${SITE}/#awaken-workforce`;
const OBJECTS_ID = `${SITE}/#workforce-objects`;
type ApplicationKey = 'agents' | 'workforce' | 'objects';

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

const awakenWorkforce = {
  '@type': 'SoftwareApplication', '@id': WORKFORCE_ID,
  name: 'Awaken Workforce', description: canonicalEntities.en.workforce,
  url: siteHref('/workforce/'), applicationCategory: 'BusinessApplication',
  operatingSystem: 'Cross-platform', publisher: { '@id': ORG_ID },
  hasPart: { '@id': OBJECTS_ID },
};
const workforceObjects = {
  '@type': 'SoftwareApplication', '@id': OBJECTS_ID,
  name: docsProductName('objects'),
  description: 'The Workforce capability for typed business data and permitted actions.',
  url: siteHref('/objects/'), applicationCategory: 'BusinessApplication',
  operatingSystem: 'Cross-platform', publisher: { '@id': ORG_ID },
  isPartOf: { '@id': WORKFORCE_ID },
};
const applications = { agents: awakenAgents, workforce: awakenWorkforce, objects: workforceObjects };

// One entity owner serves landing and documentation graphs. Module routes never
// create a third independent product, and labels cannot determine URL identity.
function applicationGraph(product: ApplicationKey) {
  return product === 'agents' ? [awakenAgents, awakenRuntime]
    : product === 'objects' ? [awakenWorkforce, workforceObjects]
      : [awakenWorkforce];
}
export function homeLd() {
  return { '@context': 'https://schema.org', '@graph': [organization, website, awakenAgents, awakenRuntime, awakenWorkforce] };
}

export function softwareAppLd(opts: {
  product: ApplicationKey;
  description: string;
  url: string;
}) {
  const graph = applicationGraph(opts.product).map((entity) => entity['@id'] === applications[opts.product]['@id']
    ? { ...entity, description: opts.description, url: opts.url } : entity);
  return { '@context': 'https://schema.org', '@graph': [organization, website, ...graph] };
}

export function docsPageLd(opts: {
  title: string;
  description: string;
  url: string;
  lang: string;
  product: string;
  productKey: ApplicationKey;
  dateModified?: string;
}) {
  const localePrefix = opts.lang.startsWith('zh') ? '/zh' : '';
  const productSlug = opts.productKey;
  const productId = applications[opts.productKey]['@id'];
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
      ...applicationGraph(opts.productKey),
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
