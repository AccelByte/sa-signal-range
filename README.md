# Signal Range battle-pass prototype

**[Play the demo](https://accelbyte.github.io/sa-signal-range/)** · **[Developer tutorial](https://accelbyte.github.io/sa-signal-range/battle-pass-tutorial.html)**

Choose rewards, spend points, and unlock the next tier. The demo connects your player automatically and starts with 180 points. Its **Tutorial** button opens the implementation guide.

The [prototype source](prototype/README.md) contains the current UI, the offline demo, and the AGS implementation. Live mode provides automatic player login and 180 server-granted starter points per player and season. AGS Orders supplies purchase history; Statistics tracks validated spending; D1 coordinates starter grants.

## Development

From `prototype/`, run `npm ci`, `npm test`, `npm run typecheck`, and `npm run build`. Live development requires your own AGS environment and catalog mapping: copy `.env.example` to `.env.local` and follow the app README. Confidential credentials belong in server settings.

The tutorial is available as [HTML](battle-pass-tutorial.html) and [Markdown](docs/sa-content-studio/content/battle-pass-tutorial.md). To rebuild it:

```sh
python -m pip install -r scripts/tutorial-requirements.txt
python scripts/build-battle-pass-tutorial.py
```

## GitHub Pages

`main` contains editable source. `gh-pages` contains the compiled browser demo, tutorial, and public media. GitHub Pages serves the game UI. Authenticated requests go to the deck backend, which verifies player identity, prepares starter points, and reconciles AGS spending. The player stays on the Pages address.

Build the Pages package from the repository root:

```sh
cd prototype
npm ci
npm run build:pages
cd ..
python scripts/package-github-pages.py
```

Publish the contents of `dist-pages/` to the `gh-pages` branch. In repository **Settings → Pages**, choose **Deploy from a branch**, **gh-pages**, and **/ (root)**. The project URL is `https://accelbyte.github.io/sa-signal-range/`.

Run `python scripts/check-public-source.py` before publishing source. `python scripts/export-public-source.py` exports current public files without ignored local configuration or Git history.
