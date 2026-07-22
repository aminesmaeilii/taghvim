import { upload } from "@vercel/blob/client";

export async function uploadFile(file: File, pathname: string, onProgress?: (percentage: number) => void): Promise<string> {
  const blob = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/blob-upload",
    onUploadProgress: onProgress ? (event) => onProgress(event.percentage) : undefined,
  });
  return blob.url;
}
