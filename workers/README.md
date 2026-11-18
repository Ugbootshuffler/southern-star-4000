# World Wire feed proxy

GitHub Pages cannot read most of the news RSS feeds in the browser (CORS). This worker fetches BBC, Guardian, Al Jazeera, NPR and Fox and returns JSON at `/api/wire`.

## Local (this prototype)

`npm start` serves the same JSON at `http://localhost:8080/api/wire` through Express. No Cloudflare account is required.

## Later deploy (not done here)

1. A Cloudflare account and `npx wrangler login`
2. `npx wrangler deploy` from this repo (uses `wrangler.toml`)
3. Point the static site at the worker, either by setting `window.WORLD_WIRE_URL` or adding `?wireApi=https://<worker>.workers.dev/api/wire`
4. Push the `world-wire` branch and rebuild GitHub Pages when you are ready — do not deploy until Andrew says so

The 8kun / "Notables" feed from Monitor Light is not included.
