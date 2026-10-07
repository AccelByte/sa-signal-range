import 'server-only';
import { AGS, DECK_ITEMS } from '../ags-deck-config';
import { REWARDS, SEASON_ID } from '../deck';
import type { Season } from '../order-spending';
// Immutable original-season membership. Retain entries when introducing later seasons.
export const SEASON: Season = {
  id: SEASON_ID, namespace: AGS.namespace, currency: AGS.currency, statCode: AGS.statCode,
  items: Object.fromEntries(REWARDS.map(r => [DECK_ITEMS[r.id], r.cost])),
};
