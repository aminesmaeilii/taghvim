export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) return res.status(500).json({ error: "BACKEND_URL is not configured" });

  try {
    const authorization = req.headers.authorization;
    const requestId = req.headers["x-request-id"] || req.headers["x-correlation-id"] || `req_${crypto.randomUUID().slice(0, 8)}`;
    res.setHeader("x-request-id", requestId);
    const upstream = await fetch(`${backendUrl.replace(/\/$/, "")}/api/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
        ...(authorization ? { Authorization: authorization } : {}),
        ...(req.headers["user-agent"] ? { "User-Agent": req.headers["user-agent"] } : {}),
      },
      body: JSON.stringify(req.body ?? {}),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    try { return res.json(JSON.parse(text)); } catch { return res.send(text); }
  } catch (error) {
    console.error("Auth proxy failed:", error?.message);
    return res.status(502).json({ error: "Backend request failed" });
  }
}
