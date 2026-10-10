import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import {
  normalizeBasePath,
  siteBasePath,
  siteHref,
  withSiteBase,
  withoutSiteBase,
} from '../src/config/siteDeployment.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const failures = [];

// Cause/effect test design for deployment below a repository base path:
// C1 the site may be deployed at root or below a repository name; C2 generated
// assets, Astro component links, Markdown links, public files, search records,
// and redirects cross different renderers; C3 URLs may be external, fragment-
// only, already prefixed, or carry a query/fragment; C4 locale detection must
// see the logical route rather than the deployment prefix; C5 a prefixed URL
// can still point to a file absent from the uploaded artifact; C6 a custom
// Actions workflow can accidentally retain a redundant public/CNAME even
// though the repository Pages setting is the domain authority.
// C7 the shared brand owner names the public product Agents; a retired
// Managed label must not prevent an otherwise source-aligned deployment.
// C8 the page exists but a renamed/deleted heading leaves a dead fragment;
// C9 duplicate IDs make a fragment ambiguous; C10 Chinese fragments are URL-encoded.
// C11 Markdown-relative links resolve from the emitted directory URL, not the
// source file directory; checking only leading-slash URLs misses live 404s.
// C12 HTML-escaped query separators must decode before URL parsing, otherwise
// &#38; invents a fragment and destroys preserved request context.
// E1 prefix every internal browser URL exactly once; E2 leave external and
// fragment URLs unchanged; E3 remove the prefix before route interpretation;
// E4 keep canonical URLs on the configured site/base; E5 require every emitted
// internal target and representative asset to exist before deployment; E6
// reject the ignored duplicate domain declaration.
// Decision table:
// | Rule | base | URL kind | existing prefix | locale | target | Outcome |
// | P1 | root | internal | no | any | exists | unchanged, accept |
// | P2 | repo | internal | no | en/zh | exists | prefix once, accept |
// | P3 | repo | internal | yes | any | exists | keep once, accept |
// | P4 | repo | external/fragment | n/a | any | n/a | unchanged, accept |
// | P5 | repo | internal | any | any | missing | reject |
// | P6 | repo | internal | doubled | any | any | reject |
// | P7 | any | public/CNAME present under Actions | n/a | n/a | n/a | reject |
// P8 internal HTML + missing fragment -> reject even when the page exists;
// P9 duplicate emitted ID -> reject; P10 encoded fragment + decoded ID -> accept.
// P11 relative URL -> resolve as the browser does, then require the same target.
// P12 escaped query separator -> decode, preserving the actual fragment.
// External fragments and browser text directives remain outside HTML-ID validation.
const helperRules = [
  { base: '/', input: '/agents?x=1#proof', expected: '/agents?x=1#proof' },
  { base: '/awakenworks.com', input: '/agents?x=1#proof', expected: '/awakenworks.com/agents?x=1#proof' },
  { base: '/awakenworks.com/', input: '/awakenworks.com/zh/agents', expected: '/awakenworks.com/zh/agents' },
  { base: '/awakenworks.com', input: 'https://example.com/a', expected: 'https://example.com/a' },
  { base: '/awakenworks.com', input: '#proof', expected: '#proof' },
];

for (const rule of helperRules) {
  const actual = withSiteBase(rule.input, rule.base);
  if (actual !== rule.expected) failures.push(`withSiteBase(${rule.input}, ${rule.base}) expected ${rule.expected}, found ${actual}`);
}
if (withoutSiteBase('/awakenworks.com/zh/agents', '/awakenworks.com') !== '/zh/agents') {
  failures.push('withoutSiteBase must restore the logical localized route');
}
if (normalizeBasePath('/awakenworks.com/') !== '/awakenworks.com') {
  failures.push('normalizeBasePath must own one trailing-slash representation');
}

function filesBelow(path, predicate = () => true) {
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const child = resolve(current, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (predicate(child)) files.push(child);
    }
  };
  walk(path);
  return files;
}

function emittedTarget(url) {
  const pathname = withoutSiteBase(decodeURIComponent(url.split(/[?#]/u, 1)[0]), siteBasePath);
  const direct = resolve(dist, `.${pathname}`);
  if (existsSync(direct) && statSync(direct).isFile()) return direct;
  return resolve(direct, 'index.html');
}

function decodeAttribute(value) {
  const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
  return value.replace(/&(?:#(\d+)|#x([\da-f]+)|(amp|quot|apos|lt|gt));/giu,
    (_match, decimal, hex, name) => name
      ? entities[name.toLowerCase()]
      : String.fromCodePoint(Number.parseInt(decimal ?? hex, decimal ? 10 : 16)));
}

const htmlFiles = filesBelow(dist, (path) => extname(path) === '.html');
const htmlByPath = new Map(htmlFiles.map((path) => [path, readFileSync(path, 'utf8')]));
const idsByPath = new Map();
for (const [path, html] of htmlByPath) {
  const ids = [...html.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) failures.push(`${path}: duplicate HTML IDs make navigation ambiguous`);
  idsByPath.set(path, uniqueIds);
}
if (existsSync(resolve(root, 'public/CNAME'))) {
  failures.push('public/CNAME duplicates the GitHub Pages custom-domain setting used by the Actions workflow');
}
const attributePattern = /\b(?:href|src|poster|action|data-index-url|data-console-image)="([^"]+)"/gu;
for (const path of htmlFiles) {
  const html = htmlByPath.get(path);
  const browserUrl = new URL(relative(dist, path).replace(/index\.html$/u, ''), siteHref('/'));
  for (const match of html.matchAll(attributePattern)) {
    const url = decodeAttribute(match[1]);
    if (/^[a-z][a-z\d+.-]*:/iu.test(url) || url.startsWith('//')) continue;
    const resolved = new URL(url, browserUrl);
    const target = emittedTarget(resolved.pathname);
    if (match[0].startsWith('href=') && resolved.hash) {
      const rawFragment = resolved.hash.slice(1).split(':~:text=', 1)[0];
      if (rawFragment && idsByPath.has(target)) {
        try {
          if (!idsByPath.get(target).has(decodeURIComponent(rawFragment))) {
            failures.push(`${path}: emitted HTML fragment does not exist: ${url}`);
          }
        } catch {
          failures.push(`${path}: invalid encoded HTML fragment: ${url}`);
        }
      }
    }
    if (siteBasePath !== '/' && withSiteBase(resolved.pathname) !== resolved.pathname) {
      failures.push(`${path}: internal URL is missing ${siteBasePath}: ${url}`);
      continue;
    }
    if (siteBasePath !== '/' && resolved.pathname.includes(`${siteBasePath}${siteBasePath}`)) {
      failures.push(`${path}: internal URL contains the deployment base twice: ${url}`);
      continue;
    }
    if (!existsSync(target)) {
      failures.push(`${path}: emitted internal target does not exist: ${url}`);
    }
  }
}

const indexPath = resolve(dist, 'index.html');
const index = htmlByPath.get(indexPath);
const expectedCanonical = siteHref('/');
if (!index.includes(`<link rel="canonical" href="${expectedCanonical}">`)) {
  failures.push(`home canonical must use the configured site/base: ${expectedCanonical}`);
}
for (const expected of [
  withSiteBase('/favicon.svg'),
  withSiteBase('/_astro/'),
  withSiteBase('/agents'),
  withSiteBase('/zh'),
]) {
  if (!index.includes(expected)) failures.push(`home output is missing deployment-aware URL: ${expected}`);
}
if (!index.includes('src="https://cloud.umami.is/script.js"')) {
  failures.push('external script URLs must remain outside the deployment base');
}

const chineseAgents = readFileSync(resolve(dist, 'zh/agents/index.html'), 'utf8');
if (!/<html lang="zh-CN" data-brand="agents"/u.test(chineseAgents)) {
  failures.push('the deployment base must be removed before locale and product-brand selection');
}
if (!chineseAgents.includes(`<link rel="canonical" href="${siteHref('/zh/agents')}">`)) {
  failures.push('localized canonical URLs must retain the configured site/base exactly once');
}

const blogPath = resolve(dist, 'blog/2026-06-introducing-awakenworks/index.html');
if (!readFileSync(blogPath, 'utf8').includes(`href="${withSiteBase('/docs/agents/get-started')}"`)) {
  failures.push('Markdown internal links must use the deployment base');
}

const searchIndex = JSON.parse(readFileSync(resolve(dist, 'docs/search-index.json'), 'utf8'));
if (!searchIndex.every((record) => withSiteBase(record.href) === record.href)) {
  failures.push('documentation search records must use the deployment base exactly once');
}

const sitemapFiles = filesBelow(dist, (path) => /sitemap-\d+\.xml$/u.test(path));
if (!sitemapFiles.length) failures.push('the Pages artifact must contain a generated sitemap');
const sitemap = sitemapFiles.map((path) => readFileSync(path, 'utf8')).join('\n');
for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)) {
  if (!match[1].startsWith(expectedCanonical)) {
    failures.push(`sitemap URL must use the configured site/base: ${match[1]}`);
  }
  if (siteBasePath !== '/' && match[1].includes(`${siteBasePath}${siteBasePath}`)) {
    failures.push(`sitemap URL contains the deployment base twice: ${match[1]}`);
  }
}
if (failures.length) {
  process.stderr.write(`${failures.join('\n')}\n`);
  // Let the output drain so a large audit preserves every failed link.
  process.exitCode = 1;
} else {
  process.stdout.write(`Pages base-path and fragment checks passed for ${htmlFiles.length} HTML files at ${siteHref('/')}\n`);
}
