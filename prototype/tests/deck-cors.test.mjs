import test from 'node:test';
import assert from 'node:assert/strict';
import { deckCors } from '../.test-build/deck-cors.js';

const url = 'https://backend.example/api/deck/bootstrap';
const origin = 'https://accelbyte.github.io';

test('only the game origin can preflight the declared methods and bearer headers', async () => {
  const cors = deckCors(['POST']);
  const preflight = headers => new Request(url, { method: 'OPTIONS', headers });
  const allowed = await cors.OPTIONS(preflight({ Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' }));
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(allowed.headers.has('Access-Control-Allow-Credentials'), false);
  for (const headers of [
    { Origin: 'https://foreign.example', 'Access-Control-Request-Method': 'POST' },
    { Origin: origin, 'Access-Control-Request-Method': 'DELETE' },
    { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'x-admin-key' },
  ]) assert.equal((await cors.OPTIONS(preflight(headers))).status, 403);
});

test('foreign requests never reach the handler; allowed requests retain verification failures', async () => {
  let calls = 0;
  const handler = deckCors(['POST']).wrap(async () => {
    calls++;
    return Response.json({ error: 'Token required.' }, { status: 401, headers: { Vary: 'Authorization', 'Cache-Control': 'no-store' } });
  });
  const rejected = await handler(new Request(url, { method: 'POST', headers: { Origin: 'https://foreign.example' } }));
  assert.equal(rejected.status, 403);
  assert.equal(calls, 0);
  const response = await handler(new Request(url, { method: 'POST', headers: { Origin: origin } }));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(response.headers.get('Vary'), /Authorization/);
  assert.match(response.headers.get('Vary'), /Origin/);
  assert.equal(calls, 1);
  assert.equal((await handler(new Request(url, { method: 'POST' }))).status, 401);
});
