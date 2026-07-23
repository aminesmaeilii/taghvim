export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const configuredSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && !configuredSecret) return res.status(500).json({ error: "CRON_SECRET is not configured." });
  if (configuredSecret && req.headers.authorization !== `Bearer ${configuredSecret}`) return res.status(401).json({ error: "Unauthorized." });
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) return res.status(500).json({ error: "BACKEND_URL is not configured." });
  const response = await fetch(`${backendUrl.replace(/\/$/, "")}/api/workspace`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method: "runMonitoringCollection", args: ["DAILY", null, null] }),
  });
  const payload = await response.json().catch(() => null);
  return res.status(response.status).json(payload);
}
