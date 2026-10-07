import { AGS, DECK_ITEMS } from './ags-deck-config.js';
import { REWARDS } from './deck.js';

// The Site forwards only this player's deck operations, never an arbitrary URL.
export function allowedPlayerRequest(path: string, method: string, userId: string, body?: unknown) {
  const platform = `/platform/public/namespaces/${AGS.namespace}`;
  const user = `${platform}/users/${userId}`;
  if (method === 'POST' && path === `${user}/orders`) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
    const b = body as Record<string, unknown>;
    const reward = REWARDS.find(r => DECK_ITEMS[r.id] === b.itemId);
    return !!reward && Object.keys(b).length === 7 && b.quantity === 1 && b.currencyCode === AGS.currency && b.price === reward.cost && b.discountedPrice === reward.cost && b.region === 'US' && b.language === 'en';
  }
  if (method !== 'GET' || body !== undefined) return false;
  if (path === `${user}/wallets/${AGS.currency}`) return true;
  if (path === `/social/v1/public/namespaces/${AGS.namespace}/users/me/statitems?statCodes=${AGS.statCode}&limit=100&offset=0`) return true;
  if (Object.values(DECK_ITEMS).some(item => path === `${platform}/items/${item}/locale?region=US&language=en`)) return true;
  const prefix = `${user}/orders/`;
  if (path.startsWith(prefix) && /^[A-Za-z0-9_-]{1,100}$/.test(path.slice(prefix.length))) return true;
  const entitlementPrefix = `${user}/entitlements?limit=100&offset=`;
  if (path.startsWith(entitlementPrefix)) {
    const offset = path.slice(entitlementPrefix.length);
    return /^(0|[1-9]\d*)$/.test(offset) && Number(offset) < 10000 && Number(offset) % 100 === 0;
  }
  return false;
}
