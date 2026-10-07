import { AGS, DECK_ITEMS } from './ags-deck-config.js';
import { REWARDS, TIERS, type Reward } from './deck.js';
import { automaticDeviceId } from './auto-player.js';

type Identity = { userId: string; namespace: string; clientId: string };
type Session = Identity & { token: string };
type Page<T> = { data: T[]; paging?: { next?: string } };
type Entitlement = { userId: string; namespace: string; itemId: string; status: string };
type Stat = { statCode: string; value: number };
type CatalogItem = {
  itemId: string; namespace: string; title: string; purchasable: boolean;
  entitlementType: string; itemType: string; maxCountPerUser: number;
  regionData: { price: number; discountedPrice?: number; currencyCode: string; currencyType: string }[];
};
export type LiveDeck = { identity: Identity; balance: number; spent: number; owned: string[]; rewards: Reward[] };
export type LiveOrder = { orderNo: string; namespace: string; userId: string; itemId: string; quantity: number; status: string };

class AgsError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

async function json<T>(url: string, init: RequestInit, label: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, credentials: url.startsWith('/api/deck/') ? 'same-origin' : 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(url === '/api/deck/reconcile' || url === '/api/deck/bootstrap' ? 45000 : 25000) });
  } catch { throw new AgsError(`${label}: network error or timeout. The outcome may be unknown.`); }
  if (!response.ok) {
    // Never echo upstream payloads: IAM payloads may include tokens or private data.
    throw new AgsError(`${label}: AGS returned HTTP ${response.status}.${response.status === 401 ? ' Reconnect your test player.' : ''}`, response.status);
  }
  try { return await response.json() as T; }
  catch { throw new AgsError(`${label}: invalid service response.`); }
}

export function createAgsDeckClient() {
  let session: Session | null = null;
  let snapshot: LiveDeck | null = null;
  let generation = 0;
  // This is a submission guard, not a receipt ledger. Unknown outcomes stay blocked.
  let outstanding: { rewardId: string; orderNo?: string } | null = null;
  let submitting = false;
  let pendingItems: string[] = [];
  let automaticConnection: Promise<LiveDeck> | null = null;
  const guardKey = (s: Session) => `raiderdeck-submission:${s.namespace}:${s.userId}`;
  function saveGuard(s: Session, next: typeof outstanding) {
    current(s);
    // Correlation only, never payment/spending evidence. Preserve unknown outcomes across reload.
    if (next) localStorage.setItem(guardKey(s), JSON.stringify(next));
    else localStorage.removeItem(guardKey(s));
    outstanding = next;
  }
  const platform = `/platform/public/namespaces/${AGS.namespace}`;
  function requireSession() {
    if (!session) throw new Error('Connect an AGS test player first.');
    return session;
  }
  function current(expected: Session) {
    if (session !== expected) throw new Error('Player changed. Discarded the previous response.');
  }
  function request<T>(s: Session, path: string, label: string, body?: object) {
    return json<T>(`/api/deck/player?path=${encodeURIComponent(path)}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${s.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }, label);
  }
  async function load(): Promise<LiveDeck> {
    const s = requireSession();
    const user = `${platform}/users/${encodeURIComponent(s.userId)}`;
    async function entitlements() {
      const all: Entitlement[] = [];
      for (let offset = 0; offset < 10000; offset += 100) {
        const query = new URLSearchParams({ limit: '100', offset: String(offset) });
        const page = await request<Page<Entitlement>>(s, `${user}/entitlements?${query}`, 'Read ownership');
        if (!Array.isArray(page.data)) throw new Error('Invalid entitlement response.');
        all.push(...page.data);
        if (page.data.length < 100 && !page.paging?.next) return all;
      }
      throw new Error('Ownership paging limit reached. No partial collection is displayed.');
    }
    const [wallet, owned, stats, catalog] = await Promise.all([
      request<{ userId: string; namespace: string; currencyCode: string; balance: number }>(s, `${user}/wallets/${AGS.currency}`, 'Read wallet'),
      entitlements(),
      request<Page<Stat>>(s, `/social/v1/public/namespaces/${AGS.namespace}/users/me/statitems?statCodes=${AGS.statCode}&limit=100&offset=0`, 'Read spending stat'),
      Promise.all(REWARDS.map(async (reward) => {
        const item = await request<CatalogItem>(s, `${platform}/items/${DECK_ITEMS[reward.id]}/locale?region=US&language=en`, 'Read catalog');
        const price = item.regionData?.find((entry) => entry.currencyCode === AGS.currency && entry.currencyType === 'VIRTUAL');
        if (item.itemId !== DECK_ITEMS[reward.id] || item.namespace !== AGS.namespace || !item.purchasable ||
            item.entitlementType !== 'DURABLE' || item.itemType !== 'INGAMEITEM' || item.maxCountPerUser !== 1 ||
            !price || price.price !== reward.cost || (price.discountedPrice ?? price.price) !== reward.cost || !item.title) {
          throw new Error('Published catalog differs from the approved fixed-price fixture. Purchase is unavailable.');
        }
        return { ...reward, name: item.title, cost: price.discountedPrice ?? price.price };
      })),
    ]);
    current(s);
    if (wallet.userId !== s.userId || wallet.namespace !== AGS.namespace || wallet.currencyCode !== AGS.currency || !Number.isSafeInteger(wallet.balance) || wallet.balance < 0) throw new Error('Unexpected wallet response.');
    if (!Array.isArray(stats.data)) throw new Error('Invalid spending response.');
    const stat = stats.data.find((entry) => entry.statCode === AGS.statCode);
    if (!stat || !Number.isSafeInteger(stat.value) || stat.value < 0) throw new Error('Spending is unavailable. Retry progress.');
    snapshot = {
      identity: { userId: s.userId, namespace: s.namespace, clientId: s.clientId }, balance: wallet.balance,
      spent: stat.value,
      owned: REWARDS.filter((r) => owned.some((e) => e.userId === s.userId && e.namespace === AGS.namespace && e.itemId === DECK_ITEMS[r.id] && e.status === 'ACTIVE')).map((r) => r.id),
      rewards: catalog,
    };
    return snapshot;
  }
  async function reconcile() {
    const s = requireSession();
    const result = await json<{ total: number; projected: number; pendingItems: string[]; fulfilledItems: string[] }>('/api/deck/reconcile', {
      method: 'POST', headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(outstanding?.orderNo ? { orderNo: outstanding.orderNo } : {}),
    }, 'Reconcile progress');
    current(s);
    if (!Number.isSafeInteger(result.total) || result.total < 0 || !Number.isSafeInteger(result.projected) || result.projected < result.total || !Array.isArray(result.pendingItems) || !Array.isArray(result.fulfilledItems)) throw new Error('Invalid progress response.');
    pendingItems = result.pendingItems;
    const state = await load();
    current(s);
    // A concurrent request may already have advanced the projection beyond this response.
    if (state.spent < result.total) throw new Error('Spending is still processing. Retry progress.');
    if (outstanding && result.fulfilledItems.includes(DECK_ITEMS[outstanding.rewardId]) && state.owned.includes(outstanding.rewardId)) saveGuard(s, null);
    return state;
  }
  async function checkOrder(): Promise<LiveOrder> {
    const s = requireSession();
    const pending = outstanding;
    if (!pending?.orderNo) throw new Error('Purchase outcome unknown. Retry progress to inspect history; do not resubmit.');
    let order: LiveOrder | undefined;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 1000));
      current(s);
      order = await request<LiveOrder>(s, `${platform}/users/${encodeURIComponent(s.userId)}/orders/${encodeURIComponent(pending.orderNo)}`, 'Check order');
      current(s);
      if (order.orderNo !== pending.orderNo || order.userId !== s.userId || order.namespace !== AGS.namespace || order.itemId !== DECK_ITEMS[pending.rewardId] || order.quantity !== 1 || typeof order.status !== 'string') throw new Error('Order readback did not match this player and reward. Purchase remains blocked.');
      if (order.status !== 'INIT' && order.status !== 'CHARGED') break;
    }
    // Even FULFILLED requires a separate state refresh before allowing another buy.
    return order!;
  }
  const client = {
    connectAutomatically(): Promise<LiveDeck> {
      if (!automaticConnection) {
        const connecting = Promise.resolve().then(() => client.connect(automaticDeviceId())).finally(() => { if (automaticConnection === connecting) automaticConnection = null; });
        automaticConnection = connecting;
      }
      return automaticConnection;
    },
    async connect(deviceId: string) {
      if (!deviceId.trim() || deviceId.length > 128) throw new Error('Enter a test Device ID (1–128 characters).');
      const attempt = ++generation;
      session = null; snapshot = null; outstanding = null; pendingItems = []; submitting = false;
      const token = await json<{ access_token: string }>('/api/deck/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: deviceId.trim() }),
      }, 'Device ID login');
      if (!token.access_token || typeof token.access_token !== 'string') throw new Error('Login returned no player token.');
      const identity = await json<Identity>('/api/deck/identity', { headers: { Authorization: `Bearer ${token.access_token}` } }, 'Verify player');
      if (attempt !== generation) throw new Error('Connection cancelled.');
      if (!identity.userId || identity.namespace !== AGS.namespace || identity.clientId !== AGS.publicClientId) throw new Error('Unexpected verified identity.');
      session = { ...identity, token: token.access_token };
      const connectedSession = session;
      try {
        const saved = localStorage.getItem(guardKey(session));
        if (saved) {
          const value = JSON.parse(saved);
          if (!value || !Object.hasOwn(DECK_ITEMS, value.rewardId) || (value.orderNo !== undefined && (typeof value.orderNo !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value.orderNo)))) throw new Error('Invalid unresolved-purchase marker. Operator review is required.');
          outstanding = { rewardId: value.rewardId, orderNo: value.orderNo };
        }
        await json<{ starterPoints: number }>('/api/deck/bootstrap', {
          method: 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, body: '{}',
        }, 'Prepare starter points');
        current(connectedSession);
        return await reconcile();
      } catch (error) { if (attempt === generation) { session = null; snapshot = null; } throw error; }
    },
    disconnect() { generation++; session = null; snapshot = null; outstanding = null; pendingItems = []; submitting = false; automaticConnection = null; },
    load: reconcile,
    async purchase(rewardId: string) {
      const s = requireSession();
      if (submitting || outstanding) throw new Error('A purchase is unresolved. Refresh its status; do not submit another order.');
      submitting = true;
      try {
      await reconcile();
      current(s);
      if (pendingItems.length) throw new Error('An AGS order is still processing. Retry progress before purchasing.');
      const reward = snapshot?.rewards.find((r) => r.id === rewardId);
      if (!reward || snapshot!.owned.includes(rewardId)) throw new Error('Refresh the catalog and ownership before purchasing.');
      if (snapshot!.spent < TIERS[reward.tier - 1].threshold) throw new Error('Spend more points to access this tier.');
      if (snapshot!.balance < reward.cost) throw new Error(`Insufficient ${AGS.currency}. Retry connection to check starter points.`);
      saveGuard(s, { rewardId });
      try {
        const created = await request<LiveOrder>(s, `${platform}/users/${encodeURIComponent(s.userId)}/orders`, 'Create order', {
          itemId: DECK_ITEMS[rewardId], quantity: 1, currencyCode: AGS.currency,
          price: reward.cost, discountedPrice: reward.cost, region: 'US', language: 'en',
        });
        current(s);
        if (typeof created.orderNo !== 'string' || !created.orderNo) throw new Error('Order response missing order number. Outcome unknown; do not resubmit.');
        saveGuard(s, { rewardId, orderNo: created.orderNo });
      } catch (error) {
        // An explicit 4xx rejection is final; timeouts/5xx/malformed responses are ambiguous.
        if (session === s && error instanceof AgsError && error.status && error.status >= 400 && error.status < 500 && error.status !== 408) saveGuard(s, null);
        throw error;
      }
      return await checkOrder();
      } finally { if (session === s) submitting = false; }
    },
    checkOrder,
    pending() { return outstanding !== null || pendingItems.length > 0; },
    async refreshAfterOrder(_order: LiveOrder) { return reconcile(); },
  };
  return client;
}
