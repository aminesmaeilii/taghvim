import { handleUpload } from "@vercel/blob/client";

type HttpRequest = {
  method?: string;
  headers: { origin?: string; authorization?: string };
  body: unknown;
};

type HttpResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void; end(): void };
};

export default async function handler(req: HttpRequest, res: HttpResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const uploadSecret = process.env.BLOB_UPLOAD_SECRET;
  if (process.env.NODE_ENV === "production" && !uploadSecret) return res.status(500).json({ error: "BLOB_UPLOAD_SECRET is not configured" });
  if (uploadSecret && req.headers.authorization !== `Bearer ${uploadSecret}`) return res.status(401).json({ error: "Unauthorized" });

  try {
    const jsonResponse = await handleUpload({
      body: req.body as never,
      request: req as never,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
        maximumSizeInBytes: 50 * 1024 * 1024,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {},
    });
    return res.status(200).json(jsonResponse);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Upload failed" });
  }
}
