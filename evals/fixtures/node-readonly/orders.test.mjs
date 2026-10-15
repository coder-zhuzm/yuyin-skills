import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOrders } from './src/orders.mjs';
test('reproduces 80ms upstream being rejected by the 50ms budget', async () => {
  await assert.rejects(loadOrders(() => new Promise(resolve => setTimeout(() => resolve([]), 80))), /timed out/);
});
