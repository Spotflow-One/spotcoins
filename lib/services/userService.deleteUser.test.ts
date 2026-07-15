import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTx = {
  passwordResetToken: { deleteMany: vi.fn() },
  pollVote: { deleteMany: vi.fn() },
  pollOption: { updateMany: vi.fn() },
  eventRsvp: { deleteMany: vi.fn() },
  eventComment: { deleteMany: vi.fn() },
  payoutRequest: { updateMany: vi.fn(), deleteMany: vi.fn() },
  recognition: { findMany: vi.fn(), deleteMany: vi.fn() },
  coinTransaction: { deleteMany: vi.fn() },
  poll: { deleteMany: vi.fn() },
  workspaceEvent: { deleteMany: vi.fn() },
  payoutWindow: { deleteMany: vi.fn() },
  user: { deleteMany: vi.fn() },
};

const mockPrisma = {
  user: {
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  payoutWindow: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("bcryptjs", () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

describe("userService.deleteUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<void>) => {
      await cb(mockTx);
    });
    mockTx.recognition.findMany.mockResolvedValue([]);
    mockTx.user.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("rejects deleting yourself", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce({ id: "admin-1" })
      .mockResolvedValueOnce({ id: "admin-1", role: "ADMIN", deletedAt: null });

    const { userService } = await import("@/lib/services/userService");

    await expect(userService.deleteUser("admin-1", "admin-1", "ws-1")).rejects.toMatchObject({
      code: "SELF_DELETE",
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects deleting the last admin", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce({ id: "admin-1" })
      .mockResolvedValueOnce({ id: "admin-2", role: "ADMIN", deletedAt: null });
    mockPrisma.user.count.mockResolvedValue(1);

    const { userService } = await import("@/lib/services/userService");

    await expect(userService.deleteUser("admin-1", "admin-2", "ws-1")).rejects.toMatchObject({
      code: "LAST_ADMIN",
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects when target is missing", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce({ id: "admin-1" })
      .mockResolvedValueOnce(null);

    const { userService } = await import("@/lib/services/userService");

    await expect(userService.deleteUser("admin-1", "missing", "ws-1")).rejects.toMatchObject({
      code: "USER_NOT_FOUND",
    });
  });

  it("rejects when actor is not an admin in workspace", async () => {
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);

    const { userService } = await import("@/lib/services/userService");

    await expect(userService.deleteUser("user-1", "user-2", "ws-1")).rejects.toMatchObject({
      code: "ADMIN_NOT_FOUND",
    });
  });

  it("rejects when user owns an open payout window", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce({ id: "admin-1" })
      .mockResolvedValueOnce({ id: "user-2", role: "EMPLOYEE", deletedAt: null });
    mockPrisma.payoutWindow.findFirst.mockResolvedValue({ id: "pw-1" });

    const { userService } = await import("@/lib/services/userService");

    await expect(userService.deleteUser("admin-1", "user-2", "ws-1")).rejects.toMatchObject({
      code: "OPEN_PAYOUT_WINDOW",
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("deletes related rows then the user", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce({ id: "admin-1" })
      .mockResolvedValueOnce({ id: "user-2", role: "EMPLOYEE", deletedAt: null });
    mockPrisma.payoutWindow.findFirst.mockResolvedValue(null);
    mockTx.recognition.findMany.mockResolvedValue([{ id: "rec-1" }]);

    const { userService } = await import("@/lib/services/userService");
    const result = await userService.deleteUser("admin-1", "user-2", "ws-1");

    expect(result).toEqual({ id: "user-2", deleted: true });
    expect(mockTx.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-2" } });
    expect(mockTx.coinTransaction.deleteMany).toHaveBeenCalled();
    expect(mockTx.recognition.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["rec-1"] } } });
    expect(mockTx.user.deleteMany).toHaveBeenCalledWith({
      where: { id: "user-2", workspaceId: "ws-1" },
    });
  });
});
