import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBehaviorReport, validateBehaviorReport } from '../scripts/behavior.mjs';

const file = (path, sha256) => ({ path, sha256, mode: '100644' });
const path = 'skills/upstream/example/spring/SKILL.md';
const skill = { name: 'java-springboot', path: 'skills/upstream/example/spring' };
const old = { skills: [skill], files: [file(path, 'a'.repeat(64))] };
const next = { skills: [skill], files: [file(path, 'b'.repeat(64))] };
const cases = [{ id: 'spring-mybatis', skills: ['yuyin-dev', 'java-springboot'] }];
test('changed instructions map to affected cases with all host/mode checks pending', () => {
  const report = buildBehaviorReport({ old, next, cases, beforeText: () => 'Use JPA', afterText: () => 'Preserve MyBatis' });
  assert.deepEqual(report.affectedCases, ['spring-mybatis']);
  assert.equal(report.changes[0].removed[0], 'Use JPA');
  assert.equal(report.changes[0].added[0], 'Preserve MyBatis');
  assert.equal(report.coverage.length, 6);
  assert.ok(report.coverage.every(c => c.status === 'pending'));
  assert.equal(validateBehaviorReport(report, next, cases), true);
});
test('removed skills and uncovered changes cannot silently disappear from a report', () => {
  const report = buildBehaviorReport({ old, next: { skills: [], files: [] }, cases, beforeText: () => 'Use JPA', afterText: () => '' });
  assert.deepEqual(report.affectedCases, ['spring-mybatis']);
  const uncovered = buildBehaviorReport({ old: null, next, cases: [], beforeText: () => '', afterText: () => 'New instruction' });
  assert.deepEqual(uncovered.uncoveredSkills, ['java-springboot']);
});
test('reports reject a stale target lock and cannot claim model success automatically', () => {
  const report = buildBehaviorReport({ old, next, cases, beforeText: () => '', afterText: () => '' });
  assert.throws(() => validateBehaviorReport(report, old, cases), /target lock/i);
  report.coverage[0].status = 'passed';
  assert.throws(() => validateBehaviorReport(report, next, cases), /pending/i);
});
test('a later update retains outstanding behavior cases from its predecessor', () => {
  const previous = buildBehaviorReport({ old, next, cases, beforeText: () => '', afterText: () => '' });
  const report = buildBehaviorReport({ old: next, next, cases, previous, beforeText: () => '', afterText: () => '' });
  assert.deepEqual(report.affectedCases, ['spring-mybatis']);
  assert.equal(report.coverage.length, 6);
});
test('later updates retain uncovered skill/resource gaps and newly mapped skills become pending cases', () => {
  const previous = buildBehaviorReport({ old: null, next, cases: [], beforeText: () => '', afterText: () => '' });
  previous.unmappedPaths = ['skills/upstream/unmapped-resource.md'];
  const report = buildBehaviorReport({ old: next, next, cases: [], previous, beforeText: () => '', afterText: () => '' });
  assert.deepEqual(report.uncoveredSkills, ['java-springboot']);
  assert.deepEqual(report.unmappedPaths, previous.unmappedPaths);
  const mapped = buildBehaviorReport({ old: next, next, cases, previous: report, beforeText: () => '', afterText: () => '' });
  assert.deepEqual(mapped.uncoveredSkills, []);
  assert.deepEqual(mapped.affectedCases, ['spring-mybatis']);
  assert.equal(mapped.coverage.length, 6);
});
