import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { syncUpstreams, verifyUpstreams } from '../scripts/upstream.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'upstream-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'upstream'));
  const source = {
    id: 'example',
    repository: 'example/skills',
    ref: 'main',
    license: {
      spdx: 'MIT',
      files: ['LICENSE'],
      reviewedFiles: { LICENSE: createHash('sha256').update('MIT license').digest('hex') },
    },
    skills: [{ id: 'demo', path: 'skills/demo', name: 'demo', reviewedScripts: [] }],
  };
  writeFileSync(join(root, 'upstream/sources.json'), JSON.stringify({ schemaVersion: 1, sources: [source] }));
  const files = [
    { path: 'LICENSE', content: 'MIT license', mode: '100644' },
    {
      path: 'skills/demo/SKILL.md',
      content: '---\nname: demo\ndescription: Example skill.\n---\nRead [guide](references/guide.md).\n',
      mode: '100644',
    },
    { path: 'skills/demo/references/guide.md', content: 'Guide', mode: '100644' },
  ];
  const loadSource = async (_source, ref) => ({
    commit: /^[a-f0-9]{40}$/.test(ref) ? ref : 'a'.repeat(40),
    files,
  });
  return { root, files, loadSource };
}

test('update, offline verification and exact locked restore agree', async (t) => {
  const f = fixture(t);
  const result = await syncUpstreams(f);
  assert.equal(result.skills[0].name, 'demo');
  assert.ok(result.files.some((x) => x.endsWith('LICENSE')));
  assert.equal(verifyUpstreams(f.root).skills.length, 1);
  const before = readFileSync(join(f.root, 'upstream/lock.json'), 'utf8');
  rmSync(join(f.root, 'skills/upstream'), { recursive: true });
  const calls = [];
  await syncUpstreams({
    ...f,
    mode: 'restore',
    loadSource: async (s, ref) => {
      calls.push(ref);
      return f.loadSource(s, ref);
    },
  });
  assert.deepEqual(calls, ['a'.repeat(40)]);
  assert.equal(readFileSync(join(f.root, 'upstream/lock.json'), 'utf8'), before);
});
test('local edits and unexpected files are never overwritten', async (t) => {
  const f = fixture(t);
  await syncUpstreams(f);
  writeFileSync(join(f.root, 'skills/upstream/example/demo/SKILL.md'), 'local edit');
  await assert.rejects(syncUpstreams(f), /modified|hash/i);
  assert.equal(readFileSync(join(f.root, 'skills/upstream/example/demo/SKILL.md'), 'utf8'), 'local edit');
});
test('failed batch leaves previous snapshot and lock intact', async (t) => {
  const f = fixture(t);
  await syncUpstreams(f);
  const before = readFileSync(join(f.root, 'upstream/lock.json'), 'utf8');
  f.files.push({ path: 'skills/demo/scripts/new.py', content: 'print(1)', mode: '100644' });
  await assert.rejects(syncUpstreams(f), /review|script/i);
  assert.equal(readFileSync(join(f.root, 'upstream/lock.json'), 'utf8'), before);
  verifyUpstreams(f.root);
});
test('reject symbolic links and path traversal in upstream entries', async (t) => {
  for (const file of [
    { path: 'skills/demo/evil', mode: '120000', content: '/etc/passwd' },
    { path: 'skills/demo/../evil', mode: '100644', content: 'bad' },
  ]) {
    const f = fixture(t);
    f.files.push(file);
    await assert.rejects(syncUpstreams(f), /symbolic|path|mode/i);
  }
});
test('reject dangling cross-directory references', async (t) => {
  const f = fixture(t);
  f.files[1].content += '\n[other](../missing/SKILL.md)';
  await assert.rejects(syncUpstreams(f), /reference|link/i);
});
test('locked restore rejects changed source bytes', async (t) => {
  const f = fixture(t);
  await syncUpstreams(f);
  rmSync(join(f.root, 'skills/upstream'), { recursive: true });
  f.files[2].content = 'tampered';
  await assert.rejects(syncUpstreams({ ...f, mode: 'restore' }), /lock|hash|snapshot/i);
});
test('source manifest changes are allowed on update but rejected on restore/check', async (t) => {
  const f = fixture(t);
  await syncUpstreams(f);
  const p = join(f.root, 'upstream/sources.json');
  writeFileSync(p, readFileSync(p, 'utf8') + '\n');
  assert.throws(() => verifyUpstreams(f.root), /manifest/i);
  await assert.rejects(syncUpstreams({ ...f, mode: 'restore' }), /manifest/i);
  await syncUpstreams(f);
  verifyUpstreams(f.root);
});
test('refuse symlinked destination ancestor', async (t) => {
  const f = fixture(t);
  const outside = mkdtempSync(join(tmpdir(), 'outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  symlinkSync(outside, join(f.root, 'skills'));
  await assert.rejects(syncUpstreams(f), /symbolic/i);
});
test('approved executable paths still require exact reviewed bytes', async (t) => {
  const f = fixture(t);
  const path = join(f.root, 'upstream/sources.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  const content = 'print("reviewed")\n';
  manifest.sources[0].skills[0].reviewedScripts = ['scripts/helper.py'];
  manifest.sources[0].skills[0].reviewedScriptHashes = {
    'scripts/helper.py': createHash('sha256').update(content).digest('hex'),
  };
  writeFileSync(path, JSON.stringify(manifest));
  f.files.push({ path: 'skills/demo/scripts/helper.py', content, mode: '100644' });
  await syncUpstreams(f);
  f.files.at(-1).content = 'print("changed")\n';
  await assert.rejects(syncUpstreams(f), /Executable content changed/);
  verifyUpstreams(f.root);
});
test('a manually edited lock cannot change the manifest-selected skill set', async (t) => {
  const f = fixture(t);
  await syncUpstreams(f);
  const path = join(f.root, 'upstream/lock.json');
  const lock = JSON.parse(readFileSync(path, 'utf8'));
  lock.skills = [];
  writeFileSync(path, JSON.stringify(lock));
  assert.throws(() => verifyUpstreams(f.root), /Locked skill set/);
});
test('unreviewed license changes stop updates and preserve the old snapshot', async (t) => {
  const f = fixture(t);
  await syncUpstreams(f);
  const before = readFileSync(join(f.root, 'upstream/lock.json'), 'utf8');
  f.files[0].content = 'Different license terms';
  await assert.rejects(syncUpstreams(f), /License content changed/);
  assert.equal(readFileSync(join(f.root, 'upstream/lock.json'), 'utf8'), before);
  verifyUpstreams(f.root);
});
test('README license declarations are independently reviewed from unrelated documentation', async (t) => {
  const f = fixture(t),
    path = join(f.root, 'upstream/sources.json'),
    manifest = JSON.parse(readFileSync(path, 'utf8'));
  manifest.sources[0].license = {
    spdx: 'MIT',
    files: ['README.md'],
    declaration: {
      path: 'README.md',
      heading: '## License',
      sha256: createHash('sha256').update('MIT').digest('hex'),
    },
  };
  writeFileSync(path, JSON.stringify(manifest));
  f.files[0] = { path: 'README.md', mode: '100644', content: '# Source\nDocs\n\n## License\n\nMIT\n' };
  await syncUpstreams(f);
  f.files[0].content = '# Updated source docs\n\n## License\n\nMIT\n';
  await syncUpstreams(f);
  f.files[0].content = '# Source\n\n## License\n\nGPL-3.0\n';
  await assert.rejects(syncUpstreams(f), /License content changed/);
});
test('locked update reapplies declared patches without advancing source commits and records affected cases', async t => {
  const f = fixture(t);
  await syncUpstreams(f);
  mkdirSync(join(f.root, 'evals'));
  writeFileSync(join(f.root, 'evals/manifest.json'), JSON.stringify({ cases: [{ id: 'demo-task', skills: ['demo'] }] }));
  const path = join(f.root, 'upstream/sources.json'), manifest = JSON.parse(readFileSync(path));
  manifest.patches = [{ id: 'compatibility', type: 'replace-exact', path: 'skills/upstream/example/demo/SKILL.md', before: 'Example skill.', after: 'Example skill preserving project tools.', reason: 'Project compatibility' }];
  writeFileSync(path, JSON.stringify(manifest));
  const refs = [];
  await syncUpstreams({ ...f, locked: true, loadSource: async (source, ref) => { refs.push(ref); return f.loadSource(source, ref); } });
  assert.deepEqual(refs, ['a'.repeat(40)]);
  assert.match(readFileSync(join(f.root, 'skills/upstream/example/demo/SKILL.md'), 'utf8'), /preserving project tools/);
  const report = JSON.parse(readFileSync(join(f.root, 'evals/upstream-changes.json')));
  assert.deepEqual(report.affectedCases, ['demo-task']);
  assert.ok(report.coverage.every(c => c.status === 'pending'));
  const before = readFileSync(join(f.root, 'evals/upstream-changes.json'), 'utf8');
  await syncUpstreams({ ...f, mode: 'restore' });
  assert.equal(readFileSync(join(f.root, 'evals/upstream-changes.json'), 'utf8'), before, 'Restore must not erase pending behavior evidence');
});
test('locked update rejects a loader returning a different commit', async t => {
  const f = fixture(t); await syncUpstreams(f);
  const before = readFileSync(join(f.root, 'upstream/lock.json'), 'utf8');
  await assert.rejects(syncUpstreams({ ...f, locked: true, loadSource: async () => ({ commit: 'b'.repeat(40), files: f.files }) }), /commit differs/i);
  assert.equal(readFileSync(join(f.root, 'upstream/lock.json'), 'utf8'), before);
});
test('a failed behavior-report replacement rolls back the lock and snapshot together', async t => {
  const f = fixture(t);
  mkdirSync(join(f.root, 'evals'));
  writeFileSync(join(f.root, 'evals/manifest.json'), JSON.stringify({ cases: [{ id: 'demo-task', skills: ['demo'] }] }));
  await syncUpstreams(f);
  const lock = readFileSync(join(f.root, 'upstream/lock.json'), 'utf8');
  const report = readFileSync(join(f.root, 'evals/upstream-changes.json'), 'utf8');
  f.files[2].content = 'Updated guide';
  chmodSync(join(f.root, 'evals'), 0o500);
  try { await assert.rejects(syncUpstreams(f), /EACCES|EPERM/); }
  finally { chmodSync(join(f.root, 'evals'), 0o700); }
  assert.equal(readFileSync(join(f.root, 'upstream/lock.json'), 'utf8'), lock);
  assert.equal(readFileSync(join(f.root, 'evals/upstream-changes.json'), 'utf8'), report);
  verifyUpstreams(f.root);
});
test('case-only changes remap pending coverage even when the locked snapshot is unchanged', async t => {
  const f = fixture(t); mkdirSync(join(f.root, 'evals'));
  const path = join(f.root, 'evals/manifest.json');
  writeFileSync(path, JSON.stringify({ cases: [] })); await syncUpstreams(f);
  assert.deepEqual(JSON.parse(readFileSync(join(f.root, 'evals/upstream-changes.json'))).uncoveredSkills, ['demo']);
  const lock = readFileSync(join(f.root, 'upstream/lock.json'), 'utf8');
  writeFileSync(path, JSON.stringify({ cases: [{ id: 'demo-task', skills: ['demo'] }] }));
  await syncUpstreams({ ...f, locked: true });
  assert.equal(readFileSync(join(f.root, 'upstream/lock.json'), 'utf8'), lock);
  const report = JSON.parse(readFileSync(join(f.root, 'evals/upstream-changes.json')));
  assert.deepEqual(report.uncoveredSkills, []);
  assert.deepEqual(report.affectedCases, ['demo-task']);
  assert.ok(report.changes.length > 0, 'Remapping must retain the original change evidence');
  assert.equal(report.coverage.length, 6);
});
