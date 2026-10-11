import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const repository = 'coder-zhuzm/yuyin-skills';
const packageName = '@zhuzm/yuyin-skills';
const registry = 'https://registry.npmjs.org';
const stateFile = '.github/release-state.json';
function contentPaths() { return ['package.json', 'package-lock.json', 'README.md', ...json('package.json').files]; }

function versionParts(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? '')) throw new Error(`Invalid stable version: ${version}`);
  const parts = version.split('.').map(Number);
  if (parts.some(part => !Number.isSafeInteger(part))) throw new Error(`Version is too large: ${version}`);
  return parts;
}
function compare(a, b) {
  const left = versionParts(a), right = versionParts(b);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  return 0;
}
function stableVersions(versions) {
  return versions.filter(version => /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)).sort(compare);
}
export function planRelease({ currentVersion, publishedVersions, changed, requestedVersion = '', pendingVersion }) {
  versionParts(currentVersion);
  const highest = stableVersions(publishedVersions).at(-1);
  if (!highest) throw new Error('No published stable version; bootstrap the package manually first.');
  if (requestedVersion) versionParts(requestedVersion);
  if (pendingVersion && !publishedVersions.includes(pendingVersion)) {
    versionParts(pendingVersion);
    if (compare(pendingVersion, highest) <= 0) throw new Error(`Pending version ${pendingVersion} is behind published version ${highest}; resolve it before releasing.`);
    if (requestedVersion && requestedVersion !== pendingVersion) throw new Error(`Resume pending version ${pendingVersion} before requesting another version.`);
    return { version: pendingVersion, resume: true };
  }
  if (requestedVersion) {
    if (compare(requestedVersion, highest) <= 0) throw new Error(`Requested version must exceed published version ${highest}.`);
    return { version: requestedVersion, resume: false };
  }
  if (compare(currentVersion, highest) > 0) return { version: currentVersion, resume: false };
  if (!changed) return null;
  const parts = versionParts(highest); parts[2]++;
  const version = parts.join('.'); versionParts(version);
  return { version, resume: false };
}
export function syncVersionReferences(text, version, file) {
  versionParts(version);
  if (file === 'README.md') {
    const pattern = /版本 \*\*`\d+\.\d+\.\d+`\*\*/g;
    if ([...text.matchAll(pattern)].length !== 1) throw new Error('README version reference must appear exactly once.');
    return text.replace(pattern, `版本 **\`${version}\`**`);
  }
  return text.replace(/(@zhuzm\/yuyin-skills@|yuyin-skills-v|zhuzm-yuyin-skills-)\d+\.\d+\.\d+/g, `$1${version}`);
}
export function assertPublishedCandidate(state, published) {
  if (published.version !== state.version || published.dist?.shasum !== state.shasum) throw new Error(`Published candidate mismatch for ${state.version}; refusing to reuse its version or tag.`);
}
export function assertTagTarget(actual, expected) {
  if (actual !== expected) throw new Error(`Existing tag points to ${actual}, expected ${expected}; tags are never overwritten.`);
}
function run(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`);
  return result.stdout.trim();
}
function git(...args) { return run('git', args); }
function json(file) { return JSON.parse(readFileSync(file, 'utf8')); }
function saveJson(file, value) { mkdirSync(resolve(file, '..'), { recursive: true }); writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function tagCommit(version) {
  const result = spawnSync('git', ['rev-parse', '--verify', `refs/tags/v${version}^{commit}`], { encoding: 'utf8' });
  if (result.status === 0) return result.stdout.trim();
  if (result.status !== 128) throw new Error(`Cannot inspect tag v${version}: ${result.stderr}`);
  return null;
}
async function metadata() {
  const response = await fetch(`${registry}/${encodeURIComponent(packageName)}`, { signal: AbortSignal.timeout(30_000), headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error(`Registry metadata request failed: HTTP ${response.status}`);
  const data = await response.json();
  if (data.name !== packageName || !data.versions) throw new Error('Unexpected package metadata from registry.');
  return data;
}
function state() {
  if (!existsSync(stateFile)) return null;
  const value = json(stateFile); versionParts(value.version);
  if (!/^[a-f0-9]{40}$/.test(value.shasum) || !/^[a-f0-9]{40}$/.test(value.source)) throw new Error('Invalid persisted release candidate.');
  return value;
}
function candidateCommit() {
  const commit = git('log', '-1', '--format=%H', '--', stateFile);
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Release state must have a committed candidate.');
  return commit;
}
function pack(cwd, destination) {
  mkdirSync(destination, { recursive: true });
  const [result] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', destination, '--no-update-notifier'], cwd));
  if (result.name !== packageName || !/^[a-z0-9.-]+\.tgz$/.test(result.filename)) throw new Error('Unexpected package identity or archive filename.');
  return { ...result, archive: join(destination, result.filename) };
}
export function packCommit(commit) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid candidate commit.');
  const scratch = mkdtempSync(join(tmpdir(), 'yuyin-release-source-'));
  try {
    const source = join(scratch, 'source'); mkdirSync(source);
    run('git', ['archive', '--format=tar', `--output=${join(scratch, 'source.tar')}`, commit]);
    run('tar', ['-xf', join(scratch, 'source.tar'), '-C', source]);
    return { scratch, source, ...pack(source, scratch) };
  } catch (error) { rmSync(scratch, { recursive: true, force: true }); throw error; }
}
function notes(version, commit) {
  const changelog = git('show', `${commit}:CHANGELOG.md`);
  const section = changelog.split(`## ${version}\n`)[1]?.split(/\n## /)[0]?.trim();
  if (!section) throw new Error(`Missing changelog section for ${version}.`);
  return `${section}\n\n- npm: https://www.npmjs.com/package/${packageName}/v/${version}\n- Source: https://github.com/${repository}/commit/${commit}\n`;
}
async function completeCandidate(candidate, data, wait = false) {
  // npm may accept a publish before the new version becomes publicly downloadable.
  for (let attempt = 0; !data.versions[candidate.version] && wait && attempt < 24; attempt++) {
    console.log(`Waiting for public registry version ${candidate.version} (${attempt + 1}/24)...`);
    await new Promise(resolve => setTimeout(resolve, 15_000)); data = await metadata();
  }
  const published = data.versions[candidate.version];
  if (!published) throw new Error(`Version ${candidate.version} is not public yet; rerun this workflow to resume it.`);
  assertPublishedCandidate(candidate, published);
  const commit = candidateCommit();
  const snapshot = packCommit(commit);
  try {
    if (snapshot.shasum !== candidate.shasum) throw new Error('Committed candidate no longer matches its recorded archive.');
    const url = new URL(published.dist.tarball);
    if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org') throw new Error('Unexpected registry archive URL.');
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Public archive download failed: HTTP ${response.status}`);
    const digest = createHash('sha1').update(Buffer.from(await response.arrayBuffer())).digest('hex');
    if (digest !== candidate.shasum) throw new Error('Public archive digest does not match the release candidate.');
    const installed = join(snapshot.scratch, 'installed');
    run('npm', ['install', '--prefix', installed, `${packageName}@${candidate.version}`, '--registry', registry, '--userconfig', '/dev/null', '--cache', join(snapshot.scratch, 'cache'), '--prefer-online', '--ignore-scripts', '--no-audit', '--no-fund', '--no-update-notifier']);
    for (const file of snapshot.files) {
      const actual = readFileSync(join(installed, 'node_modules', packageName, file.path));
      if (!actual.equals(readFileSync(join(snapshot.source, file.path)))) throw new Error(`Public installation differs at ${file.path}.`);
    }
    const actualTag = tagCommit(candidate.version);
    if (actualTag) assertTagTarget(actualTag, commit);
    else git('tag', '-a', `v${candidate.version}`, commit, '-m', `v${candidate.version}`);
    git('push', 'origin', `refs/tags/v${candidate.version}`);
    const result = spawnSync('gh', ['release', 'view', `v${candidate.version}`, '--repo', repository], { encoding: 'utf8' });
    if (result.status !== 0) {
      if (!/release not found|HTTP 404/i.test(result.stderr)) throw new Error(`Cannot inspect GitHub Release: ${result.stderr}`);
      const body = join(snapshot.scratch, 'release-notes.md'); writeFileSync(body, notes(candidate.version, commit));
      run('gh', ['release', 'create', `v${candidate.version}`, snapshot.archive, '--repo', repository, '--verify-tag', '--title', `v${candidate.version}`, '--notes-file', body]);
    }
    // Creating the Release and uploading its asset are separate GitHub operations.
    // A retry must also repair an interrupted upload, without overwriting an asset.
    const release = JSON.parse(run('gh', ['api', `repos/${repository}/releases/tags/v${candidate.version}`]));
    if (release.draft || release.tag_name !== `v${candidate.version}`) throw new Error('Unexpected GitHub Release state.');
    if (!release.assets.some(asset => asset.name === snapshot.filename)) run('gh', ['release', 'upload', `v${candidate.version}`, snapshot.archive, '--repo', repository]);
    const assets = join(snapshot.scratch, 'release-assets'); mkdirSync(assets);
    run('gh', ['release', 'download', `v${candidate.version}`, '--repo', repository, '--pattern', snapshot.filename, '--dir', assets]);
    if (createHash('sha1').update(readFileSync(join(assets, snapshot.filename))).digest('hex') !== candidate.shasum) throw new Error('GitHub Release archive differs from the public npm package.');
    console.log(`Verified public package and GitHub Release v${candidate.version}.`);
  } finally { rmSync(snapshot.scratch, { recursive: true, force: true }); }
  return data;
}
function changedSince(version) {
  const baseline = tagCommit(version);
  if (!baseline) throw new Error(`Published version ${version} has no Git tag; add its verified source tag before automatic release.`);
  git('merge-base', '--is-ancestor', baseline, 'HEAD');
  return git('diff', '--name-only', baseline, 'HEAD', '--', ...contentPaths()) !== '';
}
function output(values) {
  for (const [key, value] of Object.entries(values)) {
    console.log(`${key}=${value}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}
function requireMainWorkflow() {
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REPOSITORY !== repository || process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Release mutations are allowed only in this repository main-branch GitHub workflow.');
  if (git('status', '--porcelain')) throw new Error('Release requires a clean tracked working tree.');
}
async function prepare(requestedVersion) {
  requireMainWorkflow();
  let data = await metadata(); const previous = state();
  if (previous && data.versions[previous.version]) data = await completeCandidate(previous, data);
  const currentVersion = json('package.json').version;
  const highest = stableVersions(Object.keys(data.versions)).at(-1);
  const planned = planRelease({ currentVersion, publishedVersions: Object.keys(data.versions), pendingVersion: previous?.version, requestedVersion, changed: changedSince(highest) });
  if (!planned) { output({ publish: 'false' }); return; }
  const destination = join(process.env.RUNNER_TEMP ?? tmpdir(), 'yuyin-release');
  if (planned.resume) {
    const snapshot = packCommit(candidateCommit());
    try {
      if (snapshot.shasum !== previous.shasum) throw new Error('Pending release archive changed; refusing to publish it.');
      mkdirSync(destination, { recursive: true }); const archive = join(destination, snapshot.filename); copyFileSync(snapshot.archive, archive);
      output({ publish: 'true', version: planned.version, archive, resumed: 'true' });
    } finally { rmSync(snapshot.scratch, { recursive: true, force: true }); }
    return;
  }
  const candidate = createCandidate(planned.version, highest, destination);
  output({ publish: 'true', version: candidate.version, archive: candidate.archive, resumed: 'false' });
}
export function createCandidate(version, baselineVersion, destination) {
  versionParts(version); versionParts(baselineVersion);
  const source = git('rev-parse', 'HEAD');
  const pkg = json('package.json'); pkg.version = version; saveJson('package.json', pkg);
  const lock = json('package-lock.json'); lock.version = version; lock.packages[''].version = version; saveJson('package-lock.json', lock);
  for (const file of ['README.md', 'docs/installation.md']) writeFileSync(file, syncVersionReferences(readFileSync(file, 'utf8'), version, file));
  const baseline = tagCommit(baselineVersion);
  const changes = git('log', '--format=%s (%h)', `${baseline}..${source}`, '--', ...contentPaths()).split('\n').filter(Boolean);
  const section = `## ${version}\n\n${changes.map(message => `- ${message}`).join('\n') || '- 更新分发内容。'}\n\n`;
  const changelog = readFileSync('CHANGELOG.md', 'utf8');
  if (changelog.includes(`## ${version}\n`)) throw new Error(`Changelog already contains version ${version}.`);
  if (!changelog.startsWith('# 变更记录\n\n')) throw new Error('Unexpected changelog header; refusing to omit release notes.');
  writeFileSync('CHANGELOG.md', changelog.replace(/^# 变更记录\n\n/, `# 变更记录\n\n${section}`));
  run('npm', ['run', 'verify']);
  const packed = pack(process.cwd(), destination);
  saveJson(stateFile, { version: version, source, shasum: packed.shasum });
  git('add', '--', 'package.json', 'package-lock.json', 'README.md', 'docs/installation.md', 'CHANGELOG.md', stateFile);
  git('commit', '-m', `chore(release): v${version} [skip ci]`);
  // A concurrent human push causes a normal fast-forward rejection, before npm publish.
  git('push', 'origin', 'HEAD:main');
  return { version, archive: packed.archive, shasum: packed.shasum, commit: git('rev-parse', 'HEAD') };
}

async function main() {
  const command = process.argv[2];
  if (command === 'prepare') return prepare(process.env.RELEASE_VERSION?.trim() ?? '');
  if (command === 'finalize') {
    requireMainWorkflow(); const candidate = state(); if (!candidate) throw new Error('No prepared release candidate.');
    await completeCandidate(candidate, await metadata(), true);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Published and verified **${packageName}@${candidate.version}**.\n\n[GitHub Release](https://github.com/${repository}/releases/tag/v${candidate.version}) · [npm](https://www.npmjs.com/package/${packageName}/v/${candidate.version})\n`);
    return;
  }
  throw new Error('Usage: node scripts/release.mjs prepare|finalize');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
