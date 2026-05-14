import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStore } from "@netlify/blobs";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

const MAX_BYTES = 1_500_000;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function extForMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function getBlobStore() {
  const token = env.NETLIFY_BLOB_READ_WRITE_TOKEN;
  const siteID = env.NETLIFY_SITE_ID;
  if (!token || !siteID) {
    throw new AppError(
      "NETLIFY_BLOB_READ_WRITE_TOKEN and NETLIFY_SITE_ID must both be set for uploads",
      "BLOBS_NOT_CONFIGURED",
      503,
    );
  }
  return getStore({
    name: "event-covers",
    consistency: "strong",
    token,
    siteID,
  });
}

export async function storeEventCoverImage(input: {
  workspaceId: string;
  buffer: Buffer;
  contentType: string;
  publicBaseUrl: string;
}): Promise<string> {
  if (input.buffer.length > MAX_BYTES) {
    throw new AppError("Image must be under 1.5 MB", "FILE_TOO_LARGE", 400);
  }
  if (!ALLOWED.has(input.contentType)) {
    throw new AppError("Use JPEG, PNG, or WebP", "INVALID_TYPE", 400);
  }

  const ext = extForMime(input.contentType);
  const key = `${input.workspaceId}/${randomUUID()}.${ext}`;

  if (env.NETLIFY_BLOB_READ_WRITE_TOKEN && env.NETLIFY_SITE_ID) {
    const store = getBlobStore();
    const ab = input.buffer.buffer.slice(
      input.buffer.byteOffset,
      input.buffer.byteOffset + input.buffer.byteLength,
    ) as ArrayBuffer;
    await store.set(key, ab, { metadata: { contentType: input.contentType } });
    return `${input.publicBaseUrl.replace(/\/$/, "")}/api/events/cover?k=${encodeURIComponent(key)}`;
  }

  if (process.env.NODE_ENV === "production") {
    throw new AppError(
      "Image uploads require NETLIFY_BLOB_READ_WRITE_TOKEN and NETLIFY_SITE_ID in production",
      "BLOBS_NOT_CONFIGURED",
      503,
    );
  }

  const dir = path.join(process.cwd(), "public", "uploads", "events", input.workspaceId);
  await mkdir(dir, { recursive: true });
  const file = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, file), input.buffer);
  return `${input.publicBaseUrl.replace(/\/$/, "")}/uploads/events/${input.workspaceId}/${file}`;
}

export async function readEventCoverImage(
  key: string,
  workspaceId: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!key.startsWith(`${workspaceId}/`)) {
    return null;
  }

  if (env.NETLIFY_BLOB_READ_WRITE_TOKEN && env.NETLIFY_SITE_ID) {
    try {
      const store = getBlobStore();
      const meta = await store.getWithMetadata(key, { type: "arrayBuffer" });
      if (!meta) return null;
      const contentType =
        (meta.metadata.contentType as string | undefined) ?? "application/octet-stream";
      return { buffer: Buffer.from(meta.data), contentType };
    } catch {
      return null;
    }
  }

  const full = path.join(process.cwd(), "public", "uploads", "events", key);
  try {
    const { readFile } = await import("node:fs/promises");
    const buffer = await readFile(full);
    const contentType =
      key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return { buffer, contentType };
  } catch {
    return null;
  }
}
