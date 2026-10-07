// AGS Orders is the durable source. Contributions exist only during this request.
export type Season = { id: string; namespace: string; currency: string; statCode: string; items: Record<string, number> };
export type Receipt = { orderNo: string; itemId: string; paid: number };
export type Order = Record<string, unknown>;
export class ReconcileError extends Error {}
export const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function receipt(order: Order, userId: string, season: Season): Receipt | null {
  if (order.userId !== userId || order.namespace !== season.namespace) throw new ReconcileError('Order identity mismatch.');
  if (typeof order.itemId !== 'string' || !Object.hasOwn(season.items, order.itemId)) return null;
  if (order.status !== 'FULFILLED') return null;
  const currency = object(order.currency), snapshot = object(order.itemSnapshot), price = object(snapshot.regionDataItem);
  const paid = order.discountedPrice;
  if (typeof order.orderNo !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(order.orderNo) ||
      order.quantity !== 1 || currency.currencyCode !== season.currency || currency.namespace !== season.namespace || currency.currencyType !== 'VIRTUAL' || currency.decimals !== 0 ||
      !Number.isSafeInteger(paid) || paid !== season.items[order.itemId] || order.price !== paid || order.deduction !== 0 ||
      !['tax', 'vat', 'salesTax', 'totalTax', 'paymentProviderFee', 'paymentMethodFee'].every(key => order[key] === 0) || order.totalPrice !== paid || order.subtotalPrice !== paid ||
      snapshot.itemId !== order.itemId || snapshot.namespace !== season.namespace || snapshot.entitlementType !== 'DURABLE' || snapshot.itemType !== 'INGAMEITEM' || snapshot.maxCountPerUser !== 1 ||
      price.discountedPrice !== paid || price.currencyCode !== season.currency || price.currencyType !== 'VIRTUAL') {
    throw new ReconcileError('A fulfilled order differs from the fixed-price deck contract. Operator review is required.');
  }
  return { orderNo: order.orderNo, itemId: order.itemId, paid: paid as number };
}
export interface SpendingPort {
  publishMax(total: number): Promise<number>;
}
export async function reconcileOrders(userId: string, season: Season, orders: Order[], port: SpendingPort) {
  const contributions = new Map<string, Receipt>();
  const items = new Set<string>();
  for (const order of orders) {
    const next = receipt(order, userId, season);
    if (!next) continue;
    const existing = contributions.get(next.orderNo);
    if (existing) {
      if (existing.itemId !== next.itemId || existing.paid !== next.paid) throw new ReconcileError('Conflicting order history. Operator review is required.');
      continue;
    }
    if (items.has(next.itemId)) throw new ReconcileError('Multiple fulfilled orders for a one-time reward. Operator review is required.');
    contributions.set(next.orderNo, next);
    items.add(next.itemId);
  }
  const total = [...contributions.values()].reduce((sum, order) => sum + order.paid, 0);
  if (!Number.isSafeInteger(total)) throw new ReconcileError('Invalid spending total.');
  // Always publish the absolute history-derived total, including replay and empty history.
  // MAX tolerates older indexed snapshots without lowering already projected progress.
  const projected = await port.publishMax(total);
  if (!Number.isSafeInteger(projected) || projected < total) throw new ReconcileError('Spending projection is still processing. Retry progress.');
  return { total, projected, orderCount: contributions.size };
}

export async function readOrderHistory(read: (offset: number, limit: number) => Promise<{ data: Order[]; paging?: { next?: string } }>): Promise<Order[]> {
  const orders: Order[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await read(offset, 100);
    if (!Array.isArray(page.data) || page.data.some(o => !o || typeof o !== 'object' || Array.isArray(o))) throw new ReconcileError('Order history is unavailable.');
    orders.push(...page.data);
    if (page.data.length < 100 && !page.paging?.next) return orders;
  }
  throw new ReconcileError('Order history exceeded the fixture limit. Operator review is required.');
}
