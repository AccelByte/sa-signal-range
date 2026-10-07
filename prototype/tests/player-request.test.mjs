import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedPlayerRequest } from '../.test-build/player-request.js';
import { AGS, DECK_ITEMS } from '../.test-build/ags-deck-config.js';
const user='a'.repeat(32), base=`/platform/public/namespaces/${AGS.namespace}/users/${user}`;
test('player forwarding rejects foreign users, arbitrary URLs and forged purchase amounts', () => {
  assert.equal(allowedPlayerRequest(`${base}/wallets/RDP`,'GET',user),true);
  for(const path of [`${base.replace(user,'b'.repeat(32))}/wallets/RDP`,'https://example.com','/iam/v3/oauth/token',`${base}/wallets/RDP/credit`,`${base}/entitlements?limit=100&offset=10000`]) assert.equal(allowedPlayerRequest(path,'GET',user),false);
  const purchase={itemId:DECK_ITEMS['sr-field-radio'],quantity:1,currencyCode:'RDP',price:10,discountedPrice:10,region:'US',language:'en'};
  assert.equal(allowedPlayerRequest(`${base}/orders`,'POST',user,purchase),true);
  for(const patch of [{price:0},{discountedPrice:0},{quantity:2},{itemId:'foreign'},{userId:user}]) assert.equal(allowedPlayerRequest(`${base}/orders`,'POST',user,{...purchase,...patch}),false);
});
