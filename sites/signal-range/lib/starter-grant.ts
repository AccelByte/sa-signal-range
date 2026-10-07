export class GrantError extends Error {}
export type StarterGrant = { key: string; amount: number; status: 'pending' | 'complete' };
export interface GrantPort {
  reserve(key: string, amount: number): Promise<{ claimed: boolean; grant: StarterGrant }>;
  credit(amount: number, key: string): Promise<void>;
  credited(grant: StarterGrant): Promise<boolean>;
  complete(key: string): Promise<void>;
  release(key: string): Promise<void>;
  rejected(error: unknown): boolean;
}

export async function ensureStarterGrant(key: string, amount: number, port: GrantPort) {
  if (!Number.isSafeInteger(amount) || amount < 180 || amount > 10000) throw new GrantError('Starter funding is not configured correctly.');
  const { claimed, grant } = await port.reserve(key, amount);
  if (!claimed) {
    if (grant.status === 'complete') return grant.amount;
    // Recover a committed credit whose response or local completion was lost.
    // AGS credit exposes no idempotency contract: never submit it twice.
    if (await port.credited(grant)) { await port.complete(key); return grant.amount; }
    throw new GrantError('Starter points are still processing. Retry connection shortly.');
  }
  try { await port.credit(grant.amount, key); }
  catch (error) {
    if (port.rejected(error)) await port.release(key);
    throw error;
  }
  await port.complete(key);
  return grant.amount;
}
