export const publicBrandMarks = Object.freeze(['works', 'agents', 'objects', 'workforce']);
export const brandMarkSchemes = Object.freeze(['on-dark', 'on-light']);

const aliases = Object.freeze({
  harness: 'agents',
  platform: 'agents',
  flow: 'workforce',
});

const titles = Object.freeze({
  works: 'AwakenWorks',
  agents: 'Awaken Agents',
  objects: 'Awaken Objects',
  workforce: 'Awaken Workforce',
});

const assetStems = Object.freeze({
  works: 'awakenworks',
  agents: 'awaken-agents',
  objects: 'awaken-objects',
  workforce: 'awaken-workforce',
});

function decisionDot(cx, cy, radius = 2.5) {
  return `<circle data-role="decision" cx="${cx}" cy="${cy}" r="${radius}" fill="var(--mark-decision)"/>`;
}

// One geometry owner for the website components and downloadable SVG assets.
// The original filled Awaken A is the master mark and the single shared
// geometry for AwakenWorks and Agents. Objects and Workforce inherit its
// filled-ribbon weight, diagonal cuts, and circular point of human direction.
const awakenA = Object.freeze([
  '<path data-silhouette="A" d="M14.2 6h3.6l8.6 20h-3L16 8.4 8.6 26h-3Z" fill="var(--mark-primary)"/>',
  decisionDot(16, 20.2),
]);

const geometry = Object.freeze({
  works: awakenA,
  agents: awakenA,
  objects: [
    '<g data-silhouette="O" fill="none" stroke="var(--mark-primary)" stroke-width="3"><circle cx="11" cy="11.5" r="5.75"/><circle cx="21" cy="20.5" r="5.75"/></g>',
    decisionDot(16, 16),
  ],
  workforce: [
    '<path data-silhouette="W" d="M5 6h3.4l3.5 14.1 2.7-6.6h2.8l2.7 6.6L23.6 6H27l-5.1 20h-3.1L16 19.2 13.2 26h-3.1Z" fill="var(--mark-primary)"/>',
    decisionDot(16, 15.8),
  ],
});

const palettes = Object.freeze({
  'on-dark': Object.freeze({
    works: Object.freeze({ primary: '#f2b15d', decision: '#a392ff' }),
    agents: Object.freeze({ primary: '#68ced9', decision: '#a392ff' }),
    objects: Object.freeze({ primary: '#dca447', decision: '#a392ff' }),
    workforce: Object.freeze({ primary: '#e78a67', decision: '#a392ff' }),
  }),
  'on-light': Object.freeze({
    works: Object.freeze({ primary: '#8f4300', decision: '#5c43b2' }),
    agents: Object.freeze({ primary: '#0f6f7b', decision: '#5c43b2' }),
    objects: Object.freeze({ primary: '#87570c', decision: '#5c43b2' }),
    workforce: Object.freeze({ primary: '#9b3f27', decision: '#5c43b2' }),
  }),
  current: Object.freeze({
    works: Object.freeze({ primary: 'currentColor', decision: 'currentColor' }),
    agents: Object.freeze({ primary: 'currentColor', decision: 'currentColor' }),
    objects: Object.freeze({ primary: 'currentColor', decision: 'currentColor' }),
    workforce: Object.freeze({ primary: 'currentColor', decision: 'currentColor' }),
  }),
});

export function canonicalBrandMark(mark) {
  const canonical = aliases[mark] ?? mark;
  if (!publicBrandMarks.includes(canonical)) throw new Error(`Unknown brand mark: ${mark}`);
  return canonical;
}

export function brandMarkTitle(mark) {
  return titles[canonicalBrandMark(mark)];
}

export function brandMarkAssetStem(mark) {
  return assetStems[canonicalBrandMark(mark)];
}

export function brandMarkBody(mark) {
  return geometry[canonicalBrandMark(mark)].join('');
}

export function brandMarkPalette(mark, scheme = 'current') {
  const canonical = canonicalBrandMark(mark);
  const palette = palettes[scheme];
  if (!palette) throw new Error(`Unknown brand mark scheme: ${scheme}`);
  return palette[canonical];
}

export function brandMarkStyle(mark, scheme = 'current') {
  const { primary, decision } = brandMarkPalette(mark, scheme);
  return `--mark-primary:${primary};--mark-decision:${decision}`;
}

export function renderBrandMarkSvg(mark, scheme) {
  const canonical = canonicalBrandMark(mark);
  const body = brandMarkBody(canonical)
    .replaceAll('var(--mark-primary)', brandMarkPalette(canonical, scheme).primary)
    .replaceAll('var(--mark-decision)', brandMarkPalette(canonical, scheme).decision);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><title>${titles[canonical]} — ${scheme}</title>${body}</svg>\n`;
}

export function renderAdaptiveFaviconSvg() {
  const dark = brandMarkPalette('works', 'on-dark');
  const light = brandMarkPalette('works', 'on-light');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <title>AwakenWorks</title>
  <style>
    svg { --mark-primary: ${dark.primary}; --mark-decision: ${dark.decision}; }
    .surface { fill: #17130f; }
    @media (prefers-color-scheme: light) {
      svg { --mark-primary: ${light.primary}; --mark-decision: ${light.decision}; }
      .surface { fill: #f7f3eb; }
    }
  </style>
  <rect class="surface" width="32" height="32" rx="8"/>
  ${brandMarkBody('works')}
</svg>\n`;
}
