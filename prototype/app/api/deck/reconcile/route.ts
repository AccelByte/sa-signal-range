import { IdentityError, verifyPlayer } from '@/lib/server/identity';
import { reconcileDeck } from '@/lib/server/reconcile-deck';
import { ReconcileError } from '@/lib/order-spending';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store', Vary: 'Authorization' };
  try {
    const identity = await verifyPlayer(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ error: 'JSON required.' }, { status: 415, headers });
    const text = await request.text();
    if (text.length > 256) return Response.json({ error: 'Invalid reconciliation request.' }, { status: 400, headers });
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => k !== 'orderNo') || (body.orderNo !== undefined && (typeof body.orderNo !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(body.orderNo)))) return Response.json({ error: 'Only an optional order number is accepted.' }, { status: 400, headers });
    return Response.json(await reconcileDeck(identity.userId, body.orderNo), { headers });
  } catch (error) {
    return Response.json({ error: error instanceof IdentityError || error instanceof ReconcileError ? error.message : 'Progress could not finish. Retry progress; do not repeat the purchase.' }, { status: error instanceof IdentityError ? error.status : error instanceof SyntaxError ? 400 : 503, headers });
  }
}
