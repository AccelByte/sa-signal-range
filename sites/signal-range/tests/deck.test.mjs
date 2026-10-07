import test from 'node:test';
import assert from 'node:assert/strict';
import { initialDeck, purchaseIssue, purchaseReward, settleReceipt, decodeDeck, REWARDS, SEASON_ID } from '../.test-build/deck.js';
import { createMockDeckClient, STORAGE_KEY } from '../.test-build/mock-deck-client.js';
const storage = () => { const data = new Map(); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
const client = (store = storage(), wait = async () => {}) => { const c = createMockDeckClient({ storage: store, wait }); c.hydrate(); return c; };
const buy = async (c, id) => { const state = c.purchase(id); return c.settleProgress(state.pending.id); };

test('threshold boundaries and forged/foreign rewards fail closed', () => {
  for (const [reward, threshold] of [[REWARDS[3], 40], [REWARDS[6], 100]]) {
    assert.match(purchaseIssue({ ...initialDeck(), spent: threshold - 1 }, reward), /Spend 1 more/);
    assert.equal(purchaseIssue({ ...initialDeck(), spent: threshold }, reward), null);
  }
  assert.match(purchaseIssue(initialDeck(), { ...REWARDS[0], cost: 0 }), /unavailable/);
  assert.match(purchaseIssue(initialDeck(), { ...REWARDS[0], tier: 99 }), /unavailable/);
  assert.match(purchaseIssue({ ...initialDeck(), seasonId: 'other' }, REWARDS[0]), /unavailable/);
});
test('10 + 30 opens tier two; earnings do not increase spending', async () => {
  const c = client();
  await buy(c, REWARDS[0].id);
  const state = await buy(c, REWARDS[2].id);
  assert.deepEqual([state.balance, state.spent, state.owned.length], [20, 40, 2]);
  assert.equal(purchaseIssue(state, REWARDS[3]), null);
  assert.deepEqual([c.awardMockPoints().balance, c.loadState().spent], [60, 40]);
});
test('pending, duplicate, owned, insufficient and unknown purchases have no second effect', async () => {
  const c = client();
  const pending = c.purchase(REWARDS[2].id);
  for (const id of [REWARDS[2].id, REWARDS[0].id, 'unknown']) assert.throws(() => c.purchase(id));
  assert.deepEqual(c.loadState(), pending);
  await c.settleProgress(pending.pending.id);
  assert.throws(() => c.purchase(REWARDS[2].id));
  await buy(c, REWARDS[1].id);
  const before = c.loadState();
  assert.throws(() => c.purchase(REWARDS[5].id), /more points/);
  assert.deepEqual(c.loadState(), before);
  assert.deepEqual(await c.settleProgress(pending.pending.id), before);
  assert.throws(() => purchaseReward(before, REWARDS[0], pending.pending.id), /Receipt/);
});
test('reload recovers a pending receipt once, with no repeat debit', async () => {
  const store = storage();
  const c = client(store);
  const pending = c.purchase(REWARDS[0].id);
  const reloaded = client(store);
  assert.deepEqual(reloaded.loadState(), pending);
  await Promise.all([reloaded.settleProgress(pending.pending.id), reloaded.settleProgress(pending.pending.id)]);
  const state = client(store).loadState();
  assert.deepEqual([state.balance, state.spent, state.owned.length, state.settledReceipts.length], [50, 10, 1, 1]);
});
test('old settlement cannot cross a reset or modify its new purchase', async () => {
  let release;
  const c = client(storage(), () => new Promise((resolve) => { release = resolve; }));
  const p = c.purchase(REWARDS[0].id);
  const old = c.settleProgress(p.pending.id);
  c.reset();
  const newer = c.purchase(REWARDS[2].id);
  release();
  await old;
  assert.deepEqual(c.loadState(), newer);
});
test('corrupt/foreign/inconsistent storage falls back with notice', () => {
  const variants = ['bad json', 'null', JSON.stringify({ version: 1, state: { ...initialDeck(), seasonId: 'other' } }), JSON.stringify({ version: 1, state: { ...initialDeck(), balance: -1 } }), JSON.stringify({ version: 1, state: { ...initialDeck(), spent: 40 } }), JSON.stringify({ version: 1, state: { ...initialDeck(), owned: ['fake'] } })];
  for (const raw of variants) {
    assert.throws(() => decodeDeck(raw));
    const store = storage(); store.setItem(STORAGE_KEY, raw);
    const c = createMockDeckClient({ storage: store });
    assert.match(c.hydrate().notice, /fresh deck/);
    assert.deepEqual(c.loadState(), initialDeck());
  }
  const store = storage(); store.setItem('outpost:mock-deck:other:v1', JSON.stringify({ version: 1, state: { ...initialDeck(), balance: 999 } }));
  assert.equal(client(store).loadState().balance, 60);
});
test('all rewards reachable; tier three opens before every earlier reward is owned', async () => {
  const c = client();
  c.awardMockPoints(); c.awardMockPoints(); c.awardMockPoints();
  for (const index of [2, 1, 5, 4]) await buy(c, REWARDS[index].id);
  assert.equal(c.loadState().spent, 100);
  assert.equal(c.loadState().owned.length, 4);
  assert.equal(purchaseIssue(c.loadState(), REWARDS[6]), null);
  for (const reward of REWARDS) if (!c.loadState().owned.includes(reward.id)) await buy(c, reward.id);
  const state = c.loadState();
  assert.deepEqual([state.balance, state.spent, state.owned.length], [0, 180, 9]);
  assert.equal(decodeDeck(JSON.stringify({ version: 1, state })).seasonId, SEASON_ID);
});
test('snapshots cannot mutate adapter state and unavailable storage stays usable', () => {
  const c = client(); const state = c.loadState(); state.balance = 999; state.owned.push('fake');
  assert.deepEqual(c.loadState(), initialDeck());
  const unavailable = createMockDeckClient({ storage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } } });
  assert.match(unavailable.hydrate().notice, /unavailable/);
  assert.equal(unavailable.awardMockPoints().balance, 100);
  assert.match(unavailable.storageLabel(), /Session only/);
});
