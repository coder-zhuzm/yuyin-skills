import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePackageContents } from '../scripts/verify.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
function tree(path, prefix = '') {
  return readdirSync(path).flatMap((name) =>
    lstatSync(join(path, name)).isDirectory()
      ? tree(join(path, name), `${prefix}${name}/`)
      : [`${prefix}${name}`],
  );
}
function distribution() {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const paths = new Set(['README.md', 'package.json']);
  for (const path of pkg.files) {
    if (path.endsWith('/')) for (const file of tree(join(root, path))) paths.add(`${path}${file}`);
    else paths.add(path);
  }
  return {
    pkg,
    manifest: { name: pkg.name, version: pkg.version, files: [...paths].map((path) => ({ path })) },
  };
}
test('package permits reviewed skill scripts and includes every locked resource', () => {
  const { pkg, manifest } = distribution();
  assert.ok(manifest.files.some((file) => file.path.endsWith('scripts/with_server.py')));
  validatePackageContents(manifest, pkg, root);
  const broken = {
    ...manifest,
    files: manifest.files.filter((file) => !file.path.endsWith('scripts/with_server.py')),
  };
  assert.throws(() => validatePackageContents(broken, pkg, root), /Missing skill resource/);
});
test('a broad package directory never grants permission to distribute unmanaged skill code or credentials', () => {
  const { pkg, manifest } = distribution();
  const extra = (path) => ({ ...manifest, files: [...manifest.files, { path }] });
  assert.throws(
    () =>
      validatePackageContents(
        extra('skills/upstream/anthropic/webapp-testing/scripts/unreviewed.py'),
        pkg,
        root,
      ),
    /Unmanaged skill resource/,
  );
  assert.throws(
    () => validatePackageContents(extra('skills/upstream/anthropic/webapp-testing/.env'), pkg, root),
    /credential/,
  );
  assert.throws(
    () =>
      validatePackageContents(
        extra('scripts/release.mjs'),
        { ...pkg, files: [...pkg.files, 'scripts/'] },
        root,
      ),
    /Unmanaged|internal|File outside/,
  );
});
test('npm entry and pinned runtime dependency are mandatory and cannot widen the package boundary', () => {
  const { pkg, manifest } = distribution();
  assert.throws(() => validatePackageContents(manifest, { ...pkg, dependencies: { skills: 'latest' } }, root), /pinned skills/);
  assert.throws(() => validatePackageContents(manifest, { ...pkg, dependencies: { ...pkg.dependencies, extra: '1.0.0' } }, root), /runtime dependency/);
  assert.throws(() => validatePackageContents(manifest, { ...pkg, bin: { install: 'scripts/release.mjs' } }, root), /command entry/);
  assert.throws(() => validatePackageContents({ ...manifest, files: manifest.files.filter(file => file.path !== pkg.bin['yuyin-skills']) }, pkg, root), /Missing distribution file/);
});
