#!/usr/bin/env node

import assert from 'node:assert/strict';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const supportedAgents = ['claude-code', 'codex'];
const agentLabels = { 'claude-code': 'Claude Code', codex: 'Codex' };
const help = `Usage: npx @zhuzm/yuyin-skills [options]

Install the packaged skills into the current project for Claude Code and Codex.
Content is read locally; no GitHub download is needed.
Existing skills are not overwritten. Node.js >=22.20.0 is required.

  -a, --agent <names...>  claude-code and/or codex (default: both)
  -s, --skill <names...>  Skill names (default: all packaged skills)
  -g, --global           Install at user scope instead of project scope
  --copy                 Use separate copies instead of shared links
  -l, --list             List packaged skills without installing
  -h, --help             Show this help
  -v, --version          Show the package version
  -y, --yes              Accepted for compatibility; installation is non-interactive

Example: npx @zhuzm/yuyin-skills -a codex -s yuyin-dev java-springboot
`;

export function parseOptions(args) {
  const options = { agents: [...supportedAgents], global: false, copy: false };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const names = { '-a': 'agents', '--agent': 'agents', '-s': 'skills', '--skill': 'skills',
      '-g': 'global', '--global': 'global', '--copy': 'copy', '-l': 'list', '--list': 'list',
      '-h': 'help', '--help': 'help', '-v': 'version', '--version': 'version', '-y': 'yes', '--yes': 'yes' };
    const key = Object.hasOwn(names, arg) ? names[arg] : undefined;
    assert.ok(key, `Unknown argument: ${arg}. Use --help. Remote sources are not accepted.`);
    assert.ok(!seen.has(key), `Repeated option: ${arg}`); seen.add(key);
    if (key === 'agents' || key === 'skills') {
      const values = [];
      while (i + 1 < args.length && !args[i + 1].startsWith('-')) values.push(args[++i]);
      assert.ok(values.length, `${arg} requires at least one name`);
      options[key] = [...new Set(values)];
    } else if (key !== 'yes') options[key] = true;
  }
  assert.ok(options.agents.every(agent => supportedAgents.includes(agent)), 'Supported agents: claude-code, codex');
  return options;
}

export function installationDirectories(options, cwd, userHome = homedir(), env = process.env) {
  const shared = join(options.global ? userHome : cwd, '.agents/skills');
  const dirs = options.copy ? [] : [shared];
  for (const agent of options.agents) dirs.push(agent === 'codex' ? shared :
    join(options.global ? (env.CLAUDE_CONFIG_DIR?.trim() || join(userHome, '.claude')) : join(cwd, '.claude'), 'skills'));
  return [...new Set(dirs.map(dir => resolve(dir)))];
}
export function installationLockPath(options, cwd, userHome = homedir(), env = process.env) {
  return options.global ? resolve(env.XDG_STATE_HOME ? join(env.XDG_STATE_HOME, 'skills', '.skill-lock.json') :
    join(userHome, '.agents/.skill-lock.json')) : join(cwd, 'skills-lock.json');
}
function statIfPresent(path) {
  try { return lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function checkParents(path) {
  const parent = dirname(path);
  if (parent !== path) checkParents(parent);
  const stat = statIfPresent(path);
  if (stat) {
    assert.ok(!stat.isSymbolicLink(), `Installation parent is a symbolic link: ${path}`);
    assert.ok(stat.isDirectory(), `Installation parent is not a directory: ${path}`);
  }
}
function resourceFiles(dir, prefix = '') {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name), stat = lstatSync(path);
    // Match the pinned upstream CLI's resource exclusions.
    if (name === 'metadata.json' || (stat.isDirectory() && ['.git', '__pycache__', '__pypackages__'].includes(name))) return [];
    assert.ok(!stat.isSymbolicLink(), `Unexpected resource symbolic link: ${path}`);
    return stat.isDirectory() ? resourceFiles(path, `${prefix}${name}/`) : [`${prefix}${name}`];
  }).sort();
}
function selectSkills(root, options) {
  const catalog = JSON.parse(readFileSync(join(root, 'catalog.json'), 'utf8'));
  const names = new Set();
  for (const skill of catalog.skills) {
    assert.match(skill.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(!names.has(skill.name), `Duplicate catalog skill: ${skill.name}`); names.add(skill.name);
    assert.ok(typeof skill.path === 'string' && skill.path.startsWith('skills/') &&
      skill.path.split('/').every(part => part && part !== '.' && part !== '..') && !skill.path.includes('\\'), `Invalid skill path: ${skill.path}`);
  }
  for (const name of options.skills ?? []) assert.ok(names.has(name), `Unknown skill: ${name}. Use --list.`);
  const selected = catalog.skills.filter(skill => !options.skills || options.skills.includes(skill.name));
  assert.ok(selected.length, 'No skills selected');
  return selected;
}

export function install(options, { root = packageRoot, cwd = process.cwd(), runCli = spawnSync } = {}) {
  root = realpathSync(root); cwd = realpathSync(cwd);
  const selected = selectSkills(root, options);
  const directories = installationDirectories(options, cwd);
  for (const directory of directories) {
    checkParents(directory);
    for (const skill of selected) assert.ok(!statIfPresent(join(directory, skill.name)),
      `Skill already exists: ${join(directory, skill.name)}. Inspect local edits; use -s to select other skills or explicitly update with the skills CLI.`);
  }
  const lockPath = installationLockPath(options, cwd);
  checkParents(dirname(lockPath));
  assert.ok(!statIfPresent(lockPath)?.isSymbolicLink(), `Skill lock is a symbolic link: ${lockPath}`);
  const expected = new Map(selected.map(skill => [skill.name, resourceFiles(join(root, skill.path))]));
  const require = createRequire(join(root, 'package.json'));
  const cli = join(dirname(require.resolve('skills/package.json')), 'bin/cli.mjs');
  const args = [cli, 'add', root, '-s', ...selected.map(skill => skill.name), '-a', ...options.agents, '-y', '--json'];
  if (options.global) args.push('-g');
  if (options.copy) args.push('--copy');
  const result = runCli(process.execPath, args, {
    cwd, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1', NODE_DISABLE_COMPILE_CACHE: '1' },
  });
  assert.ok(!result.error && result.status === 0,
    `Skill installation failed: ${result.error?.message || result.stderr || result.stdout || `exit ${result.status}`}. Inspect the target for partial installation before retrying.`);
  let entries;
  try { entries = JSON.parse(result.stdout); }
  catch { throw new Error('Installation result is not valid JSON; inspect the target for partial installation.'); }
  assert.ok(Array.isArray(entries), 'Invalid installation result');
  assert.deepEqual(entries.map(entry => entry.name).sort(), selected.map(skill => skill.name).sort(), 'Incomplete installation result');
  for (const skill of selected) {
    const entry = entries.find(item => item.name === skill.name);
    assert.equal(entry.status, 'installed', `${skill.name}: ${entry.error || 'not installed'}`);
    assert.ok(Array.isArray(entry.agents), `${skill.name}: missing agent installation result`);
    assert.deepEqual([...entry.agents].sort(), options.agents.map(agent => agentLabels[agent]).sort(), `${skill.name}: incomplete agent installation`);
    for (const directory of directories) {
      const destination = join(directory, skill.name);
      const actual = realpathSync(destination);
      assert.ok(directories.some(dir => actual === join(dir, skill.name)), `Installation escaped its destination: ${destination}`);
      assert.deepEqual(resourceFiles(destination), expected.get(skill.name), `Incomplete resources: ${destination}`);
      for (const file of expected.get(skill.name)) assert.ok(readFileSync(join(destination, file)).equals(readFileSync(join(root, skill.path, file))),
        `Installed resource differs: ${skill.name}/${file}`);
    }
  }
  return selected;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) console.log(help);
    else if (options.version) console.log(JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version);
    else if (options.list) for (const skill of selectSkills(packageRoot, options)) console.log(`${skill.name}\t${skill.scope}`);
    else {
      const selected = install(options);
      console.log(`Installed ${selected.length} ${selected.length === 1 ? 'skill' : 'skills'} for ${options.agents.join(', ')} (${options.global ? 'user' : 'project'} scope).`);
      console.log('Start a new agent session. Codex: $yuyin-dev; Claude Code: /yuyin-dev.');
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
