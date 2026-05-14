import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { publicFeedDisplayName } from "@/lib/publicDisplayName";
import { recognitionService } from "@/lib/services/recognitionService";
import { startOfZonedMonth, startOfZonedNextMonth } from "@/lib/zonedRange";

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

function zonedNowParts(timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(new Date());
  const n = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { year: n("year"), month: n("month") };
}

export type AdminUserOverviewQuery = {
  recognitionPage?: number;
  recognitionPageSize?: number;
  coinTxPage?: number;
  coinTxPageSize?: number;
};

export const adminUserOverviewService = {
  async getOverview(
    adminId: string,
    targetUserId: string,
    workspaceId: string,
    query: AdminUserOverviewQuery = {},
  ) {
    await assertAdminAccess(adminId, workspaceId);

    const target = await prisma.user.findFirst({
      where: { id: targetUserId, workspaceId },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        avatarUrl: true,
        role: true,
        coinsToGive: true,
        spotTokensEarned: true,
        lastActiveAt: true,
        deletedAt: true,
        position: { select: { id: true, name: true } },
        workspace: { select: { timezone: true } },
      },
    });

    if (!target) {
      throw new AppError("User not found", "USER_NOT_FOUND", 404);
    }

    const tz = target.workspace.timezone ?? "Africa/Lagos";
    const { year, month } = zonedNowParts(tz);
    const monthStart = startOfZonedMonth(tz, year, month);
    const monthEndExclusive = startOfZonedNextMonth(tz, year, month);

    const [sentAgg, receivedAgg] = await Promise.all([
      prisma.recognition.aggregate({
        where: {
          workspaceId,
          senderId: targetUserId,
          createdAt: { gte: monthStart, lt: monthEndExclusive },
        },
        _sum: { coinAmount: true },
      }),
      prisma.recognition.aggregate({
        where: {
          workspaceId,
          recipientId: targetUserId,
          createdAt: { gte: monthStart, lt: monthEndExclusive },
        },
        _sum: { coinAmount: true },
      }),
    ]);

    const recPage = Math.max(1, query.recognitionPage ?? 1);
    const recSize = Math.min(50, Math.max(1, query.recognitionPageSize ?? 20));
    const history = await recognitionService.getUserHistory(targetUserId, workspaceId, {
      direction: "both",
      page: recPage,
      pageSize: recSize,
    });

    const txPage = Math.max(1, query.coinTxPage ?? 1);
    const txSize = Math.min(100, Math.max(1, query.coinTxPageSize ?? 25));
    const txSkip = (txPage - 1) * txSize;

    const [coinTransactions, coinTxTotal] = await Promise.all([
      prisma.coinTransaction.findMany({
        where: { userId: targetUserId, workspaceId },
        orderBy: { createdAt: "desc" },
        skip: txSkip,
        take: txSize,
        select: {
          id: true,
          type: true,
          amount: true,
          referenceId: true,
          createdAt: true,
        },
      }),
      prisma.coinTransaction.count({
        where: { userId: targetUserId, workspaceId },
      }),
    ]);

    return {
      profile: {
        id: target.id,
        name: target.name,
        email: target.email,
        feedDisplayName: publicFeedDisplayName({ username: target.username, email: target.email }),
        avatarUrl: target.avatarUrl,
        role: target.role,
        coinsToGive: target.coinsToGive,
        spotTokensEarned: target.spotTokensEarned,
        lastActiveAt: target.lastActiveAt?.toISOString() ?? null,
        deletedAt: target.deletedAt?.toISOString() ?? null,
        position: target.position,
      },
      coinsSentThisMonth: sentAgg._sum.coinAmount ?? 0,
      coinsReceivedThisMonth: receivedAgg._sum.coinAmount ?? 0,
      recognitions: history.items,
      recognitionMeta: history.meta,
      coinTransactions: coinTransactions.map((row) => ({
        id: row.id,
        type: row.type,
        amount: row.amount,
        referenceId: row.referenceId,
        createdAt: row.createdAt.toISOString(),
      })),
      coinTransactionMeta: {
        page: txPage,
        pageSize: txSize,
        total: coinTxTotal,
      },
    };
  },
};
