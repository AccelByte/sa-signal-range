import 'server-only';
import { env } from 'cloudflare:workers';
import { GrantError, type StarterGrant } from '../starter-grant';

function database() {
  const db = (env as unknown as { GRANTS_DB?: D1Database }).GRANTS_DB;
  if (!db) throw new GrantError('Starter funding is unavailable. Retry connection shortly.');
  return db;
}
export const grantStore = {
  async reserve(key: string, amount: number) {
    const db = database();
    const inserted = await db.prepare("INSERT INTO starter_grants (key, amount, status) VALUES (?, ?, 'pending') ON CONFLICT(key) DO NOTHING").bind(key, amount).run();
    const grant = await db.prepare('SELECT key, amount, status FROM starter_grants WHERE key = ?').bind(key).first<StarterGrant>();
    if (!grant || !Number.isSafeInteger(grant.amount) || !['pending', 'complete'].includes(grant.status)) throw new GrantError('Starter funding is unavailable.');
    return { claimed: inserted.meta.changes === 1, grant };
  },
  async complete(key: string) { await database().prepare("UPDATE starter_grants SET status = 'complete' WHERE key = ?").bind(key).run(); },
  async release(key: string) { await database().prepare("DELETE FROM starter_grants WHERE key = ? AND status = 'pending'").bind(key).run(); },
};
