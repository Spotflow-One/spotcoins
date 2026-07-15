import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { positionService } from "@/lib/services/positionService";

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

type WorkspaceUpdateInput = Partial<{
  name: string;
  companyLegalName: string | null;
  monthlyAllowance: number;
  tokenValueNaira: number;
  tokenValueGhs: number;
  targetChannelId: string | null;
  recognitionSchedule: string;
  timezone: string;
  onboardingComplete: boolean;
}>;

type ValueInput = {
  name: string;
  emoji: string;
  isActive?: boolean;
};

export const workspaceService = {
  async getValues(workspaceId: string) {
    return prisma.companyValue.findMany({
      where: {
        workspaceId,
        isActive: true,
      },
      orderBy: { name: "asc" },
    });
  },

  async getWorkspace(workspaceId: string) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        values: {
          orderBy: { name: "asc" },
        },
      },
    });

    if (!workspace) {
      throw new AppError("Workspace not found", "WORKSPACE_NOT_FOUND", 404);
    }

    return workspace;
  },

  async updateWorkspace(adminId: string, workspaceId: string, data: WorkspaceUpdateInput) {
    await assertAdminAccess(adminId, workspaceId);

    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data,
      include: {
        values: true,
      },
    });

    if (data.onboardingComplete === true) {
      await positionService.ensureDefaultPositions(workspaceId);
    }

    return updated;
  },

  async createValue(adminId: string, workspaceId: string, data: ValueInput) {
    await assertAdminAccess(adminId, workspaceId);

    return prisma.companyValue.create({
      data: {
        workspaceId,
        name: data.name,
        emoji: data.emoji,
        isActive: data.isActive ?? true,
      },
    });
  },

  async updateValue(
    adminId: string,
    valueId: string,
    workspaceId: string,
    data: Partial<ValueInput>,
  ) {
    await assertAdminAccess(adminId, workspaceId);

    const updated = await prisma.companyValue.updateMany({
      where: { id: valueId, workspaceId },
      data,
    });

    if (updated.count === 0) {
      throw new AppError("Company value not found", "VALUE_NOT_FOUND", 404);
    }

    return prisma.companyValue.findUnique({ where: { id: valueId } });
  },

  async toggleValue(adminId: string, valueId: string, workspaceId: string) {
    await assertAdminAccess(adminId, workspaceId);

    const existing = await prisma.companyValue.findFirst({
      where: { id: valueId, workspaceId },
    });

    if (!existing) {
      throw new AppError("Company value not found", "VALUE_NOT_FOUND", 404);
    }

    return prisma.companyValue.update({
      where: { id: valueId },
      data: { isActive: !existing.isActive },
    });
  },

  async deleteValue(adminId: string, valueId: string, workspaceId: string) {
    await assertAdminAccess(adminId, workspaceId);

    const existing = await prisma.companyValue.findFirst({
      where: { id: valueId, workspaceId },
      select: { id: true },
    });
    if (!existing) {
      throw new AppError("Company value not found", "VALUE_NOT_FOUND", 404);
    }

    const recognitionCount = await prisma.recognition.count({
      where: { valueId, workspaceId },
    });
    if (recognitionCount > 0) {
      throw new AppError(
        "This value has recognition history and cannot be deleted. Deactivate it instead.",
        "VALUE_IN_USE",
        409,
      );
    }

    const deleted = await prisma.companyValue.deleteMany({
      where: { id: valueId, workspaceId },
    });
    if (deleted.count === 0) {
      throw new AppError("Company value not found", "VALUE_NOT_FOUND", 404);
    }

    return { id: valueId, deleted: true as const };
  },
};
