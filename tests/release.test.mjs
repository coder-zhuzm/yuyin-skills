import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planRelease, planWorkflowRelease, preparationSummary, syncVersionReferences, assertPublishedCandidate, assertTagTarget, refreshReleaseSources } from '../scripts/release.mjs';

const baseline = { currentVersion: '0.3.0', publishedVersions: ['0.3.0'], changed: true };

test('an interrupted candidate never refreshes upstream content', async () => {
  let calls = 0;
  const result = await refreshReleaseSources({ pendingVersion: '0.3.1', publishedVersions: ['0.3.0'], refresh: async () => { calls++; } });
  assert.equal(calls, 0);
  assert.equal(result, false);
});

test('new preparation refreshes upstreams even when local package files did not change', async () => {
  let calls = 0;
  await refreshReleaseSources({ pendingVersion: '0.3.1', publishedVersions: ['0.3.0', '0.3.1'], refresh: async () => { calls++; } });
  assert.equal(calls, 1);
  await assert.rejects(refreshReleaseSources({ publishedVersions: ['0.3.1'], refresh: async () => { throw new Error('Upstream unavailable'); } }), /Upstream unavailable/);
});

test('a package change automatically creates the next patch version', () => {
  assert.deepEqual(planRelease(baseline), { version: '0.3.1', resume: false });
});

test('reserved-directory-only changes do not release', () => {
  assert.equal(planRelease({ ...baseline, changed: false }), null);
});

test('manual dispatch allocates a new patch without local version or content changes', () => {
  assert.deepEqual(planWorkflowRelease({ ...baseline, currentVersion: '0.3.1', publishedVersions: ['0.3.0', '0.3.1'], changed: false, eventName: 'workflow_dispatch' }), { version: '0.3.2', resume: false });
  assert.equal(planWorkflowRelease({ ...baseline, changed: false, eventName: 'push' }), null);
});

test('manual recovery preserves the candidate and its catch-up only releases changed content', () => {
  const recovery = { ...baseline, currentVersion: '0.3.1', pendingVersion: '0.3.1', changed: false, eventName: 'workflow_dispatch' };
  assert.deepEqual(planWorkflowRelease(recovery), { version: '0.3.1', resume: true });
  const completed = { ...recovery, publishedVersions: ['0.3.0', '0.3.1'], changedOnly: true };
  assert.equal(planWorkflowRelease(completed), null);
  assert.deepEqual(planWorkflowRelease({ ...completed, changed: true }), { version: '0.3.2', resume: false });
});

test('manual dispatch honors explicit versions and preserves invalid-version protection', () => {
  const dispatch = { ...baseline, changed: false, eventName: 'workflow_dispatch' };
  assert.deepEqual(planWorkflowRelease({ ...dispatch, requestedVersion: '0.4.0' }), { version: '0.4.0', resume: false });
  assert.throws(() => planWorkflowRelease({ ...dispatch, requestedVersion: '0.3.0' }), /exceed/);
  assert.throws(() => planWorkflowRelease({ ...dispatch, pendingVersion: '0.3.1', requestedVersion: '0.4.0' }), /Resume pending/);
  assert.throws(() => planWorkflowRelease({ ...dispatch, eventName: 'unknown' }), /Unsupported release event/);
});

test('preparation summaries distinguish skipped, prepared and resumed releases from published success', () => {
  assert.match(preparationSummary(null, { highest: '0.3.1' }), /跳过发布.*没有新的分发内容/);
  assert.match(preparationSummary(null, { highest: '0.3.1' }), /0\.3\.1/);
  const prepared = preparationSummary({ version: '0.3.2', resume: false }, { eventName: 'workflow_dispatch' });
  assert.match(prepared, /手动触发/);
  assert.match(prepared, /准备.*0\.3\.2/);
  assert.doesNotMatch(prepared, /已发布|发布成功/);
  assert.match(preparationSummary({ version: '0.3.1', resume: true }), /恢复.*0\.3\.1/);
});

test('a failed unpublished candidate is resumed without another version bump', () => {
  assert.deepEqual(planRelease({ ...baseline, currentVersion: '0.3.1', pendingVersion: '0.3.1' }), { version: '0.3.1', resume: true });
});

test('a manually increased stable version is honored', () => {
  assert.deepEqual(planRelease({ ...baseline, currentVersion: '0.4.0' }), { version: '0.4.0', resume: false });
});

test('a dispatched version can deliberately create a minor release', () => {
  assert.deepEqual(planRelease({ ...baseline, requestedVersion: '0.4.0', changed: false }), { version: '0.4.0', resume: false });
});

test('version allocation uses the highest published stable version', () => {
  assert.equal(planRelease({ ...baseline, publishedVersions: ['0.3.0', '0.3.8', '1.0.0-beta.1'] }).version, '0.3.9');
});

test('invalid or already published requested versions fail before mutation', () => {
  for (const requestedVersion of ['0.3.0', '0.2.9', '0.03.1', '0.4.0-beta', '$(echo bad)', '1.2.3\nextra']) {
    assert.throws(() => planRelease({ ...baseline, requestedVersion }), /version/i);
  }
});

test('an explicit version cannot silently replace an unpublished candidate', () => {
  assert.throws(() => planRelease({ ...baseline, currentVersion: '0.3.1', pendingVersion: '0.3.1', requestedVersion: '0.4.0' }), /pending/i);
});

test('a pending candidate behind a manually published version stops rather than regressing latest', () => {
  assert.throws(() => planRelease({ ...baseline, pendingVersion: '0.3.1', publishedVersions: ['0.3.0', '0.4.0'] }), /behind published/i);
});

test('retrying a published candidate requires exact package identity', () => {
  const state = { version: '0.3.1', shasum: 'a'.repeat(40) };
  assertPublishedCandidate(state, { version: '0.3.1', dist: { shasum: state.shasum } });
  assert.throws(() => assertPublishedCandidate(state, { version: '0.3.1', dist: { shasum: 'b'.repeat(40) } }), /mismatch/i);
});

test('existing release tags cannot be moved to another commit', () => {
  assertTagTarget('abc', 'abc');
  assert.throws(() => assertTagTarget('abc', 'def'), /tag/i);
});

test('current install examples are synchronized without changing tool versions or verification history', () => {
  const readme = '内容包名称为 **`@zhuzm/yuyin-skills`**，版本 **`0.3.0`**。\nCLI skills@1.7.2';
  const guide = '@zhuzm/yuyin-skills@0.3.0 yuyin-skills-v0.3.0-offline.zip zhuzm-yuyin-skills-0.3.0.tgz';
  assert.match(syncVersionReferences(readme, '0.4.0', 'README.md'), /版本 \*\*`0\.4\.0`\*\*/);
  assert.match(syncVersionReferences(readme, '0.4.0', 'README.md'), /skills@1\.7\.2/);
  assert.equal(syncVersionReferences(guide, '0.4.0', 'docs/installation.md'), '@zhuzm/yuyin-skills@0.4.0 yuyin-skills-v0.4.0-offline.zip zhuzm-yuyin-skills-0.4.0.tgz');
  assert.throws(() => syncVersionReferences('unexpected format', '0.4.0', 'README.md'), /version reference/i);
});
