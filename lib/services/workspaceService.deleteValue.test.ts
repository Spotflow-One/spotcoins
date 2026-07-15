import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  user: { findFirst: vi.fn() },
  companyValue: {
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
  recognition: { count: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/services/positionService", () => ({
  positionService: { ensureDefaultPositions: vi.fn() },
}));

describe("workspaceService.deleteValue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findFirst.mockResolvedValue({ id: "admin-1" });
    mockPrisma.companyValue.findFirst.mockResolvedValue({ id: "value-1" });
    mockPrisma.recognition.count.mockResolvedValue(0);
    mockPrisma.companyValue.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("permanently deletes an unused value in the admin workspace", async () => {
    const { workspaceService } = await import("@/lib/services/workspaceService");

    await expect(
      workspaceService.deleteValue("admin-1", "value-1", "ws-1"),
    ).resolves.toEqual({ id: "value-1", deleted: true });

    expect(mockPrisma.companyValue.findFirst).toHaveBeenCalledWith({
      where: { id: "value-1", workspaceId: "ws-1" },
      select: { id: true },
    });
    expect(mockPrisma.companyValue.deleteMany).toHaveBeenCalledWith({
      where: { id: "value-1", workspaceId: "ws-1" },
    });
  });

  it("rejects a value used by recognition history", async () => {
    mockPrisma.recognition.count.mockResolvedValue(2);
    const { workspaceService } = await import("@/lib/services/workspaceService");

    await expect(
      workspaceService.deleteValue("admin-1", "value-1", "ws-1"),
    ).rejects.toMatchObject({ code: "VALUE_IN_USE", statusCode: 409 });
    expect(mockPrisma.companyValue.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects a value outside the workspace", async () => {
    mockPrisma.companyValue.findFirst.mockResolvedValue(null);
    const { workspaceService } = await import("@/lib/services/workspaceService");

    await expect(
      workspaceService.deleteValue("admin-1", "other-value", "ws-1"),
    ).rejects.toMatchObject({ code: "VALUE_NOT_FOUND", statusCode: 404 });
  });

  it("requires an active admin in the workspace", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const { workspaceService } = await import("@/lib/services/workspaceService");

    await expect(
      workspaceService.deleteValue("user-1", "value-1", "ws-1"),
    ).rejects.toMatchObject({ code: "ADMIN_NOT_FOUND", statusCode: 403 });
  });
});
