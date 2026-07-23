import { toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/db";

const LAGOS_TZ = "Africa/Lagos";

const logger = {
  info: (message: string, data?: unknown) => console.info(`[monthly-reset] ${message}`, data ?? ""),
  error: (message: string, data?: unknown) =>
    console.error(`[monthly-reset] ${message}`, data ?? ""),
};

export type MonthlyResetResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  totalResetUsers: number;
};

/** True when the given instant is day 1 in Africa/Lagos. */
export function isLagosMonthStart(now = new Date()): boolean {
  const lagos = toZonedTime(now, LAGOS_TZ);
  return lagos.getDate() === 1;
}

/**
 * Refills coinsToGive for all active users. Never mutates spotTokensEarned.
 * When `requireLagosMonthStart` is true (Vercel cron), only runs on day 1 Lagos.
 */
export async function runMonthlyResetJob(options?: {
  now?: Date;
  requireLagosMonthStart?: boolean;
}): Promise<MonthlyResetResult> {
  const now = options?.now ?? new Date();
  const requireLagosMonthStart = options?.requireLagosMonthStart ?? false;

  logger.info("Job started");

  if (requireLagosMonthStart && !isLagosMonthStart(now)) {
    logger.info("Skipping: not day 1 in Africa/Lagos", { now: now.toISOString() });
    return { ok: true, skipped: true, reason: "NOT_LAGOS_MONTH_START", totalResetUsers: 0 };
  }

  const workspaces = await prisma.workspace.findMany({
    select: {
      id: true,
      monthlyAllowance: true,
    },
  });

  let totalResetUsers = 0;

  for (const workspace of workspaces) {
    try {
      const users = await prisma.user.findMany({
        where: {
          workspaceId: workspace.id,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (users.length === 0) {
        logger.info("No active users found for workspace", { workspaceId: workspace.id });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        for (const user of users) {
          await tx.user.update({
            where: { id: user.id },
            data: {
              coinsToGive: workspace.monthlyAllowance,
            },
          });

          await tx.coinTransaction.create({
            data: {
              userId: user.id,
              workspaceId: workspace.id,
              type: "ALLOWANCE_GRANT",
              amount: workspace.monthlyAllowance,
            },
          });
        }
      });

      totalResetUsers += users.length;
      logger.info("Workspace reset complete", {
        workspaceId: workspace.id,
        usersReset: users.length,
      });
    } catch (workspaceError) {
      logger.error("Workspace reset failed", {
        workspaceId: workspace.id,
        error: workspaceError instanceof Error ? workspaceError.message : "Unknown error",
      });
    }
  }

  logger.info("Job completed", { totalResetUsers });
  return { ok: true, totalResetUsers };
}
