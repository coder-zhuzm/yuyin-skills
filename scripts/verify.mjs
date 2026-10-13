import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { verifyUpstreams } from './upstream.mjs';
import { loadCatalog, resolveProfiles } from './profiles.mjs';

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} failed: ${result.error?.message ?? result.stderr}`);
  return result.stdout.trim();
}
export function markdownAnchors(text) {
  const counts = new Map();
  return [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map(([, heading]) => {
    const base = heading
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
      .replace(/\s/g, '-');
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    return count ? `${base}-${count}` : base;
  });
}
export function validateMarkdown(file, root) {
  const text = readFileSync(file, 'utf8');
  const fences = text.match(/^\s*```/gm) ?? [];
  assert.equal(fences.length % 2, 0, `${file}: unclosed code block`);
  const prose = text.replace(/^\s*```[^\n]*\n[\s\S]*?^\s*```\s*$/gm, '');
  for (const [, url] of prose.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    if (/^(?:https?:|mailto:)/.test(url)) continue;
    const [path, anchor] = url.split('#');
    const target = path ? resolve(file, '..', decodeURIComponent(path)) : file;
    assert.ok(target.startsWith(`${root}/`) || target === root, `${file}: link escapes repository: ${url}`);
    assert.ok(existsSync(target), `${file}: missing link: ${url}`);
    if (anchor && target.endsWith('.md'))
      assert.ok(
        markdownAnchors(readFileSync(target, 'utf8')).includes(decodeURIComponent(anchor)),
        `${file}: missing anchor: ${url}`,
      );
  }
}
function skillFiles(dir, prefix = '') {
  return readdirSync(dir).flatMap((name) => {
    const relative = `${prefix}${name}`;
    const path = join(dir, name);
    const stat = lstatSync(path);
    assert.ok(!stat.isSymbolicLink(), `Skill source must not contain symbolic links: ${path}`);
    return stat.isDirectory() ? skillFiles(path, `${relative}/`) : [relative];
  });
}
export function validatePackageContents(manifest, pkg, root) {
  assert.equal(manifest.name, pkg.name);
  assert.equal(manifest.version, pkg.version);
  assert.ok(
    !pkg.dependencies || Object.keys(pkg.dependencies).length === 0,
    'Content package must have no runtime dependencies.',
  );
  const files = new Set(manifest.files.map((file) => file.path));
  for (const file of files) {
    assert.ok(!/^(?:scripts|tests)\//.test(file), `Unexpected internal maintenance file: ${file}`);
    assert.ok(
      !/(?:^|\/)(?:\.git|\.github|\.env(?:\..*)?|\.npmrc|node_modules|__pycache__)(?:\/|$)/.test(file),
      `Unexpected internal or credential file: ${file}`,
    );
    assert.ok(!file.startsWith('docs/history/'), `History tool leaked into package: ${file}`);
    assert.ok(!file.includes('..') && !file.startsWith('/'), `Invalid archive path: ${file}`);
    const declared = ['README.md', 'package.json', ...(pkg.files ?? [])];
    assert.ok(
      declared.some((path) => (path.endsWith('/') ? file.startsWith(path) : file === path)),
      `File outside package content list: ${file}`,
    );
  }
  for (const file of [
    'README.md',
    'docs/installation.md',
    'docs/development-workflow.md',
    'THIRD_PARTY_LICENSES/VercelSkills-LICENSE.txt',
  ])
    assert.ok(files.has(file), `Missing distribution file: ${file}`);
  const upstream = verifyUpstreams(root);
  const catalog = loadCatalog(root);
  resolveProfiles(catalog, Object.keys(catalog.profiles));
  const source = 'skills/development/shared/yuyin-dev/';
  const expected = new Set([
    ...skillFiles(join(root, source)).map((file) => `${source}${file}`),
    ...upstream.files,
  ]);
  assert.deepEqual(
    catalog.skills
      .filter((skill) => skill.path.startsWith('skills/upstream/'))
      .map(({ name, path }) => ({ name, path }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    upstream.skills.map(({ name, path }) => ({ name, path })).sort((a, b) => a.name.localeCompare(b.name)),
    'Catalog differs from locked upstream skills',
  );
  for (const skill of catalog.skills) {
    const text = readFileSync(join(root, skill.path, 'SKILL.md'), 'utf8');
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(match, `Missing frontmatter: ${skill.name}`);
    const meta = YAML.parse(match[1]);
    assert.equal(meta.name, skill.name);
    assert.ok(
      typeof meta.description === 'string' && meta.description.trim() && meta.description.length <= 1024,
      `Invalid skill description: ${skill.name}`,
    );
  }
  for (const file of expected) assert.ok(files.has(file), `Missing skill resource: ${file}`);
  for (const file of files)
    if (file.startsWith('skills/'))
      assert.ok(expected.has(file), `Unmanaged skill resource in package: ${file}`);
  for (const file of ['catalog.json', 'upstream/sources.json', 'upstream/lock.json'])
    assert.ok(files.has(file), `Missing distribution manifest: ${file}`);
}
function validateWorkflow(root) {
  const workflow = YAML.parse(readFileSync(join(root, '.github/workflows/publish.yml'), 'utf8'));
  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.equal(workflow.permissions.contents, 'read');
  assert.equal(workflow.jobs.publish.permissions['id-token'], 'write');
  assert.equal(workflow.jobs.publish.permissions.contents, 'write');
  assert.ok(workflow.jobs.publish.if.includes("github.repository == 'coder-zhuzm/yuyin-skills'"));
  assert.ok(workflow.jobs.publish.if.includes("github.ref == 'refs/heads/main'"));
  for (const step of workflow.jobs.publish.steps) if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/);
  const steps = workflow.jobs.publish.steps;
  assert.equal(steps.find(step => step.id === 'release')?.run, 'node scripts/release.mjs prepare');
  assert.equal(steps.find(step => step.id === 'catchup')?.run, 'node scripts/release.mjs prepare --if-changed', 'Catch-up must not force a second release after manual recovery.');
  assert.ok(
    !JSON.stringify(workflow).includes('NPM_TOKEN'),
    'Publishing must use OIDC rather than a long-lived token.',
  );
}
export function verify(root = process.cwd()) {
  root = resolve(root);
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
  assert.equal(pkg.name, '@zhuzm/yuyin-skills');
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].name, pkg.name);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.deepEqual(lock.packages[''].devDependencies, pkg.devDependencies);
  const files = [
    ...new Set(
      run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.md'], root)
        .split('\n')
        .filter((file) => file && !file.startsWith('skills/upstream/')),
    ),
  ];
  for (const file of files) validateMarkdown(join(root, file), root);
  validateWorkflow(root);
  const scratch = mkdtempSync(join(tmpdir(), 'yuyin-pack-check-'));
  try {
    const [manifest] = JSON.parse(
      run(
        'npm',
        [
          'pack',
          '--ignore-scripts',
          '--json',
          '--pack-destination',
          scratch,
          '--cache',
          join(scratch, 'cache'),
          '--no-update-notifier',
        ],
        root,
      ),
    );
    validatePackageContents(manifest, pkg, root);
    console.log(
      `Verified ${files.length} Markdown files, workflow permissions and ${manifest.entryCount} distribution files for ${pkg.name}@${pkg.version}.`,
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    verify();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
