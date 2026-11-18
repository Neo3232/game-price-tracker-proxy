// Vercel serverless proxy for Steam store prices — Game Price Tracker Public
// Only forwards to Steam's public, keyless store APIs (appdetails /
// packagedetails). No personal data, no user input beyond the allow-listed
// params below. Steam sends no CORS headers, so browsers can't call it
// directly — this proxy adds Access-Control-Allow-Origin: * so the tracker
// page can fetch real per-country Steam prices fast, instead of racing
// slow public relays that rate-limit shared IPs.

const ALLOWED_KINDS = new Set(["appdetails", "packagedetails"]);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=300");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const kind = String(req.query.kind || "appdetails");
  if (!ALLOWED_KINDS.has(kind)) {
    return res.status(400).json({ error: "Unknown kind" });
  }

  // appids: comma-separated Steam app/package ids, digits only, max 100.
  const appids = String(req.query.appids || "");
  const ids = appids.split(",").filter(Boolean);
  if (!ids.length || ids.length > 100 || !ids.every((id) => /^\d+$/.test(id))) {
    return res.status(400).json({ error: "appids must be 1-100 numeric ids" });
  }
  // cc: two-letter country code.
  const cc = String(req.query.cc || "us").toLowerCase();
  if (!/^[a-z]{2}$/.test(cc)) {
    return res.status(400).json({ error: "cc must be a two-letter country code" });
  }
  // filters: Steam appdetails filters, default price_overview only.
  const filters = String(req.query.filters || "price_overview");
  if (!/^[a-z_,]+$/.test(filters)) {
    return res.status(400).json({ error: "Invalid filters" });
  }

  const upstream = new URL(`https://store.steampowered.com/api/${kind}`);
  upstream.searchParams.set("appids", ids.join(","));
  upstream.searchParams.set("cc", cc);
  if (kind === "appdetails") upstream.searchParams.set("filters", filters);

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
    return res.status(502).json({ error: "Steam did not answer", detail: String(err.message || err) });
  }
}
