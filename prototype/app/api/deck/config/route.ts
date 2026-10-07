import { AGS, DECK_ITEMS } from '@/lib/ags-deck-config';
import { deckCors } from '@/lib/deck-cors';

export const dynamic = 'force-dynamic';
const cors = deckCors(['GET']);
export const OPTIONS = cors.OPTIONS;
export const GET = cors.wrap(async () => Response.json({
  // Explicit public fields only; service credentials never leave the server.
  ags: { baseUrl: 'https://example.invalid', namespace: AGS.namespace, publicClientId: AGS.publicClientId, currency: AGS.currency, statCode: AGS.statCode },
  items: DECK_ITEMS,
}, { headers: { 'Cache-Control': 'no-store' } }));
