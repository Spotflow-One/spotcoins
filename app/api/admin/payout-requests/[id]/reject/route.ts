import { AppError } from "@/lib/errors";
import { error, success } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { payoutRequestService } from "@/lib/services/payoutRequestService";

export const POST = requireAdmin(async (_request, context, session) => {
  try {
    const id = context.params?.id;
    if (!id) {
      throw new AppError("Missing id", "INVALID_REQUEST", 400);
    }
    await payoutRequestService.reject(session.user.id, session.user.workspaceId, id);
    return success({ ok: true });
  } catch (err) {
    return error(err);
  }
});
