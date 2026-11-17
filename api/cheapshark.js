// Vercel serverless proxy for CheapShark — Game Price Tracker Public
// Only forwards to CheapShark's public, keyless API. No personal data,
// no user input beyond the allow-listed CheapShark query params.
// Sets a descriptive User-Agent (CheapShark rejects generic ones with 400)
// and Access-Control-Allow-Origin: * so the shareable tracker page can
// fetch live prices from any browser.

const ALLOWED = new Set(["deals", "games", "stores", "alerts"]);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=300");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const endpoint = String(req.query.endpoint || "deals");
  if (!ALLOWED.has(endpoint)) {
    return res.status(400).json({ error: "Unknown endpoint" });
  }

  // Allow-listed CheapShark params only — nothing else is forwarded.
  const allowedParams = [
    "pageNumber", "pageSize", "sortBy", "desc", "lowerPrice", "upperPrice",
    "steamAppID", "title", "exact", "storeID", "metacritic", "onSale",
    "AAA", "id", "ids", "steamRating", "limit",
  ];
  const upstream = new URL(`https://www.cheapshark.com/api/1.0/${endpoint}`);
  for (const key of allowedParams) {
    const v = req.query[key];
    if (v !== undefined) upstream.searchParams.set(key, String(v));
  }
  if (endpoint === "deals" && !upstream.searchParams.has("pageSize")) {
    upstream.searchParams.set("pageSize", "60");
  }

  try {
    const upstreamRes = await fetch(upstream, {
      headers: {
        "User-Agent": "GamePriceTracker-Public/1.0 (Vercel proxy; contact: kingneo011@gmail.com)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12000),
    });
    const text = await upstreamRes.text();
    res.status(upstreamRes.status);
    res.setHeader("Content-Type", "application/json");
    return res.send(text);
  } catch (err) {
    return res.status(502).json({ error: "CheapShark did not answer", detail: String(err.message || err) });
  }
}
