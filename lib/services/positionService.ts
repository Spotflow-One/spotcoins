import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

export const DEFAULT_POSITIONS = [
  "Head of Product",
  "Head of Engineering",
  "Frontend Lead",
  "Backend Lead",
  "Frontend Developer",
  "Backend Developer",
  "Product Designer",
  "Head of Operations",
  "Operations",
  "Marketing",
  "Product Design Intern",
  "Intern",
] as const;

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

type PositionUpdateInput = Partial<{
  name: string;
  isActive: boolean;
  sortOrder: number;
}>;

export const positionService = {
  async listForWorkspace(workspaceId: string) {
    return prisma.position.findMany({
      where: { workspaceId },
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
  },

  async create(adminId: string, workspaceId: string, data: { name: string }) {
    await assertAdminAccess(adminId, workspaceId);

    const trimmed = data.name.trim();
    if (!trimmed) {
      throw new AppError("Position name is required", "INVALID_REQUEST", 400);
    }

    const existing = await prisma.position.findUnique({
      where: { workspaceId_name: { workspaceId, name: trimmed } },
      select: { id: true, isActive: true },
    });

    if (existing) {
      if (!existing.isActive) {
        return prisma.position.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
      }
      throw new AppError("Position already exists", "POSITION_DUPLICATE", 409);
    }

    const max = await prisma.position.aggregate({
      where: { workspaceId },
      _max: { sortOrder: true },
    });

    return prisma.position.create({
      data: {
        workspaceId,
        name: trimmed,
        isActive: true,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
  },

  async update(
    adminId: string,
    positionId: string,
    workspaceId: string,
    data: PositionUpdateInput,
  ) {
    await assertAdminAccess(adminId, workspaceId);

    const existing = await prisma.position.findFirst({
      where: { id: positionId, workspaceId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError("Position not found", "POSITION_NOT_FOUND", 404);
    }

    const updateData: PositionUpdateInput = {};
    if (typeof data.name === "string") {
      const trimmed = data.name.trim();
      if (!trimmed) {
        throw new AppError("Position name is required", "INVALID_REQUEST", 400);
      }
      updateData.name = trimmed;
    }
    if (typeof data.isActive === "boolean") {
      updateData.isActive = data.isActive;
    }
    if (typeof data.sortOrder === "number") {
      updateData.sortOrder = data.sortOrder;
    }

    return prisma.position.update({
      where: { id: positionId },
      data: updateData,
    });
  },

  async remove(adminId: string, positionId: string, workspaceId: string) {
    await assertAdminAccess(adminId, workspaceId);

    const inUse = await prisma.user.count({
      where: { workspaceId, positionId, deletedAt: null },
    });
    if (inUse > 0) {
      throw new AppError(
        "Reassign users off this position before deleting it",
        "POSITION_IN_USE",
        400,
      );
    }

    const existing = await prisma.position.findFirst({
      where: { id: positionId, workspaceId },
      select: { id: true },
    });
    if (!existing) {
      throw new AppError("Position not found", "POSITION_NOT_FOUND", 404);
    }

    await prisma.position.delete({ where: { id: positionId } });
  },

  async toggle(adminId: string, positionId: string, workspaceId: string) {
    await assertAdminAccess(adminId, workspaceId);

    const existing = await prisma.position.findFirst({
      where: { id: positionId, workspaceId },
    });

    if (!existing) {
      throw new AppError("Position not found", "POSITION_NOT_FOUND", 404);
    }

    return prisma.position.update({
      where: { id: positionId },
      data: { isActive: !existing.isActive },
    });
  },

  async assignToUser(
    adminId: string,
    targetUserId: string,
    workspaceId: string,
    positionId: string | null,
  ) {
    await assertAdminAccess(adminId, workspaceId);

    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, workspaceId, deletedAt: null },
      select: { id: true },
    });

    if (!targetUser) {
      throw new AppError("Target user not found", "USER_NOT_FOUND", 404);
    }

    if (positionId) {
      const position = await prisma.position.findFirst({
        where: { id: positionId, workspaceId },
        select: { id: true },
      });

      if (!position) {
        throw new AppError("Position not found", "POSITION_NOT_FOUND", 404);
      }
    }

    return prisma.user.update({
      where: { id: targetUserId },
      data: { positionId },
      select: {
        id: true,
        name: true,
        position: { select: { id: true, name: true } },
      },
    });
  },

  async ensureDefaultPositions(workspaceId: string) {
    const existing = await prisma.position.findMany({
      where: { workspaceId },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((item) => item.name.toLowerCase()));

    const toCreate = DEFAULT_POSITIONS.map((name, index) => ({ name, sortOrder: index + 1 }))
      .filter((item) => !existingNames.has(item.name.toLowerCase()));

    if (toCreate.length === 0) return;

    await prisma.position.createMany({
      data: toCreate.map((item) => ({
        workspaceId,
        name: item.name,
        sortOrder: item.sortOrder,
        isActive: true,
      })),
      skipDuplicates: true,
    });
  },
};
