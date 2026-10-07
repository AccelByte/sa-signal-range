import { AGS } from './ags-deck-config.js';

// A device credential for this demo, never a token or a spending ledger.
const key = `raiderdeck-device:${AGS.namespace}:${AGS.publicClientId}`;
export function automaticDeviceId(storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
  const saved = storage.getItem(key);
  if (saved) {
    if (!/^raiderdeck-[a-f0-9-]{36}$/.test(saved)) throw new Error('Saved player identity is invalid.');
    return saved;
  }
  const id = `raiderdeck-${crypto.randomUUID()}`;
  // Persist before login so a failed response never creates a second player.
  storage.setItem(key, id);
  return id;
}
