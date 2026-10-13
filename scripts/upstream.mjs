import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
  chmodSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, posix } from 'node:path';
import { spawnSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';

const digest = (data) => createHash('sha256').update(data).digest('hex');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const stable = (value) => JSON.stringify(value, null, 2) + '\n';
const snapshot = 'skills/upstream';
const execFileAsync = promisify(execFile);
function safePath(path) {
  assert.ok(
    typeof path === 'string' &&
      path.length &&
      !path.includes('\\') &&
      !path.includes('\0') &&
      !path.startsWith('/') &&
      path.split('/').every((x) => x && x !== '.' && x !== '..'),
    `Unsafe path: ${path}`,
  );
  return path;
}
function noLinks(root, relative) {
  let current = root;
  for (const part of safePath(relative).split('/')) {
    current = join(current, part);
    if (
      existsSync(current) ||
      (() => {
        try {
          return lstatSync(current).isSymbolicLink();
        } catch {
          return false;
        }
      })()
    )
      assert.ok(!lstatSync(current).isSymbolicLink(), `Symbolic link destination: ${current}`);
  }
}
function walk(root, relative = '') {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .sort()
    .flatMap((name) => {
      const p = join(root, name),
        r = relative ? `${relative}/${name}` : name,
        s = lstatSync(p);
      assert.ok(!s.isSymbolicLink(), `Symbolic link snapshot: ${r}`);
      assert.ok(s.isFile() || s.isDirectory(), `Unsupported snapshot file: ${r}`);
      return s.isDirectory() ? walk(p, r) : [r];
    });
}
function manifest(root) {
  const bytes = readFileSync(join(root, 'upstream/sources.json'));
  const m = JSON.parse(bytes);
  assert.equal(m.schemaVersion, 1);
  assert.ok(Array.isArray(m.sources) && m.sources.length, 'No upstream sources');
  const ids = new Set(),
    names = new Set(),
    destinations = new Set();
  for (const s of m.sources) {
    assert.match(s.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(s.id), `Duplicate source ${s.id}`);
    ids.add(s.id);
    assert.match(s.repository, /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/);
    assert.ok(s.ref && !s.ref.startsWith('-'), 'Invalid source ref');
    assert.ok(s.license?.spdx && s.license.files?.length, `Missing license: ${s.id}`);
    s.license.files.forEach(safePath);
    for (const path of s.license.files) {
      const hash =
        s.license.declaration?.path === path ? s.license.declaration.sha256 : s.license.reviewedFiles?.[path];
      assert.match(hash ?? '', /^[a-f0-9]{64}$/, `License must have a reviewed hash: ${s.id}/${path}`);
    }
    for (const skill of s.skills ?? []) {
      safePath(skill.path);
      assert.match(skill.id, /^[a-z0-9-]+$/);
      assert.match(skill.name, /^[a-z0-9-]+$/);
      assert.ok(!names.has(skill.name), `Duplicate skill name ${skill.name}`);
      names.add(skill.name);
      const dest = `${s.id}/${posix.basename(skill.path)}`;
      assert.ok(!destinations.has(dest), `Destination collision ${dest}`);
      destinations.add(dest);
      (skill.reviewedScripts ?? []).forEach(safePath);
      for (const copy of skill.licenseCopies ?? []) {
        safePath(copy.path);
        safePath(copy.destination);
      }
      for (const [path, hash] of Object.entries(skill.reviewedScriptHashes ?? {})) {
        safePath(path);
        assert.match(hash, /^[a-f0-9]{64}$/);
      }
    }
    for (const r of s.resources ?? []) {
      safePath(r.path);
      safePath(r.destination);
      if (r.licenseDestination) safePath(r.licenseDestination);
    }
  }
  return { data: m, hash: digest(bytes) };
}
function git(args, cwd) {
  const r = spawnSync('git', args, {
    cwd,
    encoding: null,
    timeout: 180000,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1' },
  });
  if (r.error || r.status !== 0)
    throw new Error(`git ${args[0]} failed: ${r.error?.message ?? r.stderr?.toString()}`);
  return r.stdout;
}
export async function loadGitSource(source, ref) {
  const temp = mkdtempSync(join(tmpdir(), 'yuyin-upstream-fetch-'));
  try {
    git(['init', '--bare', '--quiet'], temp);
    await execFileAsync(
      'git',
      [
        '-c',
        'core.hooksPath=/dev/null',
        'fetch',
        '--quiet',
        '--depth=1',
        `https://github.com/${source.repository}.git`,
        ref,
      ],
      {
        cwd: temp,
        timeout: 180000,
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1' },
      },
    );
    const commit = git(['rev-parse', 'FETCH_HEAD'], temp).toString().trim();
    const prefixes = (source.skills ?? []).map((x) => x.path + '/');
    const exact = new Set([
      ...source.license.files,
      ...(source.resources ?? []).map((x) => x.path),
      ...(source.skills ?? []).flatMap((x) => x.licenseFiles ?? []),
    ]);
    const entries = git(['ls-tree', '-rz', commit], temp).toString().split('\0').filter(Boolean);
    const files = [];
    for (const entry of entries) {
      const [metadata, path] = entry.split('\t');
      if (!prefixes.some((x) => path.startsWith(x)) && !exact.has(path)) continue;
      const [mode, type, oid] = metadata.split(' ');
      safePath(path);
      assert.ok(
        type === 'blob' && ['100644', '100755'].includes(mode),
        `Unsupported upstream mode (symbolic link/submodule): ${path} ${mode}`,
      );
      files.push({ path, mode, content: git(['cat-file', 'blob', oid], temp) });
    }
    return { commit, files };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
function isCode(path, mode, content) {
  return (
    mode === '100755' ||
    /\.(?:py|[cm]?js|tsx?|sh|bash|rb|pl|ps1|exe|wasm|so|dylib|bin)$/i.test(path) ||
    /^#!/.test(content.toString())
  );
}
function reviewedCode(spec, path, file) {
  assert.ok(
    (spec.reviewedScripts ?? []).includes(path),
    `Unreviewed executable requires review: ${spec.id}/${path}`,
  );
  assert.equal(
    digest(file.content),
    spec.reviewedScriptHashes?.[path],
    `Executable content changed; review and update its approved hash: ${spec.id}/${path}`,
  );
}
function reviewedLicense(source, path, content) {
  const declaration = source.license.declaration;
  let bytes = content,
    expected = source.license.reviewedFiles?.[path];
  if (declaration?.path === path) {
    assert.match(declaration.heading, /^#{1,6} [^\r\n]+$/, 'Invalid license declaration heading');
    const text = content.toString(),
      heading = declaration.heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = [...text.matchAll(new RegExp(`^${heading}[ \\t]*\\r?$`, 'gm'))];
    assert.equal(matches.length, 1, `License declaration missing or ambiguous: ${source.id}/${path}`);
    const level = declaration.heading.match(/^#+/)[0].length;
    const body = text.slice(matches[0].index + matches[0][0].length);
    const next = body.search(new RegExp(`^#{1,${level}}\\s`, 'm'));
    bytes = Buffer.from((next < 0 ? body : body.slice(0, next)).trim());
    expected = declaration.sha256;
  }
  assert.equal(
    digest(bytes),
    expected,
    `License content changed; review before updating its approved hash: ${source.id}/${path}`,
  );
}
function validateReferences(files) {
  for (const [path, file] of files) {
    if (!path.endsWith('.md')) continue;
    const prose = file.content.toString().replace(/^\s*```[^\n]*\n[\s\S]*?^\s*```\s*$/gm, '');
    for (const [, raw] of prose.matchAll(/(?<!!)\[[^\]]*\]\(([^)]+)\)/g)) {
      const url = raw.replace(/^<|>$/g, '').split(/\s+"/)[0].split('#')[0];
      if (!url || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(url)) continue;
      // Markdown examples and extension-less documentation routes are not local resources.
      if (/[{}<>*]/.test(url) || !/\.[a-z0-9]+$/i.test(url)) continue;
      const target = posix.normalize(posix.join(posix.dirname(path), decodeURIComponent(url)));
      assert.ok(files.has(target), `Missing local reference: ${path} -> ${url}`);
    }
  }
}
function validateSkill(file, expected) {
  const text = file.content.toString();
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, 'Skill missing YAML frontmatter');
  const meta = YAML.parse(match[1]);
  assert.equal(meta.name, expected, `Skill name mismatch for ${expected}`);
  assert.ok(
    typeof meta.description === 'string' && meta.description.trim(),
    `Missing skill description ${expected}`,
  );
}
function inspectLock(root, lock, { allowMissing = false } = {}) {
  assert.equal(lock.schemaVersion, 1);
  assert.ok(Array.isArray(lock.files), 'Invalid lock file list');
  noLinks(root, snapshot);
  const actual = walk(join(root, snapshot)).map((x) => `${snapshot}/${x}`);
  if (allowMissing && !existsSync(join(root, snapshot))) return;
  assert.deepEqual(actual, [...lock.files.map((x) => x.path)].sort(), 'Snapshot file set modified');
  for (const f of lock.files) {
    safePath(f.path);
    assert.ok(f.path.startsWith(snapshot + '/'), 'Lock path outside snapshot');
    assert.match(f.sha256, /^[a-f0-9]{64}$/);
    assert.ok(['100644', '100755'].includes(f.mode), 'Invalid lock file mode');
    const p = join(root, f.path);
    assert.equal(digest(readFileSync(p)), f.sha256, `Snapshot hash modified: ${f.path}`);
    assert.equal((lstatSync(p).mode & 0o111) !== 0, f.mode === '100755', `Snapshot mode modified: ${f.path}`);
  }
}
function result(lock) {
  return { skills: lock.skills, files: lock.files.map((x) => x.path), sources: lock.sources.length };
}
export function verifyUpstreams(root = process.cwd()) {
  root = resolve(root);
  const m = manifest(root),
    lock = json(join(root, 'upstream/lock.json'));
  assert.equal(lock.manifestSha256, m.hash, 'Upstream manifest differs from lock; run update');
  inspectLock(root, lock);
  const expectedSkills = m.data.sources.flatMap((source) =>
    (source.skills ?? []).map((spec) => ({
      id: spec.id,
      name: spec.name,
      path: `${snapshot}/${source.id}/${posix.basename(spec.path)}`,
      sourceId: source.id,
    })),
  );
  assert.deepEqual(lock.skills, expectedSkills, 'Locked skill set differs from source manifest');
  assert.deepEqual(
    lock.sources.map((source) => source.id),
    m.data.sources.map((source) => source.id),
    'Locked source set differs from manifest',
  );
  const names = new Set();
  for (const skill of lock.skills) {
    assert.ok(!names.has(skill.name), 'Duplicate locked skill');
    names.add(skill.name);
    validateSkill({ content: readFileSync(join(root, skill.path, 'SKILL.md')) }, skill.name);
  }
  for (const s of lock.sources) {
    assert.match(s.commit, /^[a-f0-9]{40}$/);
    const spec = m.data.sources.find((x) => x.id === s.id);
    assert.equal(s.repository, spec.repository, 'Unrecognized locked source');
    assert.deepEqual(s.license, spec.license, 'Locked license differs from manifest');
  }
  for (const source of m.data.sources) {
    for (const spec of source.skills ?? []) {
      const base = `${snapshot}/${source.id}/${posix.basename(spec.path)}`;
      const copies =
        spec.licenseCopies ??
        (spec.licenseFiles ?? source.license.files).map((path) => ({
          path,
          destination: posix.basename(path),
        }));
      for (const copy of copies)
        reviewedLicense(source, copy.path, readFileSync(join(root, base, copy.destination)));
    }
    for (const resource of source.resources ?? [])
      for (const path of source.license.files)
        reviewedLicense(
          source,
          path,
          readFileSync(
            join(root, snapshot, resource.licenseDestination ?? `${source.id}/${posix.basename(path)}`),
          ),
        );
  }
  for (const f of lock.files) {
    const bytes = readFileSync(join(root, f.path));
    if (!isCode(f.path, f.mode, bytes)) continue;
    const skill = lock.skills.find((s) => f.path.startsWith(s.path + '/'));
    assert.ok(skill, `Executable outside skill: ${f.path}`);
    const source = m.data.sources.find((s) => s.id === skill.sourceId),
      spec = source.skills.find((s) => s.id === skill.id);
    reviewedCode(spec, f.path.slice(skill.path.length + 1), { content: bytes });
  }
  validateReferences(new Map(lock.files.map((f) => [f.path, { content: readFileSync(join(root, f.path)) }])));
  return result(lock);
}
export async function syncUpstreams({
  root = process.cwd(),
  mode = 'update',
  loadSource = loadGitSource,
} = {}) {
  root = resolve(root);
  assert.ok(['update', 'restore'].includes(mode), 'Mode must be update or restore');
  noLinks(root, snapshot);
  noLinks(root, 'upstream/lock.json');
  const m = manifest(root),
    lockPath = join(root, 'upstream/lock.json'),
    old = existsSync(lockPath) ? json(lockPath) : null;
  if (old) inspectLock(root, old, { allowMissing: mode === 'restore' });
  else assert.ok(!existsSync(join(root, snapshot)), 'Unmanaged snapshot directory already exists');
  if (mode === 'restore') {
    assert.ok(old, 'Restore requires upstream/lock.json');
    assert.equal(old.manifestSha256, m.hash, 'Manifest changed since lock');
  }
  const files = new Map(),
    skills = [],
    sources = [],
    patches = [];
  const fetched = await Promise.allSettled(
    m.data.sources.map(async (source) => {
      const requested = mode === 'restore' ? old.sources.find((s) => s.id === source.id)?.commit : source.ref;
      assert.ok(requested, `Missing locked source ${source.id}`);
      return { source, requested, loaded: await loadSource(source, requested) };
    }),
  );
  for (let i = 0; i < fetched.length; i++)
    if (fetched[i].status === 'rejected')
      throw new Error(`Source ${m.data.sources[i].id} failed: ${fetched[i].reason.message}`, {
        cause: fetched[i].reason,
      });
  function put(path, content, mode = '100644') {
    safePath(path);
    assert.ok(path.startsWith(snapshot + '/'), 'Destination outside snapshot');
    assert.ok(!files.has(path), `File collision: ${path}`);
    files.set(path, { content: Buffer.from(content), mode });
  }
  for (const item of fetched) {
    const { source, requested, loaded } = item.value;
    assert.match(loaded.commit, /^[a-f0-9]{40}$/);
    if (mode === 'restore') assert.equal(loaded.commit, requested, 'Source commit differs from lock');
    const upstream = new Map();
    for (const f of loaded.files) {
      safePath(f.path);
      assert.ok(['100644', '100755'].includes(f.mode), `Unsupported symbolic link/file mode: ${f.path}`);
      assert.ok(!upstream.has(f.path), `Duplicate source file ${f.path}`);
      upstream.set(f.path, { ...f, content: Buffer.from(f.content) });
    }
    for (const path of source.license.files) {
      assert.ok(upstream.has(path), `Missing license: ${source.id}/${path}`);
      reviewedLicense(source, path, upstream.get(path).content);
    }
    sources.push({
      id: source.id,
      repository: source.repository,
      ref: source.ref,
      commit: loaded.commit,
      license: source.license,
    });
    for (const spec of source.skills ?? []) {
      const dest = `${snapshot}/${source.id}/${posix.basename(spec.path)}`;
      assert.ok(upstream.has(`${spec.path}/SKILL.md`), `Missing skill: ${source.id}/${spec.path}`);
      validateSkill(upstream.get(`${spec.path}/SKILL.md`), spec.name);
      for (const [path, f] of upstream) {
        if (!path.startsWith(spec.path + '/')) continue;
        const rel = path.slice(spec.path.length + 1);
        if (isCode(rel, f.mode, f.content)) reviewedCode(spec, rel, f);
        put(`${dest}/${rel}`, f.content, f.mode);
      }
      const licenseCopies =
        spec.licenseCopies ??
        (spec.licenseFiles ?? source.license.files).map((path) => ({
          path,
          destination: posix.basename(path),
        }));
      for (const { path, destination } of licenseCopies) {
        assert.ok(upstream.has(path), `Missing license/notice ${source.id}:${path}`);
        const target = `${dest}/${destination}`;
        if (!files.has(target)) put(target, upstream.get(path).content);
        else
          assert.equal(
            digest(files.get(target).content),
            digest(upstream.get(path).content),
            'License collision',
          );
      }
      skills.push({ id: spec.id, name: spec.name, path: dest, sourceId: source.id });
    }
    for (const resource of source.resources ?? []) {
      assert.ok(upstream.has(resource.path), `Missing resource ${resource.path}`);
      put(`${snapshot}/${resource.destination}`, upstream.get(resource.path).content);
      for (const path of source.license.files) {
        assert.ok(upstream.has(path), `Missing resource license ${path}`);
        const destination = resource.licenseDestination ?? `${source.id}/${posix.basename(path)}`;
        put(`${snapshot}/${destination}`, upstream.get(path).content);
      }
    }
  }
  for (const patch of m.data.patches ?? []) {
    safePath(patch.path);
    const file = files.get(patch.path);
    assert.ok(file, `Patch target missing ${patch.path}`);
    const text = file.content.toString();
    const beforeSha256 = digest(file.content);
    let changed;
    if (patch.type === 'replace-exact') {
      assert.equal(text.split(patch.before).length - 1, 1, `Patch no longer applies uniquely: ${patch.id}`);
      changed = text.replace(patch.before, patch.after);
    } else {
      assert.equal(patch.type, 'rewrite-rule-links', 'Unsupported patch type');
      changed = text.replace(/\]\(\.\/([a-z0-9_-]+\.md)(#[^)]*)?\)/g, (whole, name, anchor = '') => {
        const parent = posix.dirname(patch.path);
        if (files.has(`${parent}/${name}`) || !files.has(`${parent}/rules/${name}`)) return whole;
        return `](rules/${name}${anchor})`;
      });
    }
    file.content = Buffer.from(changed);
    patches.push({
      id: patch.id,
      path: patch.path,
      beforeSha256,
      afterSha256: digest(file.content),
      reason: patch.reason,
    });
  }
  validateReferences(files);
  const next = {
    schemaVersion: 1,
    manifestSha256: m.hash,
    sources,
    skills,
    patches,
    files: [...files]
      .sort(([a], [b]) => a.localeCompare(b, 'en'))
      .map(([path, f]) => ({ path, sha256: digest(f.content), mode: f.mode })),
  };
  if (mode === 'restore') assert.deepEqual(next, old, 'Restored snapshot differs from lock');
  // Stage and validate the complete batch before replacing any previous snapshot.
  const stage = mkdtempSync(join(root, '.upstream-stage-'));
  let moved = false,
    installed = false;
  try {
    for (const [path, f] of files) {
      mkdirSync(join(stage, posix.dirname(path)), { recursive: true });
      writeFileSync(join(stage, path), f.content);
      chmodSync(join(stage, path), f.mode === '100755' ? 0o755 : 0o644);
    }
    mkdirSync(join(stage, 'upstream'), { recursive: true });
    writeFileSync(join(stage, 'upstream/sources.json'), readFileSync(join(root, 'upstream/sources.json')));
    writeFileSync(join(stage, 'upstream/lock.json'), stable(next));
    verifyUpstreams(stage);
    // Recheck immediately before mutation to avoid overwriting edits made while fetching.
    if (old) inspectLock(root, old, { allowMissing: mode === 'restore' });
    else assert.ok(!existsSync(join(root, snapshot)), 'Snapshot appeared while fetching');
    assert.equal(
      digest(readFileSync(join(root, 'upstream/sources.json'))),
      m.hash,
      'Manifest changed while fetching',
    );
    mkdirSync(join(root, 'skills'), { recursive: true });
    if (existsSync(join(root, snapshot))) {
      renameSync(join(root, snapshot), join(stage, 'previous'));
      moved = true;
    }
    renameSync(join(stage, snapshot), join(root, snapshot));
    installed = true;
    if (mode === 'update') renameSync(join(stage, 'upstream/lock.json'), lockPath);
  } catch (error) {
    if (installed) rmSync(join(root, snapshot), { recursive: true, force: true });
    if (moved) renameSync(join(stage, 'previous'), join(root, snapshot));
    throw error;
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
  return result(next);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const mode = process.argv[2];
    assert.ok(
      ['update', 'restore', 'check'].includes(mode),
      'Usage: node scripts/upstream.mjs update|restore|check',
    );
    const r = mode === 'check' ? verifyUpstreams() : await syncUpstreams({ mode });
    console.log(
      `Upstream ${mode}: ${r.skills.length} skills, ${r.files.length} files, ${r.sources} sources.`,
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
