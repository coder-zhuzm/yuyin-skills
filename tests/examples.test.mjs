import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const read = path => readFileSync(new URL(`../skills/upstream/${path}`, import.meta.url), 'utf8');
const compile = (text, bindings = {}) => vm.runInNewContext(stripTypeScriptTypes(text, { mode: 'strip' }), { Error, ...bindings });
const details = () => read('wshobson/nodejs-backend-patterns/references/details.md');
function repository() {
  const method = details().match(/  async update\(id: string, updates: UpdateUserDTO\)[\s\S]*?(?=\n  async delete\()/)[0];
  return compile(`class Repository { ${method} }; Repository`);
}
test('update example accepts only fixed public fields and rejects empty or injected fields before SQL', async () => {
  const Repository = repository(), queries = [], repo = new Repository();
  repo.db = { query: async (...args) => { queries.push(args); return { rows: [{ id: '1' }] }; } };
  for (const updates of [{}, { role: 'admin' }, { password: 'secret' }, { "name = 'injected', email": 'x' }, { name: 'safe', role: 'admin' }]) {
    await assert.rejects(repo.update('1', updates));
  }
  assert.equal(queries.length, 0);
  await repo.update('1', { name: "O'Reilly", email: 'a@example.com' });
  assert.match(queries[0][0], /SET name = \$2, email = \$3,/);
  assert.deepEqual(Array.from(queries[0][1]), ['1', "O'Reilly", 'a@example.com']);
});
test('validation passes parsed data to downstream handlers', async () => {
  const code = details().match(/export const validate = [\s\S]*?\n};/)[0].replace('export ', '');
  const validate = compile(`${code}; validate`);
  const req = { body: { name: 'raw', role: 'admin' }, query: {}, params: {} };
  const parsed = { body: { name: 'normalized' }, query: {}, params: { id: '1' } };
  let called = false;
  const res = { locals: {} };
  await validate({ parseAsync: async () => parsed })(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(req.body, parsed.body);
  assert.equal(res.locals.validated, parsed);
});
function caching() {
  const code = read('wshobson/nodejs-backend-patterns/references/advanced-patterns.md').match(/export function Cacheable[\s\S]*?\n}\n/)[0].replace('export ', '');
  const entries = new Map();
  class CacheService { async get(key) { return entries.has(key) ? entries.get(key) : null; } async set(key, value) { entries.set(key, value); } }
  return compile(`${code}; Cacheable`, { CacheService });
}
test('cache example separates services and tenant instances and caches falsy values', async () => {
  const Cacheable = caching();
  const wrap = (namespace, fn) => {
    const descriptor = { value: fn };
    Cacheable(namespace, function (id) { return [this.tenantId, id]; })(null, 'getById', descriptor);
    return descriptor.value;
  };
  const user = wrap('users:v1', async function (id) { return `user:${this.tenantId}:${id}`; });
  const order = wrap('orders:v1', async function (id) { return `order:${this.tenantId}:${id}`; });
  assert.equal(await user.call({ tenantId: 'a' }, 1), 'user:a:1');
  assert.equal(await order.call({ tenantId: 'a' }, 1), 'order:a:1');
  assert.equal(await user.call({ tenantId: 'b' }, 1), 'user:b:1');
  for (const value of [false, 0, '']) {
    let calls = 0;
    const cached = wrap(`falsy:${typeof value}`, async () => { calls++; return value; });
    assert.equal(await cached.call({}, 1), value);
    assert.equal(await cached.call({}, 1), value);
    assert.equal(calls, 1);
  }
});
for (const path of ['rules/rendering-usetransition-loading.md', 'AGENTS.md']) {
  test(`React example ignores stale requests and handles failures (${path})`, async () => {
    const text = read(`vercel/react-best-practices/${path}`);
    const section = text.slice(text.indexOf('Use useTransition Over Manual Loading States', path === 'AGENTS.md' ? text.indexOf('### 6.11') : 0));
    const code = section.match(/import \{[^\n]+\} from 'react'\n([\s\S]*?)(?=\n  return \()/)[1];
    let results, error, transitions = 0;
    const pending = new Map();
    const handle = compile(`${code}\n return handleSearch; }; SearchResults()`, {
      useState: initial => [initial, initial === null ? value => { error = value; } : value => { if (Array.isArray(value)) results = value; }],
      useRef: initial => ({ current: initial }),
      useTransition: () => [false, fn => { transitions++; return fn(); }],
      fetchResults: value => new Promise((resolve, reject) => pending.set(value, { resolve, reject })),
    });
    const a = handle('a'), b = handle('b');
    pending.get('b').resolve(['b']); await b; await new Promise(setImmediate);
    pending.get('a').resolve(['a']); await a; await new Promise(setImmediate);
    assert.deepEqual(results, ['b']);
    const c = handle('c'); pending.get('c').reject(new Error('offline')); await c; await new Promise(setImmediate);
    assert.equal(error, 'offline');
    assert.ok(transitions >= 5, 'post-await result/error updates must use transitions');
  });
}
test('browser server helper handles real startup failures, logs and process cleanup', () => {
  const result = spawnSync('python3', [fileURLToPath(new URL('./server_helper_test.py', import.meta.url))], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr + result.stdout);
});
