import { error, success } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { payoutRequestService } from "@/lib/services/payoutRequestService";

export const GET = requireAdmin(async (_request, _context, session) => {
  try {
    const rows = await payoutRequestService.listWorkspaceBalances(session.user.workspaceId);
    return success(rows);
  } catch (err) {
    return error(err);
  }
});
