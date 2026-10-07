# Signal Range battle-pass prototype

Read the developer tutorial: **[HTML version](battle-pass-tutorial.html)** or [Markdown version](docs/sa-content-studio/content/battle-pass-tutorial.md). The HTML includes navigation, code examples, configuration screenshots, and an AGS registration link. Open it in a browser; GitHub's file view shows HTML source.

To rebuild the HTML after editing the Markdown, install the generator dependencies with `python -m pip install -r scripts/tutorial-requirements.txt`, then run `python scripts/build-battle-pass-tutorial.py`. The output uses local media and needs no hosted assets or frontend build.

Source: [sites/signal-range](sites/signal-range/README.md). It provides automatic AGS player login and 180 server-granted starter points per player/season, enough for all nine rewards. Purchases unlock Tier 3 at 100 points spent. AGS Orders remains the purchase history; D1 only coordinates starter grants.

Both apps now use the outpost presentation, tier tabs, reward details, and an owned-only Collection view. Choose Offline demo for a 60-point local walkthrough without AGS credentials. The tutorial explains navigation, reward purchases, and spending-based access.

The [prototype](prototype/README.md) variant uses manual Device ID login and operator funding.

Copy the chosen app's `.env.example` to `.env.local` and supply your own environment and catalog IDs. Public `NEXT_PUBLIC_*` values are embedded at build time; confidential credentials stay in server settings. The source defaults are synthetic; configure your AGS environment before using live mode.

Run `npm ci`, `npm test`, `npm run typecheck`, and `npm run build` from the chosen app directory. See its README for database setup and deployment configuration.

Run `python scripts/check-public-source.py` to check distributable source. Use `python scripts/export-public-source.py` to create a source archive from the working tree, excluding ignored files and Git history.
