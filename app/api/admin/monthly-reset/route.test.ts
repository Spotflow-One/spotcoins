import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const triggerMonthlyResetForWorkspaceMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => authMock(),
  requireAdmin: (handler: any) => async (request: Request, context: any) => {
    const session = await authMock();
    if (!session?.user?.id || !session.user.workspaceId) {
      return new Response(
        JSON.stringify({ error: "Authentication required", code: "UNAUTHORIZED" }),
        { status: 401, headers: { "content-type": "application/json" } },
      );
    }
    if (session.user.role !== "ADMIN") {
      return new Response(
        JSON.stringify({ error: "Admin access required", code: "FORBIDDEN" }),
        { status: 403, headers: { "content-type": "application/json" } },
      );
    }
    return handler(request, context, session);
  },
}));

vi.mock("@/lib/jobs/monthlyReset", () => ({
  triggerMonthlyResetForWorkspace: triggerMonthlyResetForWorkspaceMock,
}));

describe("admin monthly reset route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires admin auth", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost:3000/api/admin/monthly-reset"), {});
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("triggers reset for the current workspace", async () => {
    authMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", workspaceId: "ws-1" },
    });
    triggerMonthlyResetForWorkspaceMock.mockResolvedValue({ ok: true, resetUsers: 2 });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost:3000/api/admin/monthly-reset"), {});
    const body = await response.json();

    expect(triggerMonthlyResetForWorkspaceMock).toHaveBeenCalledWith("ws-1");
    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { ok: true, resetUsers: 2 } });
  });
});
