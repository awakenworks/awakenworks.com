import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  attributionFormValues,
  captureAttribution,
  evolveAttribution,
} from '../src/lib/attribution.mjs';
import {
  buildCanaryPayload,
  checkAnalyticsLive,
  hasCanary,
} from './check-analytics-live.mjs';
import {
  brandMarkAssetStem,
  brandMarkBody,
  brandMarkPalette,
  brandMarkSchemes,
  publicBrandMarks,
  renderAdaptiveFaviconSvg,
  renderBrandMarkSvg,
} from '@awaken/ui/brand';

const root = resolve(import.meta.dirname, '..');
const failures = [];

function requireDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${message}; expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
  }
}

// Cause/effect design for the one session-scoped attribution authority:
// C1 no prior state; C2 a later page has no campaign; C3 a later campaign has
// only some UTM fields; C4 legacy flat state exists; C5 stored JSON is corrupt;
// C6 storage writes fail; C7 schema-shaped state has malformed touches. E1 capture first and last once; E2 keep both touches;
// E3 preserve first and replace last without leaking old UTM fields; E4 migrate
// one flat record without loss; E5 recover to valid schema; E6 page/form work.
// Decision table:
// | Rule | prior | incoming UTM | storage | Effect |
// | A1 | none | yes | works | first=last=incoming |
// | A2 | v2 | no | works | first/last unchanged |
// | A3 | v2 | yes | works | first unchanged, last replaced |
// | A4 | legacy | no | works | first=last=legacy |
// | A5 | corrupt | any | works | valid v2 fallback |
// | A6 | any | any | write fails | valid return, no page failure |
// | A7 | malformed v2 | any | works | valid current-page fallback |
const firstCampaign = evolveAttribution({}, 'https://awakenworks.com/?utm_source=x&utm_medium=social&utm_campaign=launch&utm_content=hero', 'https://x.com/');
const laterPage = evolveAttribution(firstCampaign, 'https://awakenworks.com/agents', 'https://awakenworks.com/');
const laterCampaign = evolveAttribution(laterPage, 'https://awakenworks.com/integrations?utm_source=hn&utm_campaign=integration', 'https://news.ycombinator.com/');
requireDeepEqual(laterPage, firstCampaign, 'A2 no-campaign navigation must not rewrite attribution');
requireDeepEqual(laterCampaign.first, firstCampaign.first, 'A3 later campaign must preserve first touch');
requireDeepEqual(
  laterCampaign.last,
  {
    landing_page: 'https://awakenworks.com/integrations?utm_source=hn&utm_campaign=integration',
    referrer: 'https://news.ycombinator.com/',
    utm_source: 'hn',
    utm_medium: '',
    utm_campaign: 'integration',
    utm_content: '',
  },
  'A3 later campaign must replace the complete last touch',
);
const legacy = evolveAttribution({ landing_page: 'https://awakenworks.com/old', referrer: 'https://example.com/', utm_source: 'legacy' }, 'https://awakenworks.com/agents');
requireDeepEqual(legacy.first, legacy.last, 'A4 legacy flat attribution must seed both touches');
const projected = attributionFormValues(laterCampaign);
if (projected.utm_source !== 'hn' || projected.first_utm_source !== 'x') failures.push('form projection must expose explicit last and first campaign fields');
let recoveredWrite = '';
const recovered = captureAttribution({
  storage: {
    getItem: () => '{bad json',
    setItem: (_key, value) => { recoveredWrite = value; },
  },
  href: 'https://awakenworks.com/',
});
if (recovered.schema !== 2 || !recoveredWrite) failures.push('A5 corrupt storage must recover to persisted schema v2');
const writeFailure = captureAttribution({
  storage: { getItem: () => '{}', setItem: () => { throw new Error('quota'); } },
  href: 'https://awakenworks.com/',
});
if (writeFailure.schema !== 2) failures.push('A6 storage write failure must still return valid attribution');
const malformedV2 = evolveAttribution({ schema: 2, first: 'bad', last: [] }, 'https://awakenworks.com/current');
if (malformedV2.first.landing_page !== 'https://awakenworks.com/current') failures.push('A7 malformed schema-shaped attribution must recover to the current page');

// Cause/effect design for the analytics data-plane release gate:
// C1 a release has a revision/run ID; C2 the query contains the exact event;
// C3 it contains another run/revision; C4 the response is malformed.
// E1 emit one anonymous bounded canary; E2 accept only the exact pair; E3/E4
// reject false positives. Decision table: exact -> pass; mismatch/malformed -> fail.
const canaryPayload = buildCanaryPayload({ websiteId: 'website', host: 'awakenworks.com', revision: 'abc123', runId: 'run-1' });
requireDeepEqual(Object.keys(canaryPayload.payload.data).sort(), ['kind', 'revision', 'run_id'], 'canary must contain only bounded deployment fields');
const canaryRows = { data: [{ eventName: 'analytics_canary', propertyKeys: ['revision', 'run_id'], propertyValues: ['abc123', 'run-1'] }] };
if (!hasCanary(canaryRows, 'run-1', 'abc123')) failures.push('exact analytics canary must pass');
if (hasCanary(canaryRows, 'run-2', 'abc123') || hasCanary({}, 'run-1', 'abc123')) failures.push('mismatched or malformed analytics canary must fail');
async function expectCanaryFailure(options, pattern, message) {
  try {
    await checkAnalyticsLive(options);
    failures.push(`${message}; expected failure`);
  } catch (error) {
    if (!pattern.test(error.message)) failures.push(`${message}; unexpected error: ${error.message}`);
  }
}
await expectCanaryFailure({ revision: 'abc123' }, /UMAMI_API_KEY is required/, 'missing analytics credential must fail before sending');
await expectCanaryFailure({ apiKey: 'secret' }, /AWAKENWORKS_EXPECTED_REVISION is required/, 'missing release revision must fail before sending');
let mockCalls = 0;
const observedCanary = await checkAnalyticsLive({
  apiKey: 'secret',
  websiteId: 'website',
  revision: 'abc123',
  runId: 'run-1',
  attempts: 2,
  intervalMs: 0,
  fetchImpl: async (url, options) => {
    mockCalls += 1;
    if (mockCalls === 1) {
      const body = JSON.parse(options.body);
      if (body.payload.data.run_id !== 'run-1' || !options.headers['User-Agent']) failures.push('canary send must carry exact run ID and user agent');
      return new Response('{}', { status: 200 });
    }
    if (!String(url).includes('/event-data-pivot?') || options.headers.Authorization !== 'Bearer secret') failures.push('canary query must use the pivot endpoint and bearer credential');
    return new Response(JSON.stringify(mockCalls === 2 ? { data: [] } : canaryRows), { status: 200 });
  },
});
if (observedCanary.attempt !== 2 || mockCalls !== 3) failures.push('delayed canary must retry and terminate on the exact observed event');
await expectCanaryFailure({
  apiKey: 'secret', revision: 'abc123', attempts: 1, intervalMs: 0,
  fetchImpl: async () => new Response('rejected', { status: 503 }),
}, /Umami canary send failed: status=503/, 'send rejection must remain distinguishable');
let exhaustionCalls = 0;
await expectCanaryFailure({
  apiKey: 'secret', revision: 'abc123', attempts: 1, intervalMs: 0,
  fetchImpl: async () => {
    exhaustionCalls += 1;
    return new Response(exhaustionCalls === 1 ? '{}' : JSON.stringify({ data: [] }), { status: 200 });
  },
}, /was not observable after 1 attempts/, 'unobserved canary must fail instead of reporting success');

function requireOrderedText(path, markers, message) {
  const text = readFileSync(path, 'utf8');
  let cursor = -1;
  for (const marker of markers) {
    const next = text.indexOf(marker, cursor + 1);
    if (next === -1 || next < cursor) {
      failures.push(`${path}: ${message}`);
      return;
    }
    cursor = next;
  }
}

function requirePattern(path, pattern, message) {
  if (!pattern.test(readFileSync(path, 'utf8'))) failures.push(`${path}: ${message}`);
}

function requireOccurrenceCount(path, marker, expected, message) {
  const actual = readFileSync(path, 'utf8').split(marker).length - 1;
  if (actual !== expected) {
    failures.push(`${path}: ${message}; expected ${expected}, found ${actual}`);
  }
}

function requireSectionOccurrenceCount(path, startMarker, endMarker, marker, expected, message) {
  const text = readFileSync(path, 'utf8');
  const start = text.indexOf(startMarker);
  const end = start === -1 ? -1 : text.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    failures.push(`${path}: ${message}; section boundary missing`);
    return;
  }
  const actual = text.slice(start, end).split(marker).length - 1;
  if (actual !== expected) failures.push(`${path}: ${message}; expected ${expected}, found ${actual}`);
}

function rejectPattern(path, pattern, message) {
  if (pattern.test(readFileSync(path, 'utf8'))) failures.push(`${path}: ${message}`);
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

// Cause/effect design for locale registration, UI copy ownership, and static
// parameterized routes:
// C1: a locale is added to routing but omitted from schema, SEO, path helpers,
//     or the language switch, creating a partially reachable language.
// C2: a component selects Chinese with `lang === 'zh'` or an `isZh` flag, so a
//     third language requires branching through presentation code.
// C3: a locale-specific `src/pages/zh` tree duplicates route behavior and can
//     drift from another locale while preserving the same public URL.
// C4: parameterized source routes build but emit the wrong HTML language,
//     OpenGraph locale, canonical path, or hreflang pair.
// C5: API-like documentation outputs are missed while HTML routes still pass.
// E1: one registry owns locale IDs, prefixes, HTML/OG/hreflang metadata and is
//     consumed by Astro routing, content schema, layout, and language switches.
// E2: components select one translation catalog entry without locale branches.
// E3: non-default pages are generated only by `[lang]` routes while `/zh/...`
//     remains byte-addressable in the static output.
// E4: representative marketing, content, docs, and docs-data routes exist in
//     both locale shapes with registry-derived SEO metadata.
// Decision table:
// | Rule | registry consumers | component branch | route owner | dist + SEO | Outcome |
// | L1   | all                | none             | [lang]      | correct    | accept  |
// | L2   | missing            | any              | any         | any        | reject  |
// | L3   | all                | present          | any         | any        | reject  |
// | L4   | all                | none             | zh tree     | any        | reject  |
// | L5   | all                | none             | [lang]      | missing/bad| reject  |
const localeRegistryPath = resolve(root, 'src/i18n/locales.ts');
for (const [path, pattern, message] of [
  [resolve(root, 'astro.config.mjs'), /DEFAULT_LANG[\s\S]*LANGS[\s\S]*localeRegistry/, 'Astro and sitemap configuration must derive from the locale registry'],
  [resolve(root, 'src/content.config.ts'), /import \{ LANGS \} from '.\/i18n\/locales'/, 'content language validation must derive from the locale registry'],
  [resolve(root, 'src/layouts/Base.astro'), /localeFromPath[\s\S]*localeRegistry[\s\S]*LANGS\.map/, 'SEO locale metadata must derive from the locale registry'],
  [resolve(root, 'src/components/SiteHeader.astro'), /LANGS[\s\S]*localeRegistry/, 'the company language switch must derive from the locale registry'],
  [resolve(root, 'src/components/DocsShell.astro'), /LANGS[\s\S]*localeRegistry/, 'the documentation language switch must derive from the locale registry'],
]) requirePattern(path, pattern, message);
requirePattern(localeRegistryPath, /DEFAULT_LANG[\s\S]*NON_DEFAULT_LANGS[\s\S]*localePath[\s\S]*localizedStaticPaths/, 'locale registry must own default, non-default, path, and static-route facts');
for (const path of filesBelow(resolve(root, 'src/components'), (candidate) => candidate.endsWith('.astro'))) {
  rejectPattern(path, /lang\s*===\s*['"]zh['"]|\bisZh(?:Document|Search)?\b/, 'component presentation must not branch on a specific locale');
}
if (existsSync(resolve(root, 'src/pages/zh'))) failures.push('src/pages/zh: locale-specific route tree must be replaced by parameterized routes');
for (const path of [
  'src/pages/[lang]/index.astro',
  'src/pages/[lang]/blog/[...slug].astro',
  'src/pages/[lang]/cases/[slug].astro',
  'src/pages/[lang]/integrations/index.astro',
  'src/pages/[lang]/docs/[...slug].astro',
  'src/pages/[lang]/docs/search-index.json.ts',
  'src/pages/[lang]/docs/llms.txt.ts',
]) {
  if (!existsSync(resolve(root, path))) failures.push(`${path}: missing parameterized locale route`);
}
for (const path of [
  'dist/index.html', 'dist/zh/index.html',
  'dist/agents/index.html', 'dist/zh/agents/index.html',
  'dist/blog/index.html', 'dist/zh/blog/index.html',
  'dist/docs/index.html', 'dist/zh/docs/index.html',
  'dist/docs/search-index.json', 'dist/zh/docs/search-index.json',
  'dist/docs/llms.txt', 'dist/zh/docs/llms.txt',
]) {
  if (!existsSync(resolve(root, path))) failures.push(`${path}: expected localized static output is missing`);
}
const englishAgents = resolve(root, 'dist/agents/index.html');
const chineseAgents = resolve(root, 'dist/zh/agents/index.html');
requirePattern(englishAgents, /<html lang="en"[\s\S]*<meta property="og:locale" content="en_US">/, 'English output must use registered HTML and OpenGraph locales');
requirePattern(chineseAgents, /<html lang="zh-CN"[\s\S]*<meta property="og:locale" content="zh_CN">/, 'Chinese output must use registered HTML and OpenGraph locales');
for (const path of [englishAgents, chineseAgents]) {
  requirePattern(path, /hreflang="en" href="https:\/\/awakenworks\.com\/agents"/, 'Agents output must retain the registered English alternate');
  requirePattern(path, /hreflang="zh-Hans" href="https:\/\/awakenworks\.com\/zh\/agents"/, 'Agents output must retain the registered Chinese alternate');
  requirePattern(path, /hreflang="x-default" href="https:\/\/awakenworks\.com\/agents"/, 'Agents output must retain the default-locale alternate');
}

// Cause/effect design for the responsive brand-mark family:
// C1: the site can render on a light or dark surface, so one fixed palette can
//     lose contrast even when the geometry is correct.
// C2: unrelated glyph construction can explain products beside labels but fail
//     to read as one family; one circular direction point and the original
//     filled-ribbon language must remain across the family.
// C3: copying paths into Header, Footer, Docs, favicon, and downloads creates
//     parallel geometry owners that drift after the next brand change.
// C4: a downloadable asset can be stale even when the Astro component renders
//     correctly unless both outputs are generated from the same source.
// C5: color and adjacent labels can disguise a generic icon; the bare geometry
//     must still read as A for Works/Agents, O for Objects, and W for Workforce.
// C6: maintaining two almost-identical A paths would make company and flagship
//     identity drift even though the intended public mark is exactly shared.
// C7: the shared A still needs a stable company/product lockup distinction;
//     primary hue separates context while violet keeps one judgment accent.
// E1: every public mark has exact on-dark and on-light assets with distinct
//     palettes, while theme-aware page use renders one matching variant.
// E2: every mark contains one shared circular direction-point primitive.
// E3: ProductMark is the only component renderer and generated files exactly
//     equal the canonical renderer output.
// E4: each canonical body declares the required mnemonic silhouette, and Works
//     and Agents resolve to exactly the same geometry.
// E5: Works and Agents use different primary hues but one shared accent in both
//     surface schemes.
// Decision table:
// | Rule | schemes | point | renderer | exact | mnemonic | shared A | distinct A hue | Outcome |
// | B1   | both    | one   | one      | yes   | correct  | yes      | yes            | accept  |
// | B2   | missing | any   | any      | any   | any      | any      | any            | reject  |
// | B3   | both    | bad   | any      | any   | any      | any      | any            | reject  |
// | B4   | both    | one   | many     | any   | any      | any      | any            | reject  |
// | B5   | both    | one   | one      | no    | any      | any      | any            | reject  |
// | B6   | both    | one   | one      | yes   | wrong    | any      | any            | reject  |
// | B7   | both    | one   | one      | yes   | correct  | no       | any            | reject  |
// | B8   | both    | one   | one      | yes   | correct  | yes      | no             | reject  |
const expectedSilhouettes = Object.freeze({
  works: 'A',
  agents: 'A',
  objects: 'O',
  workforce: 'W',
});
// Geometry construction invariants are tested by the package owner. This
// consumer verifies emitted assets and chrome against the pinned public API.
if (brandMarkBody('works') !== brandMarkBody('agents')) {
  failures.push('@awaken/ui/brand: AwakenWorks and Agents must share exactly one A geometry');
}
for (const scheme of brandMarkSchemes) {
  const worksPalette = brandMarkPalette('works', scheme);
  const agentsPalette = brandMarkPalette('agents', scheme);
  if (worksPalette.primary === agentsPalette.primary) {
    failures.push(`@awaken/ui/brand: AwakenWorks and Agents need distinct ${scheme} primary hues`);
  }
  if (worksPalette.decision !== agentsPalette.decision) {
    failures.push(`@awaken/ui/brand: AwakenWorks and Agents must share the ${scheme} judgment accent`);
  }
}
for (const mark of publicBrandMarks) {
  const body = brandMarkBody(mark);
  if ((body.match(/data-role="decision"/g) ?? []).length !== 1) {
    failures.push(`@awaken/ui/brand: ${mark} must contain one decision point`);
  }
  if (!body.includes(`data-silhouette="${expectedSilhouettes[mark]}"`)) {
    failures.push(`@awaken/ui/brand: ${mark} must retain its ${expectedSilhouettes[mark]} silhouette`);
  }
  for (const scheme of brandMarkSchemes) {
    const path = resolve(root, `public/brand/${brandMarkAssetStem(mark)}-${scheme}.svg`);
    if (readFileSync(path, 'utf8') !== renderBrandMarkSvg(mark, scheme)) {
      failures.push(`${path}: generated brand asset differs from canonical geometry or palette`);
    }
  }
}

if (readFileSync(resolve(root, 'public/favicon.svg'), 'utf8') !== renderAdaptiveFaviconSvg()) {
  failures.push('public/favicon.svg: adaptive favicon differs from the canonical AwakenWorks mark');
}

for (const path of [
  resolve(root, 'src/components/SiteHeader.astro'),
  resolve(root, 'src/components/SiteFooter.astro'),
  resolve(root, 'src/components/DocsShell.astro'),
]) {
  requirePattern(path, /<ProductMark product="works"/, 'shared chrome must render the canonical AwakenWorks mark');
  rejectPattern(path, /awmark-|M14\.2 6 H17\.8|linearGradient/, 'shared chrome must not copy brand geometry');
}
// M1 JS absent -> one SVG with package-owned OS palette; M2 JS preference ->
// the same SVG follows the appearance controller; M3 size class -> utilities
// still override package defaults. Browser tests cover all three effects.
const markSource = resolve(root, 'src/components/ProductMark.astro');
requireOccurrenceCount(markSource, '<svg', 1, 'each mark must render one SVG regardless of appearance');
requirePattern(markSource, /brandMarkPalette[\s\S]*aw-brand-mark[\s\S]*data-mark-scheme=\{scheme\}/, 'marks must reuse the package palette and adaptive rendering contract');
rejectPattern(markSource, /variants\.map|icon-when-dark|icon-when-light/, 'retired parallel mark variants must stay removed');
requirePattern(resolve(root, 'src/styles/global.css'), /@import '@awaken\/ui\/brand\/styles\.css' layer\(components\)/, 'package CSS must own adaptive marks while preserving utility sizes');
rejectPattern(resolve(root, 'src/styles/global.css'), /icon-when-dark|icon-when-light/, 'local visibility policy must not duplicate package appearance rules');
rejectPattern(resolve(root, 'README.md'), /Agents：开发者预览|Objects：开发者预览|Workforce：设计伙伴预览/, 'README must not duplicate registry-owned product availability labels');

// Theme integration decision table (runtime combinations live with the shared tests):
// T1 every route -> one prepaint shared controller and optional legacy migration.
// T2 product identity changes -> hue changes, no product-specific mode decision.
// T3 either shell -> same localized three-choice native projection, no local store.
const baseLayoutPath = resolve(root, 'src/layouts/Base.astro');
requirePattern(baseLayoutPath, /appearanceBootstrap\(\{ legacyStorageKeys: \['theme'\] \}\)/, 'all routes must initialize the shared appearance owner before paint');
rejectPattern(baseLayoutPath, /localStorage|matchMedia|data-theme-toggle/, 'the website must not retain a second appearance state owner');
requirePattern(resolve(root, 'src/styles/global.css'), /@awaken\/ui\/brand\/family\.css/, 'website colors and typography must map the shared family foundation');
// T4 every existing family-color utility must resolve a shared alias. Missing
// shades silently lose text/border styling, so inspect every Astro source rather
// than maintaining a second list of the six originally missing shades.
const familyStyles = readFileSync(resolve(root, 'src/styles/global.css'), 'utf8');
const mappedColors = new Set([...familyStyles.matchAll(/--color-([a-z]+-\d+)\s*:/g)].map((match) => match[1]));
for (const file of readdirSync(resolve(root, 'src'), { recursive: true }).filter((file) => file.endsWith('.astro'))) {
  const source = readFileSync(resolve(root, 'src', file), 'utf8');
  for (const match of source.matchAll(/\b(?:fog|ink|accent|iris|rust|bone)-\d+\b/g)) {
    if (!mappedColors.has(match[0])) failures.push(`${file}: unmapped family color ${match[0]}`);
  }
}
for (const shell of ['SiteHeader', 'DocsShell']) {
  requirePattern(resolve(root, `src/components/${shell}.astro`), /<AppearanceSelect lang=\{lang\}/, 'both shells must use the same localized appearance projection');
}
requirePattern(resolve(root, 'src/components/AppearanceSelect.astro'), /data-appearance-select[\s\S]*value="system"[\s\S]*value="light"[\s\S]*value="dark"/, 'appearance must expose system, light, and dark choices');

// Cause/effect design for shared navigation state:
// C1 the visitor can be at a route root; C2 can be on a product/docs subroute;
// C3 can switch locale; C4 desktop and mobile render the same logical links.
// E1 root and descendants identify one active owner; E2 aria-current exposes
// that state semantically; E3 locale switching does not alter the logical path;
// E4 no parallel navigation registry is introduced.
// Decision table: root or descendant -> one active link; unrelated route -> no
// false active link; locale change -> same logical route in the other locale.
const siteHeaderPath = resolve(root, 'src/components/SiteHeader.astro');
requirePattern(siteHeaderPath, /const isActive = \(candidate: string\)[\s\S]*path\.startsWith/, 'shared navigation must derive root and descendant state from the logical path');
requireOccurrenceCount(siteHeaderPath, 'aria-current=', 4, 'grouped desktop and mobile navigation must expose semantic active state from the same product and resource registries');

// Cause-effect design for the company-to-two-product positioning journey:
// C1: the visitor enters through English or Chinese and may land on the company
//     home or directly on Agents, Objects, or Workforce.
// C2: the company home and product page can duplicate or contradict category
//     ownership unless each product has one name, one route, and one boundary.
// C3: an evaluator may already use the official Anthropic SDK and needs the
//     base URL, authentication, beta-header, compatibility, and difference
//     boundaries stated without a false drop-in or cloud-only claim.
// C4: JavaScript may be unavailable, so positioning, proof, and conversion must
//     remain server-rendered.
// C5: the registries expose different maturity levels; evaluation must not imply
//     packaged access, and each reference case still needs evidence ownership.
// C6: implementation vocabulary can leak into product naming and make Harness or
//     Platform appear beside Agents, or Flow appear beside Workforce.
// C7: a visitor can arrive with business-cooperation intent or independent
//     developer-evaluation intent; collapsing both into Quickstart loses the
//     cooperation path, while collapsing both into a contact form breaks the
//     open-source adoption path.
// C8: an enterprise form can submit with or without JavaScript and may arrive
//     through a campaign; opportunity intent, source, UTM fields, and explicit
//     contact consent must survive without creating a second CRM authority.
// C9: public price, budget, qualification, or contract mechanics expose internal
//     sales strategy and can be mistaken for a mature service catalog; reference
//     implementations can still be mistaken for customer evidence.
// C10: enterprise conversion, evaluation, and privacy paths must remain available
//      in both locales and in the server-rendered mobile navigation.
// C11: company, product, enterprise, evidence, documentation, principles, and
//      editorial pages serve different audiences; one vocabulary layer across
//      all pages either hides the product value or leaks implementation detail.
// C12: generic pain statements do not let a buyer recognize an application
//      scenario or understand what changes for the team using the product.
// C13: self-hosted, Pro, and Cloud change operating responsibility but must not
//      become three competing product authorities or imply unverified GA/SLA.
// C14: GitHub awareness is a developer conversion distinct from independent
//      evaluation and enterprise intent; Star exits must reach the canonical
//      Awaken repository and remain measurable by placement.
// C15: build-time use cases can overstate calendar repository intervals as
//      person-hours, full parity, customer evidence, or repeatable delivery.
// C16: a shallow competitor list can look comprehensive while contributing no
//      editorial decision; every page class needs five official comparisons,
//      one synthesized language rule, and one explicit remaining evidence gap.
// C17: a universal GitHub path can become unmeasurable or multiply repository
//      literals; header, mobile, footer, and page-specific exits must share the
//      canonical URL and identify their placement.
// C18: a product-specific qualification form makes Workforce maintain a second
//      cooperation path and asks for application details on a product page.
// C19: an announcement can name the product without explaining why its boundary
//      exists, how work moves through it, or how a reader can disprove the claim.
// C20: an internal evidence gate can leak into the public voice, forcing every
//      scenario to sound like an audit even when the reader only needs a safe
//      first action and a truthful maturity note.
// C21: procurement, pricing, and qualification terminology can make the business
//      page read like an internal deal review before the visitor understands
//      where cooperation helps, responsibility boundaries, and the next action.
// C22: reference-build evidence can precede the product task, forcing builders
//      to decode evidence levels before they know which path is relevant.
// C23: a principles page can describe trust as an implementation proof instead
//      of telling readers what AwakenWorks commits to do and how to participate.
// C24: a small engineering archive can imitate a newsroom or omit the author,
//      leaving readers unable to understand its scope or provenance.
// C25: a docs hub can lead with internal ownership vocabulary before readers
//      have selected the task, product, and responsibility in front of them.
// C26: a Runtime page can expose primitives without saying when a maintainer
//      should enter that layer or when ordinary product docs are the right path.
// C27: a compact privacy notice can blur website data with customer-operated
//      product data, or name processors without a usable data-request action.
// C28: the documentation header's product, search, theme, and locale controls
//      can exceed a 390px viewport when desktop spacing is kept on mobile.
// C29: three equally weighted product cards in the opening viewport can hide
//      the complete-outcome hierarchy and ask readers to decode names first.
// C30: developer evaluation and business-outcome validation are different
//      intents; one generic primary action loses one of the two GTM paths.
// C31: putting product detail before the outcome loop makes implementation
//      nouns arrive before the recognizable job and its accepted finish line.
// C32: a vendor-specific compatibility claim on the company home can make the
//      whole portfolio look subordinate to one Agents integration.
// C33: work stages, scenarios, and reference builds can repeat setup and test
//      instructions until the company home reads like an evaluation checklist.
// C34: an illustrative dashboard or old screenshot can imply current product
//      behavior, adoption, or metrics that the two-product portfolio does not
//      actually establish.
// C35: product previews can still look like measured live instances when they use
//      invented counts, customer names, or unlabeled example records.
// C36: unequal product-page depth can leave one product as a concept note while
//      another repeats the same architecture and capability claims several times.
// E1: company home names both public products and gives each one canonical path
//     without recreating their technical documentation.
// E2: Agents owns the Managed Agents-compatible category, official-SDK
//     on-ramp, customer-operated boundary, and canonical compatibility exit.
// E3: comparison copy acknowledges Anthropic's self-hosted environment worker
//     while distinguishing the Awaken control plane and persistence boundary.
// E4: both locales preserve equivalent structure and work without hydration.
// E5: both public products show explicit maturity without inventing releases.
// E6: Harness and Platform appear only as technical layers inside Agents; Flow
//     remains an internal source and engine term behind Workforce.
// E7: company entry presents distinct business-cooperation and independent
//     Awaken evaluation exits; the product page preserves both after proof.
// E8: one shared opportunity form carries context and attribution fields,
//     posts normally without JavaScript, and progressively records funnel events.
// E9: public pages contain no prices, budget fields, qualification mechanics, or
//     contract shorthand; reference builds remain separate from customer proof.
// E10: privacy names the active processors and the mobile menu exposes the same
//      enterprise/evaluation routes without relying on hydration.
// E11: each page template states and follows its audience/language responsibility;
//      technical implementation remains in product/docs while company and buyer
//      outcomes remain in home/enterprise.
// E12: home contains three bounded scenarios, each with an audience, recognizable
//      problem, and useful change, without relabeling them as customer deployments.
// E13: one shared delivery-mode fact map feeds technical and buyer views; the
//      architecture owner states that Pro/Cloud compose rather than duplicate.
// E14: home, product, docs, principles, and blog offer a canonical measurable
//      GitHub Star path without replacing their primary intent.
// E15: the Pilot and Design build logs disclose exact repository timestamps,
//      define the comparison term, preserve evidence limits, and route to cases,
//      architecture, quickstart, and GitHub.
// E16: the canonical benchmark owner contains exactly five official references
//      for every page class plus the calm-authority language contract.
// E17: every public template inherits measurable header/mobile/footer Star exits;
//      page-specific exits remain independently attributable.
// E18: Workforce explains responsibility, proof, and limits, then routes commercial
//      intent to the one shared business-cooperation page without embedding a form.
// E19: the introduction states the application/platform ownership split, shows
//      the execution and recovery sequence, and ends in a reproducible check.
// E20: scenario cards expose one recognizable situation through stable markup;
//      evaluation instructions and maturity detail stay on product or case pages.
// E21: business visitors move from desired change through three cooperation
//      areas, operating choice, a short process, and the single shared form.
// E22: case visitors choose a product shape, see the first useful result, try the
//      smallest path, then inspect current availability and limitations.
// E23: principles move from the work owner through three operating commitments,
//      current maturity, and direct participation paths in both languages.
// E24: the blog states its build-derived scope, shows author and date, and routes
//      technical depth to Docs while keeping GitHub as a separate community exit.
// E25: the docs hub asks for the reader's task first, then routes by product and
//      responsibility without exposing its internal content-governance process.
// E26: Runtime tells configuration-only readers to stay in Awaken docs and gives
//      advanced maintainers a causal path from portable behavior to Step commit.
// E27: privacy separates site scope, submitted information, analytics, purpose,
//      processors, retention, and contact, with a working mail action.
// E28: documentation controls use compact mobile spacing and restore the wider
//      rhythm from the small breakpoint onward.
// E29: the result-led hero is followed by one four-phase Workforce outcome loop;
//      product detail comes only after intent, scenarios, and reference evidence.
// E30: the opening and closing actions preserve independent Agents evaluation
//      and one-real-job validation as separately measurable paths.
// E31: product cards retain one canonical route and visible role, with Workforce
//      first and visually above Agents and Objects without inventing Workflow as
//      a fourth product.
// E32: the company home speaks about the open foundation, customer-controlled
//      operation, human decisions, and durable history; detailed compatibility
//      remains owned by Agents and its compatibility documentation.
// E33: one visual work path explains causality, scenario cards describe useful
//      situations, and compact reference cards link to evidence without copying
//      test or reproduction instructions into the company narrative.
// E34: the work path is server-rendered from canonical product copy and marks;
//      it contains no invented dashboard values, customer logos, or adoption data.
// E35: each product preview is explicitly example content, uses implementation-owned
//      state semantics, and contains no invented operational metric.
// E36: Agents, Objects, and Workforce each expose a task, one product view, a causal
//      mechanism, an honest boundary, and a next action without duplicating ownership.
// C37: a public validation offer can become vague consulting unless duration,
//      scope, measures, exception coverage, external terminal state, and acceptor
//      are stated together; publishing price or contract terms creates a catalog.
// C38: Workflow can be mistaken for a fourth product unless its ownership inside
//      Workforce is explicit in both the narrative and rendered loop.
// C39: a ten-logo competitor list can look complete while hiding the actual
//      content and voice decisions AwakenWorks must adopt or reject.
// E37: enterprise owns one 4–6 week paid, fixed-scope validation with one job,
//      one integration, 2–4 measures, human decision, exception recovery,
//      external terminal result, and named acceptance boundary.
// E38: the loop renders Workflow as the declare phase under Workforce, Objects as
//      grounding, Agents as execution, and Workforce as final acceptance.
// E39: the benchmark authority names exactly ten official product pages and
//      records AwakenWorks content strengths, weaknesses, voice advantage, and debt.
// C40: the website can present future Objects/Workforce value as if it were the
//      currently available product, obscuring the verified Agents buying decision.
// C41: recovery, events, Workers, and Sandboxes can be promoted as customer value
//      even though they are mechanisms supporting launch, enterprise deployment,
//      reusable product infrastructure, and repeatable custom delivery.
// C42: vertical outcome examples can imply packaged Workforce behavior or customer
//      results that the current Agents product does not own.
// C43: generic consulting copy can hide what a bounded Agents implementation
//      actually connects, tests, hands over, and leaves for a later SOW.
// C44: adding new adoption cards can create a second scenario catalog or form path.
// C45: product and enterprise pages can drift apart on the mature-product boundary.
// E40: Agents owns the hero, primary product card, and three current adoption paths;
//      Workforce capabilities retain explicit early-preview availability.
// E41: four customer-value claims lead with launch, enterprise deployment, platform
//      reuse, and repeatable delivery; mechanism detail stays in supporting text.
// E42: the three adoption paths are product team, enterprise private Agent, and
//      solution delivery; each states customer input, Awaken responsibility,
//      retained ownership, first result, and a verification focus.
// E43: enterprise shows one four-step Agents implementation and five review checks
//      before the existing fixed boundary, process, package, delivery modes, and form.
// E44: scenario context continues through the one derived allowlist and one shared
//      opportunity form; no parallel form or scenario registry is introduced.
// E45: Agents landing and enterprise both state the current product boundary while
//      preserving exact compatibility and maturity evidence.
// C46: SDK, architecture, deployment, and Runtime detail can make the product
//      page ask several implementation decisions before the reader chooses Agents.
// C47: summarizing those guides on the landing page creates a second technical
//      owner that drifts from compatibility, architecture, self-hosting, and Runtime Docs.
// C48: Workforce capability visitors can inherit the current Agents
//      implementation promise when Enterprise uses one long middle narrative.
// C49: three separate forms or enterprise pages would fix copy continuity by
//      creating competing intake, attribution, and maturity authorities.
// E46: Agents moves from promise through first run, outcomes, differentiation,
//      and product evidence, then exposes four exact Docs-owned decisions.
// E47: the landing contains no SDK sample, architecture map, deployment matrix,
//      or Runtime explainer; each is linked to its existing canonical owner.
// E48: Enterprise gives each product one input, decision, and maturity boundary
//      before one shared process and one shared opportunity form.
// E49: product-specific continuity uses stable anchors and the existing allowlisted
//      product query; it does not introduce a second page, form, or schema.
// Constraint: compatibility.md remains the only detailed compatibility owner;
// landing pages link to it rather than introducing another route/resource map.
// Decision table:
// | Rule | Entry | Locale | Managed intent | Portfolio | Outcome |
// | R1 | company | en/zh | unknown | current | company value -> two products |
// | R2 | Agents | en/zh | new build | current | quickstart + ownership boundary |
// | R3 | Agents | en/zh | SDK migration | current | SDK on-ramp -> matrix |
// | R4 | any | any | any | legacy public name | reject |
// | R5 | product | any | any | current | reject stale cloud-only/drop-in claim |
// | R6 | runtime internals | en/zh | advanced | current | Awaken identity -> Harness implementation |
// | R7 | company | en/zh | cooperation | current | business page -> shared contact form |
// | R8 | company/product | en/zh | developer | current | product -> compatibility/quickstart |
// | R9 | cooperation form | en/zh | campaign | current | attribution + consent -> one endpoint |
// | R10 | enterprise | en/zh | unqualified | current | disclose boundary -> self-service path |
// | R11 | company | en/zh | scenario recognition | current | audience + constraint + useful change |
// | R12 | product | en/zh | architecture/deployment | current | four contexts + one path + shared modes |
// | R13 | business | en/zh | operating responsibility | current | buyer-language modes -> cooperation |
// | R14 | developer content | en/zh | community | current | canonical repository + measurable Star |
// | R15 | build log | en/zh | time claim | current | repository interval + explicit non-claims |
// | R16 | benchmark owner | n/a | editorial review | current | five official sources + decision + gap |
// | R17 | any public template | en/zh | community | current | canonical Star URL + placement |
// | R18 | Workforce direct link | en/zh | cooperation | current | product boundary -> business page |
// | R19 | introduction | en/zh | product context | current | boundary -> sequence -> self-verification |
// | R20 | company | en/zh | scenario selection | current | situation -> product or reference path |
// | R21 | business | en/zh | cooperation | current | shared work -> operating boundary -> conversation -> form |
// | R22 | reference build | en/zh | product-shape match | current | result -> boundary -> trial -> status -> docs |
// | R23 | principles | en/zh | understand commitments | current | owner -> choices -> status -> participate |
// | R24 | blog index | en/zh | choose a question | current | scope -> author/date -> article -> docs/source |
// | R25 | docs index | en/zh | complete a task | current | task -> product -> responsibility path |
// | R26 | runtime internals | en/zh | extend the loop | current | applicability -> behavior -> capability -> commit |
// | R27 | privacy | en/zh | understand site data | current | scope -> data -> purpose -> processor -> request |
// | R28 | docs header | en/zh | 390px viewport | current | compact controls without horizontal overflow |
// | R29 | product portfolio | en/zh | choose a product | current | Agents first; Objects/Workforce labelled early direction |
// | R30 | company | en/zh | first viewport | current | product launch value -> self-service or enterprise deployment |
// | R31 | company | en/zh | understand system | current | buyer value -> adoption path -> implementation evidence |
// | R32 | company | en/zh | product choice | current | later product name + visible role -> canonical route |
// | R33 | company | en/zh | scenario recognition | current | situation and benefit -> compact reference build |
// | R34 | company | en/zh | trust | current | current open-source fact + no invented product evidence |
// | R35 | product preview | en/zh | understand product | current | labelled example + code-owned state semantics |
// | R36 | product | en/zh | choose next action | current | task -> view -> mechanism -> boundary -> docs/cooperation |
// | R37 | enterprise | en/zh | implement one app | current | app contract -> inputs -> placement -> failure exercise -> decide |
// | R38 | company/workforce | en/zh | understand Workflow | current | Workforce-owned definition, never fourth product |
// | R39 | benchmark owner | n/a | portfolio voice | current | ten official pages -> strengths/debts -> editorial decision |
// | R40 | company hero | en/zh | choose intent | current | exactly two conversion choices |
// | R41 | company value | en/zh | understand difference | current | continuity + control + reuse -> owning product evidence |
// | R42 | company home | en/zh | recognize primary audience | current | product-team promise + workflow proof; secondary ICP detail remains off-home |
// | R43 | enterprise | en/zh | understand purchase | current | concrete implementation -> scope -> outputs -> delivery -> form |
// | R44 | cooperation form | en/zh | submitted | current | review sequence + one-business-day boundary |
// | R45 | enterprise | en/zh | custom delivery | current | reusable products + bounded service SOW |
// | R46 | Agents | en/zh | first visit | current | value -> differentiation -> evidence -> evaluation |
// | R47 | Agents | en/zh | SDK migration | current | compact baseline -> canonical compatibility page |
// | R48 | Agents/enterprise | en/zh | choose operations | current | one shared structured delivery renderer |
// | R49 | Agents | en/zh | exact API question | current | no local matrix -> documentation authority |
// | R50 | company entity | en/zh | classify provider | current | AwakenWorks company -> Awaken Agents current product |
// | R51 | Agents | en/zh | assess operating fit | current | fit -> first run -> owners -> lifecycle/failure -> evidence |
const rules = [
  {
    path: resolve(root, 'dist/index.html'),
    primary: 'Business teams: see the workflow',
    primaryHref: '#workforce-preview',
    secondary: 'Developer quickstart',
    secondaryHref: '/docs/agents/get-started',
    agentsHref: '/docs/agents/get-started',
    casePrefix: '/cases/',
    releaseStatus: 'Source available · pre-release',
    speedPromise: 'Make AI part of',
    speedHighlight: 'enterprise production.',
    primaryAudience: 'People keep important decisions',
    entityDefinition: 'Business teams use Workforce',
  },
  {
    path: resolve(root, 'dist/zh/index.html'),
    primary: '业务团队：看工作流程',
    primaryHref: '#workforce-preview',
    secondary: '开发者开始使用',
    secondaryHref: '/zh/docs/agents/get-started',
    agentsHref: '/zh/docs/agents/get-started',
    casePrefix: '/zh/cases/',
    releaseStatus: '源码可评估 · 尚无稳定发布包',
    speedPromise: '让 AI 成为',
    speedHighlight: '受控的生产力。',
    primaryAudience: '重要决定由人掌握',
    entityDefinition: '业务团队用 Workforce',
  },
];

// Company-home cause/effect graph: C1 business owner; C2 developer; C3 proof
// seeker; C4 en/zh; C5 module mistaken for independently available product.
// E1 company value -> two product purposes -> labelled illustration -> contact;
// E2 business intent previews the work then reaches the existing enterprise form; E3 developer intent
// reaches canonical Quickstart; E4 registry-owned availability stays explicit;
// E5 reference evidence cannot become a customer outcome.
// Decision rules: H1 C1 -> E1+E2+E4; H2 C2 -> E1+E3+E4; H3 C3 -> E5;
// H4 every rule x C4 -> localized equivalent; H5 C5 -> reject third product.
// UX decision table: U1 first-time reader -> concise promise, product purposes, then the labelled business example;
// U2 identity -> canonical JSON-LD/footer, no repeated hero slogan; U3 business
// request -> three required controls, bounded optional detail in one disclosure;
// U4 deployment -> three delivery modes, still exactly two public products.
// Browser tests prove pixel bounds, semantic wrapping, native dismissal, draft
// continuity, blocked storage, and transport outcomes; source checks preserve
// the single renderer/catalog/endpoint and honest qualification boundaries.
for (const rule of rules) {
  requireOrderedText(rule.path, [
    'id="home-hero"',
    'id="home-products"',
    'id="workforce-preview"',
    'id="home-cases"',
    'id="home-cta"',
  ], 'home must move from the primary promise through product purposes, the shared example, references, and contact');
  requirePattern(
    rule.path,
    new RegExp(`href="${rule.primaryHref}"[^>]*>${rule.primary}`),
    'home business action must reach the shared illustrative workflow',
  );
  requirePattern(
    rule.path,
    new RegExp(`href="${rule.secondaryHref}"[^>]*>${rule.secondary}`),
    'home developer action must reach the localized quickstart',
  );
  requireOccurrenceCount(rule.path, '<h1', 1, 'home must have one primary heading');
  requireOccurrenceCount(rule.path, 'data-home-title-highlight', 1, 'home hero must highlight one part of its company promise');
  requirePattern(
    rule.path,
    new RegExp(`data-home-production-promise[\\s\\S]*${rule.speedPromise}[\\s\\S]*data-home-title-highlight[\\s\\S]*${rule.speedHighlight}`),
    'home hero must render the localized company-value promise and highlight',
  );
  requireSectionOccurrenceCount(rule.path, 'id="home-hero"', '</section>', '<a ', 2, 'home hero must expose exactly the two intent actions');
  requireOccurrenceCount(rule.path, 'data-home-entity-definition', 1, 'home hero must expose one canonical product definition');
  requirePattern(rule.path, new RegExp(`data-home-entity-definition[\\s\\S]*${rule.entityDefinition}`), 'home hero must make the Agents category directly quotable');
  requirePattern(rule.path, new RegExp(rule.primaryAudience), 'home must state that people retain important decisions');
  requirePattern(rule.path, new RegExp(`data-product-access[\\s\\S]*${rule.releaseStatus}`), 'early product choices must disclose registry-owned access');
  for (const product of ['agents', 'workforce']) {
    requireOccurrenceCount(rule.path, `data-awaken-event="home-${product}-details"`, 1, `home must expose one ${product} product path`);
  }
  requireOccurrenceCount(rule.path, 'data-home-work-step=', 0, 'home must not present the Workforce outcome loop as current Agents value');
  // C-Read1 business/developer -> two early catalog-owned purposes, no third
  // adoption chooser; C-Read2 the same story already owns facts/approval/result
  // -> no repeated value section. Width and JS cases live in the browser tests.
  rejectPattern(rule.path, /id="home-adoption"|id="home-value"|data-home-adoption=|data-home-value=/, 'retired overlapping home sections must stay removed');
  requireOccurrenceCount(rule.path, 'data-product-role', 2, 'every product card must retain one visible role');
  requireOccurrenceCount(rule.path, 'data-awaken-event-location="home-hero"', 2, 'both existing home hero intents must identify their placement without adding a third action');
  requireOccurrenceCount(rule.path, 'data-awaken-event-location="home-closing"', 2, 'both existing closing intents must identify their placement without adding another action');
  requireOccurrenceCount(rule.path, 'data-awaken-event-location="header"', 2, 'desktop GitHub and Quickstart exits must identify their placement');
  requireOccurrenceCount(rule.path, 'data-awaken-event-location="mobile-menu"', 2, 'mobile GitHub and Quickstart exits must identify their placement');
  requireOccurrenceCount(rule.path, 'data-awaken-event-location="footer"', 1, 'footer Star exit must identify its placement');
  requireOccurrenceCount(rule.path, 'data-scenario-card', 0, 'home must not restore the old detailed scenario-card implementation');
  // H-R1 business reader -> one explicitly fictional refund path; H-R2
  // developer -> the existing Agents owner, not a second setup flow on Home.
  // All four stages and three completion records render without hydration.
  requireOccurrenceCount(rule.path, 'data-workforce-refund-example', 1, 'home must show the selected refund example once');
  requireOccurrenceCount(rule.path, 'data-preview-kind="illustration"', 1, 'home must disclose the example kind');
  requireOccurrenceCount(rule.path, 'data-workforce-stage', 4, 'home must reuse the four canonical refund stages');
  requireOccurrenceCount(rule.path, 'data-refund-result-record', 3, 'home must explain refund, notification and closure evidence');
  rejectPattern(rule.path, /data-home-compatibility-proof|data-home-workflow-step|data-home-runtime-concept/, 'home must not retain the retired developer setup projection');
  requirePattern(rule.path, new RegExp(`href="${rule.agentsHref}"`), 'closing developer action must reach the localized task-first Agents entry');
  rejectPattern(rule.path, /A demo proves possibility|演示证明可能|First evidence:|第一项证据：|Choose your next proof|选择下一份证据/, 'company-page voice must lead with reader action instead of internal proof language');
  rejectPattern(rule.path, /Start here:|可以先做：/, 'company home must not copy test or evaluation instructions into scenarios');
  rejectPattern(rule.path, /Managed Agents compatible|Managed Agents 兼容/, 'company trust signals must not let one Agents compatibility define the portfolio');
  rejectPattern(rule.path, /budget path|预算路径|RMB \d|目标 ¥|signed SOW|签署的 SOW/i, 'home must not expose price, budget, or contract qualification strategy');
  for (const slug of ['pilot', 'deepseek-harness', 'design']) {
    requireOccurrenceCount(rule.path, `data-case-card="${slug}"`, 1, `home must show the ${slug} case exactly once`);
    requirePattern(rule.path, new RegExp(`href="${rule.casePrefix}${slug}"`), `${slug} must lead to its localized case page`);
  }
  requireOccurrenceCount(rule.path, 'data-home-case-boundary', 1, 'home reference builds must retain one explicit non-customer evidence boundary');
  rejectPattern(rule.path, /Awaken Flow|Oversight/, 'home must expose only the Agents, Objects, and Workforce product names');
  requireOccurrenceCount(rule.path, '<astro-island', 0, 'home proof must remain available without client hydration');
  requirePattern(rule.path, new RegExp(rule.releaseStatus.replaceAll('.', '\\.')), 'home must render the registry-owned product maturity');
  requireOccurrenceCount(rule.path, 'data-awaken-event="footer-youtube"', 1, 'footer video exit must be measurable');
  rejectPattern(rule.path, /fonts\.googleapis\.com|fonts\.gstatic\.com/, 'public entry must not depend on third-party font delivery');
  rejectPattern(rule.path, /Download Awaken 1\.0|下载 Awaken 1\.0/, 'pre-release Agents must not claim a stable download');
}

const homeSourcePath = resolve(root, 'src/components/Home.astro');
// A1-A4: production HTML uses one declared click owner, and the SDK does not
// own navigation timing. Browser fault injection covers missing/rejected/hung
// collectors without suppressing the real application action.
for (const path of [resolve(root, 'dist/index.html'), resolve(root, 'dist/zh/index.html')]) {
  rejectPattern(path, /data-umami-event/, 'retired SDK click attributes must not duplicate the layout dispatcher');
}

requirePattern(resolve(root, 'src/layouts/Base.astro'), /import \{ captureAttribution \} from '\.\.\/lib\/attribution\.mjs'[\s\S]*captureAttribution\(\)/, 'the shared layout must capture attribution through the canonical module');
requireOrderedText(homeSourcePath, ['id="home-hero"', 'id="home-products"', '<ProductShowcase', 'id="home-cases"'], 'source must show the existing product catalog before the shared example and references');
rejectPattern(homeSourcePath, /id="home-work"|id="home-paths"|id="home-scenarios"|data-scenario-card/, 'source must not restore overlapping homepage choosers');
requireOccurrenceCount(homeSourcePath, 'data-awaken-event-location="home-hero"', 2, 'home source must measure the existing two hero intents without adding another action');
requireOccurrenceCount(homeSourcePath, 'data-awaken-event-location="home-closing"', 2, 'home source must measure the existing two closing intents without adding another action');
// Responsive promise graph: C1 company value changes; C2 either locale;
// C3 long text at narrow/desktop widths; C4 an unverified speed or ROI claim.
// E1 literal value and both product uses remain visible; E2 browser wraps text;
// E3 application/domain ownership remains in its existing owner; E4 reject C4.
// R1 C1+C2+C3 -> E1+E2+E3; R2 C4 -> reject regardless of viewport.
requirePattern(homeSourcePath, /data-home-production-promise[\s\S]*home-display-title-line[\s\S]*data-home-title-highlight/, 'home must render one company promise with one highlighted phrase');
requirePattern(homeSourcePath, /@media \(min-width: 1024px\)[\s\S]*\.home-display-title-line[\s\S]*white-space: normal/, 'home company promise must allow natural desktop wrapping');
rejectPattern(homeSourcePath, /home\.hero\.title\.map/, 'home must not force editorial line breaks into the speed promise');
const contentSourcePath = resolve(root, 'src/i18n/content.ts');
requirePattern(contentSourcePath, /title: 'Make AI part of',[\s\S]*titleHighlight: 'enterprise production\.'[\s\S]*title: '让 AI 成为',[\s\S]*titleHighlight: '受控的生产力。'/, 'both locales must lead with company value and one highlight');
rejectPattern(contentSourcePath, /titleHighlight: '(?:much|far) faster|titleHighlight: '快得多/, 'home speed promise must not imply an unverified magnitude');
requirePattern(contentSourcePath, /Business teams use Workforce[\s\S]*Developers use Agents to build and run AI applications[\s\S]*业务团队用 Workforce[\s\S]*开发团队用 Agents 构建和运行 AI 应用/, 'both locales must explain Agents and Workforce uses in one supporting-copy owner');
requirePattern(contentSourcePath, /application owns its product experience|应用负责产品体验、领域状态、工作流、结果验收和商业关系/, 'both locales must preserve the application ownership boundary');
rejectPattern(contentSourcePath, /Ship Agent applications without rebuilding the platform underneath|交付 Agent 应用，不必重建下层平台|Ship your working Agent as an application customers can keep using|把能运行的 Agent，交付成客户可以持续使用的应用|Your Agent already works\. Now ship the application|Agent 已经能运行，现在把应用交付出去/, 'homepage copy must not retain the weaker infrastructure contrast, require an existing working Agent, or imply unverified continued customer use');
rejectPattern(contentSourcePath, /without becoming an Agent infrastructure team|不必把团队变成 Agent 基础设施团队|The form is shared\. The promise is not\.|入口可以共用，承诺不能混用|Managed-compatible\. Awaken-enhanced\./, 'core pages must use literal product language instead of rhetorical contrast or slogans');
rejectPattern(contentSourcePath, /—/, 'site copy must use plain punctuation instead of decorative em dashes');
requirePattern(contentSourcePath, /export const canonicalEntities[\s\S]*AwakenWorks makes AI a governed part of enterprise production\.[\s\S]*Awaken Agents is open-source, self-hostable infrastructure designed for building and operating production AI Agent applications\.[\s\S]*Awaken Runtime is the Rust execution core inside Awaken Agents\./, 'one catalog must own the company, product, and runtime entity definitions');
rejectPattern(contentSourcePath, /pages:\s*\{[\s\S]*awaken:/, 'the retired hidden Awaken page copy must not compete with canonical entity definitions');
rejectPattern(contentSourcePath, /Turn an Agent prototype into a shippable, operable, reusable product|让 Agent 原型，变成可交付、可运营、可复用的产品|Make Agents shippable, operable, and reusable|让 Agent 可交付、可运营、可复用/, 'result headlines must not regress to lifecycle adjectives');
requirePattern(contentSourcePath, /Current access is shown in the product choices[\s\S]*当前访问方式见产品说明/, 'both locales must separate Workforce product placement from available scope');
requirePattern(contentSourcePath, /proofLabel: 'What this changes'[\s\S]*proofLabel: '这意味着'/, 'Agents comparison must connect each capability to its consequence in both locales');
rejectPattern(contentSourcePath, /REFERENCE ACCOUNT|REPLACE WITH|本页故意|客户需要纠正|外发前确认|受控外发|【\s*】/, 'public content must not expose editor prompts, distribution reminders, or visible placeholders');
rejectPattern(contentSourcePath, /Customer result|客户得到/, 'public comparison copy must not address the reader with an internal third-person sales label');
rejectPattern(homeSourcePath, /home-display-title-zh[\s\S]{0,120}white-space: normal/, 'the longer Chinese result promise must wrap naturally instead of overflowing');

// Cause/effect design for Agents fit, authority, recovery, and product proof:
// C1: a visitor owns an application but may start from a job, compatible Agent,
//     or existing behavior; C2: a one-off script may not need this platform;
// C3: Control, Coordinator, Worker, and embedded Runtime can be mistaken for
//     competing owners; C4: permission, Worker interruption, or ambiguous
//     external execution changes the legal recovery outcome; C5: full Agents
//     pages need verified captures while home needs one compact capture;
// C6: JavaScript may be absent, reduced motion requested, or keyboard close
//     required; C7: one Quickstart href can drift across placements; C8: the
//     official-SDK migration route can be buried below architecture detail.
// E1: four fit conditions and one non-fit boundary precede evaluation; E2: one
//     three-owner static view and six-step dynamic path preserve the source
//     authority direction; E3: three failure rules keep awaiting, reclaim, and
//     indeterminate outcomes distinct; E4: five reliability consequences link
//     to their Docs owners; E5: compact/full proof reuses one renderer and stays
//     visible without hydration; E6: native dialog and reduced-motion behavior
//     remain intact; E7: one CTA object owns its label and href; E8: one early,
//     bounded compatibility entry links to the canonical matrix.
// Decision table:
// | Rule | durable/controlled need | authority path | terminal outcome | proof | Outcome |
// | A1   | yes                     | single         | explicit         | linked| accept  |
// | A2   | no, one-off             | n/a            | n/a              | n/a   | explain non-fit |
// | A3   | yes                     | competing      | any              | any   | reject  |
// | A4   | yes                     | single         | ambiguous success| any   | reject  |
// | A5   | yes                     | single         | explicit         | absent| reject  |
const productRules = [
  {
    path: resolve(root, 'dist/agents/index.html'),
    title: 'Build and run your AI Agent application.',
    agentsHref: '/docs/agents/get-started',
    compatibilityHref: '/docs/agents/compatibility',
    fit: ['Embed an Agent in your product', 'Keep work beyond one connection', 'Choose execution without forking the product', 'Control and grow the operating boundary'],
    owners: ['Control', 'Coordinator', 'Worker + Runtime'],
    failures: ['Permission required', 'Worker interrupted', 'External outcome ambiguous'],
    reliability: ['A user reconnects', 'A Worker or process stops', 'A tool requests sensitive action', 'An operator needs an explanation', 'Data and tools must stay inside'],
    proofHrefs: ['/docs/agents/concepts/sessions-and-events', '/docs/agents/concepts/production-reliability', '/docs/agents/runtime/how-to/enable-tool-permission-hitl', '/docs/agents/runtime/how-to/enable-observability', '/docs/agents/how-to/self-host'],
    outcomes: ['Ship one real Agent application', 'Keep existing application investment', 'Keep differentiated Agent behavior', 'Run inside enterprise boundaries'],
    decisions: [
      ['/docs/agents/compatibility', 'Migrate an existing client'],
      ['/docs/agents/concepts/architecture', 'Review authority and recovery'],
      ['/docs/agents/how-to/self-host', 'Choose a deployment boundary'],
      ['/docs/agents/concepts/agent-runtime', 'Understand the runtime boundary'],
    ],
  },
  {
    path: resolve(root, 'dist/zh/agents/index.html'),
    title: '构建并运行你的 AI Agent 应用。',
    agentsHref: '/zh/docs/agents/get-started',
    compatibilityHref: '/zh/docs/agents/compatibility',
    fit: ['把 Agent 接入自己的产品', '让工作跨越单次连接', '改变执行方式而不分叉产品', '掌控并扩展运营边界'],
    owners: ['Control', 'Coordinator', 'Worker + Runtime'],
    failures: ['需要权限决定', 'Worker 中断', '外部结果不确定'],
    reliability: ['用户重新连接', 'Worker 或进程中断', '工具请求敏感操作', '操作者需要解释过程', '数据与工具必须留在内部'],
    proofHrefs: ['/zh/docs/agents/concepts/sessions-and-events', '/zh/docs/agents/concepts/production-reliability', '/zh/docs/agents/runtime/how-to/enable-tool-permission-hitl', '/zh/docs/agents/runtime/how-to/enable-observability', '/zh/docs/agents/how-to/self-host'],
    outcomes: ['交付一个真实 Agent 应用', '保留现有应用投入', '保留有差异的 Agent 行为', '在企业边界内运行'],
    decisions: [
      ['/zh/docs/agents/compatibility', '迁移已有客户端'],
      ['/zh/docs/agents/concepts/architecture', '审阅权威与恢复'],
      ['/zh/docs/agents/how-to/self-host', '选择部署边界'],
      ['/zh/docs/agents/concepts/agent-runtime', '理解 Runtime 边界'],
    ],
  },
];

for (const rule of productRules) {
  requirePattern(rule.path, new RegExp(`<h1[^>]*>[\\s\\S]*${rule.title.replaceAll('.', '\\.')}[\\s\\S]*</h1>`), 'Awaken product page must own the production Agent application promise');
  requireOccurrenceCount(rule.path, 'data-agent-compatibility-entry', 1, 'Agents hero must expose one prominent compatibility entry');
  requirePattern(rule.path, new RegExp(`<a href="${rule.compatibilityHref}" data-agent-compatibility-entry`), 'Agents hero compatibility entry must reach the localized canonical matrix');
  requireOrderedText(rule.path, ['id="agents-hero"', 'id="platform-preview"', 'id="agents-fit"', 'id="agents-quickstart"', 'id="agents-boundary"', 'id="agents-outcomes"', 'id="agents-reliability"', 'id="managed-relation"', 'id="agents-decisions"'], 'Agents must show actual product evidence before fit, first success, optional architecture, and canonical Docs decisions');
  requireOccurrenceCount(rule.path, 'data-agent-fit', 4, 'Agents must expose exactly four product-fit conditions');
  requireOccurrenceCount(rule.path, 'data-agent-not-fit', 1, 'Agents must expose one explicit non-fit boundary');
  for (const fit of rule.fit) requirePattern(rule.path, new RegExp(fit), `Agents must name the ${fit} fit condition`);
  requireOccurrenceCount(rule.path, 'data-agent-owner=', 3, 'Agents must expose one compact three-owner static view');
  for (const owner of rule.owners) requirePattern(rule.path, new RegExp(owner.replace('+', '\\+')), `Agents must name the ${owner} authority`);
  requireOccurrenceCount(rule.path, 'data-agent-lifecycle-step', 6, 'Agents must expose the six-step publication-to-recovery path');
  requireOccurrenceCount(rule.path, 'data-agent-failure', 3, 'Agents must keep three distinct failure outcomes');
  for (const failure of rule.failures) requirePattern(rule.path, new RegExp(failure), `Agents must name the ${failure} outcome`);
  requirePattern(rule.path, /indeterminate|不确定/, 'Agents must never collapse ambiguous external execution into success');
  requireOccurrenceCount(rule.path, '<dialog data-console-dialog', 1, 'Agents must expose one native dialog owner for screenshot inspection');
  requireOccurrenceCount(rule.path, '<img data-console-dialog-image', 1, 'Agents must expose one dialog image target');
  requirePattern(rule.path, /showModal\(\)/, 'Agents screenshot proof must support a larger native-dialog view');
  requireOccurrenceCount(rule.path, 'data-agent-outcome', 4, 'Agents must show exactly four customer outcomes before implementation detail');
  for (const outcome of rule.outcomes) {
    requirePattern(rule.path, new RegExp(outcome), `Agents must explain the ${outcome} customer outcome`);
  }
  requireOccurrenceCount(rule.path, 'data-agent-reliability=', 5, 'Agents must render five bounded reliability causes exactly once');
  for (const cause of rule.reliability) requirePattern(rule.path, new RegExp(cause), `Agents must connect ${cause} to an explicit consequence`);
  for (const href of rule.proofHrefs) requirePattern(rule.path, new RegExp(`href="${href}"`), `Agents reliability evidence must link to ${href}`);
  requirePattern(rule.path, new RegExp(`href="${rule.agentsHref}"`), 'Agents primary action must reach the task-first product entry before the source quickstart');
  requireOccurrenceCount(rule.path, 'data-agent-doc-decision=', 4, 'Agents must expose exactly four compact technical decisions after product evidence');
  for (const [href, title] of rule.decisions) {
    requirePattern(rule.path, new RegExp(`href="${href}"`), `${title} must lead to its canonical Docs owner`);
    requirePattern(rule.path, new RegExp(title), `Agents must name the ${title} decision without recreating its detail`);
  }
  for (const removedSection of ['agents-platform-map', 'sdk-onramp', 'delivery', 'runtime']) {
    requireOccurrenceCount(rule.path, `id="${removedSection}"`, 0, `${removedSection} detail must no longer compete with its canonical Docs owner`);
  }
  rejectPattern(rule.path, /managed-agents-2026-04-01|127 generated operations|127 个生成操作|Beta header 决策表|const client = new Anthropic/, 'exact SDK setup and compatibility detail must remain in canonical documentation');
  rejectPattern(rule.path, /Anthropic's cloud only|仅 Anthropic 云|drop-in replacement|完全兼容/, 'product page must reject stale or overbroad compatibility claims');
  requireOccurrenceCount(rule.path, '<astro-island', 0, 'product positioning and SDK proof must remain available without hydration');
  requirePattern(rule.path, /data-awaken-event="enterprise_intent_selected"/, 'Awaken proof must retain a measurable enterprise-production exit');
  requirePattern(rule.path, /data-awaken-event="developer_evaluation_selected"/, 'Awaken task-first entry must retain a measurable independent-evaluation exit');
  requirePattern(rule.path, /data-awaken-event="github_star_selected"/, 'Awaken product page must retain a measurable GitHub Star exit');
}
const productLandingSourcePath = resolve(root, 'src/components/ProductLanding.astro');
const uiSourcePath = resolve(root, 'src/i18n/ui.ts');
rejectPattern(uiSourcePath, /—/, 'UI copy must use plain punctuation instead of decorative em dashes');
requirePattern(productLandingSourcePath, /id="agents-quickstart"[\s\S]*\{p\.ctaPrimary\.label\}/, 'Agents Quickstart must reuse the primary CTA label authority');
rejectPattern(uiSourcePath, /quickstartCta:/, 'UI copy must not maintain a second Agents Quickstart CTA label');

// Cause-effect design for the Objects product boundary:
// C1: repository, crate, or package layout can leak into public copy and make an
//     internal implementation choice look like the definition of a product.
// C2: a preview can be mistaken for a production SLA when maturity is omitted.
// C3: the shared GitHub exit can look like an Objects-only repository unless its
//     label names the Awaken open foundation that the visitor will reach.
// E1: Objects starts from the business-object job and omits code-layout claims.
// E2: the page says early preview and offers one bounded early-access action
//     without implying production delivery.
// E3: the reader reaches Objects docs, one early-preview request, and one
//     accurately labelled Star exit without a second form.
// Decision table:
// | Rule | task first | code layout absent | maturity | Star accurate | Outcome |
// | O1   | yes        | yes                | present  | yes           | accept  |
// | O2   | no         | any                | any      | any           | reject  |
// | O3   | yes        | no                 | any      | any           | reject  |
// | O4   | yes        | yes                | absent   | any           | reject  |
// | O5   | yes        | yes                | present  | no            | reject  |
for (const rule of [
  {
    path: resolve(root, 'dist/objects/index.html'),
    title: 'Give applications and Agents the same typed business records.',
    docsHref: '/docs/objects',
    task: 'Choose one important business object',
    maturity: 'Preview access by request',
    previewHref: '/enterprise\\?product=workforce#apply',
    star: 'Star the Awaken open foundation',
  },
  {
    path: resolve(root, 'dist/zh/objects/index.html'),
    title: '让应用和 Agent 使用同一份类型化业务记录。',
    docsHref: '/zh/docs/objects',
    task: '选择一类关键业务对象',
    maturity: '需申请预览',
    previewHref: '/zh/enterprise\\?product=workforce#apply',
    star: 'Star Awaken 开源基础',
  },
]) {
  requirePattern(rule.path, new RegExp(rule.title.replaceAll('.', '\\.')), 'Objects must lead with the business-fact job');
  requirePattern(rule.path, new RegExp(`href="${rule.docsHref}"`), 'Objects must lead technical readers to its own documentation boundary');
  requirePattern(rule.path, new RegExp(rule.task), 'Objects must tell the reader which business object to start with');
  requirePattern(rule.path, new RegExp(rule.maturity), 'Objects must disclose its product maturity');
  requirePattern(rule.path, new RegExp(`href="${rule.previewHref}"`), 'Objects early-preview intent must reach the shared business form with product context');
  requireOccurrenceCount(rule.path, '<form class="opportunity-form"', 0, 'Objects must not create a second early-preview form');
  rejectPattern(rule.path, /source repository|shared source|independent package|repository layout|源码仓库|共用源码|独立安装包|代码仓划分/, 'Objects product copy must not derive its boundary from code organization');
  requirePattern(rule.path, new RegExp(rule.star), 'Objects must label the canonical Awaken Star exit without implying an Objects repository');
  requireOccurrenceCount(rule.path, 'data-awaken-event-location="objects-close"', 1, 'Objects must expose one measurable GitHub Star exit outside the primary hero decision');
}

// Cause/effect design for product captures, illustrations and routing:
// C1 local Console captures have their own exact source; C2 illustrative records
// are not customer or deployed-product evidence; C3 AI execution can end before
// the business completion conditions hold; C4 business and developer readers
// need different owners; C5 modules can be mistaken for separate purchases.
// E1 disclose each preview kind; E2 preserve the business completion boundary;
// E3 route contact to the one existing form and technical questions to Docs;
// E4 retain two public products plus internal capability ownership.
// P1 declared capture/illustration + boundary + canonical exits -> accept;
// P2 missing disclosure, inferred customer outcome, missing result condition,
// second form or third purchasing product -> reject.
for (const rule of [
  { path: resolve(root, 'dist/agents/index.html'), id: 'platform-preview', label: 'Captured from the local Awaken v1.0.0-dev Console at revision' },
  { path: resolve(root, 'dist/objects/index.html'), id: 'objects-preview', label: 'Product model preview · example content' },
  { path: resolve(root, 'dist/workforce/index.html'), id: 'workforce-preview', label: 'Workflow illustration · fictional records' },
  { path: resolve(root, 'dist/zh/agents/index.html'), id: 'platform-preview', label: '截图来自 Awaken v1.0.0-dev revision' },
  { path: resolve(root, 'dist/zh/objects/index.html'), id: 'objects-preview', label: '产品模型预览 · 示例内容' },
  { path: resolve(root, 'dist/zh/workforce/index.html'), id: 'workforce-preview', label: '工作流程示意 · 虚构记录' },
]) {
  requirePattern(rule.path, new RegExp(`id="${rule.id}"`), 'each product must expose one identifiable product preview');
  requirePattern(rule.path, new RegExp(rule.label), 'each product preview must disclose its capture or illustration kind');
  rejectPattern(rule.path, /52\.1k|168 nodes|共 168 节点|acme \/|customer logo|客户徽标/i, 'product previews must not invent usage, fleet, customer, or adoption evidence');
}
// C6 Agents already renders verified Console captures; a default/model platform
// branch would maintain a second presentation. P7 Agents -> captures only;
// P8 Objects/Workforce -> retained illustrative preview. Existing rendered
// checks above and browser image/modal checks cover the observable routes;
// reject a dormant fallback so callers cannot restore the competing branch.
rejectPattern(resolve(root, 'src/components/ProductPreview.astro'), /\bplatform\b/, 'model previews must not retain a second Agents console');
const modelPreviewCopy = readFileSync(resolve(root, 'src/i18n/ui.ts'), 'utf8').split('export const productPreviewCopy = ')[1]?.split('export const docsIndexCopy = ')[0];
if (!modelPreviewCopy || /\bplatform\s*:/.test(modelPreviewCopy)) failures.push('product model copy must not retain the retired Agents preview');

// Cause/effect design for product discovery metadata and route identity:
// C1 a search crawler has no visual context; C2 a reader lands directly on a
// product route; C3 locale changes the URL but not product identity.
// E1 every product emits SoftwareApplication metadata; E2 Objects uses its own
// governed-change accent; E3 current navigation is semantic on direct entry.
for (const [path, name, brand, currentHref] of [
  ['dist/agents/index.html', 'Awaken Agents', 'agents', '/agents'],
  ['dist/objects/index.html', 'Workforce.*Objects.*', 'objects', '/workforce'],
  ['dist/workforce/index.html', 'Awaken Workforce', 'workforce', '/workforce'],
  ['dist/zh/agents/index.html', 'Awaken Agents', 'agents', '/zh/agents'],
  ['dist/zh/objects/index.html', 'Workforce.*Objects.*', 'objects', '/zh/workforce'],
  ['dist/zh/workforce/index.html', 'Awaken Workforce', 'workforce', '/zh/workforce'],
]) {
  const absolute = resolve(root, path);
  requirePattern(absolute, new RegExp(`"@type":"SoftwareApplication"[\\s\\S]*"name":"${name}"`), `${name} must expose product discovery metadata`);
  requirePattern(absolute, new RegExp(`<html[^>]*data-brand="${brand}"`), `${name} must render its route-owned visual identity`);
  requirePattern(absolute, new RegExp(`href="${currentHref}" aria-current="page"`), `${name} direct entry must expose semantic current navigation`);
}

// Cause/effect design for entity graph consistency:
// C1: visual copy can name Agents while machine-readable data names a generic
//     Awaken application; C2: Runtime can be collapsed into the product; C3:
//     product and Runtime identifiers can vary by route or locale.
// E1: Organization, Agents, and Runtime remain separate nodes; E2: Agents owns
//     Runtime through hasPart and Runtime points back through isPartOf; E3: the
//     same stable IDs and Rust repository facts appear on home and Agents pages.
// Decision table: G1 all nodes + both edges + stable ids -> accept; G2 any node,
// edge, or id absent -> reject. Rich-result eligibility is deliberately not an
// effect because schema markup cannot promise search-engine presentation.
for (const path of [
  resolve(root, 'dist/index.html'),
  resolve(root, 'dist/zh/index.html'),
  resolve(root, 'dist/agents/index.html'),
  resolve(root, 'dist/zh/agents/index.html'),
]) {
  requirePattern(path, /"@id":"https:\/\/awakenworks\.com\/#organization"/, 'entity graph must retain one Organization id');
  requirePattern(path, /"@id":"https:\/\/awakenworks\.com\/#awaken-agents"/, 'entity graph must retain one Awaken Agents id');
  requirePattern(path, /"@type":"SoftwareSourceCode","@id":"https:\/\/awakenworks\.com\/#awaken-runtime"/, 'entity graph must model Runtime separately as source code');
  requirePattern(path, /"hasPart":\{"@id":"https:\/\/awakenworks\.com\/#awaken-runtime"\}/, 'Agents must own Runtime through hasPart');
  requirePattern(path, /"programmingLanguage":"Rust"[\s\S]*"isPartOf":\{"@id":"https:\/\/awakenworks\.com\/#awaken-agents"\}/, 'Runtime must expose Rust and point back to Agents');
  requirePattern(path, /"codeRepository":"https:\/\/github\.com\/AwakenWorks\/awaken"/, 'Runtime graph must identify the canonical source repository');
}

for (const path of [resolve(root, 'dist/agents/index.html'), resolve(root, 'dist/zh/agents/index.html')]) {
  for (const asset of ['overview.png', 'agent-editor.png', 'models-and-providers.png', 'api-and-protocols.png', 'deployments.png']) {
    requirePattern(path, new RegExp(`/awaken/assets/console-current/${asset.replace('.', '\\.')}`), 'Agents must show every current Console journey screenshot');
  }
  requirePattern(path, /cadf3816ab4003e977387be2f700ce03c0455e04/, 'current Console screenshots must name their exact verified Awaken revision');
}

for (const rule of [
  {
    path: resolve(root, 'dist/workforce/index.html'),
    title: 'Let AI handle everyday work. Keep important decisions with people.',
    docsHref: '/docs/workforce',
    cooperationHref: '/enterprise\\?product=workforce(?:&amp;|&#38;|&)scenario=customer-exception-refund#apply',
    workspaceHref: '/workforce#workforce-preview',
    maturity: 'Preview access by request',
    boundary: 'work remains open while a required system result, notification or acceptance condition is missing.',
  },
  {
    path: resolve(root, 'dist/zh/workforce/index.html'),
    title: '让 AI 处理日常工作，把重要决定交给你。',
    docsHref: '/zh/docs/workforce',
    cooperationHref: '/zh/enterprise\\?product=workforce(?:&amp;|&#38;|&)scenario=customer-exception-refund#apply',
    workspaceHref: '/zh/workforce#workforce-preview',
    maturity: '需申请预览',
    boundary: '所需的系统结果、通知或验收条件缺失时，工作仍保持未完成。',
  },
]) {
  requirePattern(rule.path, new RegExp(rule.title.replaceAll('.', '\\.')), 'Workforce must lead with a commissioned result and acceptance');
  requireOrderedText(rule.path, ['id="workforce-hero"', 'id="workforce-preview"', 'id="workforce-capabilities"', 'id="workforce-scenarios"'], 'Workforce must move from the promise to one labelled story, supporting capabilities and suitable jobs');
  requirePattern(rule.path, new RegExp(`href="${rule.docsHref}"`), 'Workforce technical evaluation must lead to its current docs');
  requirePattern(rule.path, new RegExp(`href="${rule.cooperationHref}"`), 'Workforce commercial intent must lead to the shared business page');
  requirePattern(rule.path, new RegExp(`href="${rule.workspaceHref}"`), 'Workforce primary action must lead to the current product workspace');
  requirePattern(rule.path, new RegExp(rule.maturity), 'Workforce must disclose early-preview availability');
  requirePattern(rule.path, new RegExp(rule.boundary), 'Workforce must preserve the Run-versus-Issue terminal boundary');
  requireOccurrenceCount(rule.path, '<form class="opportunity-form"', 0, 'Workforce must not create a second cooperation form');
  requireOccurrenceCount(rule.path, 'data-awaken-event-location="workforce-close"', 1, 'Workforce must expose one measurable GitHub Star exit outside the primary hero decision');
  requireOccurrenceCount(rule.path, 'data-awaken-event="workforce_workspace_selected"', 2, 'Workforce must measure both product-workspace actions');
  requireOccurrenceCount(rule.path, 'data-awaken-event="paid_validation_selected"', 2, 'Workforce must measure both one-real-job validation actions');
  requireOccurrenceCount(rule.path, 'data-workforce-outcome-path', 1, 'Workforce must render the one selected illustrative path');
  requireOccurrenceCount(rule.path, 'data-workforce-role', 3, 'Workforce example must distinguish AI, the approving person and the source systems');
  requireOccurrenceCount(rule.path, 'data-workforce-acceptance-preview', 1, 'Workforce preview must show the formal-deliverable acceptance boundary');
  requireOccurrenceCount(rule.path, 'data-workforce-stage', 4, 'Workforce must reuse all four content-owned refund stages');
  requireOccurrenceCount(rule.path, 'data-workforce-capability-card', 3, 'Workforce must name two Workforce capability groups and the Agents execution dependency');
  requireOccurrenceCount(rule.path, 'data-workforce-composition-path', 1, 'Workforce must show one composed path without a second architecture');
  for (const product of ['Awaken Agents', 'Objects', 'Awaken Workforce']) {
    requirePattern(rule.path, new RegExp(product), `Workforce composition must name ${product}`);
  }
  rejectPattern(rule.path, /Flow revision/, 'Workforce public UI must not expose the internal source product name');
  rejectPattern(rule.path, /Apply for design partnership|申请设计伙伴/, 'Workforce must not restore a separate design-partner funnel');
}

// Evidence presentation cause/effect graph:
// C1 documented implementation with named tests; C2 locale; C3 the existing
// refund illustration; C4 unsupported economic/budget/responsibility promises;
// C5 the generic comparison renderer's optional proof link.
// E1 three bounded mechanisms link to their current localized guides;
// E2 source/test references stay in those owning guides; E3 illustration and
// preview status remain qualified; E4 no claimed customer ROI or budget guarantee.
// Decision rules: V1 C1+C2 -> E1+E2; V2 C3 -> E3, never customer evidence;
// V3 C4 -> reject; V4 Workforce+C5 -> exactly three source links; Agents without
// C5 -> ordinary text. These check website contracts, not product E2E or ROI.
const workforceMechanismEvidence = [
  { product: 'workforce', route: '/concepts/issue-based-workflows', coordinate: 'crates/domain/awaken-flow-work/src/handoff.rs', test: 'output_projection_separates_business_values_from_settled_resources' },
  { product: 'objects', route: '/concepts/permissions-resources', coordinate: 'crates/app/awaken-flow-server/src/resource_content_api.rs', test: 'agent_tools_complete_submission_and_reauthorize_content_reads' },
  { product: 'workforce', route: '/operating/attention-recovery', coordinate: 'crates/domain/awaken-flow-work/tests/g106_attention_overlay.rs', test: 'only_a_resolved_signal_drops_the_overlay_not_an_acknowledged_one' },
];
for (const [lang, prefix] of [['en', ''], ['zh', '/zh']]) {
  const productPath = resolve(root, `dist${prefix}/workforce/index.html`);
  requireOccurrenceCount(productPath, 'id="workforce-evidence"', 1, 'Workforce must reuse one implementation-evidence section');
  requireOccurrenceCount(productPath, 'data-capability-evidence-link', 3, 'every bounded mechanism must have a visible guide link');
  for (const evidence of workforceMechanismEvidence) {
    requirePattern(productPath, new RegExp(`href="${prefix}/docs/${evidence.product}${evidence.route}"`), 'mechanism evidence must preserve its locale and canonical route');
    const doc = resolve(root, `src/content/docs/flow/current/${lang}${evidence.route}.md`);
    requirePattern(doc, new RegExp(evidence.coordinate.replaceAll('.', '\\.')), 'the owning guide must identify implementation evidence');
    requirePattern(doc, new RegExp(evidence.test), 'the owning guide must identify the reviewed regression case');
  }
  for (const route of ['/index.html', '/workforce/index.html']) {
    const path = resolve(root, `dist${prefix}${route}`);
    requirePattern(path, new RegExp(`href="${prefix}/workforce#workforce-evidence"`), 'the illustration must lead to the one implementation-evidence section');
    rejectPattern(path, /Less manual coordination|减少人工交接与催办|收益可验证|成本可预测|责任可追溯|verifiable returns|predictable costs|traceable responsibility/i, 'unqualified economic, budget or responsibility promises must not return');
  }
}
requirePattern(resolve(root, 'src/components/AdvantageSection.astro'), /proofHref\?: string/, 'evidence links must extend the existing renderer');
requirePattern(resolve(root, 'src/components/Home.astro'), /concept=\{\{ label: ui\[lang\]\.landing\.workforceEvidence/, 'Home must use the existing showcase guide slot');

// Refund illustration cause/effect decision table:
// R1 Home/Workforce x en/zh -> same one-owned stages, three roles and records.
// R2 illustration + missing real-business qualification -> disclose fictional
// records and research status; no refund command or customer-result inference.
// R3 contact -> existing form with bounded product/scenario metadata; unknown
// context remains covered by the existing request rules and browser suite.
// R4 fulfilment exception + human judgment -> delivery/shipments/terms remain
// explicit; the retired billing-error narrative is rejected in both locales.
for (const [prefix, boundary] of [['', 'Customer validation of this refund scenario is pending'], ['/zh', '尚待客户验证']]) {
  for (const route of ['/index.html', '/workforce/index.html']) {
    const path = resolve(root, `dist${prefix}${route}`);
    requireOccurrenceCount(path, 'data-refund-example-boundary', 1, 'each story must disclose its research boundary');
    requirePattern(path, new RegExp(boundary), 'refund example must remain research, not customer acceptance');
    requireOccurrenceCount(path, 'data-workforce-role', 3, 'the story must state AI, human and system responsibilities');
    requireOccurrenceCount(path, 'data-refund-result-record', 3, 'completion must explain all three required result records');
    requirePattern(path, prefix ? /交付承诺[\s\S]*物流进度[\s\S]*退款条款/ : /promised delivery[\s\S]*shipment progress[\s\S]*refund terms/, 'refund example must explain the fulfilment and policy context');
    rejectPattern(path, /重复扣款|扣了两次|duplicate charge|charged twice/i, 'retired billing-error example must not remain on business pages');
    rejectPattern(path, /data-workforce-console-preview|aria-disabled="true"/, 'illustrations must not retain the retired mock console or fake disabled actions');
  }
}
requirePattern(resolve(root, 'src/components/ProductPreview.astro'), /loop\.stages\.map/, 'one existing content owner must supply the stage renderer');
rejectPattern(resolve(root, 'src/components/WorkforceLanding.astro'), /loop\.stages\.map|workforce-how-it-works/, 'Workforce must not duplicate the shared stage renderer');
if (/\bpath\s*:|"path"\s*:|\bnavigation\s*:|"navigation"\s*:/.test(modelPreviewCopy)) failures.push('preview copy must not retain its parallel phase or navigation catalog');

// Request graph: C1 no product context; C2 Agents; C3 Workforce;
// C4 legacy Objects; C5 unknown input; C6 JavaScript absent.
// E1 catalog-owned Agents/Workforce choices; E2 one form and POST schema;
// E3 Objects selects Workforce and retains capability_context; E4 unknown input
// cannot create an option; E5 availability and delivery scope remain distinct.
// G1 C1 or C5 -> scoped Workforce default+E2; G2 C2 -> Agents+E2;
// G3 C3 -> Workforce+E2; G4 C4 -> E3+E2; G5 C6 -> visible choices+normal POST.
// Browser decision-table coverage verifies context and the no-JS path.
const enterpriseRules = [
  {
    path: resolve(root, 'dist/enterprise/index.html'),
    productHref: '/agents',
    privacyHref: '/privacy',
    title: 'Evaluate one job with a result you can check.',
    intent: 'cooperation',
    boundary: 'Current access is shown in the product choices.',
    pathFacts: [
      ['enterprise-agents', 'An application you want to build', '4–6 week implementation uses 2–4 release checks'],
      ['enterprise-workforce', 'One real job', 'one bounded paid validation'],
    ],
    success: 'Request received',
  },
  {
    path: resolve(root, 'dist/zh/enterprise/index.html'),
    productHref: '/zh/agents',
    privacyHref: '/zh/privacy',
    title: '评估一项工作，约定可以检查的结果。',
    intent: 'cooperation',
    boundary: '当前访问方式见产品说明。',
    pathFacts: [
      ['enterprise-agents', '一个希望构建或已在使用的应用', '4–6 周实施以 2–4 项发布检查为边界'],
      ['enterprise-workforce', '一项真实工作', '范围受控付费验证'],
    ],
    success: '需求已收到',
  },
];

const opportunityFormSourcePath = resolve(root, 'src/components/OpportunityForm.astro');
requirePattern(opportunityFormSourcePath, /import\.meta\.env\.PUBLIC_OPPORTUNITY_ENDPOINT[\s\S]*https:\/\/formspree\.io\/f\/mrewzorl/, 'the shared opportunity form must have one documented endpoint configuration with the current transport fallback');
rejectPattern(opportunityFormSourcePath, /PUBLIC_WAITLIST_ENDPOINT/, 'the opportunity form must not retain the legacy parallel endpoint configuration');
requirePattern(opportunityFormSourcePath, /import \{ attributionFormValues, captureAttribution \} from '\.\.\/lib\/attribution\.mjs'/, 'the opportunity form must reuse the shared attribution authority');
requirePattern(opportunityFormSourcePath, /Array\.from\(product\.options\)\.some/, 'shared form must accept only known product context from early-preview links');
requirePattern(opportunityFormSourcePath, /content\[lang\]\.enterprise\.contextLabels/, 'enterprise must own all request-context labels');
rejectPattern(contentSourcePath, /home\.scenarios|home\.advantages/, 'retired home catalogs must not remain referenced');
requirePattern(resolve(root, 'src/components/EnterpriseLanding.astro'), /followUp\.successSteps\.map/, 'before and after contact must share follow-up steps');
requirePattern(opportunityFormSourcePath, /Object\.prototype\.hasOwnProperty\.call\(scenarioLabels, requestedScenario\)/, 'shared form must accept only known scenario context from company links');
requirePattern(opportunityFormSourcePath, /setAttribute\('aria-busy', 'true'\)/, 'progressive submission must expose its busy state');
requirePattern(opportunityFormSourcePath, /getAttribute\('aria-busy'\) === 'true'\) return/, 'progressive submission must reject a second submit while transport is pending');
requirePattern(opportunityFormSourcePath, /globalThis\.crypto\?\.randomUUID\?\.\(\)/, 'progressive submission must create a traceable submission identifier with a fallback');
requirePattern(opportunityFormSourcePath, /success\.focus\(\)/, 'successful submission must move focus to the next-step panel');
requirePattern(opportunityFormSourcePath, /opportunity_form_submission_failed[\s\S]*reason: failureReason/, 'rejected transport must emit one bounded failure reason');
for (const dimension of ['product', 'location']) {
  requirePattern(opportunityFormSourcePath, new RegExp(`${dimension}:`), `opportunity events must include the bounded ${dimension} dimension`);
}
rejectPattern(opportunityFormSourcePath, /window\.umami\.track\([\s\S]{0,500}(?:email|company|additional_context|submission_id)/, 'Umami opportunity events must not include contact, free text, or submission identifiers');
requirePattern(resolve(root, '.env.example'), /PUBLIC_OPPORTUNITY_ENDPOINT=https:\/\/formspree\.io\/f\/mrewzorl/, 'deployment configuration must document the one opportunity endpoint');

for (const rule of enterpriseRules) {
  // C-Read3 first contact -> one follow-up owner, four native adoption answers;
  // C-Read4 partner -> existing form with known context, no separate intake;
  // C-Read5 legacy URLs -> migrated context labels without a retired home catalog.
  requireOccurrenceCount(rule.path, 'data-adoption-question=', 4, 'adoption questions must cover starting, preparation, setup and fees');
  requireOccurrenceCount(rule.path, 'data-contact-next-steps', 1, 'pre-contact guidance must reuse the one submission follow-up owner');
  requireOccurrenceCount(rule.path, 'id="enterprise-process"', 0, 'duplicated contact-process section must stay removed');
  requirePattern(rule.path, /data-product-help/, 'existing product selector must explain the business and developer choices');
  requirePattern(rule.path, /scenario=solution-delivery#apply/, 'partners must use the existing scenario-aware request');

  requireOccurrenceCount(rule.path, '<h1', 1, 'business page must have one primary heading');
  requirePattern(rule.path, new RegExp(rule.title.replaceAll('.', '\\.')), 'services page must lead with the two-product decision and honest maturity boundary');
  requireOrderedText(rule.path, ['id="enterprise-hero"', 'id="apply"', 'id="delivery-modes"', 'id="enterprise-paths"', 'id="enterprise-agents-scope"', 'id="enterprise-questions"', 'id="enterprise-partners"'], 'services must offer the single short form before detailed delivery, product and implementation scope');
  requireOccurrenceCount(rule.path, 'data-enterprise-product-path=', 2, 'enterprise must present exactly the Agents and Workforce paths');
  requireOccurrenceCount(rule.path, 'data-enterprise-path-fact=', 6, 'each product path must expose bring, first decision, and current boundary once');
  for (const [id, bring, decision] of rule.pathFacts) {
    requireOccurrenceCount(rule.path, `id="${id}"`, 1, `${id} must provide one stable context-preserving landing target`);
    requirePattern(rule.path, new RegExp(bring), `${id} must say what the visitor brings`);
    requirePattern(rule.path, new RegExp(decision), `${id} must say what the first product decision is`);
  }
  requirePattern(rule.path, /a permission decision|权限决定/, 'implementation must exercise an explicit permission decision');
  requirePattern(rule.path, /interruption-and-recovery|中断恢复路径/, 'implementation must exercise an interruption and recovery path');
  requirePattern(rule.path, /go, change, or stop decision|继续、调整或停止决定/, 'the current Agents path must end in an explicit terminal decision');
  // Cause/effect design for enterprise purchase completeness:
  // C1 a duration without scope looks like open consulting; C2 scope without
  // deliverables or owners cannot be accepted; C3 preview requests must not
  // inherit the Agents promise; C4 price, SLA, rollout, and unlimited changes
  // are outside this public bounded decision.
  // E1 state one app, one integration, 2–4 checks, and a terminal decision;
  // E2 list four deliverables and both responsibility owners; E3 keep one
  // explicit exclusions boundary before the existing shared process and form.
  // Decision table: complete bounded Agents facts -> accept; missing owner,
  // deliverable, exclusion, or preview separation -> reject.
  requireOccurrenceCount(rule.path, 'data-enterprise-scope-fact', 4, 'Agents scope must expose its four bounded buying facts');
  requireOccurrenceCount(rule.path, 'data-enterprise-deliverable', 4, 'Agents scope must expose four concrete handover artifacts');
  requireOccurrenceCount(rule.path, 'data-enterprise-responsibility', 2, 'Agents scope must name both delivery responsibility owners');
  requireOccurrenceCount(rule.path, 'data-enterprise-scope-boundary', 1, 'Agents scope must state excluded production commitments once');
  requirePattern(rule.path, /Production SLA|生产 SLA/, 'Agents scope must keep production SLA outside the bounded implementation');
  requirePattern(rule.path, /Request preview access, then confirm available capabilities|申请预览后，先确认可提供的能力/, 'Objects and Workforce must not inherit the current Agents implementation promise');
  for (const removedSection of ['enterprise-first-implementation', 'enterprise-responsibility', 'enterprise-validation', 'enterprise-package', 'delivery']) {
    requireOccurrenceCount(rule.path, `id="${removedSection}"`, 0, `${removedSection} must not restore the old Agents-only long narrative`);
  }
  requireOccurrenceCount(rule.path, 'data-enterprise-now', 1, 'business page must state current availability once without repeating the maturity disclaimer');
  requirePattern(rule.path, new RegExp(`href="${rule.productHref}"`), 'unqualified or self-service visitors must retain the Awaken evaluation path');
  requireOccurrenceCount(rule.path, '<form class="opportunity-form"', 1, 'business page must render the single shared opportunity form once');
  // Cause/effect design for the one opportunity form:
  // C1: JavaScript is unavailable; C2: JavaScript is available; C3: attribution
  // and a known scenario are present; C4: a product/scenario is unrecognized;
  // C5: a user submits twice or the network is slow; C6: transport accepts or
  // rejects the request; C7: role, stage, blocker, timing, and environment
  // usually fit a bounded vocabulary; C8: the real job cannot be inferred from
  // that vocabulary; C9: several systems can apply; C10: optional context is
  // unknown or unnecessary.
  // E1: normal POST and progressive fetch share one endpoint/schema; E2: every
  // attempt has an ID, timestamp, and exact page; E3: only allowlisted context
  // is copied; E4: the submit control exposes busy state and cannot double-fire;
  // E5: success focuses one announced next-step panel; E6: failure restores the
  // control and keeps the entered fields; E7: bounded facts use localized
  // choices; E8: one short required field captures the real job; E9: system
  // choices allow more than one answer; E10: optional facts never block submit.
  // Decision table:
  // | Rule | JS | context | transport | repeated click | Outcome |
  // | F1   | no | any     | accepted  | n/a            | normal POST |
  // | F2   | yes| known   | accepted  | blocked        | attributed success |
  // | F3   | yes| unknown | accepted  | blocked        | context omitted |
  // | F4   | yes| any     | rejected  | blocked        | error and restore |
  // | F5   | any| bounded answers | any | n/a          | select choices |
  // | F6   | any| concrete job    | any | n/a          | short required text |
  // | F7   | any| multiple systems| any | n/a          | optional checkboxes |
  // | F8   | any| no extra context| any | n/a          | submit without extras |
  for (const field of ['intent', 'product', 'source_page', 'landing_page', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'first_landing_page', 'first_referrer', 'first_utm_source', 'first_utm_medium', 'first_utm_campaign', 'first_utm_content', 'scenario_context', 'submission_id', 'submitted_at', 'page_url', 'contact_consent']) {
    requirePattern(rule.path, new RegExp(`name="${field}"`), `opportunity form must carry ${field}`);
  }
  requirePattern(rule.path, new RegExp(`name="intent" value="${rule.intent}"`), 'shared form must reuse the canonical cooperation intent instead of creating a second paid-validation schema');
  rejectPattern(rule.path, /name="budget_path"/, 'business contact form must not ask for a public budget path');
  requirePattern(rule.path, /<select name="product"[\s\S]*Awaken Agents[\s\S]*Awaken Workforce/, 'shared form must let no-JavaScript visitors select one product with visible maturity');
  requirePattern(rule.path, /<option value="workforce" selected>/, 'no-context intake must default to a scoped Workforce job');
  requirePattern(rule.path, /<select name="frequency" class=/, 'frequency must remain optional for previews where cadence is not yet known');
  rejectPattern(rule.path, /<select name="frequency" required/, 'optional preview frequency must not block the shared form');
  requireOccurrenceCount(rule.path, 'data-opportunity-details', 1, 'additional information must be one optional disclosure inside the same form');
  requireOccurrenceCount(rule.path, 'data-delivery-mode=', 3, 'delivery must explain self-host, enterprise and Cloud without another product');
  for (const optional of ['company', 'role', 'current_stage', 'current_loss']) rejectPattern(rule.path, new RegExp(`name="${optional}" required`), 'optional background must not block first contact');
  requireOccurrenceCount(rule.path, 'data-form-step=', 3, 'the opportunity form must group contact, request, and scope into three short steps');
  requirePattern(rule.path, /<select name="role" autocomplete=/, 'optional role must use a bounded choice instead of open-ended text');
  requirePattern(rule.path, /<select name="current_stage" class=/, 'optional current stage must use a bounded choice without duplicating product selection');
  requirePattern(rule.path, /<textarea name="job" required/, 'the concrete customer job must remain one required job description');
  requirePattern(rule.path, /<select name="current_loss" class=/, 'optional blocker must use a bounded choice');
  requireOccurrenceCount(rule.path, 'type="checkbox" name="systems_and_risks"', 9, 'system and constraint context must allow multiple optional choices');
  requirePattern(rule.path, /<select name="target_timing" class=/, 'target timing must use an optional bounded choice');
  requirePattern(rule.path, /<textarea name="additional_context" maxlength="2000" rows="3"/, 'unmatched context must retain one short optional text escape hatch');
  rejectPattern(rule.path, /<textarea name="current_loss"|<textarea name="systems_and_risks"|<input type="text" name="target_timing"|<input type="text" name="role"/, 'bounded form facts must not regress to long open-ended fields');
  requirePattern(rule.path, /data-submitting="(?:Submitting…|提交中…)"/, 'shared form must expose localized submitting state');
  requireOccurrenceCount(rule.path, '<section data-opportunity-success', 1, 'shared form must expose one progressive success panel');
  requirePattern(rule.path, /<section data-opportunity-success role="status" aria-live="polite" tabindex="-1"/, 'the progressive success panel must be announced and programmatically focusable');
  requirePattern(rule.path, new RegExp(rule.success), 'successful submission must name the received state');
  requireOccurrenceCount(rule.path, '<li data-opportunity-success-step', 3, 'successful submission must explain exactly three next steps');
  requirePattern(rule.path, new RegExp(`href="${rule.privacyHref}"`), 'contact consent must link to the localized privacy notice');
  requirePattern(rule.path, new RegExp(rule.boundary), 'business page must disclose the current product delivery boundary');
  rejectPattern(rule.path, /budget path|预算路径|RMB \d|目标 ¥|signed SOW|签署的 SOW|annual terms|年度条款|¥|\$\d/i, 'solutions page must not expose price, budget, or contract qualification strategy');
  rejectPattern(rule.path, /buy an FDE|购买 FDE|Applied AI subscription|Applied AI 订阅/, 'delivery roles and capabilities must not become products');
  rejectPattern(rule.path, /Make the production decision on evidence|让生产决定建立在证据上|Adoption block|采购阻碍|Commercial form|商业方式|Conversion:|转换目标：|Each commitment follows evidence|每一步承诺，都由证据开启/, 'enterprise voice must explain the buyer task instead of exposing internal review language');
  requireOccurrenceCount(rule.path, '<astro-island', 0, 'business contact and disclosure must work without hydration');
}

for (const path of [
  'dist/index.html',
  'dist/zh/index.html',
  'dist/enterprise/index.html',
  'dist/zh/enterprise/index.html',
  'dist/privacy/index.html',
  'dist/zh/privacy/index.html',
  'dist/agents/index.html',
  'dist/zh/agents/index.html',
  'dist/objects/index.html',
  'dist/zh/objects/index.html',
  'dist/workforce/index.html',
  'dist/zh/workforce/index.html',
]) {
  rejectPattern(
    resolve(root, path),
    /paid engagement|正式付费合作|budget path|预算路径|RMB \d|目标 ¥|signed SOW|签署的 SOW|annual terms|年度条款|¥|\$\d/i,
    'public product and solutions surfaces must keep price, budget, and contract qualification strategy private',
  );
}

// Cause/effect design for public evidence:
// C1 moving product main can make a claim unrepeatable; C2 a source check can
// be mistaken for a live deployment; C3 a local reference build can be mistaken
// for customer acceptance. E1 expose the exact registry-owned source revision
// and verification date; E2 define three increasing evidence thresholds; E3
// keep each case's narrower limitation. Decision table: pin + date + three
// levels + disclaimer -> accept; floating source or collapsed levels -> reject.
for (const rule of [
  { path: resolve(root, 'dist/cases/index.html'), disclaimer: 'do not represent customer adoption or endorsement', quickstart: '/docs/agents/get-started' },
  { path: resolve(root, 'dist/zh/cases/index.html'), disclaimer: '不代表客户采用或背书', quickstart: '/zh/docs/agents/get-started' },
]) {
  requireOrderedText(rule.path, ['id="reference-hero"', 'id="reference-builds"', 'id="reference-source"'], 'reference-build index must show the applications before the documentation baseline');
  requireOccurrenceCount(rule.path, 'data-reference-disclaimer', 1, 'reference-build index must disclose its non-customer boundary once');
  requirePattern(rule.path, new RegExp(rule.disclaimer), 'reference-build index must reject customer-adoption inference');
  requirePattern(rule.path, /50d5035c68456c9106626f748cf4c169c2057beb/, 'reference-build index must expose the registry-owned Awaken source revision');
  requirePattern(rule.path, /2026-08-31/, 'reference-build index must expose when product claims were checked');
  requirePattern(rule.path, new RegExp(`href="${rule.quickstart}"`), 'reference evidence must lead to the matching localized quickstart');
  requireOccurrenceCount(rule.path, 'data-evidence-source-revision', 1, 'reference evidence must link the exact public source revision once');
  requireOccurrenceCount(rule.path, 'data-evidence-standard', 3, 'reference evidence must distinguish source checks, external reproduction, and external acceptance');
  requireOccurrenceCount(rule.path, 'data-case-index=', 3, 'reference-build index must expose exactly three product shapes');
}

for (const rule of [
  { path: resolve(root, 'dist/docs/index.html'), architectureHref: '/docs/agents/concepts/architecture', star: 'Star on GitHub' },
  { path: resolve(root, 'dist/zh/docs/index.html'), architectureHref: '/zh/docs/agents/concepts/architecture', star: '在 GitHub Star' },
]) {
  requireOrderedText(rule.path, ['id="docs-hero"', 'id="start"', 'id="products"', 'id="agents-paths"'], 'docs index must move from task to two products and then their existing responsibility paths');
  for (const product of ['Awaken Agents', 'Awaken Workforce']) {
    requirePattern(rule.path, new RegExp(product), `docs index must expose ${product}`);
  }
  requirePattern(rule.path, new RegExp(`href="${rule.architectureHref}"`), 'docs index must expose the canonical architecture owner');
  requirePattern(rule.path, new RegExp(rule.star), 'docs index must retain a GitHub Star exit');
  requireOccurrenceCount(rule.path, 'data-awaken-event-location="docs-index"', 1, 'docs index must measure its page-specific GitHub Star exit');
  rejectPattern(rule.path, /Each fact keeps one documentation owner|每一项事实只保留一个文档所有者/, 'docs index must explain the reader task rather than its editorial governance');
}
// Cause/effect design for the 390px documentation navigation:
// C1: product, version, search, Star, theme, and language controls can each fit
//     alone while their combined intrinsic width pushes the page sideways.
// C2: a horizontal product rail can hide Workforce or Star beyond the viewport.
// C3: desktop-only section and page navigation can leave mobile readers with no
//     route into the document tree even when the product links remain visible.
// C4: a separate mobile tree can drift from the desktop navigation authority.
// E1: mobile keeps compact product, search, and language actions without overflow.
// E2: both public products and Star stay visible in a wrapping grid.
// E3: one expandable mobile control exposes the section tree and page outline.
// E4: desktop and mobile render the same canonical DocsNavigation component.
// Decision table:
// | Rule | compact header | visible grid | mobile tree | shared owner | Outcome |
// | H1   | yes            | yes          | yes         | yes          | accept  |
// | H2   | no             | any          | any         | any          | reject  |
// | H3   | yes            | no           | any         | any          | reject  |
// | H4   | yes            | yes          | no          | any          | reject  |
// | H5   | yes            | yes          | yes         | no           | reject  |
const docsShellPath = resolve(root, 'src/components/DocsShell.astro');
requirePattern(docsShellPath, /flex min-w-0 items-center gap-2 text-sm sm:gap-3/, 'docs header must use compact spacing and permit shrinkage before the small breakpoint');
requirePattern(docsShellPath, /product === 'agents' \? 'Agents'[\s\S]*class="hidden sm:inline">\{productLabel\}/, 'docs header must use a compact mobile product label');
requirePattern(docsShellPath, /<details data-site-menu class="relative hidden md:block">/, 'docs header must leave the version selector out of the narrow mobile row');
requirePattern(docsShellPath, /<AppearanceSelect lang=\{lang\}/, 'docs header must keep the appearance selection available with the shared compact control');
requirePattern(docsShellPath, /<span class="sm:hidden">\{localeRegistry\[alternateLang\]\.shortName\}<\/span>/, 'docs header must use the registry-owned compact mobile language label');
requirePattern(docsShellPath, /data-awaken-event-location="docs-mobile-nav"/, 'docs mobile product nav must retain the measurable GitHub Star action');
requirePattern(docsShellPath, /grid grid-cols-3 gap-2 font-mono text-xs sm:grid-cols-4/, 'docs mobile product navigation must wrap all exits instead of scrolling horizontally');
requirePattern(docsShellPath, /class="col-span-3[^"]*sm:col-span-1"/, 'docs mobile Star exit must stay visible below products at 390px and join the row at sm');
requirePattern(docsShellPath, /<details data-docs-mobile-sections[\s\S]*label=\{copy\.mobileNav\}[\s\S]*aria-label=\{copy\.mobileToc\}/, 'mobile docs must expose both localized section and page navigation');
requireOccurrenceCount(docsShellPath, '<DocsNavigation', 2, 'desktop and mobile navigation must share one renderer');
rejectPattern(docsShellPath, /<nav class="[^"]*overflow-x-auto[^"]*" aria-label=\{isZh \? '产品文档'/, 'mobile product navigation must not hide exits in a horizontal rail');

for (const rule of [
  { path: resolve(root, 'dist/principles/index.html'), owner: 'Keep the work, responsibility, and completion decision connected', participation: 'Ask questions and contribute' },
  { path: resolve(root, 'dist/zh/principles/index.html'), owner: '让工作、责任与完成决定始终连在一起', participation: '提出问题或参与贡献' },
]) {
  requireOrderedText(rule.path, ['id="principles-hero"', 'id="principles-owner"', 'id="principles-commitments"', 'id="principles-status"', 'id="principles-trust"', 'id="principles-participate"'], 'principles must move from ownership through commitments, status, public trust owners, and participation');
  requirePattern(rule.path, new RegExp(rule.owner), 'principles must begin from the work and its human owner');
  requirePattern(rule.path, new RegExp(rule.participation), 'principles must end with a direct invitation to participate');
  requireOccurrenceCount(rule.path, 'data-awaken-event-location="principles"', 1, 'principles must retain one measurable GitHub Star exit');
  requireOccurrenceCount(rule.path, 'data-trust-owner=', 5, 'principles must expose the five existing source, license, privacy, implementation, and security owners');
}

// Cause/effect design for keyboard, motion, and release identity:
// C1 repeated navigation can delay keyboard users; C2 animations can violate a
// reduced-motion preference; C3 healthy HTML can still be a stale release.
// E1 one localized skip link targets one focusable main landmark; E2 global CSS
// disables nonessential motion; E3 every representative artifact carries one
// build revision marker. Decision table: all three present -> accept; a missing
// target, duplicated marker, or component-specific locale branch -> reject.
for (const path of [
  resolve(root, 'dist/index.html'),
  resolve(root, 'dist/zh/index.html'),
  resolve(root, 'dist/enterprise/index.html'),
  resolve(root, 'dist/zh/enterprise/index.html'),
  resolve(root, 'dist/docs/agents/get-started/index.html'),
  resolve(root, 'dist/zh/docs/agents/get-started/index.html'),
]) {
  requireOccurrenceCount(path, 'href="#main-content"', 1, 'every page must expose one skip link');
  requireOccurrenceCount(path, 'id="main-content"', 1, 'every page must expose one skip-link target');
  requireOccurrenceCount(path, 'name="awakenworks-build-revision"', 1, 'every page must expose one deployment revision marker');
}
requirePattern(resolve(root, 'src/styles/global.css'), /prefers-reduced-motion: reduce[\s\S]*animation-duration: 0\.01ms[\s\S]*transition-duration: 0\.01ms/, 'global styles must honor reduced-motion preferences');

for (const rule of [
  { path: resolve(root, 'dist/blog/index.html'), headline: 'Start with a real problem', archive: 'Article archive' },
  { path: resolve(root, 'dist/zh/blog/index.html'), headline: '从真实问题开始', archive: '文章列表' },
]) {
  requireOrderedText(rule.path, ['id="blog-hero"', 'id="blog-archive"'], 'blog index must explain its editorial scope before listing articles');
  requirePattern(rule.path, new RegExp(rule.headline), 'blog index must state the problem-first editorial promise');
  requirePattern(rule.path, new RegExp(`aria-label="${rule.archive}"`), 'blog archive must have a reader-facing label');
  requirePattern(rule.path, /AwakenWorks · 2026-/, 'blog cards must expose recorded author and date');
  requireOccurrenceCount(rule.path, 'data-awaken-event-location="blog-index"', 1, 'blog index must retain one measurable GitHub Star exit');
}

// Cause-effect design for individual engineering articles:
// C1: a title or opening can describe the company or an implementation inventory
//     without telling the reader which task or decision the article helps finish.
// C2: an article can duplicate the case page or reference documentation instead
//     of owning one editorial question and routing exact wiring to its owner.
// C3: repository timestamps can be stale or rounded, turning calendar history
//     into a false person-time, delivery-speed, parity, or quality claim.
// C4: English and Chinese can drift in task order, product mapping, limits, or
//     exact time disclosure even when both pages still build.
// C5: five generic Agent links can satisfy a count while offering no useful
//     comparison for design workflow, delegated work, or Skill delivery.
// C6: a proof-led conclusion can leave the reader with evidence terminology but
//     no supported next action.
// E1: each article opens with one reader task and moves through actions before
//     implementation detail.
// E2: introduction, Runtime, Design, Pilot, and Skill articles own distinct
//     questions; case and docs pages retain evidence and reference detail.
// E3: Design and Pilot show exact commit timestamps and calculated repository
//     intervals beside explicit non-person-time and non-parity language.
// E4: localized pairs retain the same causal sequence and truthful boundary.
// E5: every article row keeps exactly five official, topic-adjacent benchmarks.
// E6: each article ends by telling the reader where to start or what to decide.
// E7: implementation articles expose one concrete duplicate-path or concurrency
//     risk and the single authoritative mechanism that removes it.
// Decision table:
// | Rule | task first | distinct scope | exact time/limits | topic benchmarks | next action | Outcome |
// | B1   | yes        | yes            | n/a               | five             | yes         | accept  |
// | B2   | no         | any            | any               | any              | any         | reject  |
// | B3   | yes        | no             | any               | any              | any         | reject  |
// | B4   | yes        | yes            | wrong/missing     | any              | any         | reject  |
// | B5   | yes        | yes            | valid             | generic/not five | any         | reject  |
// | B6   | yes        | yes            | valid             | five             | missing     | reject  |
for (const rule of [
  {
    path: resolve(root, 'src/content/blog/en/2026-06-introducing-awakenworks.md'),
    markers: ['## Start with one recoverable task', '## Run it as one Session', '## Run the interruption test'],
    next: /quickstart[\s\S]*interrupt[\s\S]*reconnect[\s\S]*Star Awaken/,
  },
  {
    path: resolve(root, 'src/content/blog/zh/2026-06-introducing-awakenworks.md'),
    markers: ['## 先选一项必须恢复的任务', '## 用一个 Session 跑通', '## 跑一次中断与重连'],
    next: /快速开始[\s\S]*中断客户端[\s\S]*重新连接[\s\S]*Star Awaken/,
  },
  {
    path: resolve(root, 'src/content/blog/en/2026-08-awaken-runtime-boundary.md'),
    markers: ['## Send every client into the same Session', '## Pin the credential before the Run starts', '## Choose when the Sandbox should begin', '## Check one operating record'],
    next: /If you are deciding how a Skill should load/,
  },
  {
    path: resolve(root, 'src/content/blog/zh/2026-08-awaken-runtime-boundary.md'),
    markers: ['## 让所有客户端进入同一个 Session', '## Run 开始前固定凭据', '## 决定 Sandbox 何时启动', '## 在一份运营记录里检查结果'],
    next: /决定 Skill 应怎样加载/,
  },
  {
    path: resolve(root, 'src/content/blog/en/2026-08-build-claude-design-style-workflow.md'),
    markers: ['## Begin with one reviewable result', '## Keep design facts with the design product', '## Turn Session files into an immutable Revision', '## Let feedback create the next Revision', '## Accept the result explicitly'],
    next: /To try the same pattern, begin with the \[Awaken quickstart\]/,
  },
  {
    path: resolve(root, 'src/content/blog/zh/2026-08-build-claude-design-style-workflow.md'),
    markers: ['## 先得到一个可以评审的结果', '## 设计事实留在设计产品里', '## 把 Session 文件发布成不可变 Revision', '## 让反馈产生下一个 Revision', '## 明确验收结果'],
    next: /如果要尝试这套方法，先完成 \[Awaken 快速开始\]/,
  },
  {
    path: resolve(root, 'src/content/blog/en/2026-08-build-manus-style-agent-product.md'),
    markers: ['## Begin with one Mission that can continue', '## Build the product experience in Pilot', '## Reuse Awaken for execution', '## Follow one command to its result'],
    next: /To build the first Mission, run the \[Awaken quickstart\]/,
  },
  {
    path: resolve(root, 'src/content/blog/zh/2026-08-build-manus-style-agent-product.md'),
    markers: ['## 先完成一项可以继续的 Mission', '## 在 Pilot 中实现产品体验', '## 让 Awaken 承担执行', '## 跟随一条命令直到结果'],
    next: /要构建第一项 Mission，先完成 \[Awaken 快速开始\]/,
  },
  {
    path: resolve(root, 'src/content/blog/en/2026-08-skill-tool-or-prompt.md'),
    markers: ['## Start with what the Skill needs', '## Freeze one delivery path for the Session', '## Choose from capability, not preference', '## Let the Runtime make the final choice'],
    next: /To add a Skill, follow \[Use Skills Subsystem\]/,
  },
  {
    path: resolve(root, 'src/content/blog/zh/2026-08-skill-tool-or-prompt.md'),
    markers: ['## 先说明 Skill 需要什么', '## 为 Session 固定一条交付路径', '## 按能力选择，不按偏好选择', '## 让 Runtime 完成最终选择'],
    next: /要增加一份 Skill[\s\S]*开始/,
  },
]) {
  requireOrderedText(rule.path, rule.markers, 'engineering article must move from the reader task through its distinct decision path');
  requirePattern(rule.path, rule.next, 'engineering article must end with one supported next action');
}

for (const rule of [
  {
    path: resolve(root, 'src/content/blog/en/2026-08-build-manus-style-agent-product.md'),
    decision: /projectMission[\s\S]*newer complete plan replaces[\s\S]*status table plus a Plan table[\s\S]*both synchronization problems/,
  },
  {
    path: resolve(root, 'src/content/blog/zh/2026-08-build-manus-style-agent-product.md'),
    decision: /projectMission[\s\S]*较新的完整计划会替换旧快照[\s\S]*status 表和 Plan 表[\s\S]*两类同步问题/,
  },
  {
    path: resolve(root, 'src/content/blog/en/2026-08-build-claude-design-style-workflow.md'),
    decision: /MAX\(sequence\) \+ 1[\s\S]*publisher now locks[\s\S]*inside the transaction[\s\S]*DesignWritebackPort[\s\S]*same (?:Revision )?publisher/,
  },
  {
    path: resolve(root, 'src/content/blog/zh/2026-08-build-claude-design-style-workflow.md'),
    decision: /MAX\(sequence\) \+ 1[\s\S]*事务中锁定 Project[\s\S]*DesignWritebackPort[\s\S]*同一个 Publisher/,
  },
]) {
  requirePattern(rule.path, rule.decision, 'engineering use case must connect a concrete failure mode to one authoritative implementation path');
}

for (const path of [
  resolve(root, 'src/content/docs/platform/current/en/concepts/architecture.md'),
  resolve(root, 'src/content/docs/platform/current/zh/concepts/architecture.md'),
]) {
  requirePattern(path, /Delivery composition|交付组合/, 'architecture owner must explain self-hosted, Pro, and Cloud composition');
  requirePattern(path, /Cloud[\s\S]*does not copy|Cloud[\s\S]*不复制/, 'architecture owner must reject a second Cloud product authority');
  requirePattern(path, /Static structure|静态结构/, 'architecture owner must retain the static structure view');
  requirePattern(path, /Dynamic behavior|动态行为/, 'architecture owner must retain the dynamic behavior view');
  requirePattern(path, /Apache-2\.0/, 'architecture owner must label the open-source Agents core');
  requirePattern(path, /non-open-source|非开源/, 'architecture owner must distinguish commercial delivery from the open-source core');
  requirePattern(path, /early hosted preview|早期托管预览/, 'architecture owner must state the current Cloud preview boundary without importing conversion language into technical docs');
  requirePattern(path, /public access pending|公开接口待开放/, 'architecture owner must not imply that the Cloud interface is public');
}

const buildLogRules = [
  {
    path: resolve(root, 'dist/blog/2026-08-build-manus-style-agent-product/index.html'),
    time: 'exactly\\s+16 hours, 39 minutes, and 31 seconds',
    disclaimer: 'not a claim of 17 person-hours',
    caseHref: '/cases/pilot',
  },
  {
    path: resolve(root, 'dist/zh/blog/2026-08-build-manus-style-agent-product/index.html'),
    time: '精确间隔为 16 小时 39 分 31 秒',
    disclaimer: '不代表只投入了 17 个人时',
    caseHref: '/zh/cases/pilot',
  },
  {
    path: resolve(root, 'dist/blog/2026-08-build-claude-design-style-workflow/index.html'),
    time: 'exact repository interval of 5 days, 14 hours,\\s+44 minutes, and 56 seconds',
    disclaimer: 'not person-time',
    caseHref: '/cases/design',
  },
  {
    path: resolve(root, 'dist/zh/blog/2026-08-build-claude-design-style-workflow/index.html'),
    time: '精确仓库间隔为 5 天 14 小时 44 分 56 秒',
    disclaimer: '不是人力投入',
    caseHref: '/zh/cases/design',
  },
];

for (const rule of buildLogRules) {
  requirePattern(rule.path, new RegExp(rule.time), 'build log must expose its exact repository interval');
  requirePattern(rule.path, new RegExp(rule.disclaimer), 'build log must distinguish repository time from effort/parity claims');
  requirePattern(rule.path, new RegExp(`href="${rule.caseHref}"`), 'build log must route to its evidence-bounded reference build');
  requirePattern(rule.path, /github\.com\/AwakenWorks\/awaken/, 'build log must route community intent to the canonical Awaken repository');
}

for (const rule of [
  {
    path: resolve(root, 'dist/blog/2026-06-introducing-awakenworks/index.html'),
    boundary: /The application owns its\s+domain\. Awaken owns durable Agent execution\./,
    sequence: ['publish or select an Agent', 'create a Session', 'reconnect from committed facts', 'inspect the record'],
    verification: 'Run the interruption test',
    architectureHref: '/docs/agents/concepts/architecture/',
  },
  {
    path: resolve(root, 'dist/zh/blog/2026-06-introducing-awakenworks/index.html'),
    boundary: /应用拥有自己的业务领域，Awaken 拥有持久 Agent\s+执行/,
    sequence: ['发布或选择 Agent', '创建 Session', '从已提交事实重连', '检查执行记录'],
    verification: '跑一次中断与重连',
    architectureHref: '/zh/docs/agents/concepts/architecture/',
  },
]) {
  requirePattern(rule.path, rule.boundary, 'introduction must state one application/platform ownership boundary');
  requireOrderedText(rule.path, rule.sequence, 'introduction must show execution, recovery, and inspection in causal order');
  requirePattern(rule.path, new RegExp(rule.verification), 'introduction must invite falsifiable evaluation instead of asking for trust');
  requirePattern(rule.path, new RegExp(`href="${rule.architectureHref}"`), 'introduction must route technical depth to the architecture owner');
  requirePattern(rule.path, /github\.com\/AwakenWorks\/awaken/, 'introduction must retain the canonical source and Star path');
}

for (const rule of [
  { path: resolve(root, 'dist/privacy/index.html'), formspree: 'Formspree', umami: 'Umami Cloud' },
  { path: resolve(root, 'dist/zh/privacy/index.html'), formspree: 'Formspree', umami: 'Umami Cloud' },
]) {
  requireOrderedText(rule.path, ['id="privacy-notice"', 'id="privacy-provided"', 'id="privacy-analytics"', 'id="privacy-purpose"', 'id="privacy-processors"', 'id="privacy-retention"', 'id="privacy-contact"'], 'privacy must move from scope and collected data through purpose, processors, retention, and contact');
  requirePattern(rule.path, new RegExp(rule.formspree), 'privacy notice must name the default form processor');
  requirePattern(rule.path, new RegExp(rule.umami), 'privacy notice must name the default analytics processor');
  requirePattern(rule.path, /hello@awakenworks\.com/, 'privacy notice must provide a data-request contact');
  requirePattern(rule.path, /href="mailto:hello@awakenworks\.com"/, 'privacy notice must provide a working email action');
}

// Cause/effect design for consolidating Platform and Runtime under one product:
// C1: a full /harness landing duplicates the Awaken product narrative and lets
//     an implementation layer look like a second product.
// C2: removing that landing can orphan maintainers unless the product page
//     exposes one concise Runtime decision linked to its canonical definition,
//     which in turn links to the stable internal documentation owner.
// C3: repeating the control-plane and execution-semantics explanation on the
//     product page creates a second architecture owner.
// C4: retired aliases can recreate a second landing or documentation URL.
// E1: /agents is the single product landing and links one Runtime decision after proof.
// E2: the concept page defines the public category boundary and links maintainers
//     to /docs/agents/runtime for internal extension detail.
// E3: the landing does not recreate a Runtime section or architecture explanation.
// E4: retired aliases are absent from the generated artifact.
// Decision table:
// | Rule | one landing | docs route | duplicate explanation | aliases absent | Outcome |
// | R1 | yes | yes | no | yes | accept |
// | R2 | no | any | any | any | reject |
// | R3 | yes | no | any | any | reject |
// | R4 | yes | yes | yes | any | reject |
// | R5 | yes | yes | no | no | reject |
const runtimeIdentityRules = [
  {
    landing: resolve(root, 'dist/agents/index.html'),
    docs: resolve(root, 'src/content/docs/platform/current/en/concepts/agent-runtime.md'),
    decision: /Understand the runtime boundary/,
    docsOwnership: /Awaken Runtime[\s\S]*Rust execution core inside[\s\S]*Awaken Agents/,
    docsHref: '/docs/agents/concepts/agent-runtime',
    internalHref: '/docs/agents/runtime/',
  },
  {
    landing: resolve(root, 'dist/zh/agents/index.html'),
    docs: resolve(root, 'src/content/docs/platform/current/zh/concepts/agent-runtime.md'),
    decision: /理解 Runtime 边界/,
    docsOwnership: /Awaken Runtime[\s\S]*Rust 执行内核[\s\S]*Awaken Agents/,
    docsHref: '/zh/docs/agents/concepts/agent-runtime',
    internalHref: '/zh/docs/agents/runtime/',
  },
];

for (const rule of runtimeIdentityRules) {
  requireOrderedText(rule.landing, ['id="agents-hero"', 'id="platform-preview"', 'id="agents-boundary"', 'id="agents-outcomes"', 'id="agents-decisions"'], 'Agents must keep the embedded Runtime boundary before value and the Runtime Docs decision after product evidence');
  requirePattern(rule.landing, rule.decision, 'Awaken must name the Runtime extension decision without recreating the guide');
  requirePattern(rule.landing, new RegExp(`href="${rule.docsHref}"`), 'Awaken must route Runtime maintainers to the stable technical documentation');
  requireOccurrenceCount(rule.landing, 'id="runtime"', 0, 'Agents landing must not recreate a Runtime explanation section');
  requirePattern(rule.docs, rule.docsOwnership, 'Runtime concept must keep the product and execution-core identities distinct');
  requirePattern(rule.docs, new RegExp(rule.internalHref), 'Runtime concept must keep internal extension documentation reachable');
  rejectPattern(rule.docs, /title: "Awaken Runtime\s*[（(]Harness[）)]"|Awaken Harness (?:is|是)(?: the)? product/, 'Runtime docs must not recreate a Harness product identity');
}

for (const path of [
  resolve(root, 'dist/agents/index.html'),
  resolve(root, 'dist/zh/agents/index.html'),
]) {
  rejectPattern(path, /Maintain or extend Runtime|维护或扩展 Runtime|Most teams never need to use Runtime|大多数团队不需要直接使用 Runtime/, 'Agents landing must not present Runtime as a separate public product');
}

// Cause/effect design for one canonical product URL:
// C1: retaining retired product or docs aliases recreates duplicate page owners.
// C2: deleting only the top-level aliases can leave documentation aliases behind.
// E1: each product has one generated landing and documentation URL family.
// E2: top-level and documentation aliases are both absent.
// Decision table:
// | Rule | top-level aliases | docs aliases | Outcome |
// | L1   | absent            | absent       | accept  |
// | L2   | present           | any          | reject  |
// | L3   | absent            | present      | reject  |
for (const path of [
  'dist/platform', 'dist/harness', 'dist/flow',
  'dist/zh/platform', 'dist/zh/harness', 'dist/zh/flow',
  'dist/docs/platform', 'dist/docs/harness', 'dist/docs/flow',
  'dist/zh/docs/platform', 'dist/zh/docs/harness', 'dist/zh/docs/flow',
]) {
  if (existsSync(resolve(root, path))) failures.push(`${path}: retired alias must not be emitted`);
}

// Cause/effect design for reference-build and engineering-story separation:
// C1: a case page owns product shape, smallest trial, and current evidence;
// C2: Pilot and Awaken Design also have a long implementation
// narrative; C3: copying
// that narrative into the case would create two editorial owners. E1: the case
// stays scannable and links to the one engineering article; DeepSeek keeps no
// empty article action; E2: the `/cases/design` compatibility route uses the
// one public Awaken Design name without creating a Classroom-branded parallel
// application. Decision rules C1/C2 accept one contextual link only where an
// article exists and reject copied long-form sections.
const caseRules = [
  { prefix: '', slug: 'pilot', href: '/docs/agents/get-started', blog: '/blog/2026-08-build-manus-style-agent-product' },
  { prefix: '', slug: 'deepseek-harness', href: '/docs/agents/how-to/connect-a-published-agent' },
  { prefix: '', slug: 'design', href: '/docs/agents/how-to/build-an-agent-with-the-assistant', blog: '/blog/2026-08-build-claude-design-style-workflow', currentOwner: 'Awaken Design' },
  { prefix: '/zh', slug: 'pilot', href: '/zh/docs/agents/get-started', blog: '/zh/blog/2026-08-build-manus-style-agent-product' },
  { prefix: '/zh', slug: 'deepseek-harness', href: '/zh/docs/agents/how-to/connect-a-published-agent' },
  { prefix: '/zh', slug: 'design', href: '/zh/docs/agents/how-to/build-an-agent-with-the-assistant', blog: '/zh/blog/2026-08-build-claude-design-style-workflow', currentOwner: 'Awaken Design' },
];

for (const rule of caseRules) {
  const path = resolve(root, `dist${rule.prefix}/cases/${rule.slug}/index.html`);
  requireOrderedText(path, ['id="case-hero"', 'id="case-result"', 'id="case-boundary"', 'id="case-try"', 'id="case-availability"', 'id="case-build-path"', 'id="case-cta"'], `${rule.slug} must explain availability before architectural build advice`);
  requirePattern(path, new RegExp(`href="${rule.href}"`), `${rule.slug} must use its tailored primary action`);
  requireOccurrenceCount(path, 'data-evidence-level=', 3, `${rule.slug} must retain three explicit current-status entries`);
  requirePattern(path, /Where to check:|检查位置：/, `${rule.slug} must identify where a reader can inspect each status`);
  // Source-availability graph: C1 fixed source is qualified; C2 only local
  // working state exists; C3 a fixture clip exists without real-provider proof.
  // E1 C1 exposes one immutable source archive + exact baseline/digest;
  // E2 C2 retains the local/pending boundary; E3 C3 keeps deterministic scope.
  // Rules S1 Pilot/Harness -> E1; S2 Design -> E2; S3 Harness -> E1+E3.
  requireOccurrenceCount(path, 'data-case-source class=', 1, `${rule.slug} must expose its application source baseline once`);
  if (rule.slug === 'design') {
    requirePattern(path, /currently local|path is local|仍在本地|目前仍在本地/, 'Design must retain its local qualification boundary');
  } else {
    requirePattern(path, /source-[a-f0-9]{40}\.zip/, `${rule.slug} must expose a commit-qualified source archive`);
    requireOccurrenceCount(path, 'data-case-source-digest', 1, `${rule.slug} must expose one archive digest`);
  }
  if (rule.slug === 'deepseek-harness') {
    requireOccurrenceCount(path, 'data-case-walkthrough', 1, 'Harness must expose its one existing deterministic recording');
    requirePattern(path, /fixture data|夹具数据/, 'Harness recording must retain its fixture scope');
  }
  if (rule.currentOwner) {
    requirePattern(path, new RegExp(rule.currentOwner), `${rule.slug} must identify the current executable owner`);
  }
  rejectPattern(path, /Publish only what can be reproduced|只发布能够复现的主张|Current evidence|当前证据|Evidence source:|证据来源：/, `${rule.slug} must keep status available without leading as an audit report`);
  rejectPattern(path, /GTM optimization gates|GTM 优化门槛/, `${rule.slug} must not expose internal distribution work`);
  if (rule.blog) {
    requirePattern(path, new RegExp(`href="${rule.blog}"`), `${rule.slug} must link its separate engineering narrative`);
    requireOccurrenceCount(path, `data-awaken-event="case-${rule.slug}-engineering-blog"`, 1, `${rule.slug} must expose one measurable engineering-story action`);
  } else {
    requireOccurrenceCount(path, `data-awaken-event="case-${rule.slug}-engineering-blog"`, 0, `${rule.slug} must not render an empty engineering-story action`);
  }
}

for (const path of [
  resolve(root, 'src/i18n/content.ts'),
  resolve(root, 'src/components/Principles.astro'),
  resolve(root, 'src/components/BlogIndex.astro'),
  resolve(root, 'src/components/WorkforceLanding.astro'),
]) {
  rejectPattern(path, /—/, 'primary public copy must use direct punctuation instead of em-dash cadence');
}

// Cause/effect design for measurable conversion exits:
// C1 the same intent appears in several components; C2 page URL alone cannot
// distinguish placement or originating product; C3 event names have history.
// E1 preserve event names; E2 require bounded location/product/destination on
// every literal conversion link. Decision table: all three dimensions ->
// accept; renamed event or any missing dimension -> reject.
const conversionEvents = new Set([
  'developer_evaluation_selected',
  'github_star_selected',
  'private_deployment_cooperation_selected',
  'enterprise_intent_selected',
]);
for (const path of filesBelow(resolve(root, 'src/components'), (candidate) => candidate.endsWith('.astro'))) {
  const source = readFileSync(path, 'utf8');
  for (const match of source.matchAll(/<a\b[^>]*data-awaken-event="([^"]+)"[^>]*>/gsu)) {
    if (!conversionEvents.has(match[1])) continue;
    for (const dimension of ['location', 'product', 'destination']) {
      if (!match[0].includes(`data-awaken-event-${dimension}=`)) {
        failures.push(`${path}: ${match[1]} link must declare ${dimension}`);
      }
    }
  }
}

// Cause/effect design for the integration growth entry:
// C1 visitors search by an existing protocol; C2 technical scope already has
// canonical Docs owners; C3 locale routes can drift; C4 an empty SEO page could
// imply unsupported integrations. E1 render six verified entry cards in both
// locales; E2 link each card to existing Docs; E3 state that this directory is
// not a compatibility authority; E4 expose one measurable Quickstart path.
// Decision table: bilingual route + six Docs links + boundary + CTA -> accept;
// missing peer, copied matrix, missing target, or unmeasured CTA -> reject.
const integrationRules = [
  { path: resolve(root, 'dist/integrations/index.html'), prefix: '', title: 'Connect through the protocol your application already uses.' },
  { path: resolve(root, 'dist/zh/integrations/index.html'), prefix: '/zh', title: '从应用已经使用的协议接入。' },
];
for (const rule of integrationRules) {
  requirePattern(rule.path, new RegExp(rule.title), 'integration directory must render its localized decision headline');
  requireOccurrenceCount(rule.path, 'data-integration-card=', 6, 'integration directory must project six verified documentation entries');
  requireOccurrenceCount(rule.path, 'data-awaken-event="integration_selected"', 6, 'every integration entry must be measurable');
  requireOccurrenceCount(rule.path, 'data-integration-authority', 1, 'integration directory must state its non-authoritative projection boundary once');
  for (const href of [
    '/docs/agents/protocols/managed-agents',
    '/docs/agents/how-to/integrate-ai-sdk-frontend',
    '/docs/agents/how-to/integrate-copilotkit-ag-ui',
    '/docs/agents/protocols/mcp',
    '/docs/agents/protocols/a2a',
    '/docs/agents/protocols/acp',
  ]) requirePattern(rule.path, new RegExp(`href="${rule.prefix}${href}"`), `integration directory must link to ${rule.prefix}${href}`);
  requirePattern(rule.path, /data-awaken-event="developer_evaluation_selected"[^>]*data-awaken-event-location="integrations-hero"[^>]*data-awaken-event-product="agents"[^>]*data-awaken-event-destination="quickstart"/, 'integration hero must expose one fully dimensioned Quickstart exit');
}

const analyticsGatePath = resolve(root, 'scripts/check-analytics-live.mjs');
const liveGatePath = resolve(root, 'scripts/check-live.mjs');
const pagesWorkflowPath = resolve(root, '.github/workflows/pages.yml');
// Asset URL rules: shared non-localized case release fact + root/repository base
// -> one deployment prefix, never a translated copy or raw-root bypass.
requirePattern(resolve(root, 'src/components/CaseDetail.astro'), /src=\{withSiteBase\(item\.walkthrough\.src\)\}/, 'case videos must use the deployment URL authority');
requirePattern(resolve(root, 'src/components/CaseDetail.astro'), /withSiteBase\(item\.sourceArchive\.href\)/, 'case source downloads must use the deployment URL authority');
// Release decision table: browser failure -> no Pages artifact/deploy; browser
// pass -> existing artifact upload -> exact-revision verification. No second suite.
requireOrderedText(pagesWorkflowPath, ['Validate standalone content and Pages paths', 'Install browser test runtime', 'Verify browser journeys before publication', 'Upload Pages artifact'], 'browser qualification must block publication of the same built artifact');
requirePattern(pagesWorkflowPath, /pnpm exec playwright install --with-deps chromium[\s\S]*pnpm exec playwright test/, 'Pages must run the existing browser suite with its pinned runtime');
requirePattern(analyticsGatePath, /User-Agent[\s\S]*event-data-pivot[\s\S]*Authorization: `Bearer \$\{apiKey\}`/, 'analytics gate must send with a user agent and query authenticated event data');
requirePattern(analyticsGatePath, /UMAMI_API_KEY is required[\s\S]*AWAKENWORKS_EXPECTED_REVISION is required/, 'analytics gate must reject missing credentials or release identity');
// R1 public SITE ID only -> normal deployment plus explicit unconfigured API
// readback; R2 private key configured -> strict checker runs and failure is not
// ignored. Absence is a skipped capability, never fabricated data-plane PASS.
requirePattern(pagesWorkflowPath, /UMAMI_API_KEY: \$\{\{ secrets\.UMAMI_API_KEY \}\}[\s\S]*Verify deployed revision[\s\S]*Verify analytics data plane[\s\S]*if: \$\{\{ env\.UMAMI_API_KEY != '' \}\}/, 'configured private analytics readback must follow revision verification');
requirePattern(pagesWorkflowPath, /Record unconfigured analytics readback[\s\S]*if: \$\{\{ env\.UMAMI_API_KEY == '' \}\}[\s\S]*not run because UMAMI_API_KEY is not configured/, 'SITE ID-only deployment must disclose unexecuted API readback');
rejectPattern(pagesWorkflowPath, /continue-on-error|check-analytics-live\.mjs\s*\|\|/, 'configured analytics verification failures must not be suppressed');
rejectPattern(pagesWorkflowPath, /PUBLIC_UMAMI_API_KEY/, 'Umami API credentials must never enter the public build environment');
requirePattern(liveGatePath, /'\/integrations\/'[\s\S]*'\/zh\/integrations\/'/, 'live release gate must verify both integration directory locales');

for (const path of [
  resolve(root, 'dist/docs/agents/index.html'),
  resolve(root, 'dist/zh/docs/agents/index.html'),
  resolve(root, 'dist/docs/objects/index.html'),
  resolve(root, 'dist/zh/docs/objects/index.html'),
  resolve(root, 'dist/docs/workforce/index.html'),
  resolve(root, 'dist/zh/docs/workforce/index.html'),
]) {
  rejectPattern(path, /<meta name="robots" content="noindex,follow">/, 'current product docs must be indexable with an explicit maturity label');
}

for (const path of [
  resolve(root, 'dist/docs/search-index.json'),
  resolve(root, 'dist/zh/docs/search-index.json'),
]) {
  const records = JSON.parse(readFileSync(path, 'utf8'));
  for (const product of ['Awaken Agents', 'Workforce · Business Data & Actions (Objects)', 'Awaken Workforce']) {
    if (!records.some((record) => record.product === product)) {
      failures.push(`${path}: public search must expose ${product}`);
    }
  }
  if (records.some((record) => /\/docs\/(?:platform|harness|flow)(?:\/|$)/.test(record.href))) {
    failures.push(`${path}: public search must use current product paths instead of legacy routes`);
  }
}

const sitemap = readFileSync(resolve(root, 'dist/sitemap-0.xml'), 'utf8');
if (!/\/docs\/agents\//.test(sitemap) || !/\/docs\/objects\//.test(sitemap) || !/\/docs\/workforce\//.test(sitemap) || !/\/cases\/pilot\//.test(sitemap) || !/\/integrations\//.test(sitemap)) {
  failures.push('sitemap: both product and internal-module docs, case pages, and the integration directory must be discoverable');
}
if (/(?:\/zh)?\/(?:platform|harness|flow)(?:\/|<)|\/docs\/(?:platform|harness|flow)(?:\/|<)/.test(sitemap)) {
  failures.push('sitemap: legacy product routes must not be discoverable');
}

if (failures.length > 0) {
  process.stderr.write(`Home checks failed (${failures.length}):\n${failures.map((failure) => `- ${failure}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('Home checks passed: two public products, Workforce module routes, one shared opportunity form, and measurable exits.\n');
