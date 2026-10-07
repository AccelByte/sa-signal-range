// Public build configuration. All defaults are synthetic and cannot reach a live AGS environment.
// Never put confidential credentials in NEXT_PUBLIC_* variables.
export const AGS = {
  baseUrl: (process.env.NEXT_PUBLIC_AGS_BASE_URL || 'https://example.invalid').replace(/\/$/, ''),
  namespace: process.env.NEXT_PUBLIC_AGS_NAMESPACE || 'example-game',
  publicClientId: process.env.NEXT_PUBLIC_AGS_CLIENT_ID || '00000000000000000000000000000000',
  currency: process.env.NEXT_PUBLIC_AGS_CURRENCY || 'RDP',
  statCode: process.env.NEXT_PUBLIC_AGS_STAT_CODE || 'raiderdecksignalrange01spent',
} as const;

export const DECK_ITEMS: Record<string, string> = {
  'sr-field-radio': process.env.NEXT_PUBLIC_AGS_ITEM_FIELD_RADIO || '00000000000000000000000000000001',
  'sr-pathfinder': process.env.NEXT_PUBLIC_AGS_ITEM_PATHFINDER || '00000000000000000000000000000002',
  'sr-ridge-pack': process.env.NEXT_PUBLIC_AGS_ITEM_RIDGE_PACK || '00000000000000000000000000000003',
  'sr-pulse': process.env.NEXT_PUBLIC_AGS_ITEM_PULSE || '00000000000000000000000000000004',
  'sr-nightwatch': process.env.NEXT_PUBLIC_AGS_ITEM_NIGHTWATCH || '00000000000000000000000000000005',
  'sr-sentinel': process.env.NEXT_PUBLIC_AGS_ITEM_SENTINEL || '00000000000000000000000000000006',
  'sr-relay': process.env.NEXT_PUBLIC_AGS_ITEM_RELAY || '00000000000000000000000000000007',
  'sr-far-sight': process.env.NEXT_PUBLIC_AGS_ITEM_FAR_SIGHT || '00000000000000000000000000000008',
  'sr-wayfarer': process.env.NEXT_PUBLIC_AGS_ITEM_WAYFARER || '00000000000000000000000000000009',
};
