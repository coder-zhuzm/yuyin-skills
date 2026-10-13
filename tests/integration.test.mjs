import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCandidate, packCommit, planWorkflowRelease, syncVersionReferences } from '../scripts/release.mjs';
import { validateMarkdown, validatePackageContents } from '../scripts/verify.mjs';

const project = dirname(dirname(fileURLToPath(import.meta.url)));
function command(cwd, executable, ...args) {
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}
function fixture({ changed = true } = {}) {
  const scratch = mkdtempSync(join(tmpdir(), 'yuyin-release-test-'));
  const tree = join(scratch, 'source'), remote = join(scratch, 'remote.git');
  cpSync(project, tree, { recursive: true, filter: path => relative(project, path) !== '.github/release-state.json' && !['.git', 'node_modules'].some(dir => relative(project, path) === dir || relative(project, path).startsWith(`${dir}/`)) });
  // Keep the test baseline fixed even after CI updates the real repository version.
  for (const file of ['package.json', 'package-lock.json']) {
    const data = JSON.parse(readFileSync(join(tree, file), 'utf8')); data.version = '0.3.0';
    if (data.packages) data.packages[''].version = '0.3.0';
    writeFileSync(join(tree, file), `${JSON.stringify(data, null, 2)}\n`);
  }
  for (const file of ['README.md', 'docs/installation.md']) writeFileSync(join(tree, file), syncVersionReferences(readFileSync(join(tree, file), 'utf8'), '0.3.0', file));
  writeFileSync(join(tree, 'CHANGELOG.md'), '# 变更记录\n\n## 0.3.0\n\n- Baseline fixture content.\n');
  symlinkSync(join(project, 'node_modules'), join(tree, 'node_modules'), 'dir');
  command(tree, 'git', 'init', '-b', 'main');
  command(tree, 'git', 'config', 'user.name', 'Release Test');
  command(tree, 'git', 'config', 'user.email', 'release-test@example.invalid');
  command(tree, 'git', 'add', '.'); command(tree, 'git', 'commit', '-m', 'Baseline content');
  command(tree, 'git', 'tag', 'v0.3.0');
  command(scratch, 'git', 'init', '--bare', remote);
  command(tree, 'git', 'remote', 'add', 'origin', remote);
  command(tree, 'git', 'push', 'origin', 'HEAD:main');
  if (changed) {
    writeFileSync(join(tree, 'README.md'), `${readFileSync(join(tree, 'README.md'), 'utf8')}\nPackage content update for release validation.\n`);
    command(tree, 'git', 'add', 'README.md'); command(tree, 'git', 'commit', '-m', 'Update package content');
    command(tree, 'git', 'push', 'origin', 'HEAD:main');
  }
  return { scratch, tree, remote };
}
function inFixture(callback, options) {
  const context = fixture(options); const previousCwd = process.cwd(); const previousCache = process.env.npm_config_cache;
  process.chdir(context.tree); process.env.npm_config_cache = join(context.scratch, 'npm-cache');
  try { callback(context); }
  finally {
    process.chdir(previousCwd);
    if (previousCache === undefined) delete process.env.npm_config_cache; else process.env.npm_config_cache = previousCache;
    rmSync(context.scratch, { recursive: true, force: true });
  }
}

test('manual preparation creates a real new archive without editing the version or distribution first', () => inFixture(({ tree, scratch, remote }) => {
  assert.equal(command(tree, 'git', 'diff', 'v0.3.0', 'HEAD', '--stat'), '');
  const planned = planWorkflowRelease({ eventName: 'workflow_dispatch', currentVersion: '0.3.0', publishedVersions: ['0.3.0'], changed: false });
  const candidate = createCandidate(planned.version, '0.3.0', join(scratch, 'archives'));
  assert.equal(candidate.version, '0.3.1');
  assert.equal(JSON.parse(readFileSync(join(tree, 'package.json'), 'utf8')).version, '0.3.1');
  assert.equal(command(remote, 'git', 'rev-parse', 'refs/heads/main'), candidate.commit);
  const snapshot = packCommit(candidate.commit);
  try { assert.equal(snapshot.shasum, candidate.shasum); }
  finally { rmSync(snapshot.scratch, { recursive: true, force: true }); }
}, { changed: false }));

test('an actual CLI failure records an incomplete release in the Actions summary', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'yuyin-summary-test-'));
  try {
    const summary = join(scratch, 'summary.md');
    const result = spawnSync(process.execPath, [join(project, 'scripts/release.mjs'), 'prepare', '--unknown'], { encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: summary } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage/);
    assert.match(readFileSync(summary, 'utf8'), /发布未完成/);
    assert.doesNotMatch(readFileSync(summary, 'utf8'), /已发布并验证/);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('a real release candidate synchronizes references, persists identity and remains reproducible after later edits', () => inFixture(({ tree, scratch, remote }) => {
  const source = command(tree, 'git', 'rev-parse', 'HEAD');
  const candidate = createCandidate('0.3.1', '0.3.0', join(scratch, 'archives'));
  const state = JSON.parse(readFileSync(join(tree, '.github/release-state.json'), 'utf8'));
  assert.deepEqual(state, { version: '0.3.1', source, shasum: candidate.shasum });
  assert.equal(JSON.parse(readFileSync(join(tree, 'package.json'), 'utf8')).version, '0.3.1');
  assert.equal(JSON.parse(readFileSync(join(tree, 'package-lock.json'), 'utf8')).packages[''].version, '0.3.1');
  assert.match(readFileSync(join(tree, 'README.md'), 'utf8'), /版本 \*\*`0\.3\.1`\*\*/);
  assert.match(readFileSync(join(tree, 'docs/installation.md'), 'utf8'), /@zhuzm\/yuyin-skills@0\.3\.1/);
  assert.match(readFileSync(join(tree, 'CHANGELOG.md'), 'utf8'), /## 0\.3\.1\n\n- Update package content/);
  assert.equal(command(tree, 'git', 'status', '--porcelain'), '');
  assert.equal(command(remote, 'git', 'rev-parse', 'refs/heads/main'), candidate.commit);
  assert.equal(createHash('sha1').update(readFileSync(candidate.archive)).digest('hex'), candidate.shasum);
  writeFileSync(join(tree, 'README.md'), `${readFileSync(join(tree, 'README.md'), 'utf8')}\nA newer change while publication is interrupted.\n`);
  command(tree, 'git', 'add', 'README.md'); command(tree, 'git', 'commit', '-m', 'Later package update');
  const snapshot = packCommit(candidate.commit);
  try {
    assert.equal(snapshot.shasum, candidate.shasum, 'A retry must publish the persisted candidate, not newer working-tree contents.');
    assert.doesNotMatch(readFileSync(join(snapshot.source, 'README.md'), 'utf8'), /A newer change/);
    assert.notEqual(command(tree, 'git', 'diff', '--name-only', candidate.commit, 'HEAD', '--', 'README.md'), '', 'The subsequent preparation can detect and release newer content.');
  } finally { rmSync(snapshot.scratch, { recursive: true, force: true }); }
}));

test('a concurrent remote commit rejects candidate publication before npm publish', () => inFixture(({ tree, scratch, remote }) => {
  const peer = join(scratch, 'peer');
  command(scratch, 'git', 'clone', '--branch', 'main', remote, peer);
  command(peer, 'git', 'config', 'user.name', 'Concurrent Test');
  command(peer, 'git', 'config', 'user.email', 'concurrent-test@example.invalid');
  writeFileSync(join(peer, 'concurrent-change.txt'), 'An independent remote change.\n');
  command(peer, 'git', 'add', '.'); command(peer, 'git', 'commit', '-m', 'Concurrent remote update');
  command(peer, 'git', 'push', 'origin', 'HEAD:main');
  const remoteHead = command(remote, 'git', 'rev-parse', 'refs/heads/main');
  assert.throws(() => createCandidate('0.3.1', '0.3.0', join(scratch, 'archives')), /git push.*failed:[\s\S]*(?:rejected|fetch first)/);
  assert.equal(command(remote, 'git', 'rev-parse', 'refs/heads/main'), remoteHead, 'A concurrent human commit must remain intact.');
}));

test('verification rejects broken local links and private files in the public package', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'yuyin-verification-test-'));
  try {
    const doc = join(scratch, 'README.md'); writeFileSync(doc, '# Install\n\n[Jump](#missing)\n');
    assert.throws(() => validateMarkdown(doc, scratch), /missing anchor/);
    writeFileSync(doc, '# Install\n\n[Outside](../private.md)\n');
    assert.throws(() => validateMarkdown(doc, scratch), /escapes repository/);
    const pkg = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));
    assert.throws(() => validatePackageContents({ name: pkg.name, version: pkg.version, files: [{ path: '.npmrc' }] }, { ...pkg, files: ['.npmrc'] }, scratch), /credential file/);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});
