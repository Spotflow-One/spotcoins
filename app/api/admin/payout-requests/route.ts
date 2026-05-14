import { z } from "zod";
import { error, success } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { payoutRequestService } from "@/lib/services/payoutRequestService";

const querySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

export const GET = requireAdmin(async (request, _context, session) => {
  try {
    const { searchParams } = new URL(request.url);
    const q = querySchema.parse({
      status: searchParams.get("status") ?? undefined,
    });
    const rows = await payoutRequestService.listWorkspaceRequests(
      session.user.workspaceId,
      q.status,
    );
    return success(rows);
  } catch (err) {
    return error(err);
  }
});
