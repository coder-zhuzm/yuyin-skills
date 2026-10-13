import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseOptions, install, installationDirectories, installationLockPath } from '../bin/yuyin-skills.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const catalog = JSON.parse(readFileSync(join(root, 'catalog.json'), 'utf8'));
function temporary(callback) {
  const scratch = mkdtempSync(join(tmpdir(), 'yuyin-npm-cli-'));
  try { return callback(scratch); }
  finally { rmSync(scratch, { recursive: true, force: true }); }
}
function guard(scratch) {
  const path = join(scratch, 'no-network.cjs');
  writeFileSync(path, `globalThis.fetch = () => { throw new Error('Network forbidden'); };
for (const name of ['node:http', 'node:https']) { const api = require(name); api.request = api.get = globalThis.fetch; }
for (const name of ['node:net', 'node:tls']) { const api = require(name); api.connect = api.createConnection = globalThis.fetch; }
require('node:net').Socket.prototype.connect = globalThis.fetch;
`);
  return `--require=${path}`;
}
test('defaults select packaged skills, two agents and project scope; remote sources and unknown flags fail', () => {
  assert.deepEqual(parseOptions([]), { agents: ['claude-code', 'codex'], global: false, copy: false });
  const chosen = parseOptions(['-a', 'codex', '-s', 'yuyin-dev', 'java-springboot', '--copy', '-g']);
  assert.deepEqual(chosen, { agents: ['codex'], skills: ['yuyin-dev', 'java-springboot'], global: true, copy: true });
  for (const args of [['coder-zhuzm/yuyin-skills'], ['constructor'], ['__proto__'], ['--all'], ['--unknown'], ['-a'], ['-s'], ['-a', '*'], ['-a', 'cursor']])
    assert.throws(() => parseOptions(args));
});
test('help and list do not create project files or access the network', () => temporary((scratch) => {
  const project = join(scratch, 'project'); mkdirSync(project);
  for (const option of ['--help', '--list']) {
    const result = spawnSync(process.execPath, [join(root, 'bin/yuyin-skills.mjs'), option], {
      cwd: project, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: guard(scratch) },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /yuyin-dev/);
    if (option === '--list') for (const skill of catalog.skills) assert.ok(result.stdout.includes(skill.name));
    assert.deepEqual(readdirSync(project), []);
  }
}));
test('global destination selection follows skills shared directory and Claude config without changing user settings', () => {
  assert.deepEqual(installationDirectories({ agents: ['codex', 'claude-code'], global: true }, '/project', '/users/example', { CLAUDE_CONFIG_DIR: '/config/claude' }),
    ['/users/example/.agents/skills', '/config/claude/skills']);
  assert.equal(installationLockPath({ global: true }, '/project', '/users/example', { XDG_STATE_HOME: '/state' }), '/state/skills/.skill-lock.json');
});
test('preflight refuses existing content, symlinked parents and invalid names before invoking the CLI', () => temporary((scratch) => {
  const project = join(scratch, 'project'); mkdirSync(project);
  const existing = join(project, '.agents/skills/yuyin-dev'); mkdirSync(existing, { recursive: true });
  writeFileSync(join(existing, 'SKILL.md'), 'Keep my edits');
  const runCli = () => { assert.fail('Must stop before installing'); };
  assert.throws(() => install(parseOptions(['-s', 'yuyin-dev']), { root, cwd: project, runCli }), /already exists/);
  assert.equal(readFileSync(join(existing, 'SKILL.md'), 'utf8'), 'Keep my edits');
  rmSync(join(project, '.agents'), { recursive: true });
  const outside = join(scratch, 'outside'); mkdirSync(outside);
  symlinkSync(outside, join(project, '.agents'), 'dir');
  assert.throws(() => install(parseOptions(['-s', 'yuyin-dev']), { root, cwd: project, runCli }), /symbolic link/);
  assert.deepEqual(readdirSync(outside), []);
  assert.throws(() => install(parseOptions(['-s', 'nonexistent']), { root, cwd: project, runCli }), /Unknown skill/);
}));
test('a symbolic link in the project lock cannot redirect metadata writes', () => temporary((scratch) => {
  const project = join(scratch, 'project'); mkdirSync(project);
  const outside = join(scratch, 'outside.json'); writeFileSync(outside, 'Keep metadata');
  symlinkSync(outside, join(project, 'skills-lock.json'));
  assert.throws(() => install(parseOptions(['-s', 'yuyin-dev']), { root, cwd: project, runCli: () => assert.fail('Must stop before installing') }), /lock is a symbolic link/);
  assert.equal(readFileSync(outside, 'utf8'), 'Keep metadata');
}));
test('structured failures, incomplete results and false success cannot be reported as installation success', () => temporary((scratch) => {
  const options = parseOptions(['-s', 'yuyin-dev', '-a', 'codex']);
  for (const result of [
    { status: 1, stdout: '[]', stderr: 'Permission denied' },
    { status: 0, stdout: 'not json' },
    { status: 0, stdout: JSON.stringify([{ name: 'yuyin-dev', status: 'failed', error: 'Denied' }]) },
    { status: 0, stdout: '[]' },
    { status: 0, stdout: JSON.stringify([{ name: 'yuyin-dev', status: 'installed', agents: ['Codex'] }]) },
  ]) assert.throws(() => install(options, { root, cwd: scratch, runCli: () => result }));
  assert.deepEqual(readdirSync(scratch), []);
}));
for (const copy of [false, true])
  test(`npm entry installs all nine skills locally with every resource (${copy ? 'copy' : 'shared links'}) and no network`, () => temporary((scratch) => {
    const project = join(scratch, 'project'); mkdirSync(project);
    const originals = { 'AGENTS.md': 'Keep instructions', 'CLAUDE.md': 'Keep instructions', 'package.json': '{"private":true}' };
    for (const [path, text] of Object.entries(originals)) writeFileSync(join(project, path), text);
    const result = spawnSync(process.execPath, [join(root, 'bin/yuyin-skills.mjs'), ...(copy ? ['--copy'] : [])], {
      cwd: project, encoding: 'utf8', timeout: 120_000,
      env: { ...process.env, NODE_OPTIONS: guard(scratch) },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Installed 9 skills/);
    for (const skill of catalog.skills) {
      assert.deepEqual(readFileSync(join(project, '.agents/skills', skill.name, 'SKILL.md')), readFileSync(join(root, skill.path, 'SKILL.md')));
      assert.deepEqual(readFileSync(join(project, '.claude/skills', skill.name, 'SKILL.md')), readFileSync(join(root, skill.path, 'SKILL.md')));
    }
    for (const [path, text] of Object.entries(originals)) assert.equal(readFileSync(join(project, path), 'utf8'), text);
  }));

test('global installation uses the requested scope, configured Claude directory and XDG state with no network', () => temporary((scratch) => {
  const project = join(realpathSync(scratch), 'project'); mkdirSync(project);
  const isolatedHome = join(realpathSync(scratch), 'user'); mkdirSync(isolatedHome);
  const preload = guard(scratch);
  const stub = join(scratch, 'isolated-home.cjs');
  // Stub the OS API rather than changing HOME or CODEX_HOME in the environment.
  writeFileSync(stub, `require('node:os').homedir = () => ${JSON.stringify(isolatedHome)}; require('node:module').syncBuiltinESMExports();`);
  const claudeDir = join(isolatedHome, 'claude-config'), stateDir = join(isolatedHome, 'state');
  const result = spawnSync(process.execPath, [join(root, 'bin/yuyin-skills.mjs'), '-g', '-s', 'yuyin-dev'], {
    cwd: project, encoding: 'utf8', timeout: 120_000,
    env: { ...process.env, NODE_OPTIONS: `${preload} --require=${stub}`, CLAUDE_CONFIG_DIR: claudeDir, XDG_STATE_HOME: stateDir },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /user scope/);
  for (const dir of [join(isolatedHome, '.agents/skills'), join(claudeDir, 'skills')])
    assert.deepEqual(readFileSync(join(dir, 'yuyin-dev/SKILL.md')), readFileSync(join(root, 'skills/development/shared/yuyin-dev/SKILL.md')));
  assert.ok(JSON.parse(readFileSync(join(stateDir, 'skills/.skill-lock.json'), 'utf8')).skills['yuyin-dev']);
  assert.deepEqual(readdirSync(project), []);
}));

for (const args of [['-a', 'codex'], ['-a', 'claude-code', '--copy']])
  test(`selective installation preserves unrelated skills (${args.join(' ')})`, () => temporary((scratch) => {
    const project = join(scratch, 'project'); mkdirSync(project);
    const unrelated = join(project, '.agents/skills/java-springboot'); mkdirSync(unrelated, { recursive: true });
    writeFileSync(join(unrelated, 'SKILL.md'), 'Keep unrelated skill');
    const result = spawnSync(process.execPath, [join(root, 'bin/yuyin-skills.mjs'), '-s', 'yuyin-dev', ...args], {
      cwd: project, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: guard(scratch) }, timeout: 120_000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Installed 1 skill/);
    assert.equal(readFileSync(join(unrelated, 'SKILL.md'), 'utf8'), 'Keep unrelated skill');
    if (args[1] === 'codex') assert.ok(!readdirSync(project).includes('.claude'));
  }));
