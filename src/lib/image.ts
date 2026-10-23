"use client";

import { createClient } from "@/lib/supabase/client";

const MAX_INPUT_BYTES = 12 * 1024 * 1024;

/**
 * Shrinks a photo in the browser before upload (receipts, payment screenshots),
 * so a 4 MB phone photo becomes ~150 KB and the free storage tier lasts.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.8): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("invalid_file");
  if (file.size > MAX_INPUT_BYTES) throw new Error("file_too_large");

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const blob = (await toBlob("image/webp")) ?? (await toBlob("image/jpeg"));
  if (!blob) throw new Error("upload_failed");
  return blob;
}

/** Compresses and uploads to a Storage bucket; returns the object path. */
export async function uploadImage(bucket: string, folder: string, file: File) {
  const blob = await compressImage(file);
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await createClient().storage.from(bucket).upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error("upload_failed");
  return path;
}
