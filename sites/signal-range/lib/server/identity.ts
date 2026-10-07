import 'server-only';
import { AGS } from '../ags-deck-config';
import { validatedIdentity } from '../player-identity';

export class IdentityError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function verifyPlayer(request: Request) {
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') ?? '');
  if (!match || match[1].length > 16384) throw new IdentityError(401, 'Connect an AGS test player.');
  const clientId = process.env.AGS_WORKER_CLIENT_ID;
  const secret = process.env.AGS_WORKER_CLIENT_SECRET;
  if (!clientId || !secret || process.env.AGS_NAMESPACE !== AGS.namespace || process.env.AGS_BASE_URL?.replace(/\/$/, '') !== AGS.baseUrl) {
    throw new IdentityError(503, 'Server identity verification is not configured for this environment.');
  }
  let response: Response;
  try {
    response = await fetch(`${AGS.baseUrl}/iam/v3/oauth/verify`, {
      method: 'POST', cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: match[1] }),
    });
  } catch { throw new IdentityError(503, 'AGS identity verification is unavailable. Try connecting again.'); }
  if (!response.ok) throw new IdentityError(response.status >= 500 ? 503 : 401, 'AGS could not verify this player. Reconnect or check server configuration.');
  // Verification includes the token; return only the allowlisted identity fields.
  const verified = await response.json() as Record<string, unknown>;
  const identity = validatedIdentity(verified);
  if (!identity) {
    throw new IdentityError(401, 'A current player token from this test namespace and Public client is required.');
  }
  return identity;
}
