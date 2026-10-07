type Actions = { read: () => unknown; earn: () => unknown; purchase: (id: string) => Promise<unknown>; reset: () => unknown };
type Tool = { name: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => unknown };
type Context = { registerTool: (tool: Tool, options: { signal: AbortSignal }) => void | Promise<void> };

function inputObject(input: unknown, keys: string[]) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !keys.includes(key))) throw new Error('Invalid tool input.');
  return input as Record<string, unknown>;
}

export function registerDeckTools(actions: Actions) {
  const context = (document as Document & { modelContext?: Context }).modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const add = (name: string, description: string, properties: object, required: string[], execute: Tool['execute'], readOnlyHint = false) => {
    try {
      void Promise.resolve(context.registerTool({ name, description, inputSchema: { type: 'object', properties, required, additionalProperties: false }, annotations: { readOnlyHint, untrustedContentHint: false }, execute }, { signal: lifecycle.signal })).catch(() => console.warn('Optional deck tools unavailable.'));
    } catch { console.warn('Optional deck tools unavailable.'); }
  };
  add('get_mock_deck', 'Read local mock balance, settled spending, ownership, pending receipt and reward catalogue. No live AGS connection.', {}, [], (input) => { inputObject(input, []); return actions.read(); }, true);
  add('earn_mock_points', 'Add exactly 40 local demo points; does not change spending or tier access.', {}, [], (input) => { inputObject(input, []); return actions.earn(); });
  add('purchase_mock_reward', 'Buy one local mock reward by ID and wait for delayed spending settlement. Uses the same tier, balance and ownership checks as the visible confirmation. No real money.', { rewardId: { type: 'string' } }, ['rewardId'], (input) => {
    const value = inputObject(input, ['rewardId']);
    if (typeof value.rewardId !== 'string') throw new Error('A rewardId is required.');
    return actions.purchase(value.rewardId);
  });
  add('reset_mock_deck', 'Reset this local demo to 60 balance, zero spending and no owned rewards; cancels pending work. Requires explicit confirmation.', { confirm: { type: 'boolean', const: true } }, ['confirm'], (input) => {
    if (inputObject(input, ['confirm']).confirm !== true) throw new Error('Reset requires confirm: true.');
    return actions.reset();
  });
  return () => lifecycle.abort();
}
