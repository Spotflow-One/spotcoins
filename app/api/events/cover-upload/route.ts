import { AppError } from "@/lib/errors";
import { error, success } from "@/lib/api";
import { requireAdminOrManager } from "@/lib/auth";
import { env } from "@/lib/env";
import { storeEventCoverImage } from "@/lib/eventCoverStorage";

export const POST = requireAdminOrManager(async (request, _context, session) => {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("Missing file", "INVALID_REQUEST", 400);
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "image/jpeg";
    const url = await storeEventCoverImage({
      workspaceId: session.user.workspaceId,
      buffer: buf,
      contentType,
      publicBaseUrl: env.NEXT_PUBLIC_APP_URL,
    });
    return success({ url });
  } catch (err) {
    return error(err);
  }
});
