import { error, success } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { triggerMonthlyResetForWorkspace } from "@/lib/jobs/monthlyReset";

export const POST = requireAdmin(async (_request, _context, session) => {
  try {
    const result = await triggerMonthlyResetForWorkspace(session.user.workspaceId);
    return success(result);
  } catch (err) {
    return error(err);
  }
});
