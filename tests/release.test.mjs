import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planRelease, syncVersionReferences, assertPublishedCandidate, assertTagTarget } from '../scripts/release.mjs';

const baseline = { currentVersion: '0.3.0', publishedVersions: ['0.3.0'], changed: true };

test('a package change automatically creates the next patch version', () => {
  assert.deepEqual(planRelease(baseline), { version: '0.3.1', resume: false });
});

test('reserved-directory-only changes do not release', () => {
  assert.equal(planRelease({ ...baseline, changed: false }), null);
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
