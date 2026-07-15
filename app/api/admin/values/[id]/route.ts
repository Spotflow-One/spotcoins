import { z } from "zod";
import { AppError } from "@/lib/errors";
import { error, success } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { workspaceService } from "@/lib/services/workspaceService";

const updateValueSchema = z.object({
  name: z.string().min(1).optional(),
  emoji: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = requireAdmin(async (request, context, session) => {
  try {
    const valueId = context.params?.id;
    if (!valueId) {
      throw new AppError("Missing value id", "INVALID_REQUEST", 400);
    }

    const payload = updateValueSchema.parse(await request.json());
    const value = await workspaceService.updateValue(
      session.user.id,
      valueId,
      session.user.workspaceId,
      payload,
    );
    return success(value);
  } catch (err) {
    return error(err);
  }
});

export const DELETE = requireAdmin(async (_request, context, session) => {
  try {
    const valueId = context.params?.id;
    if (!valueId) {
      throw new AppError("Missing value id", "INVALID_REQUEST", 400);
    }

    const result = await workspaceService.deleteValue(
      session.user.id,
      valueId,
      session.user.workspaceId,
    );
    return success(result);
  } catch (err) {
    return error(err);
  }
});
