export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const backendUrl = process.env.BACKEND_URL;

  if (!backendUrl) {
    return res.status(500).json({
      error: "BACKEND_URL is not configured",
    });
  }

  try {
    const authorization = req.headers.authorization;
    const requestId = req.headers["x-request-id"] || req.headers["x-correlation-id"] || `req_${crypto.randomUUID().slice(0, 8)}`;
    res.setHeader("x-request-id", requestId);

    const upstream = await fetch(`${backendUrl.replace(/\/$/, "")}/api/workspace`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const responseText = await upstream.text();

    res.status(upstream.status);

    const contentType = upstream.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      try {
        return res.json(JSON.parse(responseText));
      } catch {
        return res.json({
          error: "Invalid JSON returned by backend",
        });
      }
    }

    return res.send(responseText);
  } catch (error) {
    console.error("Workspace proxy failed:", error?.message);

    return res.status(502).json({
      error: "Backend request failed",
    });
  }
}
