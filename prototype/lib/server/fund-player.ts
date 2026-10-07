import 'server-only';
import { AGS } from '../ags-deck-config';
import { ensureStarterGrant, GrantError, type StarterGrant } from '../starter-grant';
import { SEASON_ID } from '../deck';
import { ags, ServiceError } from './ags';
import { grantStore } from './grant-store';

export async function fundPlayer(userId: string) {
  const amount = Number(process.env.AGS_STARTER_POINTS ?? '180');
  const base = `/platform/admin/namespaces/${AGS.namespace}/users/${encodeURIComponent(userId)}/wallets`;
  const key = `${AGS.namespace}:${SEASON_ID}:${userId}`;
  async function credited(grant: StarterGrant) {
    for (let offset = 0; offset < 10000; offset += 100) {
      const page = await ags<{ data: Record<string, unknown>[]; paging?: { next?: string } }>(`${base}/currencies/${AGS.currency}/transactions?limit=100&offset=${offset}`);
      if (!Array.isArray(page.data)) throw new GrantError('Starter funding history is unavailable.');
      if (page.data.some(t => t.userId === userId && t.namespace === AGS.namespace && t.currencyCode === AGS.currency && t.walletAction === 'CREDIT' && t.amount === grant.amount && t.reason === `Signal Range starter ${grant.key}`)) return true;
      if (page.data.length < 100 && !page.paging?.next) return false;
    }
    throw new GrantError('Starter funding history is unavailable.');
  }
  return ensureStarterGrant(key, amount, {
    ...grantStore, credited,
    rejected: error => error instanceof ServiceError && error.status >= 400 && error.status < 500 && error.status !== 408,
    async credit(points, grantKey) {
      const wallet = await ags<{ userId: string; namespace: string; currencyCode: string; balance: number }>(`${base}/${AGS.currency}/credit`, 'PUT', {
        amount: points, origin: 'System', source: 'OTHER', reason: `Signal Range starter ${grantKey}`,
        metadata: { starterGrant: grantKey },
      });
      if (wallet.userId !== userId || wallet.namespace !== AGS.namespace || wallet.currencyCode !== AGS.currency || !Number.isSafeInteger(wallet.balance) || wallet.balance < 0) throw new GrantError('Starter funding could not be confirmed. Retry connection.');
    },
  });
}
