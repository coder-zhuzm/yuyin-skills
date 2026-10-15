import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCase, loadCases, snapshot, verifyEvals, buildInvocation, summarizeRun, runCase } from '../scripts/evals.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
function project(t, id) {
  const dir = mkdtempSync(join(tmpdir(), 'yuyin-eval-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(root, 'evals/fixtures', id), dir, { recursive: true });
  return dir;
}
test('all six fixtures expose their intended defects without counting them as model failures', () => {
  assert.equal(loadCases(root).length, 6);
  assert.equal(verifyEvals(root).cases, 6);
});
test('React checker distinguishes stock, query normalization and unchanged architecture', t => {
  const workspace = project(t, 'react-local'), baseline = snapshot(workspace);
  const results = () => checkCase({ root, caseId: 'react-local', workspace, baseline, allowReviewedExecution: true });
  assert.equal(results().find(r => r.id === 'react-filter').status, 'failed');
  writeFileSync(join(workspace, 'src/filter-products.mjs'), 'export function filterProducts(items, query) { return items.filter(p => p.stock > 0 && p.name.toLowerCase().includes(query.trim().toLowerCase())); }');
  assert.equal(results().find(r => r.id === 'react-filter').status, 'passed');
  writeFileSync(join(workspace, 'src/filter-products.test.mjs'), 'import "node:test";');
  assert.equal(results().find(r => r.id === 'scope-preserved').status, 'passed', 'A colocated behavior test is within task scope');
  const pkg = JSON.parse(readFileSync(join(workspace, 'package.json')));
  pkg.dependencies.react = '19.0.0';
  writeFileSync(join(workspace, 'package.json'), JSON.stringify(pkg));
  assert.equal(results().find(r => r.id === 'scope-preserved').status, 'failed');
});
test('SQL sample checks active and deleted rows, and does not claim a Spring integration test', t => {
  const workspace = project(t, 'spring-mybatis'), baseline = snapshot(workspace);
  const results = () => checkCase({ root, caseId: 'spring-mybatis', workspace, baseline });
  assert.equal(results().find(r => r.id === 'spring-query').status, 'failed');
  const xml = join(workspace, 'src/main/resources/mappers/OrderMapper.xml');
  writeFileSync(xml, readFileSync(xml, 'utf8').replace('FROM orders ORDER', 'FROM orders WHERE deleted = false ORDER'));
  const result = results().find(r => r.id === 'spring-query');
  assert.equal(result.status, 'passed');
  assert.equal(result.kind, 'sql-sample');
});
test('readonly snapshot detects a created file and changed file modes', t => {
  const workspace = project(t, 'node-readonly'), baseline = snapshot(workspace);
  writeFileSync(join(workspace, 'extra.txt'), 'unrequested');
  assert.equal(checkCase({ root, caseId: 'node-readonly', workspace, baseline })[0].status, 'failed');
  rmSync(join(workspace, 'extra.txt'));
  mkdirSync(join(workspace, 'unrequested-empty'));
  assert.equal(checkCase({ root, caseId: 'node-readonly', workspace, baseline })[0].status, 'failed');
  rmSync(join(workspace, 'unrequested-empty'), { recursive: true });
  chmodSync(join(workspace, 'src/orders.mjs'), 0o755);
  assert.equal(checkCase({ root, caseId: 'node-readonly', workspace, baseline })[0].status, 'failed');
  chmodSync(join(workspace, 'src/orders.mjs'), 0o644);
  mkdirSync(join(workspace, '.git'));
  writeFileSync(join(workspace, '.git/config'), 'unexpected Git initialization');
  assert.equal(checkCase({ root, caseId: 'node-readonly', workspace, baseline })[0].status, 'failed');
});
test('a missing baseline blocks integrity verification instead of passing it', t => {
  const workspace = project(t, 'missing-skill');
  assert.equal(checkCase({ root, caseId: 'missing-skill', workspace })[0].status, 'blocked');
});
test('small-copy checker executes independent output examples', t => {
  const workspace = project(t, 'small-copy'), baseline = snapshot(workspace);
  writeFileSync(join(workspace, 'src/checkout.mjs'), 'export const buttonLabel = "确认支付"; export function formatPrice(n) { return `¥${n.toFixed(2)}`; }');
  assert.ok(checkCase({ root, caseId: 'small-copy', workspace, baseline, allowReviewedExecution: true }).every(r => r.status === 'passed'));
});
test('CLI exit zero never implies behavior or manual trace review passed', () => {
  assert.equal(summarizeRun({ exitCode: 0, completed: false, checks: [{ status: 'passed' }] }), 'incomplete');
  assert.equal(summarizeRun({ exitCode: 0, completed: true, checks: [{ status: 'failed' }] }), 'failed');
  assert.equal(summarizeRun({ exitCode: 0, completed: true, checks: [{ status: 'passed' }] }), 'needs-trace-review');
  assert.equal(summarizeRun({ exitCode: 0, completed: true, checks: [{ status: 'blocked' }] }), 'blocked');
});
test('host invocations use fresh sessions, preserve sandboxing and leave implicit prompts unprefixed', () => {
  const c = loadCases(root).find(c => c.id === 'react-local');
  const direct = buildInvocation({ host: 'codex', mode: 'direct', caseInfo: c, workspace: '/tmp/example' });
  assert.match(direct.prompt, /^\$vercel-composition-patterns/);
  assert.ok(direct.args.includes('--ephemeral'));
  assert.ok(direct.args.includes('workspace-write'));
  const implicit = buildInvocation({ host: 'claude', mode: 'implicit', caseInfo: c, workspace: '/tmp/example' });
  assert.equal(implicit.prompt, c.prompt);
  assert.ok(implicit.args.includes('--no-session-persistence'));
  assert.ok(!implicit.args.includes('bypassPermissions'));
  assert.ok(implicit.args.includes('user,project'), 'Preserve existing client authentication settings');
  assert.ok(implicit.args.includes('{"disableAllHooks":true}'), 'Disable user/project hooks for this run without editing settings');
});
test('missing host persists incomplete evidence and refuses reuse of an existing run directory', async t => {
  const scratch = mkdtempSync(join(tmpdir(), 'yuyin-eval-launch-'));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const options = { root, caseId: 'missing-skill', host: 'codex', mode: 'explicit', out: join(scratch, 'run'), executable: join(scratch, 'missing-codex'), timeoutMs: 1000 };
  const result = await runCase(options);
  assert.equal(result.status, 'incomplete');
  assert.match(result.processError, /ENOENT/);
  assert.ok(existsSync(join(options.out, 'result.json')));
  assert.equal(readFileSync(join(options.out, 'diff.patch'), 'utf8'), '');
  await assert.rejects(runCase(options), /EEXIST/);
});
test('unreviewed model code is blocked before it can write outside its project or inspect the parent environment', t => {
  const workspace = project(t, 'small-copy'), baseline = snapshot(workspace);
  const marker = join(dirname(workspace), `${workspace.split('/').at(-1)}-escaped`);
  t.after(() => { if (existsSync(marker)) rmSync(marker); });
  writeFileSync(join(workspace, 'src/checkout.mjs'), `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)},JSON.stringify(process.env)); export const buttonLabel='确认支付'; export const formatPrice=n=>n.toFixed(2);`);
  const result = checkCase({ root, caseId: 'small-copy', workspace, baseline }).find(r => r.id === 'small-copy-behavior');
  assert.equal(result.status, 'blocked');
  assert.equal(existsSync(marker), false);
});
test('explicitly reviewed checks do not inherit authentication-like environment values', t => {
  const workspace = project(t, 'small-copy'), baseline = snapshot(workspace);
  const previous = process.env.YUYIN_EVAL_TEST_SECRET;
  process.env.YUYIN_EVAL_TEST_SECRET = 'synthetic-test-value';
  t.after(() => { if (previous === undefined) delete process.env.YUYIN_EVAL_TEST_SECRET; else process.env.YUYIN_EVAL_TEST_SECRET = previous; });
  writeFileSync(join(workspace, 'src/checkout.mjs'), 'if (process.env.YUYIN_EVAL_TEST_SECRET) throw new Error("Inherited parent environment"); export const buttonLabel="确认支付"; export const formatPrice=n=>`¥${n.toFixed(2)}`;');
  assert.equal(checkCase({ root, caseId: 'small-copy', workspace, baseline, allowReviewedExecution: true }).find(r => r.id === 'small-copy-behavior').status, 'passed');
});
test('bundled Python references are distinct from introducing Python browser tests', t => {
  const workspace = project(t, 'js-playwright');
  cpSync(join(root, 'skills/upstream/anthropic/webapp-testing'), join(workspace, '.agents/skills/webapp-testing'), { recursive: true });
  const baseline = snapshot(workspace);
  const check = () => checkCase({ root, caseId: 'js-playwright', workspace, baseline, browser: false }).find(r => r.id === 'playwright-surface');
  assert.equal(check().status, 'passed');
  writeFileSync(join(workspace, 'tests/new-browser.py'), 'print("new test stack")');
  assert.equal(check().status, 'failed');
});
