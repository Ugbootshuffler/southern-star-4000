# World Wire feed proxy

GitHub Pages cannot read most of the news RSS feeds in the browser (CORS). This worker fetches BBC, Guardian, Al Jazeera, NPR and Fox and returns JSON at `/api/wire`. The 8kun / "Notables" feed from Monitor Light is not included.

## Live

The worker is deployed as `southern-star-wire`:

https://southern-star-wire.ugbootshuffler.workers.dev/api/wire

The GitHub Pages site uses that URL by default (`server/scripts/modules/utils/worldwire-api.mjs`). You can still override it with `?wireApi=` or `window.WORLD_WIRE_URL`.

## Local

`npm start` still serves the same JSON at `http://localhost:8080/api/wire` through Express, which is useful when developing the aggregator. The static site will call the live worker unless you override the URL.

## Redeploy

Upload `workers/world-wire.mjs` as a module Worker named `southern-star-wire` (see `wrangler.toml`, compatibility_date `2026-11-18`). CORS allows `https://ugbootshuffler.github.io` (`Access-Control-Allow-Origin: *`).
