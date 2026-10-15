import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { validateCiWorkflow } from '../scripts/verify.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const workflow = () => YAML.parse(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8'));

test('PR and manual validation run tests and package checks without publishing', () => {
  validateCiWorkflow(workflow());
});

test('PR validation cannot gain release permissions or check the wrong revision', () => {
  for (const mutate of [
    w => { w.permissions.contents = 'write'; },
    w => { w.jobs.test.permissions = { 'id-token': 'write' }; },
    w => { w.jobs.test.steps[0].with.ref = 'main'; },
    w => { w.jobs.test.steps[0].with['persist-credentials'] = true; },
  ]) {
    const w = workflow(); mutate(w);
    assert.throws(() => validateCiWorkflow(w));
  }
});

test('required CI checks cannot be omitted, made nonblocking, or replaced by model runs', () => {
  for (const mutate of [
    w => { w.jobs.test.steps = w.jobs.test.steps.filter(s => s.run !== 'npm test'); },
    w => { w.jobs.test.steps.find(s => s.run === 'npm run verify')['continue-on-error'] = true; },
    w => { w.jobs.test.if = 'false'; },
    w => { w.jobs.test.steps.push({ run: 'npm publish' }); },
    w => { w.jobs.test.steps.push({ run: 'npm run evals:run' }); },
    w => { w.on = { pull_request_target: {} }; },
  ]) {
    const w = workflow(); mutate(w);
    assert.throws(() => validateCiWorkflow(w));
  }
});
