import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const packageJson = JSON.parse(read('package.json'));

// Installation must remain safe in source archives and build sandboxes where
// Git metadata is intentionally absent.
for (const lifecycle of ['preinstall', 'install', 'postinstall', 'prepare']) {
  if (packageJson.scripts?.[lifecycle]) failures.push(`package.json: ${lifecycle} must not mutate or inspect the host environment`);
}

const normalEntrypoints = ['dev', 'build', 'check:home', 'check:docs', 'preview'];
for (const name of normalEntrypoints) {
  const command = packageJson.scripts?.[name] ?? '';
  if (/provenance:refresh|hooks:install|\.\.\/awaken|\/Users\//.test(command)) {
    failures.push(`package.json: ${name} depends on a maintenance command or host path`);
  }
}

// Cause/effect design for repository-owned validation inputs:
// C1: a validation script can read a user-specific absolute path and pass only
//     on the author's machine, while a source archive or clean checkout fails.
// C2: a validation script can read a sibling repository and silently create a
//     second release prerequisite outside package metadata.
// E1: all normal validation inputs resolve from this repository.
// E2: personal paths, sibling repositories, and Git worktrees are rejected.
// Decision table:
// | Rule | User path | Sibling repo or Git dependency | Outcome |
// | S1   | absent    | absent                         | accept  |
// | S2   | present   | any                            | reject  |
// | S3   | absent    | present                        | reject  |
for (const path of ['astro.config.mjs', 'scripts/check-docs.mjs', 'scripts/check-home.mjs', 'scripts/generate-brand-marks.mjs']) {
  const text = read(path);
  for (const [pattern, message] of [
    [/(?:\/Users\/|\/home\/[^/]+\/)/, 'contains a user-specific absolute path'],
    [/\.\.\/awaken(?:-|\/|\b)/, 'reads a sibling Awaken repository'],
    [/execFileSync\(['"]git['"]|spawnSync\(['"]git['"]|git\s+-C\s+/, 'requires Git metadata or another Git worktree'],
  ]) {
    if (pattern.test(text)) failures.push(`${path}: ${message}`);
  }
}

let provenance;
try {
  provenance = JSON.parse(read('config/source-provenance.json'));
} catch (error) {
  failures.push(`config/source-provenance.json: invalid JSON (${error.message})`);
}
// Cause/effect design for repository-owned provenance:
// C1: documentation can drift from the exact source revision it describes.
// C2: duplicate or unsorted evidence coordinates make the lock nondeterministic.
// E1: both products retain exact reviewed revisions.
// E2: cited Awaken coordinates remain non-empty, unique, and sorted.
// Decision table:
// | Rule | Exact revisions | Awaken coordinates | Outcome |
// | P1   | yes             | non-empty/unique/sorted | accept |
// | P2   | no              | any                    | reject |
// | P3   | yes             | empty/duplicate/unsorted | reject |
const awakenProvenance = provenance?.repositories?.awaken;
const flowProvenance = provenance?.repositories?.flow;
for (const [name, repository] of [['awaken', awakenProvenance], ['flow', flowProvenance]]) {
  if (!/^[0-9a-f]{40}$/.test(repository?.revision ?? '')) failures.push(`config/source-provenance.json: ${name} needs an exact revision`);
}
const awakenEvidence = awakenProvenance?.evidenceCoordinates ?? [];
if (!awakenEvidence.length) failures.push('config/source-provenance.json: Awaken evidence is empty');
if (new Set(awakenEvidence).size !== awakenEvidence.length) failures.push('config/source-provenance.json: Awaken evidence has duplicates');
if (JSON.stringify(awakenEvidence) !== JSON.stringify([...awakenEvidence].sort())) failures.push('config/source-provenance.json: Awaken evidence must be sorted');

if (failures.length) {
  process.stderr.write(`Standalone checks failed (${failures.length}):\n${failures.map((failure) => `- ${failure}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('Standalone checks passed: build and validation use repository-owned inputs only.\n');
