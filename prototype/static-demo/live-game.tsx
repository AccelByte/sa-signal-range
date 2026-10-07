import { useEffect, useState } from 'react';
import Home from '@/app/page';
import { REWARDS } from '@/lib/deck';
import type { AGS } from '@/lib/ags-deck-config';

const API_ORIGIN = 'https://signal-range-deck.workspace-025025.chatgpt.site';
type Config = { ags: typeof AGS; items: Record<string, string> };

export function LiveGame() {
  const [config, setConfig] = useState<Config | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    void fetch(`${API_ORIGIN}/api/deck/config`, {
      credentials: 'omit', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]),
    }).then(async response => {
      if (!response.ok) throw new Error('Configuration unavailable');
      const result = await response.json() as Config;
      if (!result.ags || !['namespace', 'publicClientId', 'currency', 'statCode'].every(key => typeof result.ags[key as keyof typeof AGS] === 'string' && result.ags[key as keyof typeof AGS]) || !REWARDS.every(reward => typeof result.items?.[reward.id] === 'string' && result.items[reward.id])) throw new Error('Invalid configuration');
      if (!controller.signal.aborted) setConfig(result);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [attempt]);

  if (config) return <Home
    liveOptions={{ apiBase: API_ORIGIN, config: config.ags, items: config.items }}
    hideModeControls assetBase={import.meta.env.BASE_URL}
    tutorialHref={`${import.meta.env.BASE_URL}battle-pass-tutorial.html`}
  />;

  return <main className="outpost-shell"><div className="outpost-backdrop" aria-hidden="true" />
    <div className="outpost-content"><div className="season-heading"><p className="eyebrow">SEASON 01 / FIELD COLLECTION</p><h1>Signal Range</h1></div>
      <section className="connection-card" aria-live="polite"><h2>{failed ? 'Your expedition is waiting.' : 'Preparing your expedition…'}</h2>
        {failed && <button className="primary-button" onClick={() => setAttempt(value => value + 1)}>Retry connection</button>}
      </section>
      <a className="quiet-button" href={`${import.meta.env.BASE_URL}battle-pass-tutorial.html`}>Tutorial</a>
    </div>
  </main>;
}
