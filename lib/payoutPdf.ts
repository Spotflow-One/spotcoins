import PDFDocument from "pdfkit";
import type { PayoutRequestCurrency } from "@prisma/client";

export type PayoutPdfInput = {
  companyName: string;
  employeeName: string;
  employeeEmail: string;
  tokenAmount: number;
  currency: PayoutRequestCurrency;
  bankInstitution: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  fiatEstimateLabel: string;
};

export function buildPayoutApprovalPdf(input: PayoutPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(input.companyName || "Company", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text("Payout approval", { align: "center" });
    doc.moveDown(2);

    doc.fontSize(11);
    doc.text(`Name: ${input.employeeName}`);
    doc.text(`Email: ${input.employeeEmail}`);
    doc.moveDown();
    doc.text(`Tokens: ${input.tokenAmount}`);
    doc.text(`Currency: ${input.currency}`);
    doc.text(`Estimated value: ${input.fiatEstimateLabel}`);
    doc.moveDown();
    doc.text(`Bank: ${input.bankInstitution?.trim() ? input.bankInstitution : "—"}`);
    doc.text(`Account holder: ${input.bankAccountName ?? "—"}`);
    doc.text(`Account number: ${input.bankAccountNumber ?? "—"}`);
    doc.moveDown(2);
    doc.fontSize(9).fillColor("#666").text("Generated for accounts / finance. Spotcoin.", {
      align: "left",
    });

    doc.end();
  });
}
