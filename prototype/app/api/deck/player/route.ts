import { deckCors } from '@/lib/deck-cors';
import { AGS } from '@/lib/ags-deck-config';
import { allowedPlayerRequest } from '@/lib/player-request';
import { IdentityError, verifyPlayer } from '@/lib/server/identity';

export const dynamic = 'force-dynamic';
async function forward(request: Request) {
  const headers = { 'Cache-Control': 'no-store', Vary: 'Authorization' };
  try {
    const identity = await verifyPlayer(request);
    const url = new URL(request.url);
    const path = url.searchParams.get('path') ?? '';
    let body: unknown;
    if (request.method === 'POST') {
      if (request.headers.get('content-type') !== 'application/json') return Response.json({ error: 'JSON required.' }, { status: 415, headers });
      const text = await request.text();
      if (text.length > 512) return Response.json({ error: 'Invalid purchase.' }, { status: 400, headers });
      body = JSON.parse(text);
    }
    if (!allowedPlayerRequest(path, request.method, identity.userId, body)) return Response.json({ error: 'Unsupported deck operation.' }, { status: 400, headers });
    const response = await fetch(`${AGS.baseUrl}${path}`, {
      method: request.method, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(10000),
      headers: { Authorization: request.headers.get('authorization')!, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) return Response.json({ error: 'AGS could not finish this deck operation.' }, { status: response.status >= 300 && response.status < 400 ? 503 : response.status, headers });
    return new Response(await response.text(), { status: response.status, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (error) {
    return Response.json({ error: 'Deck operation could not finish.' }, { status: error instanceof IdentityError ? error.status : error instanceof SyntaxError ? 400 : 503, headers });
  }
}
const cors = deckCors(['GET', 'POST']);
export const OPTIONS = cors.OPTIONS;
export const GET = cors.wrap(forward);
export const POST = cors.wrap(forward);
