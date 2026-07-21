import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import workspaceHandler from "./routes/workspace";

const PORT = Number(process.env.PORT ?? 3000);

type RenderRequest = {
  method?: string;
  headers: { origin?: string };
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
      headers: { origin: Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin },
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

    if (url.pathname === "/health") {
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (url.pathname !== "/api/workspace") {
      res.statusCode = 404;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Not found." }));
      return;
    }

    const body = await readBody(req);
    const adapter = createAdapter(req, res, body);
    await workspaceHandler(adapter.req, adapter.res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected backend error." }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Taghvim backend listening on port ${PORT}`);
});
