-- Bank institution (e.g. GTBank) for payout setup; snapshot on approval for PDFs
ALTER TABLE "User" ADD COLUMN "payoutBankName" TEXT;
ALTER TABLE "PayoutRequest" ADD COLUMN "snapshotBankInstitution" TEXT;
