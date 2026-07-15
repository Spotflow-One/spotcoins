import { beforeEach, describe, expect, it, vi } from "vitest";

const oauthAccessMock = vi.fn();
const findWorkspaceMock = vi.fn();
const updateWorkspaceMock = vi.fn();
const upsertInstallationMock = vi.fn();

vi.mock("@slack/web-api", () => ({
  WebClient: class WebClient {
    oauth = {
      v2: {
        access: oauthAccessMock,
      },
    };
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    SLACK_CLIENT_ID: "client_123",
    SLACK_CLIENT_SECRET: "secret_123",
  },
}));

vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn((value: string) => `enc:${value}`),
}));

vi.mock("@/lib/slack/oauthState", () => ({
  verifySlackOAuthState: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    workspace: {
      findFirst: findWorkspaceMock,
      update: updateWorkspaceMock,
    },
    slackInstallation: {
      upsert: upsertInstallationMock,
    },
  },
}));

const authMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => authMock(),
}));

describe("Slack OAuth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(null);
    oauthAccessMock.mockResolvedValue({
      team: { id: "T123", name: "Team A" },
      access_token: "xoxb-token",
      bot_user_id: "B123",
      authed_user: { id: "U123" },
    });
    findWorkspaceMock.mockResolvedValue({ id: "ws_1" });
    updateWorkspaceMock.mockResolvedValue({});
    upsertInstallationMock.mockResolvedValue({});
  });

  it("redirects oauth_denied when Slack returns an error", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost:3000/api/slack/oauth/callback?error=access_denied"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/admin/login?slack=oauth_denied&redirect=%2Fapi%2Fslack%2Foauth%2Fstart",
    );
  });

  it("redirects missing_code when code is absent", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost:3000/api/slack/oauth/callback?state=abc"));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/admin/login?slack=missing_code&redirect=%2Fapi%2Fslack%2Foauth%2Fstart",
    );
  });

  it("redirects invalid_state to login when there is no admin session", async () => {
    const { verifySlackOAuthState } = await import("@/lib/slack/oauthState");
    vi.mocked(verifySlackOAuthState).mockReturnValue(null);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost:3000/api/slack/oauth/callback?code=abc&state=bad"),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/admin/login?slack=invalid_state&redirect=%2Fapi%2Fslack%2Foauth%2Fstart",
    );
  });

  it("redirects invalid_state to admin settings when an admin session exists", async () => {
    const { verifySlackOAuthState } = await import("@/lib/slack/oauthState");
    vi.mocked(verifySlackOAuthState).mockReturnValue(null);
    authMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost:3000/api/slack/oauth/callback?code=abc&state=bad"),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/admin/settings?slack=invalid_state",
    );
  });

  it("redirects connected for successful installation", async () => {
    const { verifySlackOAuthState } = await import("@/lib/slack/oauthState");
    vi.mocked(verifySlackOAuthState).mockReturnValue({
      userId: "admin_1",
      workspaceId: "ws_1",
      issuedAt: Date.now(),
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost:3000/api/slack/oauth/callback?code=abc&state=good"),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/admin/settings?slack=connected",
    );
    expect(oauthAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        redirect_uri: "http://localhost:3000/api/slack/oauth/callback",
      }),
    );
    expect(findWorkspaceMock).toHaveBeenCalled();
    expect(updateWorkspaceMock).toHaveBeenCalled();
    expect(upsertInstallationMock).toHaveBeenCalled();
  });
});
