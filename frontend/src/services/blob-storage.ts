import { upload } from "@vercel/blob/client";
import { API_BASE_URL } from "./api-config";

export async function uploadFile(file: File, pathname: string, onProgress?: (percentage: number) => void): Promise<string> {
  const blob = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: `${API_BASE_URL}/api/blob-upload`,
    onUploadProgress: onProgress ? (event) => onProgress(event.percentage) : undefined,
  });
  return blob.url;
}
