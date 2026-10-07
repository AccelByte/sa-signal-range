import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgsDeckClient } from '../.test-build/ags-deck-client.js';
import { AGS } from '../.test-build/ags-deck-config.js';
import { REWARDS } from '../.test-build/deck.js';

test('a separately hosted frontend uses public runtime mapping and bearer requests without cookies', async () => {
  const originalFetch = globalThis.fetch, originalStorage = globalThis.localStorage;
  const apiBase = 'https://backend.example';
  const config = { ...AGS, namespace: 'synthetic-pages-game', publicClientId: 'example-public-client', currency: 'BPT' };
  const items = Object.fromEntries(REWARDS.map(reward => [reward.id, `example-${reward.id}`]));
  const identity = { userId: 'example-player', namespace: config.namespace, clientId: config.publicClientId };
  const paths = [];
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.fetch = async (url, init) => {
    assert.ok(url.startsWith(`${apiBase}/api/deck/`));
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    const route = new URL(url);
    paths.push(route.pathname);
    const reply = body => Response.json(body);
    if (route.pathname.endsWith('/login')) {
      assert.equal(init.headers.Authorization, undefined);
      return reply({ access_token: 'fake-player-token' });
    }
    assert.equal(init.headers.Authorization, 'Bearer fake-player-token');
    if (route.pathname.endsWith('/identity')) return reply(identity);
    if (route.pathname.endsWith('/bootstrap')) return reply({ starterPoints: 180 });
    if (route.pathname.endsWith('/reconcile')) return reply({ total: 0, projected: 0, pendingItems: [], fulfilledItems: [] });
    const path = route.searchParams.get('path');
    assert.ok(path.includes(config.namespace));
    if (path.includes('/wallets/')) return reply({ ...identity, currencyCode: config.currency, balance: 180 });
    if (path.includes('/entitlements?')) return reply({ data: [] });
    if (path.includes('/statitems?')) return reply({ data: [{ statCode: config.statCode, value: 0 }] });
    const reward = REWARDS.find(reward => path.includes(`/items/${items[reward.id]}/locale?`));
    assert.ok(reward);
    return reply({ itemId: items[reward.id], namespace: config.namespace, title: reward.name, purchasable: true, entitlementType: 'DURABLE', itemType: 'INGAMEITEM', maxCountPerUser: 1, regionData: [{ price: reward.cost, currencyCode: config.currency, currencyType: 'VIRTUAL' }] });
  };
  try {
    const state = await createAgsDeckClient({ apiBase, config, items }).connect('example-device');
    assert.equal(state.balance, 180);
    assert.equal(state.spent, 0);
    assert.deepEqual(state.owned, []);
    assert.equal(state.identity.namespace, config.namespace);
    assert.ok(paths.includes('/api/deck/bootstrap'));
  } finally { globalThis.fetch = originalFetch; globalThis.localStorage = originalStorage; }
});
