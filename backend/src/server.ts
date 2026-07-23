import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import authHandler from "./routes/auth.js";
import workspaceHandler from "./routes/workspace.js";

const PORT = Number(process.env.PORT || 3000);

type RenderRequest = {
  method?: string;
  headers: { origin?: string; authorization?: string; "user-agent"?: string; "x-request-id"?: string; "x-correlation-id"?: string };
  body: unknown;
};

type RenderResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): {
    json(body: unknown): void;
    end(): void;
  };
};

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function createAdapter(req: IncomingMessage, res: ServerResponse, body: unknown): { req: RenderRequest; res: RenderResponse } {
  return {
    req: {
      method: req.method,
      headers: {
        origin: Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin,
        authorization: Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization,
        "user-agent": Array.isArray(req.headers["user-agent"]) ? req.headers["user-agent"][0] : req.headers["user-agent"],
        "x-request-id": Array.isArray(req.headers["x-request-id"]) ? req.headers["x-request-id"][0] : req.headers["x-request-id"],
        "x-correlation-id": Array.isArray(req.headers["x-correlation-id"]) ? req.headers["x-correlation-id"][0] : req.headers["x-correlation-id"],
      },
      body,
    },
    res: {
      setHeader(name, value) {
        res.setHeader(name, value);
      },
      status(code) {
        res.statusCode = code;
        return {
          json(payload) {
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify(payload));
          },
          end() {
            res.end();
          },
        };
      },
    },
  };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/health" || url.pathname === "/health/live") {
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: true, service: "taghvim-backend" }));
      return;
    }

    if (url.pathname === "/health/ready") {
      const hasRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
      const production = process.env.NODE_ENV === "production";
      const ready = !production || hasRedis;
      res.statusCode = ready ? 200 : 503;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        ok: ready,
        service: "taghvim-backend",
        persistence: hasRedis ? "upstash-redis" : "local-file",
        checks: { persistentStorage: hasRedis || !production },
      }));
      return;
    }

    if (url.pathname === "/health/version") {
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        applicationVersion: process.env.APP_VERSION ?? "0.1.1",
        commitSha: process.env.COMMIT_SHA ?? null,
        buildTimestamp: process.env.BUILD_TIMESTAMP ?? null,
        environment: process.env.NODE_ENV ?? "development",
      }));
      return;
    }

    if (url.pathname !== "/api/workspace" && url.pathname !== "/api/auth") {
      res.statusCode = 404;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Not found." }));
      return;
    }

    const body = await readBody(req);
    const adapter = createAdapter(req, res, body);
    if (url.pathname === "/api/auth") await authHandler(adapter.req, adapter.res);
    else await workspaceHandler(adapter.req, adapter.res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected backend error." }));
  }
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Taghvim backend listening on port ${PORT}`);
});
