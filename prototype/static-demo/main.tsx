import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { DeckView } from '@/components/deck-view';
import { REWARDS, TIERS, purchaseIssue, type Reward } from '@/lib/deck';
import { createMockDeckClient } from '@/lib/mock-deck-client';
import '../app/globals.css';
import '../app/outpost.css';
import './fonts.css';

const LIVE_GAME_URL = 'https://signal-range-deck.workspace-025025.chatgpt.site/';

function Demo() {
  const [client] = useState(() => createMockDeckClient());
  const [deck, setDeck] = useState(() => client.loadState());
  const [selected, setSelected] = useState<Reward | null>(null);
  const [ready, setReady] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [message, setMessage] = useState('Preparing your expedition…');
  const operation = useRef(0);

  useEffect(() => {
    let active = true;
    const restored = client.hydrate();
    setDeck(restored.state);
    setReady(true);
    setMessage(restored.notice || 'Choose a reward; spending opens the next tier.');
    const attempt = ++operation.current;
    if (restored.state.pending) void client.settleProgress(restored.state.pending.id).then(state => {
      if (active && attempt === operation.current) {
        setDeck(state);
        setMessage('Saved purchase processed once. Your collection is ready.');
      }
    });
    return () => { active = false; };
  }, [client]);

  function earn() {
    if (!ready) return;
    try {
      setDeck(client.awardMockPoints());
      setMessage('40 mock points added. Spending progress is unchanged.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Points could not be added.'); }
  }

  async function buy() {
    if (!ready || !selected) return;
    try {
      const reward = selected;
      const purchased = client.purchase(reward.id);
      const attempt = ++operation.current;
      flushSync(() => {
        setDeck(purchased); setSelected(null);
        setMessage(`${reward.name} acquired. Updating deck progress…`);
      });
      const settled = await client.settleProgress(purchased.pending!.id);
      if (attempt !== operation.current) return;
      const unlocked = TIERS.find(tier => purchased.spent < tier.threshold && settled.spent >= tier.threshold);
      setDeck(settled);
      setMessage(unlocked ? `Tier ${unlocked.id} unlocked — ${unlocked.name}. Choose your next reward.` : 'Deck progress updated. Your next reward is up to you.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Purchase could not be completed.'); }
  }

  function reset() {
    operation.current++;
    setDeck(client.reset()); setSelected(null); setResetOpen(false);
    setMessage('Demo reset. 60 points ready for a new expedition.');
  }

  return <DeckView
    deck={deck} rewards={REWARDS} mode="mock" ready={ready} busy={false} connected
    selected={selected} selectedIssue={selected ? purchaseIssue(deck, selected) : null}
    resetOpen={resetOpen} message={message} connection={null}
    storageLabel={ready ? client.storageLabel() : 'Loading saved demo…'}
    assetBase={import.meta.env.BASE_URL}
    tutorialHref={`${import.meta.env.BASE_URL}battle-pass-tutorial.html`}
    onSelect={setSelected} onMode={mode => { if (mode === 'live') window.location.assign(LIVE_GAME_URL); }}
    onEarn={earn} onBuy={() => void buy()} onRefresh={() => {}}
    onReset={reset} onResetOpen={setResetOpen}
  />;
}

createRoot(document.getElementById('root')!).render(<Demo />);
