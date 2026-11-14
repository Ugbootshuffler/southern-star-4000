# Southern Star 4000

A retro, 1990s cable-TV "local forecast" style weather display for **Australia**.
Default location is **Shell Cove, NSW 2529**; any Australian town, suburb or postcode can be searched.

This is an unofficial fan project. It is **not** affiliated with or endorsed by the Bureau of
Meteorology (BOM) or The Weather Channel.

It is a modified copy of [WeatherStar 4000+](https://github.com/netbymatt/ws4kp) by Matt Walsh (MIT),
starting from the Open-Meteo based [ws4kp-international](https://github.com/mwood77/ws4kp-international)
fork by Michael Wood (MIT). See [LICENSE](LICENSE) and `views/credits.html`.

## What changed from upstream

* **Data:** US National Weather Service replaced. Forecasts and current conditions come from
  [Open-Meteo](https://open-meteo.com/) (free, no key, CC BY 4.0, works from the browser).
  Units: °C, km/h, hPa, metres; times in the location's own time zone (e.g. AEDT, AWST).
* **Optional BOM data** (Settings → "BOM data (personal use only)", off by default): real BOM
  station observations, BOM forecast text, fire danger and BOM warnings, fetched by the browser from
  `api.weather.bom.gov.au`. That API is unofficial and states it "must not be used, copied or shared",
  so keep it off for any public deployment unless you have BOM's permission.
* **Screens:** Hazards/Warnings (BOM only), Current Conditions, Latest Observations / Nearby
  Conditions, Hourly Forecast, Hourly Graph, Travel Forecast (Australian capitals and big towns),
  Local Forecast, Extended Forecast, Almanac (sunrise/sunset, moon), Local Radar
  ([RainViewer](https://www.rainviewer.com/api.html)), Marine Forecast and Air Quality (Open-Meteo).
  US-only screens (NWS alerts, SPC outlook, US regional map) were removed.
* **Search:** Esri ArcGIS geocoder restricted to Australia; nearby towns from a bundled GeoNames list
  (no third-party proxy).
* **Branding:** all Weather Channel / WeatherStar logos removed and replaced with the Southern Star
  4000 logo. Upstream's streamed Weatherscan/TWC music (Webamp) removed.
* **Music:** 14 smooth-jazz / lounge tracks by Kevin MacLeod (incompetech.com, CC BY 4.0) bundled in
  `server/music/` and played on shuffle with the speaker button. Credits page: `credits.html`.

## Run locally

Requires Node.js 18+.

```sh
npm ci
npm start                 # development: http://localhost:8080 (PORT=xxxx to change)
npm run build             # builds the static site into ./docs
DIST=1 npm start          # serve the built ./docs folder
# or any static server, e.g.
python3 -m http.server 8080 --directory docs
```

Useful URL parameters: `?settings-bomData-checkbox=true` (turn on BOM data),
`?latLonQuery=Kiama%2C%20NSW&latLon=%7B%22lat%22%3A-34.67%2C%22lon%22%3A150.85%7D` (location),
`?kiosk=true` (full-window kiosk mode). "Copy Permalink" on the page builds these for you.

Headless test helpers (Python + Playwright): `tools/capture.py`, `tools/shoot.py`, `tools/search_test.py`.

## Deploy (free static hosting)

The built site in `docs/` is plain HTML/JS/CSS with no server code, so any static host works.
It uses relative paths, so it also works from a sub-folder such as `https://<user>.github.io/<repo>/`.
About 55 MB, mostly the music.

### Option A: GitHub Pages (recommended, matches the original project)
1. Create a free GitHub account and a new **public** repository (e.g. `southern-star-4000`).
2. Push this folder to it (including the built `docs/` folder):
   `git remote add origin https://github.com/<you>/southern-star-4000.git && git push -u origin main`
3. On GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, branch `main`,
   folder `/docs`. Save.
4. After a minute the site is live at `https://<you>.github.io/southern-star-4000/`.
   Re-run `npm run build`, commit and push to update it.

### Option B: Cloudflare Pages
1. Sign in to Cloudflare (free) → **Workers & Pages → Create → Pages**.
2. Either connect the GitHub repo (build command `npm run build`, output directory `docs`)
   or choose **Direct upload** and drag in the `docs` folder.

### Option C: Netlify
Drag and drop the `docs` folder on <https://app.netlify.com/drop>, or connect the repo with
build command `npm run build` and publish directory `docs`.

## Licences and attribution

* Code: MIT (see LICENSE). Keep the copyright notices for Matt Walsh and Michael Wood.
* Forecast data: Open-Meteo, CC BY 4.0 (attribution shown on the page and credits page).
  If Open-Meteo can't be reached the page falls back to MET Norway (api.met.no, CC BY 4.0), then to the
  last forecast saved on the device (up to 6 hours old). Optional feeds (marine, air quality, radar, BOM)
  fail soft and never stop the main forecast.
* Leaflet 1.9.4 is bundled (server/scripts/vendor/leaflet, BSD-2) instead of loaded from a CDN, so
  content blockers can't break the radar.
  Open-Meteo's free API is for non-commercial use (under 10,000 calls/day per user).
* Radar: RainViewer public Weather Maps API: free for personal, educational and small-scale community use; a visible "RainViewer" credit with a link is required (shown under the display).
* Towns: GeoNames, CC BY 4.0.
* Music: Kevin MacLeod, CC BY 4.0 (credit on the credits page; do not remove it).
* Fonts/icons: inherited from WeatherStar 4000+ (TWCClassics community); see `server/fonts/ReadMe.txt`.
