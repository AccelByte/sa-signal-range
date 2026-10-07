import 'server-only';
import { ags, ServiceError } from './ags';
import { SEASON } from './deck-config';
import { reconcileOrders, readOrderHistory, ReconcileError, type Order, type SpendingPort } from '../order-spending';

export async function reconcileDeck(userId: string, hint?: string) {
  const base = `/platform/admin/namespaces/${SEASON.namespace}/users/${userId}/orders`;
  // Query every immutable deck item. Follow offset/limit, never an upstream-supplied URL.
  const groups = await Promise.all(Object.keys(SEASON.items).map(itemId =>
    readOrderHistory((offset, limit) => ags<{ data: Order[]; paging?: { next?: string } }>(`${base}?itemId=${encodeURIComponent(itemId)}&limit=${limit}&offset=${offset}`))
  ));
  const orders = groups.flat();
  if (hint) {
    const order = await ags<Order>(`${base}/${encodeURIComponent(hint)}`);
    if (order.userId !== userId || order.namespace !== SEASON.namespace || typeof order.itemId !== 'string' || !Object.hasOwn(SEASON.items, order.itemId)) throw new ReconcileError('Order does not belong to this player and deck.');
    // A direct read can be newer than indexed history. Replace the same order snapshot.
    const index = orders.findIndex(o => o.orderNo === hint);
    if (index >= 0) orders[index] = order; else orders.push(order);
  }
  const stat = `/social/v2/admin/namespaces/${SEASON.namespace}/users/${userId}/stats/${SEASON.statCode}/statitems/value`;
  const port: SpendingPort = {
    async publishMax(total) {
      const update = () => ags<{ currentValue: number }>(stat, 'PUT', { updateStrategy: 'MAX', value: total });
      try { return (await update()).currentValue; }
      catch (error) {
        if (!(error instanceof ServiceError) || error.status !== 404) throw error;
        try { await ags(`/social/v1/admin/namespaces/${SEASON.namespace}/users/${userId}/stats/${SEASON.statCode}/statitems`, 'POST', {}); }
        catch (createError) { if (!(createError instanceof ServiceError) || createError.status !== 409) throw createError; }
        return (await update()).currentValue;
      }
    },
  };
  const result = await reconcileOrders(userId, SEASON, orders, port);
  const pendingItems = [...new Set(orders.filter(o => Object.hasOwn(SEASON.items, String(o.itemId)) && !['FULFILLED', 'CANCELLED', 'CLOSED', 'EXPIRED', 'CHARGE_FAILED'].includes(String(o.status))).map(o => String(o.itemId)))];
  return { ...result, pendingItems, fulfilledItems: [...new Set(orders.filter(o => o.status === 'FULFILLED').map(o => String(o.itemId)))], seasonId: SEASON.id };
}
