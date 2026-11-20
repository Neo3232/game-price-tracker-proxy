// Vercel serverless proxy for game artwork — Game Price Tracker Public
// The user's phone/network DNS cannot resolve Steam's or Epic's domains
// at all (net::ERR_NAME_NOT_RESOLVED), so browsers on that network can
// never load art directly from those CDNs. Prices already work because
// they go through this proxy server-side; this endpoint does the same
// for pictures: the tracker page asks this proxy for the image, the
// proxy fetches it from the art CDN, and the browser only ever talks
// to game-price-tracker-proxy.vercel.app (which resolves fine).
// Only forwards to a small allow-list of game-art hosts, only images,
// max ~4 MB (Vercel serverless response limit). No personal data.

const ALLOWED_HOSTS = new Set([
  // Steam art CDNs
  "cdn.cloudflare.steamstatic.com",
  "shared.fastly.steamstatic.com",
  "cdn.akamai.steamstatic.com",
  "shared.akamai.steamstatic.com",
  // Epic art CDNs
  "cdn1.epicgames.com",
  "cdn2.unrealengine.com",
  "store-site-backend-static.ak.epicgames.com",
  // Other stores the tracker shows art from
  "images.gog-statics.com",
  "images.greenmangaming.com",
  "www.cheapshark.com",
  "cdn.cheapshark.com",
]);

const MAX_BYTES = 4 * 1024 * 1024;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const raw = String(req.query.u || "");
  if (!raw) return res.status(400).json({ error: "Missing u param" });
  let upstream;
  try {
    upstream = new URL(raw);
  } catch {
    return res.status(400).json({ error: "Bad u param" });
  }
  if (upstream.protocol !== "https:") {
    return res.status(400).json({ error: "Only https upstream URLs" });
  }
  if (!ALLOWED_HOSTS.has(upstream.hostname.toLowerCase())) {
    return res.status(400).json({ error: "Host not allowed" });
  }

  try {
    const upstreamRes = await fetch(upstream, {
      headers: {
        "User-Agent": "GamePriceTracker-Public/1.0 (Vercel proxy; contact: kingneo011@gmail.com)",
        Accept: "image/*",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({ error: "Upstream did not answer ok" });
    }
    const type = upstreamRes.headers.get("content-type") || "";
    if (!type.startsWith("image/")) {
      return res.status(502).json({ error: "Upstream did not return an image" });
    }
    const len = Number(upstreamRes.headers.get("content-length") || 0);
    if (len > MAX_BYTES) {
      return res.status(502).json({ error: "Image too large" });
    }
    const buf = Buffer.from(await upstreamRes.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      return res.status(502).json({ error: "Image too large" });
    }
    // Art barely changes: cache at the edge for a day.
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=86400");
    res.setHeader("Content-Type", type.split(";")[0]);
    res.setHeader("Content-Length", String(buf.length));
    return res.status(200).send(buf);
  } catch (err) {
    return res.status(502).json({ error: "Art host did not answer", detail: String(err.message || err) });
  }
}
