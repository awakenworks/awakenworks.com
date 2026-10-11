import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const baseline = JSON.parse(readFileSync(join(root, 'config/source-provenance.json'), 'utf8'));
const flowCoordinate = 'crates/domain/awaken-flow-work/src/handoff.rs';

// Source-owner cause/effect graph: C1 owning repository has the referenced
// coordinate; C2 coordinate is absent; C3 the other repository has the same
// coordinate; C4 an Agents reference is absent from its own repository lock.
// Rules S1(C1)->pass; S2(C2)->reject; S3(C2+C3)->reject, never borrow;
// S4(C4)->reject, preserving the pre-existing Agents evidence gate.
// Run the actual whole-document checker against a copied manifest. All other
// inputs are read-only symlinks; mutations never touch the source worktree.
// These are manifest/ownership checks, not source execution or customer proof.
for (const rule of ['valid', 'missing-flow', 'borrowed-flow', 'missing-agents'] as const) {
  test(`source provenance ${rule}`, () => {
    const fixture = mkdtempSync(join(tmpdir(), 'awakenworks-provenance-'));
    try {
      for (const name of readdirSync(root)) {
        if (name === '.git') continue;
        if (name === 'config' || name === 'scripts') {
          cpSync(join(root, name), join(fixture, name), { recursive: true });
        } else {
          symlinkSync(join(root, name), join(fixture, name));
        }
      }
      const manifest = structuredClone(baseline);
      if (rule === 'missing-flow' || rule === 'borrowed-flow') {
        manifest.repositories.flow.evidenceCoordinates = manifest.repositories.flow.evidenceCoordinates.filter((value: string) => value !== flowCoordinate);
      }
      if (rule === 'borrowed-flow') manifest.repositories.awaken.evidenceCoordinates.push(flowCoordinate);
      if (rule === 'missing-agents') manifest.repositories.awaken.evidenceCoordinates.shift();
      writeFileSync(join(fixture, 'config/source-provenance.json'), JSON.stringify(manifest));
      const result = spawnSync(process.execPath, [join(fixture, 'scripts/check-docs.mjs')], { encoding: 'utf8', timeout: 30_000 });
      const output = result.stdout + result.stderr;
      expect(result.error, output).toBeUndefined();
      if (rule === 'valid') {
        expect(result.status, output).toBe(0);
        expect(output).toContain('Documentation checks passed');
      } else {
        expect(result.status, output).toBe(1);
        // Frontmatter and inline references have different diagnostic prefixes;
        // both must reject the missing coordinate from its own source owner.
        expect(output).toMatch(/verified(?: [a-z]+)? source coordinate/);
        if (rule === 'missing-agents') expect(output).toContain(baseline.repositories.awaken.evidenceCoordinates[0]);
        if (rule !== 'missing-agents') expect(output).toContain(flowCoordinate);
      }
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
}
