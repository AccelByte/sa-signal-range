export const SEASON_ID = 'signal-range-01';
export const SEASON_NAME = 'Signal Range';

export type Reward = {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: 'radio' | 'compass' | 'backpack' | 'scan' | 'flashlight' | 'shield' | 'antenna' | 'binoculars' | 'flag';
  cost: number;
  tier: number;
};
export const TIERS = [
  { id: 1, name: 'First contact', threshold: 0, note: 'Essentials for the first expedition.' },
  { id: 2, name: 'Beyond the perimeter', threshold: 40, note: 'Equipment for the longer route.' },
  { id: 3, name: 'The last signal', threshold: 100, note: 'Distinctions earned in the field.' },
] as const;

export const REWARDS: readonly Reward[] = [
  { id: 'sr-field-radio', name: 'Field radio', category: 'Equipment charm', description: 'A pocket-sized reminder to keep a channel open. Synthetic cosmetic reward.', icon: 'radio', cost: 10, tier: 1 },
  { id: 'sr-pathfinder', name: 'Pathfinder', category: 'Compass skin', description: 'A worn brass finish for every uncertain heading. Synthetic cosmetic reward.', icon: 'compass', cost: 20, tier: 1 },
  { id: 'sr-ridge-pack', name: 'Ridge pack', category: 'Pack appearance', description: 'A utility silhouette in expedition yellow. Synthetic cosmetic reward.', icon: 'backpack', cost: 30, tier: 1 },
  { id: 'sr-pulse', name: 'Pulse reader', category: 'Equipment charm', description: 'Carry the signature of a distant transmission. Synthetic cosmetic reward.', icon: 'scan', cost: 10, tier: 2 },
  { id: 'sr-nightwatch', name: 'Nightwatch', category: 'Torch skin', description: 'A dark anodized finish for the night shift. Synthetic cosmetic reward.', icon: 'flashlight', cost: 20, tier: 2 },
  { id: 'sr-sentinel', name: 'Sentinel', category: 'Outfit emblem', description: 'A field insignia for those who hold the perimeter. Synthetic cosmetic reward.', icon: 'shield', cost: 30, tier: 2 },
  { id: 'sr-relay', name: 'Relay station', category: 'Equipment charm', description: 'A miniature uplink, always searching for home. Synthetic cosmetic reward.', icon: 'antenna', cost: 10, tier: 3 },
  { id: 'sr-far-sight', name: 'Far sight', category: 'Optics skin', description: 'A survey-orange finish for the distant horizon. Synthetic cosmetic reward.', icon: 'binoculars', cost: 20, tier: 3 },
  { id: 'sr-wayfarer', name: 'Wayfarer', category: 'Season insignia', description: 'The final mark of the Signal Range expedition. Synthetic cosmetic reward.', icon: 'flag', cost: 30, tier: 3 },
];

export type Receipt = { id: string; rewardId: string; cost: number };
export type DeckState = {
  seasonId: string;
  balance: number;
  spent: number;
  owned: string[];
  pending: Receipt | null;
  settledReceipts: string[];
};
export function initialDeck(): DeckState {
  return { seasonId: SEASON_ID, balance: 60, spent: 0, owned: [], pending: null, settledReceipts: [] };
}
export function purchaseIssue(state: DeckState, reward: Reward): string | null {
  const configured = REWARDS.find((item) => item.id === reward.id);
  if (state.seasonId !== SEASON_ID || !configured || configured.cost !== reward.cost || configured.tier !== reward.tier) return 'Reward unavailable.';
  if (state.pending) return 'Updating deck progress… Please wait before purchasing again.';
  if (state.owned.includes(reward.id)) return 'Already in your collection.';
  const tier = TIERS.find((item) => item.id === reward.tier)!;
  if (state.spent < tier.threshold) return `Spend ${tier.threshold - state.spent} more points to unlock.`;
  if (state.balance < reward.cost) return `You need ${reward.cost - state.balance} more points. Earn 40 demo points to continue.`;
  return null;
}
export function purchaseReward(state: DeckState, reward: Reward, receiptId: string): DeckState {
  if (!receiptId || state.settledReceipts.includes(receiptId)) throw new Error('Receipt already processed or invalid.');
  const issue = purchaseIssue(state, reward);
  if (issue) throw new Error(issue);
  return { ...state, balance: state.balance - reward.cost, owned: [...state.owned, reward.id], pending: { id: receiptId, rewardId: reward.id, cost: reward.cost } };
}

// Browser storage is untrusted, even in a local-only demo.
export function decodeDeck(raw: string): DeckState {
  const { version, state } = JSON.parse(raw);
  const validNumber = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
  const validIds = (value: unknown): value is string[] => Array.isArray(value) && value.every((id) => typeof id === 'string' && id.length > 0) && new Set(value).size === value.length;
  if (version !== 1 || !state || state.seasonId !== SEASON_ID || !validNumber(state.balance) || !validNumber(state.spent) || !validIds(state.owned) || !validIds(state.settledReceipts)) throw new Error('Invalid saved deck.');
  const owned = state.owned.map((id: string) => REWARDS.find((reward) => reward.id === id));
  if (owned.some((reward: Reward | undefined) => !reward)) throw new Error('Unknown saved reward.');
  const pending = state.pending;
  if (pending !== null) {
    const reward = REWARDS.find((item) => item.id === pending?.rewardId);
    if (!reward || !state.owned.includes(reward.id) || pending.cost !== reward.cost || typeof pending.id !== 'string' || !pending.id || state.settledReceipts.includes(pending.id)) throw new Error('Invalid pending receipt.');
  }
  if (state.spent + (pending?.cost ?? 0) !== owned.reduce((sum: number, reward: Reward) => sum + reward.cost, 0) || state.settledReceipts.length !== state.owned.length - (pending ? 1 : 0)) throw new Error('Inconsistent saved spending.');
  return { seasonId: SEASON_ID, balance: state.balance, spent: state.spent, owned: [...state.owned], pending: pending ? { id: pending.id, rewardId: pending.rewardId, cost: pending.cost } : null, settledReceipts: [...state.settledReceipts] };
}
export function settleReceipt(state: DeckState, receiptId: string): DeckState {
  if (!state.pending || state.pending.id !== receiptId || state.settledReceipts.includes(receiptId)) return state;
  return { ...state, spent: state.spent + state.pending.cost, pending: null, settledReceipts: [...state.settledReceipts, receiptId] };
}
