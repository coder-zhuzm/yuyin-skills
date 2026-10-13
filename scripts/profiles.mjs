import assert from 'node:assert/strict';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { verifyUpstreams } from './upstream.mjs';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const supportedAgents = ['codex', 'claude-code'];
function safeRelative(path) {
  assert.ok(
    typeof path === 'string' &&
      path.split('/').every((part) => part && part !== '.' && part !== '..') &&
      !path.includes('\\'),
    `Invalid catalog path: ${path}`,
  );
}
export function loadCatalog(root = repositoryRoot) {
  const catalog = JSON.parse(readFileSync(join(root, 'catalog.json'), 'utf8'));
  resolveProfiles(catalog, []);
  return catalog;
}
export function resolveProfiles(catalog, profiles) {
  assert.ok(Array.isArray(catalog.skills), 'Catalog requires skills');
  const byName = new Map();
  for (const skill of catalog.skills) {
    assert.match(skill.name, /^[a-z0-9-]+$/);
    safeRelative(skill.path);
    assert.ok(!byName.has(skill.name), `Duplicate skill: ${skill.name}`);
    byName.set(skill.name, skill);
  }
  assert.ok(catalog.profiles && typeof catalog.profiles === 'object', 'Catalog requires profiles');
  const selected = new Set();
  for (const name of profiles) {
    assert.ok(Object.hasOwn(catalog.profiles, name), `Unknown profile: ${name}`);
    const names = catalog.profiles[name];
    assert.ok(Array.isArray(names) && names.length, `Empty profile: ${name}`);
    for (const skill of names) {
      assert.ok(byName.has(skill), `Profile ${name} references missing skill: ${skill}`);
      selected.add(skill);
    }
  }
  return [...selected].map((name) => byName.get(name));
}
export function parseArguments(args) {
  const [command = 'list', ...rest] = args;
  assert.ok(
    ['list', 'add'].includes(command),
    'Usage: profiles.mjs list | add --profile core,react,spring --target /absolute/project --agent codex,claude-code [--copy]',
  );
  if (command === 'list') {
    assert.equal(rest.length, 0, 'list accepts no options');
    return { command };
  }
  const result = { command, copy: false };
  const seen = new Set();
  for (let i = 0; i < rest.length; i++) {
    const option = rest[i];
    assert.ok(!seen.has(option), `Repeated option: ${option}`);
    seen.add(option);
    if (option === '--copy') {
      result.copy = true;
      continue;
    }
    assert.ok(['--profile', '--target', '--agent'].includes(option), `Unknown option: ${option}`);
    const value = rest[++i];
    assert.ok(value && !value.startsWith('--'), `Missing value for ${option}`);
    if (option === '--target') result.target = value;
    else result[option === '--profile' ? 'profiles' : 'agents'] = value.split(',');
  }
  validateOptions(result);
  return result;
}
function validateOptions(options) {
  assert.ok(Array.isArray(options.profiles) && options.profiles.length, 'Select --profile');
  assert.ok(
    typeof options.target === 'string' && isAbsolute(options.target),
    'Select an absolute --target project directory',
  );
  assert.ok(Array.isArray(options.agents) && options.agents.length, 'Select --agent explicitly');
  assert.ok(
    options.agents.every((agent) => supportedAgents.includes(agent)),
    `Supported agents: ${supportedAgents.join(', ')}`,
  );
}
function statIfPresent(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
function inspectDestination(target, name) {
  for (const directory of ['.agents', '.claude']) {
    let current = target;
    for (const part of [directory, 'skills']) {
      current = join(current, part);
      const stat = statIfPresent(current);
      if (stat) {
        assert.ok(!stat.isSymbolicLink(), `Destination parent is a symbolic link: ${current}`);
        assert.ok(stat.isDirectory(), `Destination parent is not a directory: ${current}`);
      }
    }
    const destination = join(current, name);
    assert.ok(
      !statIfPresent(destination),
      `Skill already exists: ${destination}. Inspect its source and local edits before explicitly updating with the upstream skills CLI.`,
    );
  }
}
function resourceFiles(directory, prefix = '') {
  return readdirSync(directory)
    .sort()
    .flatMap((name) => {
      if (['metadata.json', '.git', '__pycache__', '__pypackages__'].includes(name)) return [];
      const path = join(directory, name),
        relative = `${prefix}${name}`,
        stat = lstatSync(path);
      assert.ok(!stat.isSymbolicLink(), `Unexpected symbolic link resource: ${path}`);
      return stat.isDirectory() ? resourceFiles(path, `${relative}/`) : [relative];
    });
}
export function verifyInstallation(selected, options, root = repositoryRoot) {
  const target = realpathSync(options.target);
  for (const skill of selected) {
    const source = join(root, skill.path),
      expected = resourceFiles(source);
    for (const agent of new Set(options.agents)) {
      const destination = join(
        options.target,
        agent === 'codex' ? '.agents/skills' : '.claude/skills',
        skill.name,
      );
      assert.ok(existsSync(destination), `Incomplete installation: ${agent}/${skill.name} is missing`);
      assert.ok(
        realpathSync(destination).startsWith(`${target}/`),
        `Installation escaped target: ${destination}`,
      );
      assert.deepEqual(
        resourceFiles(destination),
        expected,
        `Incomplete installation resources: ${agent}/${skill.name}`,
      );
      for (const path of expected)
        assert.ok(
          readFileSync(join(source, path)).equals(readFileSync(join(destination, path))),
          `Installed resource differs: ${agent}/${skill.name}/${path}`,
        );
    }
  }
}
export function installProfiles(
  options,
  { root = repositoryRoot, stdio = 'inherit', runCli = spawnSync } = {},
) {
  validateOptions(options);
  root = resolve(root);
  const targetStat = lstatSync(options.target);
  assert.ok(
    targetStat.isDirectory() && !targetStat.isSymbolicLink(),
    'Target must be an existing project directory, not a symbolic link',
  );
  const selected = resolveProfiles(loadCatalog(root), options.profiles);
  for (const skill of selected) inspectDestination(options.target, skill.name);
  if (selected.some((skill) => skill.path.startsWith('skills/upstream/'))) verifyUpstreams(root);
  for (const skill of selected) {
    const text = readFileSync(join(root, skill.path, 'SKILL.md'), 'utf8');
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(frontmatter, `Missing skill frontmatter: ${skill.path}`);
    assert.equal(
      YAML.parse(frontmatter[1]).name,
      skill.name,
      `Catalog skill name differs from source: ${skill.path}`,
    );
  }
  const cli = join(root, 'node_modules/skills/bin/cli.mjs');
  assert.ok(
    existsSync(cli),
    'Local skills CLI is missing. Run npm ci in the source checkout first; this helper never downloads tools.',
  );
  const args = [
    cli,
    'add',
    root,
    '--full-depth',
    '-s',
    ...selected.map((skill) => skill.name),
    '-a',
    ...new Set(options.agents),
    '-y',
  ];
  if (options.copy) args.push('--copy');
  const result = runCli(process.execPath, args, {
    cwd: options.target,
    stdio,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1', NPM_CONFIG_UPDATE_NOTIFIER: 'false' },
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `Skill installation failed: ${result.error?.message ?? result.stderr ?? result.stdout}. Inspect ${options.target} for partial installation before retrying.`,
    );
  // skills@1.7.2 can report individual failures without a nonzero exit status.
  // Check the actual requested targets before reporting installation complete.
  verifyInstallation(selected, options, root);
  return selected;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.command === 'list') {
      const catalog = loadCatalog();
      for (const [profile, skills] of Object.entries(catalog.profiles))
        console.log(`${profile}: ${skills.join(', ')}`);
    } else installProfiles(options);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
