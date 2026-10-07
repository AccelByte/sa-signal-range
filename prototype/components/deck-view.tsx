'use client';

import { useState, type ReactNode } from 'react';
import { ArrowRight, Check, ChevronRight, Compass, LoaderCircle, LockKeyhole, Plus, Radio, RotateCcw, Signal, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { REWARDS, SEASON_NAME, TIERS, type DeckState, type Reward } from '@/lib/deck';

type Props = {
  deck: DeckState;
  rewards: readonly Reward[];
  mode: 'live' | 'mock';
  ready: boolean;
  busy: boolean;
  connected: boolean;
  player?: string;
  message: string;
  selected: Reward | null;
  selectedIssue: string | null;
  resetOpen: boolean;
  storageLabel: string;
  tutorialHref?: string;
  assetBase?: string;
  connection: ReactNode;
  onSelect: (reward: Reward | null) => void;
  onMode: (mode: 'live' | 'mock') => void;
  onEarn: () => void;
  onRefresh: () => void;
  onBuy: () => void;
  onReset: () => void;
  onResetOpen: (open: boolean) => void;
};

function EquipmentArt({ reward, className = '' }: { reward: Reward; className?: string }) {
  const index = REWARDS.findIndex((item) => item.id === reward.id);
  const position = `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%`;
  return <span className={`equipment-art ${className}`} style={{ backgroundPosition: position }} aria-hidden="true" />;
}

export function DeckView(props: Props) {
  const { deck, rewards, mode, ready, busy, connected, selected, selectedIssue } = props;
  const [activeTier, setActiveTier] = useState(1);
  const [view, setView] = useState<'deck' | 'collection'>('deck');
  const tier = TIERS.find((item) => item.id === activeTier)!;
  const nextTier = TIERS.find((item) => deck.spent < item.threshold);
  const visibleRewards = view === 'collection' ? rewards.filter((reward) => deck.owned.includes(reward.id)) : rewards.filter((reward) => reward.tier === activeTier);
  const ownedInTier = rewards.filter((reward) => reward.tier === activeTier && deck.owned.includes(reward.id)).length;

  return <main className="outpost-shell">
    <div className="outpost-backdrop" aria-hidden="true" />
    <header className="outpost-topbar">
      <a className="outpost-brand" href="#season-title"><Signal size={28} aria-hidden="true" /><span>OUTPOST<small>FIELD OPERATIONS</small></span></a>
      <nav className="outpost-nav" aria-label="Reward views">
        <button aria-pressed={view === 'deck'} onClick={() => setView('deck')}>Reward deck</button>
        <button aria-pressed={view === 'collection'} onClick={() => setView('collection')}>Collection <span>{deck.owned.length.toString().padStart(2, '0')}</span></button>
        {props.tutorialHref && <a href={props.tutorialHref}>Tutorial <ArrowRight size={14} aria-hidden="true" /></a>}
      </nav>
      <div className="outpost-wallet"><Zap size={18} aria-hidden="true" /><strong>{connected ? deck.balance : '—'}</strong><span>PTS</span></div>
      <span className={`player-indicator ${connected ? 'is-connected' : ''}`}><span />{mode === 'mock' ? 'OFFLINE DEMO' : connected ? `PLAYER ${props.player?.slice(0, 8)}` : busy ? 'CONNECTING' : 'DISCONNECTED'}</span>
    </header>

    <div className="outpost-content">
      <section className="expedition-stage" aria-labelledby="season-title">
        <div className="deck-workspace">
          <div className="season-heading"><p className="eyebrow"><span className="signal-dot" />SEASON 01 <span>/</span> FIELD COLLECTION</p><h1 id="season-title">{SEASON_NAME}</h1><p className="season-caption"><span />Follow the signal. Make your own way.</p></div>
          {!connected ? <section className="connection-card" aria-label="Player connection">{props.connection}</section> : <>
            {view === 'deck' ? <div className="tier-tabs" role="group" aria-label="Choose a tier">{TIERS.map((item) => <button key={item.id} aria-pressed={activeTier === item.id} onClick={() => setActiveTier(item.id)}><strong>0{item.id}</strong><span>{item.id === 2 ? 'Perimeter' : item.id === 3 ? 'Last signal' : item.name}</span>{deck.spent < item.threshold ? <LockKeyhole size={14} aria-label="Locked" /> : <Check size={14} aria-label="Accessible" />}</button>)}</div> : <div className="collection-heading"><h2>Your field collection</h2><span>{deck.owned.length} / 9 ACQUIRED</span></div>}
            <div className="deck-context"><span>{view === 'collection' ? 'Equipment secured for the expedition.' : tier.note}</span><span>{view === 'collection' ? 'SEASON 01' : `${ownedInTier} / 3 COLLECTED`}</span></div>
            {visibleRewards.length > 0 ? <div className={`equipment-grid ${view === 'collection' ? 'collection-grid' : ''}`}>{visibleRewards.map((reward) => {
              const owned = deck.owned.includes(reward.id);
              const locked = deck.spent < TIERS[reward.tier - 1].threshold;
              return <button key={reward.id} className={`equipment-card ${owned ? 'equipment-owned' : ''} ${locked ? 'equipment-locked' : ''}`} onClick={() => props.onSelect(reward)} aria-label={`${reward.name}, ${reward.cost} points, ${owned ? 'owned' : locked ? 'tier locked, view reward' : 'view reward'}`}>
                <span className="equipment-topline"><span>S01 / {String(REWARDS.findIndex((item) => item.id === reward.id) + 1).padStart(2, '0')}</span>{owned ? <Check size={16} /> : locked ? <LockKeyhole size={15} /> : <Plus size={16} />}</span>
                <EquipmentArt reward={reward} />
                <span className="equipment-meta"><span className="equipment-category">{reward.category}</span><strong>{reward.name}</strong><span className="equipment-bottom"><span>{owned ? <><Check size={13} /> ACQUIRED</> : <><Zap size={13} /> {reward.cost} <small>PTS</small></>}</span><span className="equipment-arrow"><ArrowRight size={18} /></span></span></span>
              </button>;
            })}</div> : <div className="empty-collection"><Compass size={32} aria-hidden="true" /><h3>Your expedition starts here.</h3><p>Choose a reward from the deck to begin your collection.</p><button className="primary-button" onClick={() => setView('deck')}>Explore the deck <ArrowRight size={17} /></button></div>}
            {view === 'deck' && <div className={`tier-access ${deck.spent < tier.threshold ? 'tier-access-locked' : ''}`}><span>{deck.spent < tier.threshold ? <LockKeyhole size={15} /> : <Radio size={15} />}{deck.spent < tier.threshold ? `Spend ${tier.threshold - deck.spent} more points to access this tier.` : 'Your choice. Select any reward to view and acquire it.'}</span><ChevronRight size={16} aria-hidden="true" /></div>}
          </>}
        </div>

        <aside className="character-stage" aria-label="Signal Range expedition scout">
          <div className="character-orbit" aria-hidden="true" />
          <img className="scout-character" src={`${props.assetBase ?? '/'}art/signal-range/scout-v1.png`} alt="Signal Range scout in a weathered blue and orange field jacket with a yellow expedition pack" fetchPriority="high" />
          <div className="field-coordinate" aria-hidden="true"><span>RELAY / 001</span><span>TRANSMISSION ACTIVE</span><span className="coordinate-cross">+</span></div>
          <div className="character-caption"><span className="character-badge"><Compass size={16} aria-hidden="true" /> EXPEDITION SCOUT</span><strong>The wayfinder</strong><p>Somewhere beyond the perimeter,<br />a signal is still calling.</p></div>
        </aside>
      </section>

      <section className="season-progress" aria-label="Season progress">
        <div className="progress-title"><span className="eyebrow">SEASON SPENDING</span><strong>{deck.spent}<small>PTS</small></strong></div>
        <div className="progress-route"><div className="route-label"><span>{nextTier ? `Next access · Tier 0${nextTier.id}` : 'Every route is open'}</span><span>{nextTier ? `${deck.spent} / ${nextTier.threshold} PTS` : 'ALL TIERS ACCESSIBLE'}</span></div><Progress value={nextTier ? Math.min(100, deck.spent / nextTier.threshold * 100) : 100} aria-label={nextTier ? `Tier ${nextTier.id} access progress` : 'All tiers accessible'} /><div className="route-milestones"><span className="milestone-open">01 · CONTACT</span><span className={deck.spent >= 40 ? 'milestone-open' : ''}>02 · 40 PTS</span><span className={deck.spent >= 100 ? 'milestone-open' : ''}>03 · 100 PTS</span></div></div>
        <div className="progress-collection"><strong>{deck.owned.length}<span>/ 9</span></strong><span>COLLECTED</span></div>
        <button className="primary-button progress-action" disabled={!ready || busy || !connected || !!deck.pending} onClick={mode === 'mock' ? props.onEarn : props.onRefresh}>{mode === 'mock' ? <><Plus size={17} /> Earn 40 points</> : <><RotateCcw size={17} className={busy ? 'spinner' : ''} /> Refresh progress</>}</button>
      </section>

      <div className={`status-line ${deck.pending ? 'is-pending' : ''}`} role="status" aria-live="polite" aria-atomic="true">{deck.pending || busy ? <LoaderCircle className="spinner" size={14} aria-hidden="true" /> : <Signal size={14} aria-hidden="true" />}<span>{props.message}</span></div>
      <footer className="outpost-footer"><div className="mode-controls" aria-label="Connection mode"><button className="quiet-button" aria-pressed={mode === 'live'} disabled={mode === 'live' && connected} onClick={() => props.onMode('live')}>Live AGS</button><button className="quiet-button" aria-pressed={mode === 'mock'} onClick={() => props.onMode('mock')}>Offline demo</button></div><p>{deck.owned.length === 9 ? 'Collection complete. All nine rewards secured.' : 'Choose rewards. Spend points. Open the next route.'}<span>{mode === 'live' ? 'Signal Range · Season 01' : props.storageLabel}</span></p>{mode === 'mock' && <AlertDialog open={props.resetOpen} onOpenChange={props.onResetOpen}><AlertDialogTrigger className="quiet-button"><RotateCcw size={14} aria-hidden="true" />Reset demo</AlertDialogTrigger><AlertDialogContent><AlertDialogTitle>Start a new expedition?</AlertDialogTitle><AlertDialogDescription>Reset your demo to 60 points, zero spending and no rewards. Pending mock progress will be cancelled.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Keep collection</AlertDialogCancel><button className="primary-button" onClick={props.onReset}>Reset demo</button></AlertDialogFooter></AlertDialogContent></AlertDialog>}</footer>
    </div>

    <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) props.onSelect(null); }}><DialogContent className="reward-dialog">{selected && <><div className="detail-art"><EquipmentArt reward={selected} /><span>FIELD COLLECTION / SEASON 01</span></div><p className="eyebrow">TIER 0{selected.tier} / {selected.category}</p><DialogTitle>{selected.name}</DialogTitle><DialogDescription>{selected.description}</DialogDescription><div className="purchase-breakdown"><div><span>Reward cost</span><strong>{selected.cost} PTS</strong></div><div><span>Available balance</span><strong>{deck.balance} PTS</strong></div><div><span>Balance after purchase</span><strong>{deck.balance >= selected.cost ? `${deck.balance - selected.cost} PTS` : 'Insufficient points'}</strong></div></div>{selectedIssue && <p className="purchase-notice">{selectedIssue}</p>}<button className="primary-button purchase-button" disabled={!ready || busy || !!selectedIssue} onClick={props.onBuy}>{deck.owned.includes(selected.id) ? <><Check size={17} />Already acquired</> : <>Confirm purchase · {selected.cost} PTS<ArrowRight size={17} /></>}</button>{mode === 'mock' && deck.balance < selected.cost && !deck.owned.includes(selected.id) && <button className="quiet-button" disabled={!ready} onClick={props.onEarn}><Plus size={16} />Earn 40 demo points</button>}<p className="dialog-footnote">{mode === 'live' ? 'Points are charged when your reward is fulfilled.' : 'Offline demo · progress updates after a brief delay.'}</p></>}</DialogContent></Dialog>
  </main>;
}
