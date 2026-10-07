import { decodeDeck, initialDeck, purchaseReward, REWARDS, SEASON_ID, settleReceipt, type DeckState } from './deck.js';

export const STORAGE_KEY = `outpost:mock-deck:${SEASON_ID}:v1`;
export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
type Options = { storage?: StoragePort; wait?: () => Promise<void> };

// Local single-tab simulation. This adapter is not a trusted economy boundary.
export function createMockDeckClient(options: Options = {}) {
  let state = initialDeck();
  let generation = 0;
  let storage: StoragePort | undefined;
  let hydrated = false;
  let notice = '';
  let durable = false;
  const snapshot = (): DeckState => structuredClone(state);
  const persist = () => {
    if (!storage) return;
    try { storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state })); durable = true; }
    catch { durable = false; notice = 'Browser storage is unavailable. This session will not survive reload.'; }
  };
  const wait = options.wait ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 1400)));
  return {
    loadState: snapshot,
    storageLabel: () => durable ? 'Saved in this browser · single-tab demo' : 'Session only · browser saving unavailable',
    hydrate: () => {
      if (hydrated) return { state: snapshot(), notice };
      hydrated = true;
      try {
        storage = options.storage ?? window.localStorage;
        const saved = storage.getItem(STORAGE_KEY);
        if (saved) {
          try { state = decodeDeck(saved); notice = state.pending ? 'Purchase restored. Updating deck progress…' : 'Your saved collection is ready.'; }
          catch { state = initialDeck(); notice = 'Saved demo data could not be read. A fresh deck is ready.'; }
        }
        persist();
      } catch { notice = 'Browser storage is unavailable. This session will not survive reload.'; }
      return { state: snapshot(), notice };
    },
    awardMockPoints: (): DeckState => {
      if (!Number.isSafeInteger(state.balance + 40)) throw new Error('Demo balance limit reached. Reset to continue.');
      state = { ...state, balance: state.balance + 40 };
      persist();
      return snapshot();
    },
    purchase: (rewardId: string): DeckState => {
      const reward = REWARDS.find((item) => item.id === rewardId);
      if (!reward) throw new Error('Reward unavailable.');
      state = purchaseReward(state, reward, `mock-${crypto.randomUUID()}`);
      persist();
      return snapshot();
    },
    settleProgress: async (receiptId: string): Promise<DeckState> => {
      const startedGeneration = generation;
      await wait();
      if (startedGeneration === generation) { state = settleReceipt(state, receiptId); persist(); }
      return snapshot();
    },
    reset: (): DeckState => {
      generation += 1;
      state = initialDeck();
      persist();
      return snapshot();
    },
  };
}
