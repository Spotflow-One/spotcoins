import { AppError } from "@/lib/errors";
import { error } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { buildPayoutApprovalPdf } from "@/lib/payoutPdf";
import { payoutRequestService } from "@/lib/services/payoutRequestService";

export const GET = requireAdmin(async (_request, context, session) => {
  try {
    const id = context.params?.id;
    if (!id) {
      throw new AppError("Missing id", "INVALID_REQUEST", 400);
    }
    const row = await payoutRequestService.getApprovedForPdf(session.user.workspaceId, id);
    const companyName = row.workspace.companyLegalName?.trim() || row.workspace.name;
    const fiat =
      row.currency === "NGN"
        ? `₦${(row.tokenAmount * row.workspace.tokenValueNaira).toLocaleString("en-NG")}`
        : row.workspace.tokenValueGhs > 0
          ? `GH₵${(row.tokenAmount * row.workspace.tokenValueGhs).toLocaleString("en-GH")}`
          : "Configure token value (GHS) in Settings";

    const pdf = await buildPayoutApprovalPdf({
      companyName,
      employeeName: row.user.name,
      employeeEmail: row.user.email,
      tokenAmount: row.tokenAmount,
      currency: row.currency,
      bankInstitution: row.snapshotBankInstitution,
      bankAccountName: row.snapshotBankName,
      bankAccountNumber: row.snapshotBankNumber,
      fiatEstimateLabel: fiat,
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="payout-${id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    return error(err);
  }
});
