import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const lockDigest = lock => createHash('sha256').update(JSON.stringify(lock)).digest('hex');
const modes = ['explicit', 'implicit', 'direct'];
const hosts = ['codex', 'claude'];
function excerpt(before, after) {
  const a = before.split('\n'), b = after.split('\n');
  const removed = a.filter(line => !b.includes(line)), added = b.filter(line => !a.includes(line));
  return { removed: removed.slice(0, 40), added: added.slice(0, 40), excerptTruncated: removed.length > 40 || added.length > 40 };
}
export function buildBehaviorReport({ old, next, cases, beforeText, afterText, previous }) {
  const before = new Map((old?.files ?? []).map(f => [f.path, f]));
  const after = new Map(next.files.map(f => [f.path, f]));
  const skills = [...(old?.skills ?? []), ...next.skills];
  let changes = [...new Set([...before.keys(), ...after.keys()])].sort().flatMap(path => {
    const a = before.get(path), b = after.get(path);
    if (a?.sha256 === b?.sha256 && a?.mode === b?.mode) return [];
    const owners = [...new Set(skills.filter(s => path.startsWith(`${s.path}/`)).map(s => s.name))];
    return [{ path, beforeSha256: a?.sha256 ?? null, afterSha256: b?.sha256 ?? null,
      beforeMode: a?.mode ?? null, afterMode: b?.mode ?? null,
      skills: owners, cases: cases.filter(c => c.skills.some(s => owners.includes(s))).map(c => c.id),
      // These are review questions, not a semantic classification or a model verdict.
      reviewAreas: ['trigger-scope', 'workflow', 'tool-dependencies', 'external-actions'],
      ...(path.endsWith('.md') ? excerpt(a ? beforeText(path) : '', b ? afterText(path) : '') : {}),
    }];
  });
  const inheritedReport = previous?.targetLockSha256 === lockDigest(old) ? previous : null;
  const sameLock = old && lockDigest(old) === lockDigest(next);
  if (sameLock && inheritedReport) changes = inheritedReport.changes.map(change => ({ ...change, cases: cases.filter(c => c.skills.some(s => change.skills.includes(s))).map(c => c.id) }));
  const inherited = inheritedReport?.affectedCases ?? [];
  const pendingSkills = [...new Set([...(inheritedReport?.uncoveredSkills ?? []), ...changes.flatMap(c => c.skills)])];
  const affectedCases = [...new Set([...inherited, ...changes.flatMap(c => c.cases), ...cases.filter(c => c.skills.some(s => pendingSkills.includes(s))).map(c => c.id)])].sort();
  return { schemaVersion: 1, baseLockSha256: sameLock && inheritedReport ? inheritedReport.baseLockSha256 : old ? lockDigest(old) : null, targetLockSha256: lockDigest(next), casesSha256: lockDigest(cases),
    changes, inheritedPendingCases: inherited, affectedCases,
    uncoveredSkills: pendingSkills.filter(s => !cases.some(c => c.skills.includes(s))).sort(),
    unmappedPaths: [...new Set([...(inheritedReport?.unmappedPaths ?? []), ...changes.filter(c => !c.skills.length).map(c => c.path)])].sort(),
    coverage: affectedCases.flatMap(caseId => hosts.flatMap(host => modes.map(mode => ({ caseId, host, mode, status: 'pending' })))),
    evidencePolicy: 'Mechanical checks do not prove model behavior. Inspect run artifacts and traceReview separately; this generated report never grants a behavior pass.',
  };
}
export function validateBehaviorReport(report, lock, cases) {
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.targetLockSha256, lockDigest(lock), 'Behavior report target lock is stale');
  assert.equal(report.casesSha256, lockDigest(cases), 'Behavior report case definitions are stale; rebuild with upstream:adapt');
  assert.ok(Array.isArray(report.changes) && Array.isArray(report.coverage), 'Invalid behavior report');
  const ids = new Set(cases.map(c => c.id));
  for (const id of report.affectedCases) assert.ok(ids.has(id), `Unknown affected case: ${id}`);
  const expected = report.affectedCases.flatMap(caseId => hosts.flatMap(host => modes.map(mode => `${caseId}:${host}:${mode}`))).sort();
  assert.deepEqual(report.coverage.map(c => `${c.caseId}:${c.host}:${c.mode}`).sort(), expected, 'Incomplete host/mode matrix');
  assert.ok(report.coverage.every(c => c.status === 'pending'), 'Generated coverage must remain pending; actual evidence belongs in run artifacts');
  for (const change of report.changes) {
    assert.ok(change.path.startsWith('skills/upstream/') && !change.path.split('/').includes('..'), 'Invalid changed path');
    const current = lock.files.find(f => f.path === change.path);
    assert.equal(change.afterSha256, current?.sha256 ?? null, 'Behavior report file hash differs from target lock');
  }
  return true;
}
