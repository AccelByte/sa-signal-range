import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { reconcileOrders, receipt, readOrderHistory } from '../.test-build/order-spending.js';
import { validatedIdentity } from '../.test-build/player-identity.js';
import { AGS } from '../.test-build/ags-deck-config.js';
const original = JSON.parse(await readFile(new URL('./fixtures/fulfilled-order.json', import.meta.url)));
const user = original.userId;
const season = { id: 'signal-range-01', namespace: AGS.namespace, currency: 'RDP', statCode: AGS.statCode, items: { [original.itemId]: 10, second: 30 } };
function second() { const o = structuredClone(original); Object.assign(o, {orderNo:'Osecond',itemId:'second',price:30,discountedPrice:30,totalPrice:30,subtotalPrice:30}); o.itemSnapshot.itemId='second'; o.itemSnapshot.regionDataItem.discountedPrice=30; return o; }
function projection() {
  let stat = 0;
  return { publishMax: async total => (stat = Math.max(stat, total)), value: () => stat };
}
test('verified identity rejects expired/foreign/malformed responses and strips token', () => {
  const good={user_id:user,namespace:AGS.namespace,client_id:AGS.publicClientId,expires_in:100,access_token:'secret'};
  assert.deepEqual(validatedIdentity(good),{userId:user,namespace:AGS.namespace,clientId:AGS.publicClientId});
  for(const patch of [{expires_in:0},{expires_in:Infinity},{namespace:'foreign'},{client_id:'worker'},{user_id:'../someone'}]) assert.equal(validatedIdentity({...good,...patch}),null);
});
test('only fixed-price fulfilled orders contribute; unrelated item ignored; identity mismatch rejected', () => {
  assert.equal(receipt(original,user,season).paid,10);
  for(const status of ['INIT','CHARGED','FULFILL_FAILED','CLOSED','REFUNDED']) assert.equal(receipt({...original,status},user,season),null);
  assert.equal(receipt({...original,itemId:'unrelated'},user,season),null);
  assert.throws(()=>receipt({...original,userId:'someone'},user,season));
  assert.throws(()=>receipt({...original,namespace:'foreign'},user,season));
  for(const patch of [{quantity:2},{deduction:1},{discountedPrice:9},{tax:1},{totalPrice:11},{orderNo:'../bad'},{currency:{...original.currency,currencyType:'REAL'}}]) assert.throws(()=>receipt({...original,...patch},user,season));
});
test('season membership is configured, never inferred from callback date', async () => {
  const p=projection();
  assert.equal((await reconcileOrders(user,{...season,id:'original-season'},[original],p)).total,10);
  assert.equal(receipt(original,user,{...season,items:{}}),null);
});
test('duplicate and reordered full histories count each order once; concurrent older total cannot regress stat', async () => {
  const p=projection();
  const results=await Promise.all([reconcileOrders(user,season,[second(),original,original],p),reconcileOrders(user,season,[original],p)]);
  assert.equal(results[0].total,40); assert.equal(results[0].orderCount,2); assert.equal(p.value(),40);
  await reconcileOrders(user,season,[],p); assert.equal(p.value(),40);
});
test('failed projection recovers from AGS history alone with a fresh reconciler',async()=>{
  const p=projection();
  await assert.rejects(reconcileOrders(user,season,[original,second()],{publishMax:async()=>{throw Error('unavailable')}}));
  assert.equal(p.value(),0);
  assert.equal((await reconcileOrders(user,season,[original,second()],p)).projected,40);
});
test('lost stat response and repeated requests do not increment spending',async()=>{
  const p=projection();
  await assert.rejects(reconcileOrders(user,season,[original],{publishMax:async n=>{await p.publishMax(n);throw Error('lost response')}}));
  await reconcileOrders(user,season,[original,original],p);
  assert.equal(p.value(),10);
});
test('conflicting identities and duplicate permanent purchases fail before projection',async()=>{
  let calls=0; const p={publishMax:async()=>{calls++;return 40}};
  await assert.rejects(reconcileOrders(user,season,[original,{...original,orderNo:'duplicate'}],p));
  await assert.rejects(reconcileOrders(user,season,[original,{...second(),orderNo:original.orderNo}],p));
  assert.equal(calls,0);
});
test('paging follows all pages; failed/malformed/over-limit history never becomes a partial total',async()=>{
  const offsets=[];
  const orders=await readOrderHistory(async offset=>{offsets.push(offset);return {data:offset===0?Array(100).fill(original):[second()]}});
  assert.deepEqual(offsets,[0,100]);assert.equal(orders.length,101);
  const p=projection();assert.equal((await reconcileOrders(user,season,orders,p)).total,40);
  await assert.rejects(readOrderHistory(async offset=>{if(offset)throw Error('page unavailable');return {data:Array(100).fill(original)}}));
  await assert.rejects(readOrderHistory(async()=>({data:null})));
  await assert.rejects(readOrderHistory(async()=>({data:[null]})));
  await assert.rejects(readOrderHistory(async()=>({data:Array(100).fill(original)})));
});
test('missing history cannot rebuild lost progress; MAX preserves only already projected progress',async()=>{
  const fresh=projection(); assert.equal((await reconcileOrders(user,season,[],fresh)).projected,0);
  const existing=projection();await existing.publishMax(40);
  assert.equal((await reconcileOrders(user,season,[],existing)).projected,40);
});
test('invalid projection responses fail closed',async()=>{
  for(const value of [0,NaN,Infinity,10.5]) await assert.rejects(reconcileOrders(user,season,[original],{publishMax:async()=>value}));
});
