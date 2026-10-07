import { AGS } from './ags-deck-config.js';
export function validatedIdentity(verified: Record<string, unknown>) {
  if (typeof verified.user_id !== 'string' || !/^[a-f0-9]{32}$/i.test(verified.user_id) ||
      verified.namespace !== AGS.namespace || verified.client_id !== AGS.publicClientId ||
      typeof verified.expires_in !== 'number' || !Number.isFinite(verified.expires_in) || verified.expires_in <= 0) return null;
  return { userId: verified.user_id, namespace: AGS.namespace, clientId: AGS.publicClientId };
}
