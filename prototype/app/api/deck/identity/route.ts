import { deckCors } from '@/lib/deck-cors';
import { IdentityError, verifyPlayer } from '@/lib/server/identity';

export const dynamic = 'force-dynamic';

async function handle(request: Request) {
  const headers = { 'Cache-Control': 'no-store', Vary: 'Authorization' };
  try { return Response.json(await verifyPlayer(request), { headers }); }
  catch (error) {
    return Response.json({ error: error instanceof IdentityError ? error.message : 'Identity verification failed.' },
      { status: error instanceof IdentityError ? error.status : 503, headers });
  }
}

const cors = deckCors(['GET']);
export const OPTIONS = cors.OPTIONS;
export const GET = cors.wrap(handle);
