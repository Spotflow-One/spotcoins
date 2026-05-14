import type { PayoutRequestCurrency, PayoutRequestDecisionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { publicFeedDisplayName } from "@/lib/publicDisplayName";

async function assertAdminAccess(adminId: string, workspaceId: string) {
  const admin = await prisma.user.findFirst({
    where: {
      id: adminId,
      workspaceId,
      role: "ADMIN",
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!admin) {
    throw new AppError("Admin user not found in workspace", "ADMIN_NOT_FOUND", 403);
  }
}

async function pendingTokenSum(userId: string) {
  const agg = await prisma.payoutRequest.aggregate({
    where: { userId, status: "PENDING" },
    _sum: { tokenAmount: true },
  });
  return agg._sum.tokenAmount ?? 0;
}

export const payoutRequestService = {
  async updatePayoutBank(
    userId: string,
    data: {
      payoutBankName: string | null;
      payoutBankAccountName: string | null;
      payoutBankAccountNumber: string | null;
    },
  ) {
    const institution = data.payoutBankName?.trim() || null;
    const holder = data.payoutBankAccountName?.trim() || null;
    const number = data.payoutBankAccountNumber?.replace(/\s/g, "") || null;
    if (institution && institution.length > 120) {
      throw new AppError("Bank name is too long", "INVALID_REQUEST", 400);
    }
    if (holder && holder.length > 120) {
      throw new AppError("Account holder name is too long", "INVALID_REQUEST", 400);
    }
    if (number && !/^[0-9]{10}$/.test(number)) {
      throw new AppError("Account number must be exactly 10 digits", "INVALID_REQUEST", 400);
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        payoutBankName: institution,
        payoutBankAccountName: holder,
        payoutBankAccountNumber: number,
      },
      select: {
        payoutBankName: true,
        payoutBankAccountName: true,
        payoutBankAccountNumber: true,
      },
    });
  },

  async listMine(userId: string) {
    return prisma.payoutRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tokenAmount: true,
        currency: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
      },
    });
  },

  async createRequest(
    userId: string,
    workspaceId: string,
    input: { tokenAmount: number; currency: PayoutRequestCurrency },
  ) {
    const user = await prisma.user.findFirst({
      where: { id: userId, workspaceId, deletedAt: null },
      select: {
        spotTokensEarned: true,
        payoutBankName: true,
        payoutBankAccountName: true,
        payoutBankAccountNumber: true,
      },
    });
    if (!user) {
      throw new AppError("User not found", "USER_NOT_FOUND", 404);
    }
    if (
      !user.payoutBankName?.trim() ||
      !user.payoutBankAccountName?.trim() ||
      !user.payoutBankAccountNumber?.trim()
    ) {
      throw new AppError("Add your bank account details in Wallet before requesting a payout", "BANK_REQUIRED", 400);
    }
    if (input.tokenAmount < 1) {
      throw new AppError("Request at least 1 token", "INVALID_AMOUNT", 400);
    }

    const pending = await pendingTokenSum(userId);
    const available = user.spotTokensEarned - pending;
    if (input.tokenAmount > available) {
      throw new AppError(
        `You can request at most ${available} tokens (${pending} already in pending requests)`,
        "INSUFFICIENT_TOKENS",
        400,
      );
    }

    return prisma.payoutRequest.create({
      data: {
        workspaceId,
        userId,
        tokenAmount: input.tokenAmount,
        currency: input.currency,
        status: "PENDING",
      },
      select: {
        id: true,
        tokenAmount: true,
        currency: true,
        status: true,
        createdAt: true,
      },
    });
  },

  async listWorkspaceBalances(workspaceId: string) {
    const users = await prisma.user.findMany({
      where: { workspaceId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        spotTokensEarned: true,
      },
      orderBy: { name: "asc" },
    });

    const pendingByUser = await prisma.payoutRequest.groupBy({
      by: ["userId"],
      where: { workspaceId, status: "PENDING" },
      _sum: { tokenAmount: true },
    });
    const pendingMap = new Map(
      pendingByUser.map((row) => [row.userId, row._sum.tokenAmount ?? 0]),
    );

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      feedDisplayName: publicFeedDisplayName({ username: u.username, email: u.email }),
      spotTokensEarned: u.spotTokensEarned,
      pendingPayoutTokens: pendingMap.get(u.id) ?? 0,
    }));
  },

  async listWorkspaceRequests(workspaceId: string, status?: PayoutRequestDecisionStatus) {
    return prisma.payoutRequest.findMany({
      where: { workspaceId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            payoutBankAccountName: true,
            payoutBankAccountNumber: true,
            payoutBankName: true,
          },
        },
      },
    });
  },

  async approve(adminId: string, workspaceId: string, requestId: string) {
    await assertAdminAccess(adminId, workspaceId);

    await prisma.$transaction(async (tx) => {
      const req = await tx.payoutRequest.findFirst({
        where: { id: requestId, workspaceId, status: "PENDING" },
        include: {
          user: {
            select: {
              id: true,
              spotTokensEarned: true,
              payoutBankName: true,
              payoutBankAccountName: true,
              payoutBankAccountNumber: true,
            },
          },
        },
      });
      if (!req) {
        throw new AppError("Request not found or already resolved", "NOT_FOUND", 404);
      }
      if (req.user.spotTokensEarned < req.tokenAmount) {
        throw new AppError("User no longer has enough tokens", "INSUFFICIENT_TOKENS", 400);
      }

      await tx.coinTransaction.create({
        data: {
          userId: req.userId,
          workspaceId,
          type: "PAYOUT",
          amount: -req.tokenAmount,
          referenceId: `PAYOUT_REQUEST:${req.id}`,
        },
      });

      await tx.user.update({
        where: { id: req.userId },
        data: { spotTokensEarned: { decrement: req.tokenAmount } },
      });

      await tx.payoutRequest.update({
        where: { id: req.id },
        data: {
          status: "APPROVED",
          resolvedAt: new Date(),
          resolvedById: adminId,
          snapshotBankName: req.user.payoutBankAccountName,
          snapshotBankNumber: req.user.payoutBankAccountNumber,
          snapshotBankInstitution: req.user.payoutBankName,
        },
      });
    });
  },

  async reject(adminId: string, workspaceId: string, requestId: string) {
    await assertAdminAccess(adminId, workspaceId);

    const updated = await prisma.payoutRequest.updateMany({
      where: { id: requestId, workspaceId, status: "PENDING" },
      data: {
        status: "REJECTED",
        resolvedAt: new Date(),
        resolvedById: adminId,
      },
    });
    if (updated.count === 0) {
      throw new AppError("Request not found or already resolved", "NOT_FOUND", 404);
    }
  },

  async getApprovedForPdf(workspaceId: string, requestId: string) {
    const row = await prisma.payoutRequest.findFirst({
      where: { id: requestId, workspaceId, status: "APPROVED" },
      include: {
        user: { select: { name: true, email: true } },
        workspace: {
          select: {
            companyLegalName: true,
            name: true,
            tokenValueNaira: true,
            tokenValueGhs: true,
          },
        },
      },
    });
    if (!row) {
      throw new AppError("Approved payout request not found", "NOT_FOUND", 404);
    }
    return row;
  },
};
