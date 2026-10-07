import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureStarterGrant } from '../.test-build/starter-grant.js';
import { REWARDS, TIERS, initialDeck, purchaseReward, settleReceipt } from '../.test-build/deck.js';

function fixture() {
  const grants = new Map(), transactions = new Map();
  let credits = 0;
  const port = {
    async reserve(key, amount) {
      const existing = grants.get(key);
      if (existing) return { claimed: false, grant: { ...existing } };
      const grant = { key, amount, status: 'pending' }; grants.set(key, grant);
      return { claimed: true, grant: { ...grant } };
    },
    async credit(amount, key) { credits++; transactions.set(key, amount); },
    async credited(grant) { return transactions.get(grant.key) === grant.amount; },
    async complete(key) { grants.get(key).status = 'complete'; },
    async release(key) { grants.delete(key); },
    rejected: error => error.message === 'explicit rejection',
  };
  return { port, credits: () => credits, grants };
}

test('concurrent bootstraps, reloads and configuration changes issue one grant per player', async () => {
  const f = fixture();
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => ensureStarterGrant('player', 180, f.port)));
  assert.ok(results.some(r => r.status === 'fulfilled'));
  assert.equal(f.credits(), 1);
  assert.equal(await ensureStarterGrant('player', 200, f.port), 180);
  await ensureStarterGrant('other-player', 180, f.port); assert.equal(f.credits(), 2);
});
test('credit commits but response is lost: retry finds the AGS transaction without a second credit', async () => {
  const f = fixture(); const original = f.port.credit;
  f.port.credit = async (...args) => { await original(...args); throw Error('lost response'); };
  await assert.rejects(ensureStarterGrant('player', 180, f.port));
  assert.equal(await ensureStarterGrant('player', 180, f.port), 180); assert.equal(f.credits(), 1);
});
test('uncertain uncommitted credit stays blocked; explicit rejection allows a safe retry', async () => {
  const f = fixture(), original = f.port.credit;
  f.port.credit = async () => { throw Error('unknown outcome'); };
  await assert.rejects(ensureStarterGrant('player', 180, f.port));
  await assert.rejects(ensureStarterGrant('player', 180, f.port), /processing/);
  assert.equal(f.credits(), 0);
  f.port.credit = async () => { throw Error('explicit rejection'); };
  await assert.rejects(ensureStarterGrant('other', 180, f.port)); assert.equal(f.grants.has('other'), false);
  f.port.credit = original; await ensureStarterGrant('other', 180, f.port); assert.equal(f.credits(), 1);
});
test('funding is sufficient for every purchase path to Tier 3 and for all nine rewards', () => {
  assert.equal(REWARDS.reduce((sum, r) => sum + r.cost, 0), 180);
  let state = { ...initialDeck(), balance: 180 };
  assert.equal(state.spent, 0);
  for (const reward of REWARDS) {
    state = purchaseReward(state, reward, reward.id); state = settleReceipt(state, reward.id);
  }
  assert.equal(state.balance, 0); assert.equal(state.spent, 180); assert.equal(state.owned.length, 9);
  assert.ok(state.spent >= TIERS[2].threshold);
});
test('unsafe or insufficient server grant configuration fails before reservation', async () => {
  const f = fixture();
  for (const amount of [0, 100, 179, NaN, Infinity, 180.5, 10001]) await assert.rejects(ensureStarterGrant('player', amount, f.port));
  assert.equal(f.grants.size, 0);
});
