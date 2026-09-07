import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  workspace: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

describe("runMonthlyResetJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resets coinsToGive without touching spotTokensEarned", async () => {
    mockPrisma.workspace.findMany.mockResolvedValue([{ id: "ws-1", monthlyAllowance: 5 }]);
    mockPrisma.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);

    const tx = {
      user: {
        update: vi.fn().mockResolvedValue({}),
      },
      coinTransaction: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const { runMonthlyResetJob } = await import("@/lib/jobs/monthlyReset");
    await runMonthlyResetJob({ requireLagosMonthStart: false });

    expect(tx.user.update).toHaveBeenCalled();
    const updateCalls = tx.user.update.mock.calls.map((call: any[]) => call[0]);
    for (const call of updateCalls) {
      expect(call.data).toHaveProperty("coinsToGive", 5);
      expect(call.data).not.toHaveProperty("spotTokensEarned");
    }
  });

  it("skips when Lagos month-start gate fails", async () => {
    const { runMonthlyResetJob } = await import("@/lib/jobs/monthlyReset");
    // Mid-month UTC instant that is not day 1 in Lagos
    const result = await runMonthlyResetJob({
      now: new Date("2026-07-15T12:00:00.000Z"),
      requireLagosMonthStart: true,
    });
    expect(result.skipped).toBe(true);
    expect(mockPrisma.workspace.findMany).not.toHaveBeenCalled();
  });

  it("runs when instant is day 1 in Lagos even if UTC is prior day", async () => {
    mockPrisma.workspace.findMany.mockResolvedValue([{ id: "ws-1", monthlyAllowance: 5 }]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const { runMonthlyResetJob } = await import("@/lib/jobs/monthlyReset");
    // 23:30 UTC on Jul 31 is 00:30 Aug 1 in Africa/Lagos.
    const result = await runMonthlyResetJob({
      now: new Date("2026-07-31T23:30:00.000Z"),
      requireLagosMonthStart: true,
    });

    expect(result.skipped).toBeUndefined();
    expect(result.totalResetUsers).toBe(0);
    expect(mockPrisma.workspace.findMany).toHaveBeenCalled();
  });

  it("returns failed workspace details when one workspace reset errors", async () => {
    mockPrisma.workspace.findMany.mockResolvedValue([
      { id: "ws-1", monthlyAllowance: 5 },
      { id: "ws-2", monthlyAllowance: 3 },
    ]);
    mockPrisma.user.findMany
      .mockResolvedValueOnce([{ id: "u1" }])
      .mockResolvedValueOnce([{ id: "u2" }]);

    const tx = {
      user: {
        update: vi.fn().mockResolvedValue({}),
      },
      coinTransaction: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    mockPrisma.$transaction
      .mockImplementationOnce(async (cb: any) => cb(tx))
      .mockRejectedValueOnce(new Error("db write failed"));

    const { runMonthlyResetJob } = await import("@/lib/jobs/monthlyReset");
    const result = await runMonthlyResetJob({ requireLagosMonthStart: false });

    expect(result.ok).toBe(false);
    expect(result.totalResetUsers).toBe(1);
    expect(result.failedWorkspaces).toEqual([
      { workspaceId: "ws-2", error: "db write failed" },
    ]);
  });

  it("triggers monthly reset for one workspace only", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue({ id: "ws-1", monthlyAllowance: 5 });
    mockPrisma.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);

    const tx = {
      user: {
        update: vi.fn().mockResolvedValue({}),
      },
      coinTransaction: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const { triggerMonthlyResetForWorkspace } = await import("@/lib/jobs/monthlyReset");
    const result = await triggerMonthlyResetForWorkspace("ws-1");

    expect(mockPrisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: "ws-1" },
      select: { id: true, monthlyAllowance: true },
    });
    expect(result).toEqual({ ok: true, resetUsers: 2 });
  });
});
