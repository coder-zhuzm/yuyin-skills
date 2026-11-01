import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentEvidence, refreshEvidence, validateReleaseReview } from '../scripts/evidence.mjs';
const source = dirname(dirname(fileURLToPath(import.meta.url)));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'yuyin-evidence-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of ['skills', 'evals', 'scripts', 'upstream', 'catalog.json']) cpSync(join(source, path), join(root, path), { recursive: true });
  return root;
}
test('own entry changes invalidate related cases while README changes preserve evidence', t => {
  const root = fixture(t), before = currentEvidence(root);
  writeFileSync(join(root, 'README.md'), 'Documentation only');
  assert.deepEqual(currentEvidence(root), before);
  const entry = join(root, 'skills/development/shared/yuyin-dev/SKILL.md');
  writeFileSync(entry, readFileSync(entry, 'utf8') + '\nChanged routing behavior\n');
  const after = currentEvidence(root);
  assert.notEqual(after.identitySha256, before.identitySha256);
  assert.ok(after.cases.every((c, i) => c.sha256 !== before.cases[i].sha256));
  const state = refreshEvidence(root);
  assert.ok(state.cases.every(c => c.status === 'pending'));
});
test('release review requires current fingerprints, explicit dispositions and locatable hashed evidence', t => {
  const root = fixture(t), state = currentEvidence(root);
  const evidence = 'evals/runs/reviewed-check.json';
  writeFileSync(join(root, evidence), '{"reviewed":true}\n');
  const artifact = { path: evidence, sha256: createHash('sha256').update(readFileSync(join(root, evidence))).digest('hex') };
  const review = { schemaVersion: 1, identitySha256: state.identitySha256, reviewer: 'test reviewer', reviewedAt: '2026-11-01', rationale: 'Test review', decisions: [...state.cases.map(c => `case:${c.id}`), ...state.uncoveredSkills.map(s => `skill:${s.name}`)].map(id => ({ id, status: 'waived', rationale: 'Explicit limited-scope waiver', evidence: [artifact] })) };
  validateReleaseReview(root, review);
  const stale = { ...review, identitySha256: '0'.repeat(64) };
  assert.throws(() => validateReleaseReview(root, stale), /stale/i);
  assert.throws(() => validateReleaseReview(root, { ...review, decisions: [] }), /coverage/i);
  const unverified = structuredClone(review); unverified.decisions[0].status = 'verified';
  assert.throws(() => validateReleaseReview(root, unverified), /manually reviewed behavior evidence/i);
  const verifiedPath = 'evals/runs/verified-example.json';
  const c = JSON.parse(readFileSync(join(root, 'evals/manifest.json'))).cases[0];
  const bundle = { schemaVersion: 1, caseId: c.id, caseSha256: state.cases[0].sha256, models: ['test-model'], review: { status: 'reviewed', reviewer: 'test reviewer' }, reviewedChecks: c.checks.map(id => ({ id, status: 'passed' })) };
  writeFileSync(join(root, verifiedPath), JSON.stringify(bundle));
  const verified = structuredClone(review); verified.decisions[0] = { ...verified.decisions[0], status: 'verified', evidence: [{ path: verifiedPath, sha256: createHash('sha256').update(readFileSync(join(root, verifiedPath))).digest('hex') }] };
  validateReleaseReview(root, verified);
  const escape = structuredClone(review); escape.decisions[0].evidence[0].path = '../outside';
  assert.throws(() => validateReleaseReview(root, escape), /evidence path/i);
  writeFileSync(join(root, evidence), 'changed evidence');
  assert.throws(() => validateReleaseReview(root, review), /evidence hash/i);
});

test('evidence refresh rejects dangling output symlinks before creating external files', t => {
  const root = fixture(t), outside = mkdtempSync(join(tmpdir(), 'yuyin-evidence-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  const target = join(outside, 'must-not-exist.json'), state = join(root, 'evals/behavior-state.json');
  rmSync(state, { force: true }); symlinkSync(target, state);
  assert.throws(() => refreshEvidence(root), /symbolic link/);
  assert.throws(() => readFileSync(target), /ENOENT/);
});
