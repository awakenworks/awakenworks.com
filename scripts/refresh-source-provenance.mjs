import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const awaken = args.get('--awaken');
const flow = args.get('--flow');
if (!awaken || !flow) {
  process.stderr.write('Usage: node scripts/refresh-source-provenance.mjs --awaken <repo> --flow <repo>\n');
  process.exit(2);
}

const revision = (repo, ref) => execFileSync('git', ['-C', repo, 'rev-parse', `${ref}^{commit}`], { encoding: 'utf8' }).trim();

function filesBelow(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...filesBelow(path));
    else if (extname(path) === '.md') files.push(path);
  }
  return files;
}

function publicEvidence(products) {
  const coordinates = new Set();
  for (const product of products) {
    for (const path of filesBelow(resolve(root, 'src/content/docs', product))) {
      const text = readFileSync(path, 'utf8');
      const frontmatter = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
      const evidence = /^evidence:\n((?:  - "[^"]+"\n?)+)/m.exec(frontmatter)?.[1] ?? '';
      for (const match of evidence.matchAll(/^  - "([^"]+)"$/gm)) coordinates.add(match[1]);
      for (const match of text.matchAll(/`((?:crates|web|e2e|packs|docs|adr)\/[^`\s#)]+)`/g)) {
        coordinates.add(match[1].replace(/[.,;:]$/, ''));
      }
    }
  }
  return [...coordinates].sort();
}

function verifyCoordinates(repo, ref, coordinates) {
  for (const coordinate of coordinates) {
    try {
      execFileSync('git', ['-C', repo, 'cat-file', '-e', `${ref}:${coordinate}`], { stdio: 'ignore' });
    } catch {
      throw new Error(`Public source evidence is missing at ${ref}: ${coordinate}`);
    }
  }
}

const pins = JSON.parse(readFileSync(resolve(root, 'config/source-provenance.json'), 'utf8'));
const awakenRevision = pins.repositories?.awaken?.revision;
const flowRevision = pins.repositories?.flow?.revision;
if (![awakenRevision, flowRevision].every((value) => /^[0-9a-f]{40}$/.test(value ?? ''))) throw new Error('source-provenance.json must pin Awaken and Flow to exact revisions');

const actualAwaken = revision(awaken, awakenRevision);
const actualFlow = revision(flow, flowRevision);
const awakenEvidence = publicEvidence(['platform', 'harness']);
const flowEvidence = publicEvidence(['flow']);
verifyCoordinates(awaken, awakenRevision, awakenEvidence);
verifyCoordinates(flow, flowRevision, flowEvidence);

const manifest = {
  schemaVersion: 1,
  description: 'Minimal source verification lock for documentation checks.',
  repositories: {
    awaken: {
      revision: actualAwaken,
      evidenceCoordinates: awakenEvidence,
    },
    flow: {
      revision: actualFlow,
      evidenceCoordinates: flowEvidence,
    },
  },
};

mkdirSync(resolve(root, 'config'), { recursive: true });
writeFileSync(resolve(root, 'config/source-provenance.json'), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`Wrote minimal provenance for Awaken ${actualAwaken} and Flow ${actualFlow}.\n`);
