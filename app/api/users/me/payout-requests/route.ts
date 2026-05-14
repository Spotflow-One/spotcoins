import { z } from "zod";
import { error, success } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { payoutRequestService } from "@/lib/services/payoutRequestService";

const createSchema = z.object({
  tokenAmount: z.number().int().min(1),
  currency: z.enum(["NGN", "GHS"]),
});

export const GET = requireAuth(async (_request, _context, session) => {
  try {
    const rows = await payoutRequestService.listMine(session.user.id);
    return success(rows);
  } catch (err) {
    return error(err);
  }
});

export const POST = requireAuth(async (request, _context, session) => {
  try {
    const body = createSchema.parse(await request.json());
    const row = await payoutRequestService.createRequest(session.user.id, session.user.workspaceId, {
      tokenAmount: body.tokenAmount,
      currency: body.currency,
    });
    return success(row);
  } catch (err) {
    return error(err);
  }
});
