import { AppError } from "@/lib/errors";
import { error, success } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { userService } from "@/lib/services/userService";

export const DELETE = requireAdmin(async (_request, context, session) => {
  try {
    const userId = context.params?.id;
    if (!userId) {
      throw new AppError("Missing user id", "INVALID_REQUEST", 400);
    }

    const result = await userService.deleteUser(
      session.user.id,
      userId,
      session.user.workspaceId,
    );

    return success(result);
  } catch (err) {
    return error(err);
  }
});
