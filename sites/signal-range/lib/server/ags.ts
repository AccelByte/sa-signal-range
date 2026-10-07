import 'server-only';
import { AGS } from '../ags-deck-config';

export class ServiceError extends Error {
  constructor(public status: number, message = 'AGS is unavailable. Retry progress to recover safely.') { super(message); }
}
let cached: { token: string; until: number } | undefined;
let minting: Promise<string> | undefined;
async function token() {
  if (cached && cached.until > Date.now()) return cached.token;
  if (minting) return minting;
  minting = (async () => {
    const id = process.env.AGS_WORKER_CLIENT_ID, secret = process.env.AGS_WORKER_CLIENT_SECRET;
    if (!id || !secret || process.env.AGS_NAMESPACE !== AGS.namespace || process.env.AGS_BASE_URL?.replace(/\/$/, '') !== AGS.baseUrl) throw new ServiceError(503);
    const response = await fetch(`${AGS.baseUrl}/iam/v3/oauth/token`, {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    if (!response.ok) throw new ServiceError(503);
    const value = await response.json() as { access_token: string; expires_in: number };
    if (!value.access_token || !Number.isFinite(value.expires_in) || value.expires_in <= 60) throw new ServiceError(503);
    cached = { token: value.access_token, until: Date.now() + (value.expires_in - 60) * 1000 };
    return cached.token;
  })().finally(() => { minting = undefined; });
  return minting;
}
export async function ags<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  try {
    const response = await fetch(`${AGS.baseUrl}${path}`, {
      method, redirect: 'manual', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${await token()}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status === 401) cached = undefined;
    if (!response.ok) throw new ServiceError(response.status);
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(503);
  }
}
