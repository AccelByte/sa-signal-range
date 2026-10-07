import test from 'node:test';
import assert from 'node:assert/strict';
import { automaticDeviceId } from '../.test-build/auto-player.js';

test('automatic identity persists before use and survives reload without changing player', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const first = automaticDeviceId(storage);
  assert.match(first, /^raiderdeck-[a-f0-9-]{36}$/); assert.equal(automaticDeviceId(storage), first);
});
test('unavailable or corrupt device storage never silently creates a different account', () => {
  assert.throws(() => automaticDeviceId({ getItem: () => null, setItem: () => { throw Error('unavailable'); } }));
  assert.throws(() => automaticDeviceId({ getItem: () => 'invalid', setItem: () => {} }));
});
