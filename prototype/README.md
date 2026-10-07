# Signal Range reward deck

The refreshed outpost interface uses **Reward deck** tier tabs (First contact, Perimeter, Last signal), a separate **Collection** view for owned rewards, and a reward-detail dialog before confirmation. Locked and acquired rewards remain inspectable; eligibility controls confirmation. The top wallet shows available points, while Season spending tracks tier access at 40 and 100 points independently of ownership.

Choose **Offline demo** for a credential-free preview. A reset demo starts at 60 points. Buy Field radio (10) and Ridge pack (30), wait for progress, then expect 20 available, 40 spent, two collected, and Tier 2 access. **Earn 40 points** changes only the mock wallet; **Reset demo** clears only mock state. Live mode uses **Refresh progress** for reconciliation.

Presentation lives in `components/deck-view.tsx` and `app/outpost.css`; `app/page.tsx` owns state and service interactions. Runtime artwork lives in `public/art/signal-range/`.

This app combines a three-tier AGS deck with automatic Device ID login and server-funded starter points. The browser generates and persists its own random demo device credential before login, restores the same player on return, and keeps the player access token in memory. Offline mock mode remains explicit.

On connection, authenticated POST /api/deck/bootstrap grants 180 RDP once per player and season on this Site. Set AGS_STARTER_POINTS server-side to change the amount for new grants (180–10000). Existing grants retain their original amount. 180 covers all nine rewards; Tier 3 opens after 100 points of purchases. Funding never increments spending or grants rewards directly.

The Sites server verifies the user token before any grant. Its confidential client needs Platform Store / Wallet (m_platform_store / g_wallet) READ and UPDATE, plus the existing Orders READ and Statistics CREATE/READ/UPDATE. Runtime credentials belong in Sites environment settings; secrets never enter browser code. POST /api/deck/login uses the public client for token minting. The narrow /api/deck/player bridge forwards only verified-player deck operations with that player's token, supporting same-origin player requests.

AGS credit has no inspected idempotency guarantee. D1 stores only the starter-grant reservation and completion status, with a unique namespace/season/player key. Concurrent requests cannot issue a second credit. If the credit response or completion write is lost, a retry checks AGS wallet transactions for the matching credit reason and amount. Unknown outcomes remain blocked rather than blindly minting more points. A server interrupted after reservation but before submission can require operator review; no exactly-once delivery guarantee is claimed. Explicit upstream rejections release the reservation for a safe retry.

AGS Orders remains the sole purchase history. There is no Cloud Save receipt ledger or D1 purchase ledger. Spending reconciliation validates and deduplicates fulfilled fixed-price deck orders and publishes the absolute total with Statistics MAX. Refunds, repeatable items, real money, and indefinite order retention are outside this demo's contract.

Run npm test, npm run typecheck, npm run db:generate, and npm run build. D1 migrations live in drizzle/ and are included in the deployment archive; the Sites publisher applies them before uploading the Worker. For a local preview, apply unapplied SQL with Wrangler against GRANTS_DB using dist/server/wrangler.json and .wrangler/state, then run npm run dev.


Copy `.env.example` to ignored `.env.local` and supply your own namespace, public client ID, and all nine `NEXT_PUBLIC_AGS_ITEM_*` values. `AGS_BASE_URL` and `AGS_NAMESPACE` must match their public counterparts. `NEXT_PUBLIC_*` values are embedded into client and server bundles at build time; rebuild after changes and provide these public values to the build environment for hosted deployment. Never put confidential credentials in public variables. Source defaults are synthetic and use `example.invalid`, so live mode requires your AGS configuration. Offline mock mode needs no AGS credentials.

`hosting.config.json` defines the portable `GRANTS_DB` binding. Account-specific `.openai/hosting.json` is ignored and remains local. Builds work without it; publishing to Sites requires your own account metadata and runtime credentials. Tests use synthetic order/player identifiers.

## GitHub Pages demo

Run `npm run build:pages` to build the game UI into `../dist-pages/`. From the repository root, run `python scripts/package-github-pages.py` to include the tutorial and its screenshots. The game connects automatically, and **Tutorial** opens `battle-pass-tutorial.html` on the same site.

`static-demo/live-game.tsx` retrieves public catalog configuration from `/api/deck/config` and supplies the backend origin to the existing AGS adapter. Backend routes allow the `https://accelbyte.github.io` browser origin through `lib/deck-cors.ts`; player verification and operation allowlists still apply. Tokens stay in memory, cross-origin requests omit cookies, and server credentials remain server-only. Set the API origin and allowed game origin for your own deployment. Editable source stays on `main`; compiled output belongs on `gh-pages`.
