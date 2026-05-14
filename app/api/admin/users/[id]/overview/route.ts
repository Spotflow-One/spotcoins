import { z } from "zod";
import { AppError } from "@/lib/errors";
import { error, success } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { adminUserOverviewService } from "@/lib/services/adminUserOverviewService";

const querySchema = z.object({
  recognitionPage: z.coerce.number().int().min(1).optional(),
  recognitionPageSize: z.coerce.number().int().min(1).max(50).optional(),
  coinTxPage: z.coerce.number().int().min(1).optional(),
  coinTxPageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const GET = requireAdmin(async (request, context, session) => {
  try {
    const userId = context.params?.id;
    if (!userId) {
      throw new AppError("Missing user id", "INVALID_REQUEST", 400);
    }

    const { searchParams } = new URL(request.url);
    const q = querySchema.parse({
      recognitionPage: searchParams.get("recognitionPage") ?? undefined,
      recognitionPageSize: searchParams.get("recognitionPageSize") ?? undefined,
      coinTxPage: searchParams.get("coinTxPage") ?? undefined,
      coinTxPageSize: searchParams.get("coinTxPageSize") ?? undefined,
    });

    const data = await adminUserOverviewService.getOverview(session.user.id, userId, session.user.workspaceId, {
      recognitionPage: q.recognitionPage,
      recognitionPageSize: q.recognitionPageSize,
      coinTxPage: q.coinTxPage,
      coinTxPageSize: q.coinTxPageSize,
    });

    return success(data);
  } catch (err) {
    return error(err);
  }
});
