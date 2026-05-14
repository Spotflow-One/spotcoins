import { z } from "zod";
import { error, success } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { workspaceService } from "@/lib/services/workspaceService";

const recognitionScheduleValues = ["EVERY_FRIDAY", "LAST_FRIDAY"] as const;

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).optional(),
  companyLegalName: z.string().max(200).nullable().optional(),
  monthlyAllowance: z.number().int().min(1).optional(),
  tokenValueNaira: z.number().int().min(1).optional(),
  tokenValueGhs: z.number().int().min(0).optional(),
  targetChannelId: z.string().nullable().optional(),
  recognitionSchedule: z.enum(recognitionScheduleValues).optional(),
  timezone: z.string().min(1).optional(),
  onboardingComplete: z.boolean().optional(),
});

export const GET = requireAdmin(async (_request, _context, session) => {
  try {
    const workspace = await workspaceService.getWorkspace(session.user.workspaceId);
    return success(workspace);
  } catch (err) {
    return error(err);
  }
});

export const PATCH = requireAdmin(async (request, _context, session) => {
  try {
    const payload = updateWorkspaceSchema.parse(await request.json());
    const workspace = await workspaceService.updateWorkspace(
      session.user.id,
      session.user.workspaceId,
      payload,
    );
    return success(workspace);
  } catch (err) {
    return error(err);
  }
});
