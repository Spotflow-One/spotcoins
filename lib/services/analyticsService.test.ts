import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  workspace: {
    findUnique: vi.fn(),
  },
  recognition: {
    findMany: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  companyValue: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

describe("analyticsService.getAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.workspace.findUnique.mockResolvedValue({ timezone: "Africa/Lagos" });
  });

  it("calculates value counts correctly", async () => {
    mockPrisma.recognition.findMany.mockResolvedValue([
      { senderId: "u1", recipientId: "u2", coinAmount: 1, valueId: "v1" },
      { senderId: "u1", recipientId: "u3", coinAmount: 2, valueId: "v1" },
      { senderId: "u2", recipientId: "u1", coinAmount: 1, valueId: "v2" },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u1", name: "A", email: "a@test.com", slackUserId: null, lastActiveAt: new Date() },
      { id: "u2", name: "B", email: "b@test.com", slackUserId: null, lastActiveAt: new Date() },
      { id: "u3", name: "C", email: "c@test.com", slackUserId: null, lastActiveAt: new Date() },
    ]);
    mockPrisma.companyValue.findMany.mockResolvedValue([
      { id: "v1", name: "Ownership", emoji: "🔥" },
      { id: "v2", name: "Collaboration", emoji: "🤝" },
    ]);

    const { analyticsService } = await import("@/lib/services/analyticsService");
    const result = await analyticsService.getAnalytics("ws-1", { mode: "preset", period: "this_month" });

    expect(result.valueCounts).toEqual([
      { valueId: "v1", name: "Ownership", emoji: "🔥", count: 2 },
      { valueId: "v2", name: "Collaboration", emoji: "🤝", count: 1 },
    ]);
  });

  it("marks users disengaged when no activity and stale lastActiveAt", async () => {
    mockPrisma.recognition.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        name: "Quiet User",
        email: "quiet@test.com",
        slackUserId: null,
        lastActiveAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      },
      {
        id: "u2",
        name: "Recent User",
        email: "recent@test.com",
        slackUserId: null,
        lastActiveAt: new Date(),
      },
    ]);
    mockPrisma.companyValue.findMany.mockResolvedValue([]);

    const { analyticsService } = await import("@/lib/services/analyticsService");
    const result = await analyticsService.getAnalytics("ws-1", { mode: "preset", period: "this_month" });

    expect(result.disengaged.map((user) => user.id)).toContain("u1");
    expect(result.disengaged.map((user) => user.id)).not.toContain("u2");
  });
});
