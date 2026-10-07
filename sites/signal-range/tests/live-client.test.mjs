import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgsDeckClient } from '../.test-build/ags-deck-client.js';
import { AGS, DECK_ITEMS } from '../.test-build/ags-deck-config.js';
import { REWARDS } from '../.test-build/deck.js';
test('lost create response recovers through history across reload without a repeat POST',async()=>{
  const realFetch=globalThis.fetch, realStorage=globalThis.localStorage;
  const saved=new Map(); globalThis.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
  let fulfilled=false, visible=false, createCount=0, reconcileCount=0;
  const uid='a'.repeat(32), identity={userId:uid,namespace:AGS.namespace,clientId:AGS.publicClientId};
  const reply=v=>new Response(JSON.stringify(v),{status:200});
  globalThis.fetch=async(url,init)=>{
    url=String(url);
    if(url==='/api/deck/login')return reply({access_token:'fake-player-token'});
    if(url.startsWith('/api/deck/player?')) url=new URL(url,'https://site.example').searchParams.get('path');
    if(url==='/api/deck/identity')return reply(identity);
    if(url==='/api/deck/bootstrap')return reply({starterPoints:180});
    if(url==='/api/deck/reconcile'){reconcileCount++;return reply({total:visible?10:0,projected:visible?10:0,pendingItems:[],fulfilledItems:visible?[DECK_ITEMS['sr-field-radio']]:[]})}
    if(url.endsWith('/orders') && init.method==='POST'){createCount++;fulfilled=true;throw Error('response lost after AGS commits')}
    if(url.includes('/wallets/'))return reply({...identity,currencyCode:'RDP',balance:fulfilled?50:60});
    if(url.includes('/entitlements?'))return reply({data:visible?[{userId:uid,namespace:AGS.namespace,itemId:DECK_ITEMS['sr-field-radio'],status:'ACTIVE'}]:[]});
    if(url.includes('/statitems?'))return reply({data:[{statCode:AGS.statCode,value:visible?10:0}]});
    if(url.includes('/locale?')){const r=REWARDS.find(r=>url.includes(DECK_ITEMS[r.id])); return reply({itemId:DECK_ITEMS[r.id],namespace:AGS.namespace,title:r.name,purchasable:true,entitlementType:'DURABLE',itemType:'INGAMEITEM',maxCountPerUser:1,regionData:[{price:r.cost,discountedPrice:r.cost,currencyCode:'RDP',currencyType:'VIRTUAL'}]})}
    throw Error(`unexpected path ${url}`);
  };
  try{
    const first=createAgsDeckClient(); await first.connect('fixture'); await assert.rejects(first.purchase('sr-field-radio')); assert.equal(first.pending(),true);
    first.disconnect(); const reloaded=createAgsDeckClient(); await reloaded.connect('fixture');
    await assert.rejects(reloaded.purchase('sr-field-radio')); assert.equal(createCount,1);
    visible=true; const state=await reloaded.load(); assert.equal(state.balance,50);assert.equal(state.spent,10);assert.deepEqual(state.owned,['sr-field-radio']);assert.equal(reloaded.pending(),false);
    await assert.rejects(reloaded.purchase('sr-field-radio')); assert.equal(createCount,1);assert.ok(reconcileCount>=4);
    // An older connection failing must not sign out a newer successful connection.
    const workingFetch=globalThis.fetch; let release, announce; let hold=true;
    const started=new Promise(resolve=>{announce=resolve});
    globalThis.fetch=async(url,init)=>{
      if(url==='/api/deck/reconcile' && hold){hold=false;announce();return new Promise((_resolve,reject)=>{release=reject})}
      return workingFetch(url,init);
    };
    const racing=createAgsDeckClient(); const older=racing.connect('first');
    const olderFailure=assert.rejects(older); await started; await racing.connect('second');
    release(Error('late connection failure')); await olderFailure;
    assert.equal((await racing.load()).identity.userId,uid);
  }finally{globalThis.fetch=realFetch;globalThis.localStorage=realStorage}
});
