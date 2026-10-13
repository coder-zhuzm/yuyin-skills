import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  lstatSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  loadCatalog,
  resolveProfiles,
  parseArguments,
  installProfiles,
  verifyInstallation,
} from '../scripts/profiles.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
function temporary(callback) {
  const target = mkdtempSync(join(tmpdir(), 'yuyin-install-test-'));
  try {
    callback(target);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
}
function files(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      if (['metadata.json', '.git', '__pycache__', '__pypackages__'].includes(entry.name)) return [];
      return entry.isDirectory()
        ? files(join(directory, entry.name)).map((path) => `${entry.name}/${path}`)
        : [entry.name];
    })
    .sort();
}
function offlineGuard(target) {
  const guard = join(target, 'offline.cjs');
  writeFileSync(
    guard,
    `const fail = () => { throw new Error('Unexpected network access during local installation'); };
globalThis.fetch = fail;
for (const module of ['node:http', 'node:https']) { const api = require(module); api.request = fail; api.get = fail; }
for (const module of ['node:net', 'node:tls']) { const api = require(module); api.connect = fail; api.createConnection = fail; }
require('node:net').Socket.prototype.connect = fail;
`,
  );
  return `--require=${guard}`;
}

test('profiles share one catalog and overlapping selections are deduplicated', () => {
  const catalog = loadCatalog(root);
  const selected = resolveProfiles(catalog, ['core', 'react', 'spring', 'react']);
  assert.equal(selected.filter((skill) => skill.name === 'yuyin-dev').length, 1);
  assert.equal(new Set(selected.map((skill) => skill.name)).size, selected.length);
  assert.ok(selected.some((skill) => skill.name === 'java-springboot'));
  assert.throws(() => resolveProfiles(catalog, ['missing']), /Unknown profile/);
  assert.throws(
    () => resolveProfiles({ ...catalog, skills: [...catalog.skills, catalog.skills[0]] }, ['core']),
    /Duplicate skill/,
  );
});

test('default invocation is read-only and add requires explicit project and agents', () =>
  temporary((target) => {
    assert.deepEqual(parseArguments([]), { command: 'list' });
    for (const args of [
      ['add'],
      ['add', '--profile', 'core', '--target', target],
      ['add', '--profile', 'core', '--agent', 'codex'],
      ['add', '--profile', 'core', '--agent', 'codex', '--target', '.'],
      ['add', '--profile', 'core', '--agent', 'codex', '--target', target, '--replace'],
    ]) {
      assert.throws(() => parseArguments(args));
    }
    const result = spawnSync(process.execPath, [join(root, 'scripts/profiles.mjs')], {
      cwd: target,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /react/);
    assert.deepEqual(readdirSync(target), []);
  }));

test('existing skills and dangling symlinks are refused before any installation', () =>
  temporary((target) => {
    const destination = join(target, '.claude/skills/yuyin-dev');
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, 'SKILL.md'), 'user-owned content');
    const options = { profiles: ['core'], target, agents: ['codex', 'claude-code'], copy: false };
    assert.throws(() => installProfiles(options, { root, stdio: 'pipe' }), /already exists/);
    assert.equal(readFileSync(join(destination, 'SKILL.md'), 'utf8'), 'user-owned content');
    assert.deepEqual(readdirSync(target), ['.claude']);
    rmSync(destination, { recursive: true });
    symlinkSync(join(target, 'missing'), destination);
    assert.throws(() => installProfiles(options, { root, stdio: 'pipe' }), /already exists/);
    assert.ok(lstatSync(destination).isSymbolicLink());
  }));

test('symlinked destination parents cannot redirect installation outside the project', () =>
  temporary((target) =>
    temporary((outside) => {
      symlinkSync(outside, join(target, '.agents'), 'dir');
      assert.throws(
        () => installProfiles({ profiles: ['core'], target, agents: ['codex'] }, { root, stdio: 'pipe' }),
        /symbolic link/,
      );
      assert.deepEqual(readdirSync(outside), []);
    }),
  ));

test('a CLI zero exit status cannot hide missing requested installations', () =>
  temporary((target) => {
    assert.throws(
      () =>
        installProfiles(
          { profiles: ['core'], target, agents: ['codex', 'claude-code'] },
          {
            root,
            stdio: 'pipe',
            runCli: () => ({ status: 0, stdout: 'Failed to install. Done.', stderr: '' }),
          },
        ),
      /Incomplete installation/,
    );
    assert.deepEqual(readdirSync(target), []);
  }));

for (const copy of [false, true])
  test(`real local CLI installs all profiles into Codex and Claude Code (${copy ? 'copy' : 'symlink'}) with complete resources`, () =>
    temporary((target) => {
      const originals = {
        'AGENTS.md': 'Keep project instructions.\n',
        'CLAUDE.md': 'Keep Claude instructions.\n',
        'package.json': '{"name":"fixture","private":true}\n',
      };
      for (const [path, content] of Object.entries(originals)) writeFileSync(join(target, path), content);
      const catalog = loadCatalog(root);
      const profiles = Object.keys(catalog.profiles);
      const previousOptions = process.env.NODE_OPTIONS;
      process.env.NODE_OPTIONS = offlineGuard(target);
      try {
        installProfiles(
          { profiles, target, agents: ['codex', 'claude-code'], copy },
          { root, stdio: 'pipe' },
        );
      } finally {
        if (previousOptions === undefined) delete process.env.NODE_OPTIONS;
        else process.env.NODE_OPTIONS = previousOptions;
      }
      for (const skill of resolveProfiles(catalog, profiles)) {
        const source = join(root, skill.path);
        for (const directory of ['.agents/skills', '.claude/skills']) {
          const installed = join(target, directory, skill.name);
          assert.deepEqual(
            files(installed),
            files(source),
            `${skill.name}: complete resource tree in ${directory}`,
          );
          for (const path of files(source))
            assert.deepEqual(
              readFileSync(join(installed, path)),
              readFileSync(join(source, path)),
              `${skill.name}/${path}`,
            );
        }
        assert.equal(lstatSync(join(target, '.claude/skills', skill.name)).isSymbolicLink(), !copy);
      }
      for (const [path, content] of Object.entries(originals))
        assert.equal(readFileSync(join(target, path), 'utf8'), content);
      assert.throws(
        () =>
          installProfiles(
            { profiles: ['core'], target, agents: ['codex', 'claude-code'], copy },
            { root, stdio: 'pipe' },
          ),
        /already exists/,
      );
    }));

test('the real content archive installs with an empty offline npm cache and connects all skills locally', () =>
  temporary((scratch) => {
    const npm = (args) => {
      const result = spawnSync('npm', args, { cwd: root, encoding: 'utf8', timeout: 120_000 });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      return result.stdout;
    };
    const [archive] = JSON.parse(
      npm([
        'pack',
        '--ignore-scripts',
        '--json',
        '--pack-destination',
        scratch,
        '--cache',
        join(scratch, 'pack-cache'),
        '--no-update-notifier',
      ]),
    );
    const consumer = join(scratch, 'consumer');
    npm([
      'install',
      '--prefix',
      consumer,
      join(scratch, archive.filename),
      '--offline',
      '--no-update-notifier',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--userconfig',
      '/dev/null',
      '--cache',
      join(scratch, 'empty-cache'),
    ]);
    const source = join(consumer, 'node_modules/@zhuzm/yuyin-skills');
    for (const file of archive.files)
      assert.deepEqual(readFileSync(join(source, file.path)), readFileSync(join(root, file.path)), file.path);
    const pkg = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'));
    assert.deepEqual(Object.keys(pkg.dependencies ?? {}), []);
    const target = join(scratch, 'project');
    mkdirSync(target);
    const catalog = loadCatalog(source),
      selected = resolveProfiles(catalog, Object.keys(catalog.profiles));
    const result = spawnSync(
      process.execPath,
      [
        join(root, 'node_modules/skills/bin/cli.mjs'),
        'add',
        source,
        '--full-depth',
        '-s',
        ...selected.map((skill) => skill.name),
        '-a',
        'codex',
        'claude-code',
        '-y',
      ],
      {
        cwd: target,
        encoding: 'utf8',
        timeout: 120_000,
        env: {
          ...process.env,
          NODE_OPTIONS: offlineGuard(scratch),
          DISABLE_TELEMETRY: '1',
          DO_NOT_TRACK: '1',
        },
      },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    verifyInstallation(selected, { target, agents: ['codex', 'claude-code'] }, source);
  }));
