import { AppError } from "@/lib/errors";
import { error } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { readEventCoverImage } from "@/lib/eventCoverStorage";

export const GET = requireAuth(async (request, _context, session) => {
  try {
    const { searchParams } = new URL(request.url);
    const k = searchParams.get("k");
    if (!k) {
      throw new AppError("Missing key", "INVALID_REQUEST", 400);
    }
    const decoded = decodeURIComponent(k);
    const img = await readEventCoverImage(decoded, session.user.workspaceId);
    if (!img) {
      throw new AppError("Not found", "NOT_FOUND", 404);
    }
    return new Response(new Uint8Array(img.buffer), {
      headers: {
        "Content-Type": img.contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return error(err);
  }
});
