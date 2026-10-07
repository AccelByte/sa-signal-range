import { IdentityError, verifyPlayer } from '@/lib/server/identity';
import { fundPlayer } from '@/lib/server/fund-player';
import { GrantError } from '@/lib/starter-grant';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store', Vary: 'Authorization' };
  try {
    const identity = await verifyPlayer(request);
    if (request.headers.get('content-type') !== 'application/json' || (await request.text()).trim() !== '{}') return Response.json({ error: 'No player or amount fields are accepted.' }, { status: 400, headers });
    return Response.json({ starterPoints: await fundPlayer(identity.userId) }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof IdentityError || error instanceof GrantError ? error.message : 'Starter points are unavailable. Retry connection.' }, { status: error instanceof IdentityError ? error.status : 503, headers });
  }
}
