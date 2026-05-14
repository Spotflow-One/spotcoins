import { z } from "zod";
import { error, success } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { payoutRequestService } from "@/lib/services/payoutRequestService";

const bodySchema = z.object({
  payoutBankName: z.string().nullable(),
  payoutBankAccountName: z.string().nullable(),
  payoutBankAccountNumber: z
    .string()
    .nullable()
    .transform((s) => (s == null ? null : s.replace(/\s/g, ""))),
});

export const PATCH = requireAuth(async (request, _context, session) => {
  try {
    const body = bodySchema.parse(await request.json());
    const data = await payoutRequestService.updatePayoutBank(session.user.id, {
      payoutBankName: body.payoutBankName,
      payoutBankAccountName: body.payoutBankAccountName,
      payoutBankAccountNumber: body.payoutBankAccountNumber,
    });
    return success(data);
  } catch (err) {
    return error(err);
  }
});
