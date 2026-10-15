import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const json = path => JSON.parse(readFileSync(path, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = (root, path) => readFileSync(join(root, path), 'utf8');
const checkIds = ['workspace-unchanged', 'scope-preserved', 'node-reproduction', 'react-filter', 'react-surface', 'spring-architecture', 'spring-query', 'playwright-surface', 'button-copy', 'playwright-browser', 'small-copy-behavior'];

export function loadCases(root = process.cwd()) {
  const manifest = json(join(root, 'evals/manifest.json'));
  assert.equal(manifest.schemaVersion, 1);
  const names = new Set(json(join(root, 'catalog.json')).skills.map(s => s.name)), ids = new Set();
  for (const c of manifest.cases) {
    assert.match(c.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(c.id), `Duplicate eval case: ${c.id}`); ids.add(c.id);
    assert.match(c.fixture, /^[a-z0-9-]+$/);
    assert.ok(existsSync(join(root, 'evals/fixtures', c.fixture)), `Missing fixture: ${c.fixture}`);
    assert.ok(c.prompt?.trim() && c.expected?.length && c.forbidden?.length && c.traceReview?.length, `Incomplete case: ${c.id}`);
    assert.ok(c.skills.every(s => names.has(s)) && c.skills.includes(c.directSkill), `Unknown skill in ${c.id}`);
    assert.ok(c.checks.length && c.checks.every(id => checkIds.includes(id)), `Unknown mechanical check in ${c.id}`);
    assert.ok(Array.isArray(c.baselineFailures) && c.baselineFailures.every(id => c.checks.includes(id)), `Invalid baseline expectation: ${c.id}`);
    if (c.checks.includes('scope-preserved')) assert.ok(c.allowedChanges?.length && c.allowedChanges.every(p => !p.startsWith('/') && !p.split('/').includes('..')), `Invalid allowed changes: ${c.id}`);
  }
  return manifest.cases;
}
export function snapshot(root, prefix = '') {
  return Object.fromEntries(readdirSync(join(root, prefix)).sort().flatMap(name => {
    const path = prefix ? `${prefix}/${name}` : name, full = join(root, path), stat = lstatSync(full);
    assert.ok(!stat.isSymbolicLink(), `Eval workspace contains a symbolic link: ${path}`);
    return stat.isDirectory() ? [[`${path}/`, { directory: true, mode: stat.mode & 0o777 }], ...Object.entries(snapshot(root, path))] : [[path, { sha256: hash(readFileSync(full)), mode: stat.mode & 0o777, executable: !!(stat.mode & 0o111) }]];
  }));
}
function changedPaths(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(path => JSON.stringify(before[path]) !== JSON.stringify(after[path]));
}
function matches(path, pattern) {
  const escaped = pattern.split('**').map(part => part.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*');
  return new RegExp(`^${escaped}$`).test(path);
}
class BlockedCheck extends Error {}
const verificationEnv = () => ({ PATH: dirname(process.execPath), ...(process.platform === 'win32' ? { SystemRoot: process.env.SystemRoot } : {}) });
function execute(workspace, source, { reviewed = false } = {}) {
  if (!reviewed) throw new BlockedCheck('Generated JavaScript is not automatically executed outside the host sandbox. Review the source and run explicit reviewed checks in an appropriate environment.');
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', source], { cwd: workspace, env: verificationEnv(), encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024 });
  assert.ok(!r.error && r.status === 0, (r.error?.message ?? r.stderr ?? r.stdout).slice(0, 4000));
}
function sameDependencies(workspace, fixture) {
  for (const file of ['package.json', 'pom.xml']) {
    if (!existsSync(join(fixture, file))) continue;
    if (file === 'pom.xml') assert.equal(read(workspace, file), read(fixture, file), 'Build/dependency configuration changed');
    else {
      const a = json(join(workspace, file)), b = json(join(fixture, file));
      for (const key of ['dependencies', 'devDependencies', 'peerDependencies', 'type']) assert.deepEqual(a[key], b[key], `Changed ${key}`);
    }
  }
}
export function checkCase({ root = process.cwd(), caseId, workspace, baseline, browser = true, allowReviewedExecution = false, caseInfo }) {
  const c = caseInfo ?? loadCases(root).find(c => c.id === caseId);
  assert.ok(c, `Unknown eval case: ${caseId}`);
  workspace = resolve(workspace);
  const fixture = join(root, 'evals/fixtures', c.fixture);
  const originalSource = path => existsSync(join(workspace, path)) && read(workspace, path) === read(fixture, path);
  return c.checks.map(id => {
    let kind = 'static';
    try {
      if (id === 'workspace-unchanged' || id === 'scope-preserved') {
        kind = 'integrity';
        if (!baseline) return { id, kind, status: 'blocked', detail: 'No pre-run snapshot; workspace integrity is unverified.' };
        const changed = changedPaths(baseline, snapshot(workspace));
        if (id === 'workspace-unchanged') assert.deepEqual(changed, [], 'Readonly workspace changed');
        else {
          assert.deepEqual(changed.filter(p => !c.allowedChanges.some(pattern => matches(p, pattern))), [], 'Changes outside the case scope');
          sameDependencies(workspace, fixture);
        }
      } else if (id === 'node-reproduction') {
        kind = 'behavior';
        execute(allowReviewedExecution ? workspace : fixture, 'import { loadOrders } from "./src/orders.mjs"; import assert from "node:assert/strict"; await assert.rejects(loadOrders(() => new Promise(r => setTimeout(() => r([]), 80))), /timed out/); assert.deepEqual(await loadOrders(async () => [1]), [1]);', { reviewed: allowReviewedExecution || originalSource('src/orders.mjs') });
      } else if (id === 'react-filter') {
        kind = 'behavior';
        execute(allowReviewedExecution ? workspace : fixture, 'import { filterProducts as f } from "./src/filter-products.mjs"; import a from "node:assert/strict"; const items=[{id:1,name:"Apple",stock:2},{id:2,name:"APPLE",stock:0},{id:3,name:"Pear",stock:3},{id:4,name:"apple pie",stock:1},{id:5,name:"Apple",stock:-1}]; const ids=q=>f(items,q).map(p=>p.id); a.deepEqual(ids("  APPLE  "),[1,4]); a.deepEqual(ids(""),[1,3,4]); a.deepEqual(ids("pear"),[3]); a.deepEqual(ids("absent"),[]); a.deepEqual(f([],""),[]);', { reviewed: allowReviewedExecution || originalSource('src/filter-products.mjs') });
      } else if (id === 'react-surface') {
        const code = read(workspace, 'src/ProductList.jsx');
        assert.match(code, /@mui\/material/); assert.match(code, /filterProducts/);
        assert.doesNotMatch(code, /useActionState|useOptimistic|from\s+['"]next(?:\/|['"])/);
      } else if (id === 'spring-architecture') {
        sameDependencies(workspace, fixture);
        assert.match(read(workspace, 'src/main/java/example/OrderController.java'), /service\.list\(/);
        assert.match(read(workspace, 'src/main/java/example/OrderService.java'), /mapper\.findAll\(/);
        assert.match(read(workspace, 'src/main/java/example/OrderMapper.java'), /@Mapper/);
      } else if (id === 'spring-query') {
        kind = 'sql-sample';
        const xml = read(workspace, 'src/main/resources/mappers/OrderMapper.xml');
        const sql = xml.match(/<select\b[^>]*\bid=["']findAll["'][^>]*>([\s\S]*?)<\/select>/)?.[1];
        assert.ok(sql && !/<\/?[a-z]/i.test(sql), 'Expected a static findAll SELECT; dynamic mapper requires separate integration verification');
        assert.match(sql.trim(), /^SELECT\b/i, 'Only a SELECT sample can be executed by the trusted verifier');
        execute(workspace, `import { DatabaseSync } from 'node:sqlite'; import a from 'node:assert/strict'; const db=new DatabaseSync(':memory:', { allowExtension: false }); db.exec('CREATE TABLE orders(id INTEGER, deleted BOOLEAN); INSERT INTO orders VALUES(1,0),(2,1),(3,0),(4,1);'); a.deepEqual(db.prepare(${JSON.stringify(sql)}).all().map(r=>r.id),[1,3]); db.close();`, { reviewed: true });
      } else if (id === 'playwright-surface') {
        sameDependencies(workspace, fixture);
        assert.equal(read(workspace, 'playwright.config.js'), read(fixture, 'playwright.config.js'));
        const files = snapshot(workspace);
        assert.ok(!Object.keys(files).some(p => p.endsWith('.py') && (!baseline || baseline[p]?.sha256 !== files[p].sha256)), 'Introduced or modified a Python browser test stack');
      } else if (id === 'button-copy') {
        assert.match(read(workspace, 'src/index.html'), /<button\b[^>]*>\s*保存\s*<\/button>/);
        assert.match(read(workspace, 'tests/save.spec.js'), /name:\s*['"]保存['"]/);
      } else if (id === 'playwright-browser') {
        kind = 'browser';
        const cli = join(workspace, 'node_modules/@playwright/test/cli.js');
        if (!browser || !existsSync(cli)) return { id, kind, status: 'blocked', detail: 'Existing JS Playwright dependency/browser not run; no dependency was installed.' };
        if (!allowReviewedExecution) throw new BlockedCheck('Generated browser tests require source review and a separately controlled execution environment.');
        const r = spawnSync(process.execPath, [cli, 'test', '--workers=1', '--reporter=line'], { cwd: workspace, env: verificationEnv(), encoding: 'utf8', timeout: 60_000, maxBuffer: 1024 * 1024 });
        assert.ok(!r.error && r.status === 0, r.error?.message ?? r.stderr + r.stdout);
      } else if (id === 'small-copy-behavior') {
        kind = 'behavior';
        execute(allowReviewedExecution ? workspace : fixture, 'import { formatPrice as f, buttonLabel } from "./src/checkout.mjs"; import a from "node:assert/strict"; a.equal(f(10),"¥10.00"); a.equal(f(1.5),"¥1.50"); a.equal(f(0),"¥0.00"); a.equal(f(12.345),"¥12.35"); a.equal(buttonLabel,"确认支付");', { reviewed: allowReviewedExecution || originalSource('src/checkout.mjs') });
      }
      return { id, kind, status: 'passed', detail: kind === 'sql-sample' ? 'Static mapper SELECT executed against SQLite sample rows; Java, MyBatis binding and production database remain unverified.' : 'Check satisfied; see traceReview for evidence beyond this check.' };
    } catch (e) { return { id, kind, status: e instanceof BlockedCheck ? 'blocked' : 'failed', detail: e.message.slice(0, 5000) }; }
  });
}
export function verifyEvals(root = process.cwd()) {
  const cases = loadCases(root);
  for (const c of cases) {
    const workspace = join(root, 'evals/fixtures', c.fixture);
    const checks = checkCase({ root, caseId: c.id, workspace, baseline: snapshot(workspace), browser: false });
    assert.deepEqual(checks.filter(r => r.status === 'failed').map(r => r.id).sort(), [...c.baselineFailures].sort(), `Fixture no longer exposes expected defects: ${c.id}`);
    assert.ok(checks.filter(r => r.status === 'blocked').every(r => r.id === 'playwright-browser'), `Unexpected blocked fixture: ${c.id}`);
  }
  return { cases: cases.length, status: 'fixture-checks-passed', modelBehavior: 'not-run' };
}
export function buildInvocation({ host, mode, caseInfo: c, workspace }) {
  assert.ok(['codex', 'claude'].includes(host), 'Host must be codex or claude');
  assert.ok(['explicit', 'implicit', 'direct'].includes(mode), 'Mode must be explicit, implicit or direct');
  const name = mode === 'direct' ? c.directSkill : 'yuyin-dev';
  const prompt = mode === 'implicit' ? c.prompt : `${host === 'codex' ? '$' : '/'}${name}\n\n${c.prompt}`;
  const readonly = c.checks.includes('workspace-unchanged');
  const args = host === 'codex'
    ? ['exec', '--ephemeral', '--skip-git-repo-check', '--sandbox', readonly ? 'read-only' : 'workspace-write', '--json', '--cd', workspace, '-']
    : ['--print', '--verbose', '--output-format', 'stream-json', '--no-session-persistence', '--permission-mode', 'dontAsk', '--tools', readonly ? 'Read,Glob,Grep,Skill' : 'Read,Glob,Grep,Skill,Edit,Write', '--allowedTools', readonly ? 'Read,Glob,Grep,Skill' : 'Read,Glob,Grep,Skill,Edit,Write', '--setting-sources', 'user,project', '--settings', '{"disableAllHooks":true}', '--no-chrome', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}'];
  return { command: host, args, prompt };
}
export function summarizeRun({ exitCode, completed, checks }) {
  if (exitCode !== 0 || !completed) return 'incomplete';
  if (checks.some(c => c.status === 'failed')) return 'failed';
  if (checks.some(c => c.status === 'blocked')) return 'blocked';
  return 'needs-trace-review';
}
function completion(host, trace) {
  const events = trace.split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  return host === 'codex' ? events.some(e => e.type === 'turn.completed') && !events.some(e => e.type === 'turn.failed' || e.type === 'error')
    : events.some(e => e.type === 'result' && e.subtype === 'success' && !e.is_error);
}
async function capture(command, args, { cwd, input, timeoutMs, traceFile, errorFile }) {
  // No shell interpolation; a bounded process group also stops model-spawned tools on timeout.
  const child = spawn(command, args, { cwd, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '', errors = '', timedOut = false, processError = null;
  const stop = () => { try { if (process.platform === 'win32') child.kill('SIGKILL'); else process.kill(-child.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') processError = e.message; } };
  const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
  child.stdout.on('data', data => { output += data; if (output.length > 16 * 1024 * 1024) stop(); });
  child.stderr.on('data', data => { errors += data; if (errors.length > 4 * 1024 * 1024) stop(); });
  child.stdin.on('error', e => { if (e.code !== 'EPIPE') processError = e.message; });
  const exitCode = await new Promise(done => { child.on('error', e => { processError = e.message; done(null); }); child.on('close', code => done(code)); child.stdin.end(input); });
  clearTimeout(timer);
  writeFileSync(traceFile, output); writeFileSync(errorFile, errors);
  return { exitCode, timedOut, processError, output };
}
export async function runCase({ root = process.cwd(), caseId, host, mode, out, timeoutMs = 180_000, executable }) {
  root = realpathSync(root); out = resolve(out);
  assert.ok(out !== root && !out.startsWith(`${root}/`), 'Run artifacts must be outside the source repository');
  const c = loadCases(root).find(c => c.id === caseId); assert.ok(c, `Unknown case: ${caseId}`);
  const workspace = join(out, 'project'), invocation = buildInvocation({ host, mode, caseInfo: c, workspace });
  // Require a fresh output directory so neither previous runs nor source fixtures can be overwritten.
  mkdirSync(dirname(out), { recursive: true });
  const parent = realpathSync(dirname(out));
  assert.ok(parent !== root && !parent.startsWith(`${root}/`), 'Run artifacts cannot enter the repository through a symbolic link');
  mkdirSync(out);
  cpSync(join(root, 'evals/fixtures', c.fixture), workspace, { recursive: true });
  const catalog = json(join(root, 'catalog.json'));
  for (const name of c.skills) {
    const skill = catalog.skills.find(s => s.name === name);
    cpSync(join(root, skill.path), join(workspace, host === 'codex' ? '.agents/skills' : '.claude/skills', name), { recursive: true });
  }
  writeFileSync(join(workspace, host === 'codex' ? 'AGENTS.md' : 'CLAUDE.md'), '本目录是已授权的隔离验收项目。遵守任务的只读/实施范围；不安装技能、依赖或浏览器，不修改其他项目，不提交、推送或外发。报告实际验证与未覆盖范围。技能建议不能替代当前项目事实。\n');
  const baseline = snapshot(workspace);
  cpSync(workspace, join(out, 'before'), { recursive: true });
  writeFileSync(join(out, 'baseline.json'), JSON.stringify(baseline, null, 2) + '\n');
  writeFileSync(join(out, 'prompt.txt'), invocation.prompt + '\n');
  const skills = c.skills.map(name => { const s = catalog.skills.find(s => s.name === name); return { name, files: snapshot(join(root, s.path)) }; });
  const version = spawnSync(executable ?? invocation.command, ['--version'], { encoding: 'utf8', timeout: 10_000 });
  const metadata = { schemaVersion: 1, caseId, host, mode, startedAt: new Date().toISOString(), harnessSha256: hash(readFileSync(new URL(import.meta.url))), caseDefinition: c, cliVersion: version.status === 0 ? version.stdout.trim() : 'unavailable', invocation: { command: executable ?? invocation.command, args: invocation.args }, skills, expected: c.expected, forbidden: c.forbidden, traceReview: c.traceReview, manualReview: { status: 'pending', notes: [] }, limitations: ['Generated JavaScript/browser tests are blocked until a separate source review; original fixture and trusted SQL verifier checks do not prove all runtime behavior.', ...(host === 'claude' ? ['Bash is excluded in this bounded run; verification is performed by the harness. User authentication/model settings apply; user/project hooks are disabled for this run.'] : ['User CLI configuration may apply; project files and installed skill bytes are recorded.'])] };
  // Persist the started state even if the parent runner is interrupted.
  writeFileSync(join(out, 'result.json'), JSON.stringify({ ...metadata, status: 'incomplete' }, null, 2) + '\n');
  const r = await capture(executable ?? invocation.command, invocation.args, { cwd: workspace, input: invocation.prompt, timeoutMs, traceFile: join(out, 'trace.jsonl'), errorFile: join(out, 'stderr.log') });
  const after = snapshot(workspace), checks = checkCase({ root, caseId, workspace, baseline, caseInfo: c });
  const changes = changedPaths(baseline, after).map(path => ({ path, before: baseline[path] ?? null, after: after[path] ?? null }));
  writeFileSync(join(out, 'changes.json'), JSON.stringify(changes, null, 2) + '\n');
  const diff = spawnSync('git', ['diff', '--no-index', '--no-ext-diff', '--text', '--', join(out, 'before'), workspace], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 10_000 });
  writeFileSync(join(out, 'diff.patch'), diff.stdout ?? '');
  const complete = !r.timedOut && !r.processError && completion(host, r.output);
  const result = { ...metadata, endedAt: new Date().toISOString(), exitCode: r.exitCode, timedOut: r.timedOut, processError: r.processError, completed: complete, status: summarizeRun({ exitCode: r.exitCode, completed: complete, checks }), checks, changedPaths: changes.map(c => c.path), diffError: [0, 1].includes(diff.status) ? null : diff.error?.message ?? diff.stderr };
  writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}
async function main() {
  const [command, ...args] = process.argv.slice(2), options = {};
  assert.equal(args.length % 2, 0, 'Options require values');
  for (let i = 0; i < args.length; i += 2) { assert.ok(['--host', '--mode', '--case', '--out', '--timeout-ms', '--executable'].includes(args[i]), `Unknown option: ${args[i]}`); assert.ok(!Object.hasOwn(options, args[i]), 'Duplicate option'); options[args[i]] = args[i + 1]; }
  if (command === 'check') { assert.equal(args.length, 0); console.log(JSON.stringify(verifyEvals(), null, 2)); return; }
  assert.equal(command, 'run', 'Usage: node scripts/evals.mjs check | run --host codex|claude --mode explicit|implicit|direct --case ID --out NEW_DIRECTORY [--timeout-ms MS] [--executable PATH]');
  for (const flag of ['--host', '--mode', '--case', '--out']) assert.ok(options[flag], `Required: ${flag}`);
  const timeoutMs = Number(options['--timeout-ms'] ?? 180_000); assert.ok(Number.isInteger(timeoutMs) && timeoutMs >= 1000 && timeoutMs <= 600_000, 'Timeout must be 1000–600000 ms');
  const result = await runCase({ host: options['--host'], mode: options['--mode'], caseId: options['--case'], out: options['--out'], timeoutMs, executable: options['--executable'] });
  console.log(JSON.stringify({ caseId: result.caseId, host: result.host, mode: result.mode, status: result.status, checks: result.checks, artifacts: resolve(options['--out']) }, null, 2));
  if (['failed', 'incomplete'].includes(result.status)) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(e => { console.error(e.message); process.exitCode = 1; });
