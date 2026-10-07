import { deckCors } from '@/lib/deck-cors';
import { AGS } from '@/lib/ags-deck-config';

export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    if (request.headers.get('content-type') !== 'application/json') return Response.json({ error: 'JSON required.' }, { status: 415, headers });
    const text = await request.text();
    if (text.length > 256) return Response.json({ error: 'Invalid player identity.' }, { status: 400, headers });
    const body = JSON.parse(text);
    if (!body || Object.keys(body).length !== 1 || typeof body.deviceId !== 'string' || !/^raiderdeck-[a-f0-9-]{36}$/.test(body.deviceId)) return Response.json({ error: 'Invalid player identity.' }, { status: 400, headers });
    const response = await fetch(`${AGS.baseUrl}/iam/v3/oauth/platforms/device/token`, {
      method: 'POST', cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Basic ${btoa(`${AGS.publicClientId}:`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: AGS.publicClientId, device_id: body.deviceId, create_headless: 'true', skip_set_cookie: 'true' }),
    });
    if (!response.ok) return Response.json({ error: 'Player login is unavailable.' }, { status: response.status >= 500 ? 503 : 401, headers });
    const token = await response.json() as { access_token?: unknown };
    if (typeof token.access_token !== 'string' || !token.access_token) throw new Error();
    return Response.json({ access_token: token.access_token }, { headers });
  } catch { return Response.json({ error: 'Player login is unavailable. Retry connection.' }, { status: 503, headers }); }
}

const cors = deckCors(['POST']);
export const OPTIONS = cors.OPTIONS;
export const POST = cors.wrap(handle);
