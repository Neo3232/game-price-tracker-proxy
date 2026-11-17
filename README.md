# Game Price Tracker proxy (Vercel)

Tiny free serverless proxy so the shareable Game Price Tracker page can
fetch live CheapShark prices from any browser.

## What it does

- `GET /api/cheapshark?endpoint=deals&pageNumber=0&pageSize=60`
- `GET /api/cheapshark?endpoint=games&id=123456`
- `GET /api/cheapshark?endpoint=stores`
- `GET /api/cheapshark?endpoint=deals&title=elden%20ring`

Only CheapShark's public, keyless API is forwarded, with an allow-list of
query params. It sets a descriptive User-Agent (CheapShark rejects generic
ones), `Access-Control-Allow-Origin: *`, and a 5-minute edge cache.

## Deploy (free, Vercel Hobby)

1. Push this folder to a GitHub repo (or import it in Vercel).
2. In Vercel: Add New → Project → import the repo.
3. Deploy with the defaults — no environment variables, no build step.
4. Note the deployed URL, e.g. `https://game-price-tracker-proxy.vercel.app`
5. The tracker page then calls
   `https://game-price-tracker-proxy.vercel.app/api/cheapshark?endpoint=deals…`
   instead of calling CheapShark directly.
