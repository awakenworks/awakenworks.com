import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  brandMarkAssetStem,
  brandMarkBody,
  brandMarkPalette,
  brandMarkSchemes,
  publicBrandMarks,
  renderAdaptiveFaviconSvg,
  renderBrandMarkSvg,
} from '../src/lib/brandMarks.mjs';

const root = resolve(import.meta.dirname, '..');
const failures = [];

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
const brandMarkSource = resolve(root, 'src/lib/brandMarks.mjs');
requireOccurrenceCount(
  brandMarkSource,
  'const awakenA = Object.freeze(',
  1,
  'AwakenWorks and Agents must reuse one original A geometry owner',
);
requireOccurrenceCount(
  brandMarkSource,
  'function decisionDot(',
  1,
  'the brand family must reuse one circular direction-point primitive',
);
rejectPattern(brandMarkSource, /decisionDiamond/, 'the geometric diamond must not replace the original circular Awaken motif');
if (brandMarkBody('works') !== brandMarkBody('agents')) {
  failures.push('brandMarks.mjs: AwakenWorks and Agents must share exactly one A geometry');
}
for (const scheme of brandMarkSchemes) {
  const worksPalette = brandMarkPalette('works', scheme);
  const agentsPalette = brandMarkPalette('agents', scheme);
  if (worksPalette.primary === agentsPalette.primary) {
    failures.push(`brandMarks.mjs: AwakenWorks and Agents need distinct ${scheme} primary hues`);
  }
  if (worksPalette.decision !== agentsPalette.decision) {
    failures.push(`brandMarks.mjs: AwakenWorks and Agents must share the ${scheme} judgment accent`);
  }
}
for (const mark of publicBrandMarks) {
  const body = brandMarkBody(mark);
  if ((body.match(/data-role="decision"/g) ?? []).length !== 1) {
    failures.push(`brandMarks.mjs: ${mark} must contain one decision point`);
  }
  if (!body.includes(`data-silhouette="${expectedSilhouettes[mark]}"`)) {
    failures.push(`brandMarks.mjs: ${mark} must retain its ${expectedSilhouettes[mark]} silhouette`);
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
requirePattern(resolve(root, 'src/components/ProductMark.astro'), /scheme === 'auto'[\s\S]*on-dark[\s\S]*on-light/, 'theme-aware marks must render both explicit surface variants');
requirePattern(resolve(root, 'src/styles/global.css'), /data-theme='dark'[\s\S]*icon-when-light[\s\S]*data-theme='light'[\s\S]*icon-when-dark/, 'theme state must expose exactly the matching mark variant');
rejectPattern(resolve(root, 'README.md'), /Agents：开发者预览|Objects：开发者预览|Workforce：设计伙伴预览/, 'README must not duplicate registry-owned product availability labels');

// Cause/effect design for theme continuity:
// C1: a visitor has an explicit stored theme; C2: no stored preference exists
// and the operating system supplies one; C3: a route carries a different
// product brand; C4: the visitor explicitly toggles the theme.
// E1: stored preference wins; E2: the system preference is the one fallback on
// every route; E3: product navigation changes hue but not brightness; E4: only
// an explicit toggle persists a new preference.
// Decision table:
// | Rule | stored | system | route brand | toggle | Outcome |
// | T1   | dark   | light  | any         | no     | dark    |
// | T2   | none   | dark   | any         | no     | dark    |
// | T3   | none   | light  | any         | no     | light   |
// | T4   | any    | any    | any         | yes    | invert and persist |
const baseLayoutPath = resolve(root, 'src/layouts/Base.astro');
requirePattern(baseLayoutPath, /var theme = stored \|\| system;/, 'all routes must use one stored-or-system theme decision');
rejectPattern(baseLayoutPath, /productDefault|brand === 'managed'|brand === 'workforce'/, 'product routes must not select their own light or dark default');
requireOccurrenceCount(baseLayoutPath, "localStorage.setItem('theme', next)", 1, 'only the canonical explicit toggle may persist theme state');

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

// Cause-effect design for the company-to-three-product positioning journey:
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
//      behavior, adoption, or metrics that the three-product portfolio does not
//      actually establish.
// C35: product previews can still look like measured live instances when they use
//      invented counts, customer names, or unlabeled example records.
// C36: unequal product-page depth can leave one product as a concept note while
//      another repeats the same architecture and capability claims several times.
// E1: company home names all three products and gives each one canonical path
//     without recreating their technical documentation.
// E2: Agents owns the Managed Agents-compatible category, official-SDK
//     on-ramp, customer-operated boundary, and canonical compatibility exit.
// E3: comparison copy acknowledges Anthropic's self-hosted environment worker
//     while distinguishing the Awaken control plane and persistence boundary.
// E4: both locales preserve equivalent structure and work without hydration.
// E5: all three products show explicit maturity without inventing releases.
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
//      Objects and Workforce remain visibly early directions lower on the page.
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
// C48: Objects and Workforce preview visitors can inherit the current Agents
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
// | R1 | company | en/zh | unknown | current | company promise -> three products |
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
// | R41 | company reliability | en/zh | understand difference | current | five failure/control causes + inspectable effect + evidence owner |
// | R42 | company home | en/zh | recognize primary audience | current | product-team promise + workflow proof; secondary ICP detail remains off-home |
// | R43 | enterprise | en/zh | understand purchase | current | concrete implementation -> scope -> outputs -> delivery -> form |
// | R44 | cooperation form | en/zh | submitted | current | review sequence + one-business-day boundary |
// | R45 | enterprise | en/zh | custom delivery | current | reusable products + bounded service SOW |
// | R46 | Agents | en/zh | first visit | current | value -> differentiation -> evidence -> evaluation |
// | R47 | Agents | en/zh | SDK migration | current | compact baseline -> canonical compatibility page |
// | R48 | Agents/enterprise | en/zh | choose operations | current | one shared structured delivery renderer |
// | R49 | Agents | en/zh | exact API question | current | no local matrix -> documentation authority |
const rules = [
  {
    path: resolve(root, 'dist/index.html'),
    primary: 'Run the quickstart',
    primaryHref: '/docs/agents/get-started',
    secondary: 'Discuss private deployment',
    secondaryHref: '/enterprise',
    agentsHref: '/docs/agents/get-started',
    casePrefix: '/cases/',
    releaseStatus: 'Open source · stable release coming soon',
    deploymentStatus: 'Self-hostable',
    primaryAudience: 'For AI product teams',
    firstResult: 'One real application creates, runs, reconnects, and reopens the same Session',
    entityDefinition: 'Awaken Agents is open-source, self-hostable infrastructure designed for building and operating production AI Agent applications.',
    runtimeConcept: '/docs/agents/concepts/agent-runtime',
    workflow: ['Connect model', 'Publish Agent', 'Run Session', 'Inspect evidence', 'Connect application'],
    reliability: ['A user reconnects', 'A Worker or process stops', 'A tool requests sensitive action', 'An operator needs an explanation', 'Data and tools must stay inside'],
    proofHrefs: ['/docs/agents/concepts/sessions-and-events', '/docs/agents/concepts/production-reliability', '/docs/agents/runtime/how-to/enable-tool-permission-hitl', '/docs/agents/runtime/how-to/enable-observability', '/docs/agents/how-to/self-host'],
  },
  {
    path: resolve(root, 'dist/zh/index.html'),
    primary: '运行快速开始',
    primaryHref: '/zh/docs/agents/get-started',
    secondary: '沟通私有部署',
    secondaryHref: '/zh/enterprise',
    agentsHref: '/zh/docs/agents/get-started',
    casePrefix: '/zh/cases/',
    releaseStatus: '已开源 · 稳定版即将发布',
    deploymentStatus: '可自托管',
    primaryAudience: '面向 AI 产品团队',
    firstResult: '一个真实应用创建、运行、重连并重新打开同一个 Session',
    entityDefinition: 'Awaken Agents 是开源、可自托管的 Agent 应用基础设施，用于构建和运营生产级 AI Agent 应用。',
    runtimeConcept: '/zh/docs/agents/concepts/agent-runtime',
    workflow: ['连接模型', '发布 Agent', '运行 Session', '检查证据', '接入应用'],
    reliability: ['用户重新连接', 'Worker 或进程中断', '工具请求敏感操作', '操作者需要解释过程', '数据与工具必须留在内部'],
    proofHrefs: ['/zh/docs/agents/concepts/sessions-and-events', '/zh/docs/agents/concepts/production-reliability', '/zh/docs/agents/runtime/how-to/enable-tool-permission-hitl', '/zh/docs/agents/runtime/how-to/enable-observability', '/zh/docs/agents/how-to/self-host'],
  },
];

// Cause/effect design for the compressed company-home decision:
// C1: an AI product team arrives with working Agent behavior but no reusable
//     application lifecycle; C2: an enterprise visitor needs a private boundary;
// C3: a proof-seeker needs current product UI and reference-build status;
// C4: a visitor asks about the broader portfolio; C5: execution reconnects,
//     stops, requests permission, needs inspection, or must remain private;
// C6: a crawler or answer engine must classify the visible product before it
//     follows implementation detail.
// E1: the hero names the product category, product-team job, and one observable result; E2: exactly
//     two decision CTAs reach self-evaluation and the existing enterprise path;
// E3: one five-step Console path appears before reliability claims; E4: five
//     cause/effect rows link to their detailed evidence owners; E5: reference
//     builds remain explicitly non-customer evidence; E6: Agents maturity leads,
//     while Objects and Workforce appear later with their registry-owned status;
// E7: the visible definition and ordinary concept link expose the same product
//     identity without adding another conversion CTA.
// Decision table:
// | Rule | visitor cause | required effect | terminal route |
// | H1 | working Agent | product promise + first result | quickstart |
// | H2 | private boundary | concise control benefit | enterprise |
// | H3 | implementation proof | workflow + current Console | evidence link |
// | H4 | failure/control question | one bounded consequence | owning docs |
// | H5 | reference interest | maturity + non-customer boundary | case detail |
// | H6 | portfolio interest | Agents first + preview status | product page |
// | H7 | category question | visible canonical definition | runtime concept |
for (const rule of rules) {
  requireOrderedText(rule.path, [
    'id="home-hero"',
    'id="platform-preview"',
    'id="home-reliability"',
    'id="home-cases"',
    'id="home-products"',
    'id="home-cta"',
  ], 'home must move from the primary promise through product proof, reliability, reference evidence, portfolio maturity, and action');
  requirePattern(
    rule.path,
    new RegExp(`href="${rule.primaryHref}"[^>]*>${rule.primary}`),
    'home primary action must reach the localized independent Agents path',
  );
  requirePattern(
    rule.path,
    new RegExp(`href="${rule.secondaryHref}"[^>]*>${rule.secondary}`),
    'home secondary action must reach localized enterprise-deployment services',
  );
  requireOccurrenceCount(rule.path, '<h1', 1, 'home must have one primary heading');
  requireSectionOccurrenceCount(rule.path, 'id="home-hero"', '</section>', '<a ', 2, 'home hero must expose exactly the two intent actions');
  requireOccurrenceCount(rule.path, 'data-home-first-result', 1, 'home hero must expose one observable first result');
  requireOccurrenceCount(rule.path, 'data-home-entity-definition', 1, 'home hero must expose one canonical product definition');
  requirePattern(rule.path, new RegExp(`data-home-entity-definition[\\s\\S]*${rule.entityDefinition}`), 'home hero must make the Agents category directly quotable');
  requirePattern(rule.path, new RegExp(`data-home-runtime-concept href="${rule.runtimeConcept}"`), 'home workflow must link to the localized canonical Agent Runtime concept');
  requirePattern(rule.path, new RegExp(`data-home-first-result[\\s\\S]*${rule.firstResult}`), 'home hero must state the recommended scenario result as supporting evidence');
  requirePattern(rule.path, new RegExp(rule.primaryAudience), 'home hero must name AI product teams as the primary audience');
  requirePattern(rule.path, new RegExp(`data-home-maturity[\\s\\S]*${rule.releaseStatus}[\\s\\S]*${rule.deploymentStatus}`), 'home hero must separate product maturity and deployment capability from the value headline');
  for (const product of ['agents', 'objects', 'workforce']) {
    requireOccurrenceCount(rule.path, `data-umami-event="home-${product}-details"`, 1, `home must expose one ${product} product path`);
  }
  requireOccurrenceCount(rule.path, 'data-home-work-step=', 0, 'home must not present the Workforce outcome loop as current Agents value');
  requireOccurrenceCount(rule.path, 'data-home-entry=', 0, 'home must not duplicate adoption paths with a second entry-card section');
  requireOccurrenceCount(rule.path, 'data-product-role', 3, 'every product card must retain one visible role');
  requireOccurrenceCount(rule.path, 'data-umami-event-location="home-hero"', 0, 'home hero must not add a third GitHub choice beside the two intent exits');
  requireOccurrenceCount(rule.path, 'data-umami-event-location="home-closing"', 0, 'home closing action must preserve the same two-intent decision');
  requireOccurrenceCount(rule.path, 'data-umami-event-location="header"', 1, 'desktop header Star exit must identify its placement');
  requireOccurrenceCount(rule.path, 'data-umami-event-location="mobile-menu"', 1, 'mobile Star exit must identify its placement');
  requireOccurrenceCount(rule.path, 'data-umami-event-location="footer"', 1, 'footer Star exit must identify its placement');
  requireOccurrenceCount(rule.path, 'data-scenario-card', 0, 'home must keep secondary ICP detail in its existing product and enterprise owners');
  requireOccurrenceCount(rule.path, 'data-home-workflow class=', 1, 'home must show one product path instead of another adoption-card set');
  requireOccurrenceCount(rule.path, 'data-home-workflow-step', 5, 'home product path must retain five visible steps');
  for (const step of rule.workflow) {
    requirePattern(rule.path, new RegExp(step), `home workflow must show ${step}`);
  }
  requireOccurrenceCount(rule.path, 'data-home-reliability=', 5, 'home must render five bounded reliability causes exactly once');
  for (const cause of rule.reliability) {
    requirePattern(rule.path, new RegExp(cause), `home must connect ${cause} to an inspectable consequence`);
  }
  for (const href of rule.proofHrefs) {
    requirePattern(rule.path, new RegExp(`href="${href}"`), `home advantage must link to ${href}`);
  }
  requirePattern(rule.path, new RegExp(`href="${rule.agentsHref}"`), 'closing developer action must reach the localized task-first Agents entry');
  rejectPattern(rule.path, /Customer operations|Software delivery|Supplier and operations risk|客户运营|软件交付|供应商与运营风险/, 'home must not present Workforce vertical outcomes as current Agents capabilities');
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
  requireOccurrenceCount(rule.path, 'data-umami-event="footer-youtube"', 1, 'footer video exit must be measurable');
  requirePattern(rule.path, /awakenworks_attribution/, 'company entry must preserve first-touch attribution across navigation');
  rejectPattern(rule.path, /fonts\.googleapis\.com|fonts\.gstatic\.com/, 'public entry must not depend on third-party font delivery');
  rejectPattern(rule.path, /Download Awaken 1\.0|下载 Awaken 1\.0/, 'pre-release Agents must not claim a stable download');
}

const homeSourcePath = resolve(root, 'src/components/Home.astro');
requireOrderedText(homeSourcePath, ['id="home-hero"', '<ProductShowcase', 'id="home-reliability"', 'id="home-cases"', 'id="home-products"'], 'source must move from the Agents promise through product proof, reliability, reference evidence, and late portfolio context');
rejectPattern(homeSourcePath, /id="home-work"|id="home-paths"/, 'source must not restore duplicate entry cards or promote Workforce outcome mechanics on the Agents-led home');
rejectPattern(homeSourcePath, /id="home-scenarios"|data-scenario-card/, 'source must keep secondary ICP detail in the existing Agents and enterprise owners');
rejectPattern(homeSourcePath, /data-umami-event-location="home-hero"|data-umami-event-location="home-closing"/, 'home source must keep explanatory and GitHub links out of the two-choice hero and closing action');
// Cause/effect design for the Agents-led promise and its responsive rendering:
// C1: future portfolio outcomes can become the headline and leave a buyer unable
//     to identify the current Agents product or its immediate buying reason.
// C2: an array renderer forces an editorial line break in both locales.
// C3: a string lets the browser wrap only when the viewport requires it.
// C4: editor prompts, replacement instructions, or distribution reminders can
//     leak from the working layer into public website copy.
// C5: a reliability mechanism can become the value headline even though buyers
//     fund product launch, enterprise deployment, platform reuse, or delivery leverage.
// C6: an internal sales label can address the reader as "the customer" instead
//     of explaining the practical consequence in the page's existing voice.
// C7: lifecycle adjectives can occupy the headline without showing the first
//     observable result a buyer can run and inspect.
// E1: both locales lead with shipping an Agent product without rebuilding its
//     platform while supporting copy stays inside verified Agents responsibilities.
// E2: the promise reads as one sentence on wide screens and remains responsive.
// E3: public copy is a finished reader-facing point of view; internal editing
//     language remains outside the rendered content source.
// E4: both locales distinguish customer value from supporting mechanisms without
//     claiming measured customer ROI or available Workforce outcomes.
// E5: comparison rows connect capability to consequence with natural reader-facing
//     labels and contain no third-person "customer gets" drafting language.
// E6: the hero reuses the recommended scenario's finish condition as supporting
//     evidence without delaying its two actions or creating a second result authority.
// Decision table:
// | Rule | customer result | evidence | renderer | result owner | Outcome |
// | H1   | observable      | present  | string   | scenario     | accept  |
// | H2   | adjectives only | any      | any      | any          | reject  |
// | H3   | observable      | missing  | any      | any          | reject  |
// | H4   | observable      | present  | array    | any          | reject  |
// | H5   | observable      | present  | string   | duplicate    | reject  |
// | H6   | observable      | present  | string   | draft marker | reject  |
requirePattern(homeSourcePath, /\{home\.hero\.title\}/, 'home must render the vision as one responsive sentence');
rejectPattern(homeSourcePath, /home\.hero\.title\.map/, 'home must not force editorial line breaks into the vision');
requirePattern(homeSourcePath, /featuredScenario = home\.scenarios\.items\.find[\s\S]*data-home-first-result[\s\S]*featuredScenario\.finish/, 'home must reuse the recommended scenario finish as supporting first-result evidence');
const contentSourcePath = resolve(root, 'src/i18n/content.ts');
requirePattern(contentSourcePath, /title: 'Ship your working Agent as an application customers can keep using\.'[\s\S]*title: '把能运行的 Agent，交付成客户可以持续使用的应用。'/, 'both locales must lead with the application result a buyer can recognize');
requirePattern(contentSourcePath, /export const canonicalEntities[\s\S]*AwakenWorks builds open infrastructure designed for production AI Agent applications\.[\s\S]*Awaken Agents is open-source, self-hostable infrastructure designed for building and operating production AI Agent applications\.[\s\S]*Awaken Runtime is the Rust execution core inside Awaken Agents\./, 'one catalog must own the company, product, and runtime entity definitions');
rejectPattern(contentSourcePath, /pages:\s*\{[\s\S]*awaken:/, 'the retired hidden Awaken page copy must not compete with canonical entity definitions');
rejectPattern(contentSourcePath, /Turn an Agent prototype into a shippable, operable, reusable product|让 Agent 原型，变成可交付、可运营、可复用的产品|Make Agents shippable, operable, and reusable|让 Agent 可交付、可运营、可复用/, 'result headlines must not regress to lifecycle adjectives');
requirePattern(contentSourcePath, /experience, business logic, and customer relationship[\s\S]*产品体验、业务逻辑和客户关系/, 'both locales must state what the adopting product team keeps');
requirePattern(contentSourcePath, /Objects and Workforce remain early product directions, not prerequisites[\s\S]*Objects 与 Workforce 仍是早期产品方向，不是采用 Agents 的前置条件/, 'both locales must keep future products out of the current adoption prerequisite');
requirePattern(contentSourcePath, /proofLabel: 'What this changes'[\s\S]*proofLabel: '这意味着'/, 'Agents comparison must connect each capability to its consequence in both locales');
rejectPattern(contentSourcePath, /REFERENCE ACCOUNT|REPLACE WITH|本页故意|客户需要纠正|外发前确认|受控外发|【\s*】/, 'public content must not expose editor prompts, distribution reminders, or visible placeholders');
rejectPattern(contentSourcePath, /Customer result|客户得到/, 'public comparison copy must not address the reader with an internal third-person sales label');
rejectPattern(homeSourcePath, /home-display-title-zh[\s\S]{0,120}white-space: nowrap/, 'the longer Chinese result promise must wrap naturally instead of overflowing');

// Cause/effect design for product proof inspection:
// C1 full Agents pages need all verified captures; C2 home needs one compact
// capture; C3 JavaScript may be absent; C4 reduced motion can be requested;
// C5 keyboard users need a native close path.
// C6 the same Quickstart href can carry one CTA label in product content and a
//    second label in UI copy, allowing the two placements to drift.
// E1 compact and full modes reuse one renderer; E2 every image remains visible
// without JS; E3 enhancement opens one native dialog; E4 native Escape/form
// close works; E5 decorative motion is disabled for reduced motion.
// E6 the primary CTA object owns both the href and label in hero, Quickstart,
// and closing placements. Decision table: compact -> overview only; full ->
// overview + details; JS off -> static proof; JS on -> zoom dialog; reduced
// motion -> no sheen animation; duplicate CTA label -> reject.
const productRules = [
  {
    path: resolve(root, 'dist/agents/index.html'),
    title: 'Build and operate Agent applications on infrastructure you control.',
    agentsHref: '/docs/agents/get-started',
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
    title: '在自己掌控的基础设施上构建并运营 Agent 应用。',
    agentsHref: '/zh/docs/agents/get-started',
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
  requireOrderedText(rule.path, ['id="agents-hero"', 'id="agents-quickstart"', 'id="agents-outcomes"', 'id="managed-relation"', 'id="platform-preview"', 'id="agents-decisions"'], 'Agents must move from value through a first success, differentiation, evidence, and four Docs-owned next decisions');
  requireOccurrenceCount(rule.path, '<dialog data-console-dialog', 1, 'Agents must expose one native dialog owner for screenshot inspection');
  requireOccurrenceCount(rule.path, '<img data-console-dialog-image', 1, 'Agents must expose one dialog image target');
  requirePattern(rule.path, /showModal\(\)/, 'Agents screenshot proof must support a larger native-dialog view');
  requireOccurrenceCount(rule.path, 'data-agent-outcome', 4, 'Agents must show exactly four customer outcomes before implementation detail');
  for (const outcome of rule.outcomes) {
    requirePattern(rule.path, new RegExp(outcome), `Agents must explain the ${outcome} customer outcome`);
  }
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
  requirePattern(rule.path, /data-umami-event="enterprise_intent_selected"/, 'Awaken proof must retain a measurable enterprise-production exit');
  requirePattern(rule.path, /data-umami-event="developer_evaluation_selected"/, 'Awaken task-first entry must retain a measurable independent-evaluation exit');
  requirePattern(rule.path, /data-umami-event="github_star_selected"/, 'Awaken product page must retain a measurable GitHub Star exit');
}
const productLandingSourcePath = resolve(root, 'src/components/ProductLanding.astro');
const uiSourcePath = resolve(root, 'src/i18n/ui.ts');
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
    title: 'Let people and Agents act from the same business facts.',
    docsHref: '/docs/objects',
    task: 'Choose one important business object',
    maturity: 'Early preview',
    previewHref: '/enterprise\\?product=objects#enterprise-objects',
    star: 'Star the Awaken open foundation',
  },
  {
    path: resolve(root, 'dist/zh/objects/index.html'),
    title: '让人和 Agent 基于同一份业务事实行动。',
    docsHref: '/zh/docs/objects',
    task: '选择一类关键业务对象',
    maturity: '提前预览',
    previewHref: '/zh/enterprise\\?product=objects#enterprise-objects',
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
  requireOccurrenceCount(rule.path, 'data-umami-event-location="objects-close"', 1, 'Objects must expose one measurable GitHub Star exit outside the primary hero decision');
}

// Cause-effect design for code-grounded product previews and Workforce routing:
// C1: a product model has implementation-owned states but no verified customer
//     instance or operating metric available to the public site.
// C2: a Workforce reader can arrive with technical-evaluation or cooperation
//     intent, while the enterprise page is the sole owner of contact capture.
// C3: a Run can complete while its parent Issue still lacks a declared completion
//     condition or externally accepted fact.
// C4: the source UI can move to Workspace Home, Needs you, Outcomes, and formal
//     Outcome Review while the website keeps an obsolete generic Issue table.
// C5: a composed console can make Runs, Agent Center, and Resources look owned by
//     Workforce, collapsing Agents, Objects, and Workforce into one product.
// E1: every preview labels controlled example records and makes no customer,
//     adoption, or performance claim from illustrative per-record state counts.
// E2: Workforce exposes docs, business cooperation, and GitHub without a second form.
// E3: Workforce states the Run-versus-Issue terminal boundary in both locales.
// E4: the Workforce preview mirrors the source UI's outcome path, command buckets,
//     and formal-deliverable decision boundary instead of a generic product table.
// E5: exactly three product cards name separate ownership and one composed path.
// Decision table:
// | Rule | disclosure | source-shaped UI | three owners | contact owner | boundary | Outcome |
// | P1   | present    | yes               | yes          | enterprise    | present  | accept  |
// | P2   | absent     | any               | any          | any           | any      | reject  |
// | P3   | present    | no                | any          | any           | any      | reject  |
// | P4   | present    | yes               | no           | any           | any      | reject  |
// | P5   | present    | yes               | yes          | product form  | any      | reject  |
// | P6   | present    | yes               | yes          | enterprise    | absent   | reject  |
for (const rule of [
  { path: resolve(root, 'dist/agents/index.html'), id: 'platform-preview', label: 'Current Awaken Console · verified release build' },
  { path: resolve(root, 'dist/objects/index.html'), id: 'objects-preview', label: 'Product model preview · example content' },
  { path: resolve(root, 'dist/workforce/index.html'), id: 'workforce-preview', label: 'Current product workspace · controlled example content, not customer activity' },
  { path: resolve(root, 'dist/zh/agents/index.html'), id: 'platform-preview', label: '当前 Awaken Console · Release 构建实测' },
  { path: resolve(root, 'dist/zh/objects/index.html'), id: 'objects-preview', label: '产品模型预览 · 示例内容' },
  { path: resolve(root, 'dist/zh/workforce/index.html'), id: 'workforce-preview', label: '当前产品工作空间 · 受控示例内容，不代表客户活动' },
]) {
  requirePattern(rule.path, new RegExp(`id="${rule.id}"`), 'each product must expose one identifiable product preview');
  requirePattern(rule.path, new RegExp(rule.label), 'each product preview must disclose whether it is a verified product capture or example content');
  rejectPattern(rule.path, /52\.1k|168 nodes|共 168 节点|acme \/|customer logo|客户徽标/i, 'product previews must not invent usage, fleet, customer, or adoption evidence');
}

// Cause/effect design for product discovery metadata and route identity:
// C1 a search crawler has no visual context; C2 a reader lands directly on a
// product route; C3 locale changes the URL but not product identity.
// E1 every product emits SoftwareApplication metadata; E2 Objects uses its own
// governed-change accent; E3 current navigation is semantic on direct entry.
for (const [path, name, brand, currentHref] of [
  ['dist/agents/index.html', 'Awaken Agents', 'managed', '/agents'],
  ['dist/objects/index.html', 'Awaken Objects', 'objects', '/objects'],
  ['dist/workforce/index.html', 'Awaken Workforce', 'workforce', '/workforce'],
  ['dist/zh/agents/index.html', 'Awaken Agents', 'managed', '/zh/agents'],
  ['dist/zh/objects/index.html', 'Awaken Objects', 'objects', '/zh/objects'],
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
  requirePattern(path, /50d5035c68456c9106626f748cf4c169c2057beb/, 'current Console screenshots must name their exact verified Awaken revision');
}

for (const rule of [
  {
    path: resolve(root, 'dist/workforce/index.html'),
    title: 'Commission a result. Keep work moving until it is accepted.',
    docsHref: '/docs/workforce',
    cooperationHref: '/enterprise\\?product=workforce#enterprise-workforce',
    workspaceHref: '/workforce#workforce-preview',
    maturity: 'Early preview',
    boundary: 'It does not close an Issue whose declared completion conditions or external acceptance facts are still missing.',
  },
  {
    path: resolve(root, 'dist/zh/workforce/index.html'),
    title: '委托一个结果，让工作持续推进，直到可以验收。',
    docsHref: '/zh/docs/workforce',
    cooperationHref: '/zh/enterprise\\?product=workforce#enterprise-workforce',
    workspaceHref: '/zh/workforce#workforce-preview',
    maturity: '提前预览',
    boundary: '只要声明的完成条件或外部验收事实仍然缺失，Issue 就不会结束。',
  },
]) {
  requirePattern(rule.path, new RegExp(rule.title.replaceAll('.', '\\.')), 'Workforce must lead with a commissioned result and acceptance');
  requireOrderedText(rule.path, ['id="workforce-hero"', 'id="workforce-preview"', 'id="workforce-how-it-works"', 'id="workforce-products"', 'id="workforce-scenarios"'], 'Workforce must move from result to source-shaped product view, mechanism, three-product ownership, and scenarios');
  requirePattern(rule.path, new RegExp(`href="${rule.docsHref}"`), 'Workforce technical evaluation must lead to its current docs');
  requirePattern(rule.path, new RegExp(`href="${rule.cooperationHref}"`), 'Workforce commercial intent must lead to the shared business page');
  requirePattern(rule.path, new RegExp(`href="${rule.workspaceHref}"`), 'Workforce primary action must lead to the current product workspace');
  requirePattern(rule.path, new RegExp(rule.maturity), 'Workforce must disclose early-preview availability');
  requirePattern(rule.path, new RegExp(rule.boundary), 'Workforce must preserve the Run-versus-Issue terminal boundary');
  requireOccurrenceCount(rule.path, '<form class="opportunity-form"', 0, 'Workforce must not create a second cooperation form');
  requireOccurrenceCount(rule.path, 'data-umami-event-location="workforce-close"', 1, 'Workforce must expose one measurable GitHub Star exit outside the primary hero decision');
  requireOccurrenceCount(rule.path, 'data-umami-event="workforce_workspace_selected"', 2, 'Workforce must measure both product-workspace actions');
  requireOccurrenceCount(rule.path, 'data-umami-event="paid_validation_selected"', 2, 'Workforce must measure both one-real-job validation actions');
  requireOccurrenceCount(rule.path, 'data-workforce-outcome-path', 1, 'Workforce preview must show the current four-stage Outcome path once');
  requireOccurrenceCount(rule.path, 'data-workforce-bucket', 3, 'Workforce preview must show Needs you, In progress, and Blocked command buckets');
  requireOccurrenceCount(rule.path, 'data-workforce-acceptance-preview', 1, 'Workforce preview must show the formal-deliverable acceptance boundary');
  requireOccurrenceCount(rule.path, 'data-workforce-stage', 4, 'Workforce mechanism must match the four stages shown by Workspace Home');
  requireOccurrenceCount(rule.path, 'data-workforce-product-card', 3, 'Workforce must name exactly Agents, Objects, and Workforce as separate products');
  requireOccurrenceCount(rule.path, 'data-workforce-composition-path', 1, 'Workforce must show one composed path without a second architecture');
  for (const product of ['Awaken Agents', 'Awaken Objects', 'Awaken Workforce']) {
    requirePattern(rule.path, new RegExp(product), `Workforce composition must name ${product}`);
  }
  rejectPattern(rule.path, /Flow revision/, 'Workforce public UI must not expose the internal source product name');
  rejectPattern(rule.path, /Apply for design partnership|申请设计伙伴/, 'Workforce must not restore a separate design-partner funnel');
}

// Cause/effect design for one portfolio entry and one opportunity owner:
// C1 a visitor can arrive without product context; C2 can choose current Agents;
// C3 can arrive from Objects or Workforce with preview context; C4 can supply an
// unknown query; C5 JavaScript can be absent; C6 optional facts can be unknown.
// E1 every product has an anchored card with its own input, first decision, and
// maturity boundary; E2 all paths preserve one form/schema; E3 known context
// changes the submitted product and its stable hash lands on the matching card;
// E4 unknown context falls back to Agents in the form; E5 all cards and core
// form remain usable without JS; E6 optional details do not block submission.
// Decision table:
// | Rule | context | anchor | JS | outcome |
// | G1 | absent/agents | agents card | any | current implementation decision |
// | G2 | objects | objects card | any | Objects preview decision |
// | G3 | workforce | workforce card | any | Workforce preview decision |
// | G4 | unknown | none | yes | Agents form fallback, no false card |
// | G5 | any | matching card | no | all cards visible, normal POST |
const enterpriseRules = [
  {
    path: resolve(root, 'dist/enterprise/index.html'),
    productHref: '/agents',
    privacyHref: '/privacy',
    title: 'Implement Agents now, or shape an Objects and Workforce early preview.',
    intent: 'cooperation',
    boundary: 'Agents is open source, with its first stable release coming soon. Objects and Workforce are available through focused early-access collaboration.',
    pathFacts: [
      ['enterprise-agents', 'One working Agent application', '4–6 week implementation uses 2–4 release checks'],
      ['enterprise-objects', 'One business object', 'shared typed-object boundary fits the job'],
      ['enterprise-workforce', 'One real job', 'Issue, responsibility, and acceptance model fits the job'],
    ],
    processBoundary: 'Agents implementation scope does not transfer to Objects or Workforce.',
    success: 'Application received',
  },
  {
    path: resolve(root, 'dist/zh/enterprise/index.html'),
    productHref: '/zh/agents',
    privacyHref: '/zh/privacy',
    title: '现在实施 Agents，或共同定义 Objects 与 Workforce 提前预览。',
    intent: 'cooperation',
    boundary: 'Agents 已开源，首个稳定版即将发布。Objects 与 Workforce 通过聚焦的提前体验合作提供。',
    pathFacts: [
      ['enterprise-agents', '一个可运行的 Agent 应用', '4–6 周实施以 2–4 项发布检查为边界'],
      ['enterprise-objects', '一个业务对象', '共享、类型化对象边界是否适合这项工作'],
      ['enterprise-workforce', '一项真实工作', 'Issue、责任与验收模型是否适合这项工作'],
    ],
    processBoundary: 'Agents 实施范围不会自动转移到 Objects 或 Workforce',
    success: '申请已收到',
  },
];

const opportunityFormSourcePath = resolve(root, 'src/components/OpportunityForm.astro');
requirePattern(opportunityFormSourcePath, /import\.meta\.env\.PUBLIC_OPPORTUNITY_ENDPOINT[\s\S]*https:\/\/formspree\.io\/f\/mrewzorl/, 'the shared opportunity form must have one documented endpoint configuration with the current transport fallback');
rejectPattern(opportunityFormSourcePath, /PUBLIC_WAITLIST_ENDPOINT/, 'the opportunity form must not retain the legacy parallel endpoint configuration');
requirePattern(resolve(root, '.env.example'), /PUBLIC_OPPORTUNITY_ENDPOINT=https:\/\/formspree\.io\/f\/mrewzorl/, 'deployment configuration must document the one opportunity endpoint');

for (const rule of enterpriseRules) {
  requireOccurrenceCount(rule.path, '<h1', 1, 'business page must have one primary heading');
  requirePattern(rule.path, new RegExp(rule.title.replaceAll('.', '\\.')), 'services page must lead with the three-product decision and honest maturity boundary');
  requireOrderedText(rule.path, ['id="enterprise-hero"', 'id="enterprise-paths"', 'id="enterprise-process"', 'id="apply"'], 'services page must move from product choice through product-specific decisions and one shared process to one form');
  requireOccurrenceCount(rule.path, 'data-enterprise-product-path=', 3, 'enterprise must present exactly the Agents, Objects, and Workforce paths');
  requireOccurrenceCount(rule.path, 'data-enterprise-path-fact=', 9, 'each product path must expose bring, first decision, and current boundary once');
  for (const [id, bring, decision] of rule.pathFacts) {
    requireOccurrenceCount(rule.path, `id="${id}"`, 1, `${id} must provide one stable context-preserving landing target`);
    requirePattern(rule.path, new RegExp(bring), `${id} must say what the visitor brings`);
    requirePattern(rule.path, new RegExp(decision), `${id} must say what the first product decision is`);
  }
  requireOccurrenceCount(rule.path, 'data-enterprise-process-step', 3, 'enterprise must explain the shared intake in exactly three steps');
  requireOccurrenceCount(rule.path, 'data-enterprise-promise-boundary', 1, 'enterprise must state once that product promises do not transfer across maturity levels');
  requirePattern(rule.path, new RegExp(rule.processBoundary), 'enterprise must preserve the selected product promise boundary');
  requirePattern(rule.path, /a permission decision|权限决定/, 'implementation must exercise an explicit permission decision');
  requirePattern(rule.path, /interruption-and-recovery|中断恢复路径/, 'implementation must exercise an interruption and recovery path');
  requirePattern(rule.path, /go, change, or stop decision|继续、调整或停止决定/, 'the current Agents path must end in an explicit terminal decision');
  requirePattern(rule.path, /product discovery for an unreleased preview|未发布产品的发现过程/, 'Objects and Workforce must not inherit the current Agents implementation promise');
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
  // rejects the request.
  // E1: normal POST and progressive fetch share one endpoint/schema; E2: every
  // attempt has an ID, timestamp, and exact page; E3: only allowlisted context
  // is copied; E4: the submit control exposes busy state and cannot double-fire;
  // E5: success focuses one announced next-step panel; E6: failure restores the
  // control and keeps the entered fields.
  // Decision table:
  // | Rule | JS | context | transport | repeated click | Outcome |
  // | F1   | no | any     | accepted  | n/a            | normal POST |
  // | F2   | yes| known   | accepted  | blocked        | attributed success |
  // | F3   | yes| unknown | accepted  | blocked        | context omitted |
  // | F4   | yes| any     | rejected  | blocked        | error and restore |
  for (const field of ['intent', 'product', 'source_page', 'landing_page', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'scenario_context', 'submission_id', 'submitted_at', 'page_url', 'contact_consent']) {
    requirePattern(rule.path, new RegExp(`name="${field}"`), `opportunity form must carry ${field}`);
  }
  requirePattern(rule.path, new RegExp(`name="intent" value="${rule.intent}"`), 'shared form must reuse the canonical cooperation intent instead of creating a second paid-validation schema');
  rejectPattern(rule.path, /name="budget_path"/, 'business contact form must not ask for a public budget path');
  requirePattern(rule.path, /awakenworks_attribution/, 'opportunity form must restore first-touch attribution from the shared session snapshot');
  requirePattern(rule.path, /\['agents', 'objects', 'workforce'\]\.includes\(requestedProduct\)/, 'shared form must accept only known product context from early-preview links');
  requirePattern(rule.path, /<select name="product"[\s\S]*Awaken Agents[\s\S]*Awaken Objects[\s\S]*Awaken Workforce/, 'shared form must let no-JavaScript visitors select one product with visible maturity');
  requirePattern(rule.path, /<option value="agents" selected>/, 'no-context intake must default to the current Agents path');
  requirePattern(rule.path, /<select name="frequency" class=/, 'frequency must remain optional for previews where cadence is not yet known');
  rejectPattern(rule.path, /<select name="frequency" required/, 'optional preview frequency must not block the shared form');
  requirePattern(rule.path, /Object\.prototype\.hasOwnProperty\.call\(scenarioLabels, requestedScenario\)/, 'shared form must accept only known scenario context from company links');
  requirePattern(rule.path, /data-submitting="(?:Submitting…|提交中…)"/, 'shared form must expose localized submitting state');
  requirePattern(rule.path, /aria-busy/, 'progressive submission must expose its busy state');
  requirePattern(rule.path, /getAttribute\('aria-busy'\) === 'true'\) return/, 'progressive submission must reject a second submit while transport is pending');
  requirePattern(rule.path, /globalThis\.crypto\?\.randomUUID\?\.\(\)/, 'progressive submission must create a traceable submission identifier with a fallback');
  requireOccurrenceCount(rule.path, '<section data-opportunity-success', 1, 'shared form must expose one progressive success panel');
  requirePattern(rule.path, /<section data-opportunity-success role="status" aria-live="polite" tabindex="-1"/, 'the progressive success panel must be announced and programmatically focusable');
  requirePattern(rule.path, /success\.focus\(\)/, 'successful submission must move focus to the next-step panel');
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

for (const rule of [
  { path: resolve(root, 'dist/cases/index.html'), disclaimer: 'do not represent customer adoption or endorsement' },
  { path: resolve(root, 'dist/zh/cases/index.html'), disclaimer: '不代表客户采用或背书' },
]) {
  requireOrderedText(rule.path, ['id="reference-hero"', 'id="reference-builds"'], 'reference-build index must move directly from product-shape choice to the three builds');
  requireOccurrenceCount(rule.path, 'data-reference-disclaimer', 1, 'reference-build index must disclose its maturity once without an evidence tutorial');
  requirePattern(rule.path, new RegExp(rule.disclaimer), 'reference-build index must reject customer-adoption inference');
  requireOccurrenceCount(rule.path, 'data-case-index=', 3, 'reference-build index must expose exactly three product shapes');
}

for (const rule of [
  { path: resolve(root, 'dist/docs/index.html'), architectureHref: '/docs/agents/concepts/architecture', star: 'Star on GitHub' },
  { path: resolve(root, 'dist/zh/docs/index.html'), architectureHref: '/zh/docs/agents/concepts/architecture', star: '在 GitHub Star' },
]) {
  requireOrderedText(rule.path, ['id="docs-hero"', 'id="start"', 'id="products"', 'id="agents-paths"'], 'docs index must move from task to the three products and then Agents responsibility paths');
  for (const product of ['Awaken Agents', 'Awaken Objects', 'Awaken Workforce']) {
    requirePattern(rule.path, new RegExp(product), `docs index must expose ${product}`);
  }
  requirePattern(rule.path, new RegExp(`href="${rule.architectureHref}"`), 'docs index must expose the canonical architecture owner');
  requirePattern(rule.path, new RegExp(rule.star), 'docs index must retain a GitHub Star exit');
  requireOccurrenceCount(rule.path, 'data-umami-event-location="docs-index"', 1, 'docs index must measure its page-specific GitHub Star exit');
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
// E2: all three products and Star stay visible in a wrapping grid.
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
requirePattern(docsShellPath, /<details class="relative hidden md:block">/, 'docs header must leave the version selector out of the narrow mobile row');
requirePattern(docsShellPath, /data-theme-toggle[\s\S]*class="hidden h-7 w-7[\s\S]*sm:flex"/, 'docs header must leave theme control out of the narrowest row');
requirePattern(docsShellPath, /<span class="sm:hidden">\{localeRegistry\[alternateLang\]\.shortName\}<\/span>/, 'docs header must use the registry-owned compact mobile language label');
requirePattern(docsShellPath, /data-umami-event-location="docs-mobile-nav"/, 'docs mobile product nav must retain the measurable GitHub Star action');
requirePattern(docsShellPath, /grid grid-cols-3 gap-2 font-mono text-xs sm:grid-cols-4/, 'docs mobile product navigation must wrap all exits instead of scrolling horizontally');
requirePattern(docsShellPath, /class="col-span-3[^"]*sm:col-span-1"/, 'docs mobile Star exit must stay visible below products at 390px and join the row at sm');
requirePattern(docsShellPath, /<details data-docs-mobile-sections[\s\S]*label=\{copy\.mobileNav\}[\s\S]*aria-label=\{copy\.mobileToc\}/, 'mobile docs must expose both localized section and page navigation');
requireOccurrenceCount(docsShellPath, '<DocsNavigation', 2, 'desktop and mobile navigation must share one renderer');
rejectPattern(docsShellPath, /<nav class="[^"]*overflow-x-auto[^"]*" aria-label=\{isZh \? '产品文档'/, 'mobile product navigation must not hide exits in a horizontal rail');

for (const rule of [
  { path: resolve(root, 'dist/principles/index.html'), owner: 'Begin with the work and its owner', participation: 'Make it easy to question and improve' },
  { path: resolve(root, 'dist/zh/principles/index.html'), owner: '先说清工作，以及谁为它负责', participation: '让质疑和改进都容易发生' },
]) {
  requireOrderedText(rule.path, ['id="principles-hero"', 'id="principles-owner"', 'id="principles-commitments"', 'id="principles-status"', 'id="principles-participate"'], 'principles must move from ownership through commitments and status to participation');
  requirePattern(rule.path, new RegExp(rule.owner), 'principles must begin from the work and its human owner');
  requirePattern(rule.path, new RegExp(rule.participation), 'principles must end with a direct invitation to participate');
  requireOccurrenceCount(rule.path, 'data-umami-event-location="principles"', 1, 'principles must retain one measurable GitHub Star exit');
}

for (const rule of [
  { path: resolve(root, 'dist/blog/index.html'), headline: 'Start with a real problem', archive: 'Article archive' },
  { path: resolve(root, 'dist/zh/blog/index.html'), headline: '从真实问题开始', archive: '文章列表' },
]) {
  requireOrderedText(rule.path, ['id="blog-hero"', 'id="blog-archive"'], 'blog index must explain its editorial scope before listing articles');
  requirePattern(rule.path, new RegExp(rule.headline), 'blog index must state the problem-first editorial promise');
  requirePattern(rule.path, new RegExp(`aria-label="${rule.archive}"`), 'blog archive must have a reader-facing label');
  requirePattern(rule.path, /AwakenWorks · 2026-/, 'blog cards must expose recorded author and date');
  requireOccurrenceCount(rule.path, 'data-umami-event-location="blog-index"', 1, 'blog index must retain one measurable GitHub Star exit');
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
  requireOrderedText(rule.landing, ['id="agents-hero"', 'id="agents-outcomes"', 'id="platform-preview"', 'id="agents-decisions"'], 'Agents must keep the Runtime Docs decision after value and product evidence');
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
  requireOrderedText(path, ['id="case-hero"', 'id="case-result"', 'id="case-boundary"', 'id="case-try"', 'id="case-availability"', 'id="case-cta"'], `${rule.slug} must lead with the product task and trial before current availability`);
  requirePattern(path, new RegExp(`href="${rule.href}"`), `${rule.slug} must use its tailored primary action`);
  requireOccurrenceCount(path, 'data-evidence-level=', 3, `${rule.slug} must retain three explicit current-status entries`);
  requirePattern(path, /Where to check:|检查位置：/, `${rule.slug} must identify where a reader can inspect each status`);
  requirePattern(path, /currently local|path is local|仍在本地|目前仍在本地/, `${rule.slug} must disclose the local-only source boundary`);
  if (rule.currentOwner) {
    requirePattern(path, new RegExp(rule.currentOwner), `${rule.slug} must identify the current executable owner`);
  }
  rejectPattern(path, /Publish only what can be reproduced|只发布能够复现的主张|Current evidence|当前证据|Evidence source:|证据来源：/, `${rule.slug} must keep status available without leading as an audit report`);
  rejectPattern(path, /GTM optimization gates|GTM 优化门槛/, `${rule.slug} must not expose internal distribution work`);
  if (rule.blog) {
    requirePattern(path, new RegExp(`href="${rule.blog}"`), `${rule.slug} must link its separate engineering narrative`);
    requireOccurrenceCount(path, `data-umami-event="case-${rule.slug}-engineering-blog"`, 1, `${rule.slug} must expose one measurable engineering-story action`);
  } else {
    requireOccurrenceCount(path, `data-umami-event="case-${rule.slug}-engineering-blog"`, 0, `${rule.slug} must not render an empty engineering-story action`);
  }
}

for (const path of [
  resolve(root, 'src/i18n/content.ts'),
  resolve(root, 'src/components/Principles.astro'),
  resolve(root, 'src/components/BlogIndex.astro'),
  resolve(root, 'src/components/AwakenFlowLanding.astro'),
]) {
  rejectPattern(path, /—/, 'primary public copy must use direct punctuation instead of em-dash cadence');
}

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
  for (const product of ['Awaken Agents', 'Awaken Objects', 'Awaken Workforce']) {
    if (!records.some((record) => record.product === product)) {
      failures.push(`${path}: public search must expose ${product}`);
    }
  }
  if (records.some((record) => /\/docs\/(?:platform|harness|flow)(?:\/|$)/.test(record.href))) {
    failures.push(`${path}: public search must use current product paths instead of legacy routes`);
  }
}

const sitemap = readFileSync(resolve(root, 'dist/sitemap-0.xml'), 'utf8');
if (!/\/docs\/agents\//.test(sitemap) || !/\/docs\/objects\//.test(sitemap) || !/\/docs\/workforce\//.test(sitemap) || !/\/cases\/pilot\//.test(sitemap)) {
  failures.push('sitemap: all three product docs and case pages must be discoverable');
}
if (/(?:\/zh)?\/(?:platform|harness|flow)(?:\/|<)|\/docs\/(?:platform|harness|flow)(?:\/|<)/.test(sitemap)) {
  failures.push('sitemap: legacy product routes must not be discoverable');
}

if (failures.length > 0) {
  process.stderr.write(`Home checks failed (${failures.length}):\n${failures.map((failure) => `- ${failure}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('Home checks passed: Agents, Objects, and Workforce have distinct public paths, one shared opportunity form, and measurable GitHub exits.\n');
