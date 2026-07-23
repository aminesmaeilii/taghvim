export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const expected = process.env.CRON_SECRET;
  if (expected && req.headers.authorization !== `Bearer ${expected}`) return res.status(401).json({ error: "Unauthorized." });
  const backendUrl = process.env.BACKEND_URL || process.env.VITE_API_BASE_URL;
  if (!backendUrl) return res.status(500).json({ error: "BACKEND_URL is not configured." });
  const response = await fetch(`${backendUrl.replace(/\/$/, "")}/api/workspace`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method: "processDueReminders", args: [new Date().toISOString()] }),
  });
  const payload = await response.json().catch(() => null);
  return res.status(response.status).json(payload);
}
