'use client';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { DeckView } from '@/components/deck-view';
import { registerDeckTools } from '@/lib/deck-tools';
import { REWARDS, TIERS, purchaseIssue, type Reward } from '@/lib/deck';
import { createMockDeckClient } from '@/lib/mock-deck-client';
import { createAgsDeckClient, type LiveDeck } from '@/lib/ags-deck-client';


export default function Home() {
  const [client] = useState(() => createMockDeckClient());
  const [mockDeck, setDeck] = useState(() => client.loadState());
  const [mode, setMode] = useState<'live' | 'mock'>('live');
  const [liveClient] = useState(() => createAgsDeckClient());
  const [live, setLive] = useState<LiveDeck | null>(null);
  const [busy, setBusy] = useState(false);
  const recovery = useRef({ mode, live, busy, refresh: refreshLive });
  recovery.current = { mode, live, busy, refresh: refreshLive };
  const deck = mode === 'mock' ? mockDeck : { ...mockDeck, balance: live?.balance ?? 0, spent: live?.spent ?? 0, owned: live?.owned ?? [], pending: null };
  const [selected, setSelected] = useState<Reward | null>(null);
  const [message, setMessage] = useState('Connecting your player and preparing starter points…');
  const [resetOpen, setResetOpen] = useState(false);
  const operation = useRef(0);
  const [ready, setReady] = useState(false);
  const actions = useRef({ earn, purchase: purchaseById, reset });
  actions.current = { earn, purchase: purchaseById, reset };
  useEffect(() => {
    let active = true;
    const restored = client.hydrate();
    setDeck(restored.state);
    setReady(true);

    const currentOperation = ++operation.current;
    if (restored.state.pending) void client.settleProgress(restored.state.pending.id).then((state) => {
      if (active && currentOperation === operation.current) {
        setDeck(state);
        setMessage('Saved purchase processed once. Your collection is ready.');
      }
    });
    return () => { active = false; };
  }, [client]);
  useEffect(() => {
    if (mode !== 'live') return;
    let active = true;
    const attempt = ++operation.current;
    setBusy(true); setLive(null); setMessage('Connecting your player and preparing starter points…');
    void liveClient.connectAutomatically().then(state => {
      if (active && attempt === operation.current) { setLive(state); setMessage('Ready. Choose a reward; spending opens the next tier.'); }
    }).catch(error => {
      if (active && attempt === operation.current) setMessage(error instanceof Error ? error.message : 'Connection failed.');
    }).finally(() => { if (active && attempt === operation.current) setBusy(false); });
    return () => { active = false; };
  }, [liveClient, mode]);
  useEffect(() => mode === 'mock' ? registerDeckTools({ read: () => ({ ...client.loadState(), rewards: REWARDS, tiers: TIERS }), earn: () => actions.current.earn(), purchase: (id) => actions.current.purchase(id), reset: () => actions.current.reset() }) : undefined, [client, mode]);
  useEffect(() => {
    const recover = () => { const r = recovery.current; if (r.mode === 'live' && r.live && !r.busy && document.visibilityState === 'visible') void r.refresh(); };
    window.addEventListener('online', recover); window.addEventListener('focus', recover); document.addEventListener('visibilitychange', recover);
    return () => { window.removeEventListener('online', recover); window.removeEventListener('focus', recover); document.removeEventListener('visibilitychange', recover); };
  }, []);
  const rewards = mode === 'live' && live ? live.rewards : REWARDS;
  const selectedIssue = selected ? mode === 'mock' ? purchaseIssue(deck, selected) : busy || liveClient.pending() ? 'Checking your purchase. Please wait or retry progress.' : deck.owned.includes(selected.id) ? 'Already in your collection.' : deck.spent < TIERS[selected.tier - 1].threshold ? `Spend ${TIERS[selected.tier - 1].threshold - deck.spent} more points to unlock.` : deck.balance < selected.cost ? 'Insufficient points.' : null : null;

  function earn() {
    if (mode !== 'mock') throw new Error('Mock funding is unavailable in live mode.');
    if (!ready) throw new Error('The deck is loading.');
    const state = client.awardMockPoints();
    flushSync(() => { setDeck(state); setMessage('40 mock points added. Spending progress is unchanged.'); });
    return state;
  }
  async function purchaseById(id: string) {
    if (mode !== 'mock') throw new Error('Live purchases require the visible confirmation.');
    if (!ready) throw new Error('The deck is loading.');
    const reward = REWARDS.find((item) => item.id === id);
    if (!reward) throw new Error('Reward unavailable.');
    const purchased = client.purchase(id);
    const currentOperation = ++operation.current;
    flushSync(() => {
      setDeck(purchased);
      setMessage(`${reward.name} acquired. Updating deck progress…`);
      setSelected(null);
    });
    const settled = await client.settleProgress(purchased.pending!.id);
    if (currentOperation !== operation.current) return client.loadState();
    const unlocked = TIERS.find((tier) => purchased.spent < tier.threshold && settled.spent >= tier.threshold);
    flushSync(() => {
      setDeck(settled);
      setMessage(unlocked ? `Tier ${unlocked.id} unlocked — ${unlocked.name}. Choose your next reward.` : 'Deck progress updated. Your next reward is up to you.');
    });
    return settled;
  }
  async function buy() {
    if (!selected) return;
    if (mode === 'live') {
      const attempt = ++operation.current;
      setBusy(true); setMessage('Purchasing through AGS…');
      try {
        const order = await liveClient.purchase(selected.id);
        const state = await liveClient.refreshAfterOrder(order);
        if (attempt !== operation.current) return;
        setLive(state); setSelected(null);
        setMessage(order.status === 'FULFILLED' ? 'Reward fulfilled. Season spending verified by AGS.' : `Order ${order.status}. Retry progress to check again.`);
      } catch (error) { if (attempt === operation.current) setMessage(error instanceof Error ? error.message : 'Purchase could not be completed.'); }
      finally { if (attempt === operation.current) setBusy(false); }
      return;
    }
    try { await purchaseById(selected.id); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Purchase could not be completed.'); }
  }
  function reset() {
    if (mode !== 'mock') throw new Error('Live state cannot be reset from the browser.');
    operation.current += 1;
    const state = client.reset();
    flushSync(() => {
      setDeck(state); setSelected(null); setResetOpen(false);
      setMessage('Demo reset. 60 points ready for a new expedition.');
    });
    return state;
  }

  function changeMode(next: 'live' | 'mock') {
    operation.current++; liveClient.disconnect(); setLive(null); setSelected(null); setBusy(false); setMode(next);
    setMessage(next === 'live' ? 'Connecting your player…' : 'Offline mock mode. No live service changes.');
    if (next === 'live' && mode === 'live') void connect();
  }
  async function connect() {
    const attempt = ++operation.current;
    setLive(null); setBusy(true); setMessage('Connecting to AGS…');
    try { const state = await liveClient.connectAutomatically(); if (attempt === operation.current) { setLive(state); setMessage('Ready. Wallet and collection loaded from AGS.'); } }
    catch (error) { if (attempt === operation.current) setMessage(error instanceof Error ? error.message : 'Connection failed.'); }
    finally { if (attempt === operation.current) setBusy(false); }
  }
  async function refreshLive() {
    if (recovery.current.busy) return;
    recovery.current.busy = true;
    const attempt = ++operation.current; setBusy(true);
    try { const state = await liveClient.load(); if (attempt === operation.current) { setLive(state); setMessage('Wallet, collection and season spending refreshed from AGS.'); } }
    catch (error) { if (attempt === operation.current) setMessage(error instanceof Error ? error.message : 'Refresh failed.'); }
    finally { if (attempt === operation.current) setBusy(false); }
  }
  return <DeckView
    deck={deck} rewards={rewards} mode={mode} ready={ready} busy={busy}
    connected={mode === 'mock' || !!live} player={live?.identity.userId}
    message={message} selected={selected} selectedIssue={selectedIssue}
    resetOpen={resetOpen} storageLabel={ready ? client.storageLabel() : 'Loading saved demo…'}
    onSelect={setSelected} onMode={changeMode} onEarn={earn}
    onRefresh={() => void refreshLive()} onBuy={() => void buy()}
    onReset={reset} onResetOpen={setResetOpen}
    connection={<><p className="eyebrow connection-eyebrow">OUTPOST ACCESS</p><h2>Your next expedition awaits.</h2><p>Your player connects automatically. Starter points cover every reward in the field collection.</p><button className="primary-button" disabled={busy} onClick={() => void connect()}>{busy ? 'Preparing your deck…' : 'Retry connection'}</button><p className="connection-footnote">Use Offline demo below to explore with local demo points.</p></>}
  />;
}
