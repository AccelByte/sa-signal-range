# Signal Range AGS deck

The refreshed outpost interface uses **Reward deck** tier tabs (First contact, Perimeter, Last signal), a separate **Collection** view for owned rewards, and a reward-detail dialog before confirmation. Locked and acquired rewards remain inspectable; eligibility controls confirmation. The top wallet shows available points, while Season spending tracks tier access at 40 and 100 points independently of ownership.

Choose **Offline demo** for a credential-free preview. A reset demo starts at 60 points. Buy Field radio (10) and Ridge pack (30), wait for progress, then expect 20 available, 40 spent, two collected, and Tier 2 access. **Earn 40 points** changes only the mock wallet; **Reset demo** clears only mock state. Live mode uses **Refresh progress** for reconciliation.

Presentation lives in `components/deck-view.tsx` and `app/outpost.css`; `app/page.tsx` owns state and service interactions. Runtime artwork lives in `public/art/signal-range/`.

A synthetic equipment collection demonstrating choice-based spending progression, built with React/Vinext and a server worker. Offline demo provides a local walkthrough.

The browser signs in a disposable Device ID player through the public AGS client and creates quantity-one virtual-currency orders with that player's token. It never receives a confidential secret. The worker verifies the token through IAM, discovers authoritative fulfilled deck orders, deduplicates fulfilled orders in memory, sums their validated prices, and publishes that absolute total to Statistics with MAX. Native item Purchasing Requirements enforce thresholds 0/40/100.

Reconciliation runs on connection, before/after purchase, return/reconnect and Refresh progress. An unresolved submission marker in localStorage is only correlation for an ambiguous create response; it is not a spending ledger or proof of payment. Tokens remain in memory. Reconnect with the same Device ID after reload. Failure never activates mock mode.

Copy `.env.example` to ignored `.env.local`. Supply your namespace, public client ID, nine `NEXT_PUBLIC_AGS_ITEM_*` catalog IDs, and confidential server credentials. `AGS_BASE_URL` and `AGS_NAMESPACE` must match their public counterparts. Public configuration is embedded at build time: rebuild after changes. Source defaults use synthetic identifiers and `example.invalid`; configure your AGS environment before using live mode. Configure Commerce CORS for your own browser origin. Hosted secrets belong in server runtime settings.

Use `npm test`, `npm run typecheck`, and `npm run build`. Tests use a fully synthetic order fixture with simulated failure timing. They do not establish live AGS outcomes.

`hosting.config.json` defines portable binding names. Account-specific `.openai/hosting.json` is ignored; the Sites publishing plugin runs when that local metadata exists. A clean checkout can build without an existing hosting account.

Scope: nine permanent rewards, fixed virtual prices, one season, no refunds or gameplay funding endpoint. Test funding is operator-only. No unattended delivery is promised: if the player never returns, a committed purchase can remain unprojected until an authorized reconciliation runs. IAM permission groups are namespace-wide; the worker narrows all writes to the verified player and configured deck. Live WebMCP purchase execution is disabled; use the visible confirmation.

AGS Orders is the durable transaction source; no Cloud Save ledger is read or written. Recovery rereads order history. All configured item queries must complete before publication; errors and the bounded paging limit fail closed. MAX preserves previously projected progress when an indexed snapshot is older, but cannot reconstruct unprojected purchases if their order history is no longer available. Order retention duration is not established by the inspected API contract. Configure immutable, season-specific items; refunds and reused/repeatable rewards need a different policy. The worker needs Orders READ and Statistics CREATE/READ/UPDATE; Cloud Save permission is not required.
