import { error, success } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { triggerRecognitionFridayForWorkspace } from "@/lib/jobs/recognitionFriday";

export const POST = requireAdmin(async (_request, _context, session) => {
  try {
    const result = await triggerRecognitionFridayForWorkspace(session.user.workspaceId, {
      ignoreSchedule: true,
    });
    return success(result);
  } catch (err) {
    return error(err);
  }
});
