import { randomBytes } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { Resend } from "resend";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resendFromAddress } from "@/lib/resendFrom";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { publicFeedDisplayName } from "@/lib/publicDisplayName";
import { hashResetToken } from "@/lib/services/passwordResetService";
import { recognitionService, type RecognitionHistoryFilters } from "@/lib/services/recognitionService";

const resendClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const INVITE_LINK_TTL_HOURS = 72;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;

const getMeSelect = {
  id: true,
  email: true,
  name: true,
  username: true,
  avatarUrl: true,
  role: true,
  workspaceId: true,
  coinsToGive: true,
  spotTokensEarned: true,
  payoutStatus: true,
  payoutBankName: true,
  payoutBankAccountName: true,
  payoutBankAccountNumber: true,
  workspace: {
    select: { name: true, tokenValueNaira: true, tokenValueGhs: true },
  },
} as const satisfies Prisma.UserSelect;

type UserMeRow = Prisma.UserGetPayload<{ select: typeof getMeSelect }>;

function toMeResponse(user: UserMeRow) {
  return {
    ...user,
    feedDisplayName: publicFeedDisplayName({ username: user.username, email: user.email }),
  };
}

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

export const userService = {
  async listWorkspaceUsers(adminId: string, workspaceId: string) {
    await assertAdminAccess(adminId, workspaceId);

    const rows = await prisma.user.findMany({
      where: { workspaceId },
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
        position: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => ({
      ...row,
      feedDisplayName: publicFeedDisplayName({ username: row.username, email: row.email }),
    }));
  },

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: getMeSelect,
    });

    if (!user) {
      throw new AppError("User not found", "USER_NOT_FOUND", 404);
    }

    return toMeResponse(user);
  },

  async updateOwnUsername(userId: string, username: string | null) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { workspaceId: true },
      });
      if (!user) {
        throw new AppError("User not found", "USER_NOT_FOUND", 404);
      }

      if (username === null || username.trim() === "") {
        await tx.user.update({ where: { id: userId }, data: { username: null } });
        const row = await tx.user.findUnique({ where: { id: userId }, select: getMeSelect });
        if (!row) {
          throw new AppError("User not found", "USER_NOT_FOUND", 404);
        }
        return toMeResponse(row);
      }

      const trimmed = username.trim();
      if (!USERNAME_PATTERN.test(trimmed)) {
        throw new AppError(
          "Username must be 3–30 characters and use only letters, numbers, and underscores",
          "INVALID_USERNAME",
          400,
        );
      }

      const clash = await tx.user.findFirst({
        where: {
          workspaceId: user.workspaceId,
          id: { not: userId },
          deletedAt: null,
          username: { equals: trimmed, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (clash) {
        throw new AppError("That username is already taken in your workspace", "USERNAME_TAKEN", 409);
      }

      await tx.user.update({
        where: { id: userId },
        data: { username: trimmed },
      });

      const row = await tx.user.findUnique({ where: { id: userId }, select: getMeSelect });
      if (!row) {
        throw new AppError("User not found", "USER_NOT_FOUND", 404);
      }
      return toMeResponse(row);
    });
  },

  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
    const newTrimmed = newPassword.trim();
    if (newTrimmed.length < 8) {
      throw new AppError("Password must be at least 8 characters", "VALIDATION_ERROR", 400);
    }
    if (newTrimmed === currentPassword) {
      throw new AppError("New password must differ from current password", "VALIDATION_ERROR", 400);
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new AppError("User not found", "USER_NOT_FOUND", 404);
    }

    const ok = await compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new AppError("Current password is incorrect", "INVALID_CURRENT_PASSWORD", 400);
    }

    const passwordHash = await hash(newTrimmed, 12);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
    });
  },

  async searchUsers(workspaceId: string, query: string) {
    return prisma.user.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        email: true,
      },
      orderBy: { name: "asc" },
      take: 20,
    });
  },

  async listRecognitionRecipients(workspaceId: string, excludeUserId: string) {
    return prisma.user.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        id: { not: excludeUserId },
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        email: true,
      },
      orderBy: { name: "asc" },
      take: 500,
    });
  },

  async getUserRecognitions(userId: string, workspaceId: string, filters: RecognitionHistoryFilters) {
    return recognitionService.getUserHistory(userId, workspaceId, filters);
  },

  async invite(adminId: string, email: string, workspaceId: string) {
    await assertAdminAccess(adminId, workspaceId);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new AppError("Email is required", "VALIDATION_ERROR", 400);
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (existingUser) {
      throw new AppError("A user with this email already exists", "EMAIL_IN_USE", 409);
    }

    const temporaryPassword = randomBytes(8).toString("hex");
    const passwordHash = await hash(temporaryPassword, 12);

    const createdUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: normalizedEmail.split("@")[0] || "New User",
        passwordHash,
        role: "EMPLOYEE",
        workspaceId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        coinsToGive: true,
      },
    });

    const rawInviteToken = randomBytes(32).toString("base64url");
    const inviteTokenHash = hashResetToken(rawInviteToken);
    const inviteExpiresAt = new Date(Date.now() + INVITE_LINK_TTL_HOURS * 60 * 60 * 1000);

    await prisma.passwordResetToken.deleteMany({ where: { userId: createdUser.id } });
    await prisma.passwordResetToken.create({
      data: {
        userId: createdUser.id,
        tokenHash: inviteTokenHash,
        expiresAt: inviteExpiresAt,
      },
      select: { id: true },
    });

    const inviteUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(rawInviteToken)}`;

    if (resendClient) {
      try {
        await resendClient.emails.send({
          from: resendFromAddress(),
          to: normalizedEmail,
          subject: "You're invited to Spotcoin",
          text: [
            "You've been invited to Spotcoin.",
            "",
            `Set your password to activate your account (expires in ${INVITE_LINK_TTL_HOURS} hours):`,
            inviteUrl,
            "",
            "If you were not expecting this invite, you can ignore this email.",
          ].join("\n"),
        });
      } catch (err) {
        await prisma.user.delete({ where: { id: createdUser.id } }).catch(() => {});
        console.error("[invite] Failed to send invite email", err);
        throw new AppError("Could not send invite email. Please try again.", "INVITE_EMAIL_FAILED", 502);
      }
    } else {
      console.warn("[invite] RESEND_API_KEY not set; created user without sending invite email");
    }

    return createdUser;
  },

  async grantBonusCoins(
    adminId: string,
    targetUserId: string,
    workspaceId: string,
    amount: number,
    reason?: string,
  ) {
    await assertAdminAccess(adminId, workspaceId);

    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, workspaceId, deletedAt: null },
      select: { id: true },
    });

    if (!targetUser) {
      throw new AppError("Target user not found", "USER_NOT_FOUND", 404);
    }

    return prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: targetUserId },
        data: { coinsToGive: { increment: amount } },
        select: {
          id: true,
          name: true,
          coinsToGive: true,
        },
      });

      await tx.coinTransaction.create({
        data: {
          userId: targetUserId,
          workspaceId,
          type: "BONUS_GRANT",
          amount,
          referenceId: reason ? `BONUS:${reason}` : undefined,
        },
      });

      return updatedUser;
    });
  },

  async deactivate(adminId: string, targetUserId: string, workspaceId: string) {
    await assertAdminAccess(adminId, workspaceId);

    const target = await prisma.user.findFirst({
      where: { id: targetUserId, workspaceId, deletedAt: null },
      select: { role: true },
    });
    if (!target) {
      throw new AppError("Target user not found", "USER_NOT_FOUND", 404);
    }
    if (target.role === "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { workspaceId, deletedAt: null, role: "ADMIN" },
      });
      if (adminCount <= 1) {
        throw new AppError("Cannot remove the last admin in the workspace", "LAST_ADMIN", 400);
      }
    }

    const result = await prisma.user.updateMany({
      where: { id: targetUserId, workspaceId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      throw new AppError("Target user not found", "USER_NOT_FOUND", 404);
    }
    return result;
  },

  async updateRole(adminId: string, targetUserId: string, workspaceId: string, role: Role) {
    await assertAdminAccess(adminId, workspaceId);

    const updated = await prisma.user.updateMany({
      where: { id: targetUserId, workspaceId, deletedAt: null },
      data: { role },
    });

    if (updated.count === 0) {
      throw new AppError("Target user not found", "USER_NOT_FOUND", 404);
    }

    return prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });
  },
};
