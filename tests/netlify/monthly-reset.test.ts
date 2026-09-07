import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  workspace: {
    findMany: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("../../lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("../../lib/jobs/monthlyReset", async () => {
  const actual = await vi.importActual<typeof import("../../lib/jobs/monthlyReset")>(
    "../../lib/jobs/monthlyReset",
  );
  return actual;
});

describe("monthly-reset Netlify wrapper", () => {
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

    const monthlyReset = (await import("../../netlify/functions/monthly-reset.mts")).default;
    await monthlyReset();

    expect(tx.user.update).toHaveBeenCalled();
    const updateCalls = tx.user.update.mock.calls.map((call: any[]) => call[0]);
    for (const call of updateCalls) {
      expect(call.data).toHaveProperty("coinsToGive", 5);
      expect(call.data).not.toHaveProperty("spotTokensEarned");
    }
  });

  it("returns 500 when a workspace reset fails", async () => {
    mockPrisma.workspace.findMany.mockResolvedValue([{ id: "ws-1", monthlyAllowance: 5 }]);
    mockPrisma.user.findMany.mockResolvedValue([{ id: "u1" }]);
    mockPrisma.$transaction.mockRejectedValue(new Error("db write failed"));

    const monthlyReset = (await import("../../netlify/functions/monthly-reset.mts")).default;
    const response = await monthlyReset();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      ok: false,
      totalResetUsers: 0,
      failedWorkspaces: [{ workspaceId: "ws-1", error: "db write failed" }],
    });
  });
});
