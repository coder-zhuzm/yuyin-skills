import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { snapshot } from './evals.mjs';
import { buildBehaviorReport, validateBehaviorReport } from './behavior.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const fileHash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const statePath = 'evals/behavior-state.json';
function checkOutputPath(root, relative) {
  let current = realpathSync(root);
  for (const part of relative.split('/')) {
    current = join(current, part);
    try { assert.ok(!lstatSync(current).isSymbolicLink(), `Evidence output is a symbolic link: ${current}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
export function currentEvidence(root = process.cwd()) {
  const catalog = json(join(root, 'catalog.json'));
  const cases = json(join(root, 'evals/manifest.json')).cases;
  const skills = catalog.skills.map(s => ({ name: s.name, path: s.path, files: snapshot(join(root, s.path)) }));
  const harness = Object.fromEntries(['scripts/evals.mjs', 'scripts/evidence.mjs', 'scripts/behavior.mjs'].map(p => [p, fileHash(join(root, p))]));
  const identity = {
    schemaVersion: 1,
    cases: cases.map(c => ({ id: c.id, sha256: digest({ definition: c, fixture: snapshot(join(root, 'evals/fixtures', c.fixture)), skills: skills.filter(s => c.skills.includes(s.name)), harness }) })),
    uncoveredSkills: skills.filter(s => !cases.some(c => c.skills.includes(s.name))).map(s => ({ name: s.name, sha256: digest(s) })),
    skillsSha256: digest(skills),
  };
  return { ...identity, identitySha256: digest(identity) };
}
export function refreshEvidence(root = process.cwd()) {
  checkOutputPath(root, statePath);
  checkOutputPath(root, 'evals/upstream-changes.json');
  const current = currentEvidence(root);
  // This index records identity and pending work, never automatic behavior success.
  const state = { ...current, cases: current.cases.map(c => ({ ...c, status: 'pending' })), uncoveredSkills: current.uncoveredSkills.map(s => ({ ...s, status: 'pending' })) };
  const text = JSON.stringify(state, null, 2) + '\n';
  const path = join(root, statePath);
  if (!existsSync(path) || readFileSync(path, 'utf8') !== text) writeFileSync(path, text);
  const reportPath = join(root, 'evals/upstream-changes.json');
  const lock = json(join(root, 'upstream/lock.json'));
  const cases = json(join(root, 'evals/manifest.json')).cases;
  const previous = existsSync(reportPath) ? json(reportPath) : undefined;
  const readText = path => readFileSync(join(root, path), 'utf8');
  const report = buildBehaviorReport({ old: lock, next: lock, cases, previous, beforeText: readText, afterText: readText });
  validateBehaviorReport(report, lock, cases);
  const reportText = JSON.stringify(report, null, 2) + '\n';
  if (!existsSync(reportPath) || readFileSync(reportPath, 'utf8') !== reportText) writeFileSync(reportPath, reportText);
  return state;
}
export function validateEvidenceState(root = process.cwd()) {
  const current = currentEvidence(root), state = json(join(root, statePath));
  assert.deepEqual(state, { ...current, cases: current.cases.map(c => ({ ...c, status: 'pending' })), uncoveredSkills: current.uncoveredSkills.map(s => ({ ...s, status: 'pending' })) }, 'Behavior identity is stale; run node scripts/evidence.mjs refresh');
  return current;
}
export function validateReleaseReview(root = process.cwd(), review) {
  const current = currentEvidence(root);
  if (!review) {
    const path = join(root, 'evals/release-review.json');
    assert.ok(existsSync(path), 'Release blocked: no reviewed behavior decision. Inspect node scripts/evidence.mjs status and provide evals/release-review.json with current identity, reviewer, rationale and per-case/skill verified evidence or explicit waivers.');
    review = json(path);
  }
  assert.equal(review.schemaVersion, 1);
  assert.equal(review.identitySha256, current.identitySha256, 'Release review is stale for current skills, fixtures or harness');
  assert.ok(review.reviewer?.trim() && review.rationale?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt), 'Missing release reviewer, date or rationale');
  const expected = [...current.cases.map(c => `case:${c.id}`), ...current.uncoveredSkills.map(s => `skill:${s.name}`)].sort();
  assert.deepEqual(review.decisions?.map(d => d.id).sort(), expected, 'Release review coverage must account for every case and uncovered skill');
  const base = realpathSync(root);
  for (const decision of review.decisions) {
    assert.ok(['verified', 'waived'].includes(decision.status) && decision.rationale?.trim(), `Invalid review decision: ${decision.id}`);
    assert.ok(decision.evidence?.length, `Missing review evidence: ${decision.id}`);
    for (const evidence of decision.evidence) {
      assert.ok(typeof evidence.path === 'string' && evidence.path.startsWith('evals/runs/') && !evidence.path.split('/').some(p => !p || p === '.' || p === '..') && !evidence.path.includes('\\'), 'Invalid evidence path; use a sanitized repository evidence bundle under evals/runs/');
      const path = join(root, evidence.path), actual = realpathSync(path);
      assert.ok(actual.startsWith(`${base}/evals/runs/`), 'Evidence path escapes the repository evidence bundle');
      assert.equal(fileHash(path), evidence.sha256, `Release evidence hash differs: ${evidence.path}`);
    }
    if (decision.status === 'verified') {
      assert.ok(decision.id.startsWith('case:'), 'An uncovered skill needs a mapped case or an explicit waiver');
      const caseId = decision.id.slice('case:'.length);
      const expectedCase = current.cases.find(c => c.id === caseId);
      const checkIds = json(join(root, 'evals/manifest.json')).cases.find(c => c.id === caseId).checks;
      const bundles = decision.evidence.filter(e => e.path.endsWith('.json')).map(e => json(join(root, e.path)));
      assert.ok(bundles.some(b => b.schemaVersion === 1 && b.caseId === caseId && b.caseSha256 === expectedCase.sha256 &&
        b.review?.status === 'reviewed' && b.review.reviewer?.trim() && b.models?.length &&
        b.reviewedChecks?.length === checkIds.length &&
        checkIds.every(id => b.reviewedChecks.some(c => c.id === id && c.status === 'passed'))),
      `Verified decision lacks current, model-identified and manually reviewed behavior evidence: ${caseId}`);
    }
  }
  return current;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const command = process.argv[2];
    assert.equal(process.argv.length, 3, 'Usage: node scripts/evidence.mjs status|refresh|check-release');
    const result = command === 'refresh' ? refreshEvidence() : command === 'status' ? currentEvidence() : command === 'check-release' ? validateReleaseReview() : null;
    assert.ok(result, 'Usage: node scripts/evidence.mjs status|refresh|check-release');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
