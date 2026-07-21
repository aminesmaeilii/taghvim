const DEFAULT_BACKEND_URL = "https://taghvim.onrender.com";
const BACKEND_URL = (process.env.BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/$/, "");
const ALLOWED_ORIGINS = new Set([
  "https://taghvim.vercel.app",
  ...(process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? []),
]);

function setCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader(
    "access-control-allow-origin",
    origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://taghvim.vercel.app",
  );
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type, authorization");
}

function safeError(error) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: "Error", message: "Unexpected Vercel function error." };
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const operation = typeof req.body?.method === "string" ? req.body.method : "unknown";
  const upstreamUrl = `${BACKEND_URL}/api/workspace`;

  try {
    console.log("[api/workspace] proxy request", { operation });

    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
        ...(req.headers.origin ? { origin: req.headers.origin } : {}),
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";
    const text = await upstream.text();

    console.log("[api/workspace] upstream response", {
      operation,
      upstreamStatus: upstream.status,
    });

    res.setHeader("content-type", contentType);
    return res.status(upstream.status).send(text);
  } catch (error) {
    const details = safeError(error);
    console.error("[api/workspace] proxy error", {
      operation,
      errorName: details.name,
      errorMessage: details.message,
    });

    return res.status(502).json({
      error: "Workspace backend is unavailable.",
      details,
    });
  }
}
