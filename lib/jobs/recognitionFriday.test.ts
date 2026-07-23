import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const postMessageMock = vi.fn();

const mockPrisma = {
  workspace: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  slackInstallation: {
    findFirst: vi.fn(),
  },
};

vi.mock("@slack/web-api", () => ({
  WebClient: class WebClient {
    chat = {
      postMessage: postMessageMock,
    };
  },
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn((value: string) => `dec:${value}`),
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

const configuredWorkspace = {
  id: "ws-1",
  recognitionSchedule: "LAST_FRIDAY",
  targetChannelId: "C123",
  slackTeamId: "T123",
};

describe("recognitionFriday helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postMessageMock.mockResolvedValue({ ok: true });
    mockPrisma.slackInstallation.findFirst.mockResolvedValue({ botToken: "enc-token" });
  });

  it("posts when workspace is fully configured", async () => {
    const { postRecognitionFridayForWorkspace } = await import("@/lib/jobs/recognitionFriday");
    await postRecognitionFridayForWorkspace(configuredWorkspace);

    expect(mockPrisma.slackInstallation.findFirst).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", slackTeamId: "T123" },
      select: { botToken: true },
    });
    expect(postMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C123",
        text: expect.stringContaining("Recognition Friday"),
      }),
    );
  });

  it("throws when recognition channel is missing", async () => {
    const { postRecognitionFridayForWorkspace } = await import("@/lib/jobs/recognitionFriday");

    await expect(
      postRecognitionFridayForWorkspace({
        ...configuredWorkspace,
        targetChannelId: null,
      }),
    ).rejects.toMatchObject({
      code: "SLACK_NOT_CONFIGURED",
      statusCode: 400,
    } satisfies Partial<AppError>);

    expect(postMessageMock).not.toHaveBeenCalled();
  });

  it("throws when Slack bot token is missing", async () => {
    mockPrisma.slackInstallation.findFirst.mockResolvedValue(null);
    const { postRecognitionFridayForWorkspace } = await import("@/lib/jobs/recognitionFriday");

    await expect(postRecognitionFridayForWorkspace(configuredWorkspace)).rejects.toMatchObject({
      code: "SLACK_NOT_INSTALLED",
      statusCode: 400,
    });

    expect(postMessageMock).not.toHaveBeenCalled();
  });

  it("admin path posts when ignoreSchedule is true even if LAST_FRIDAY would skip", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(configuredWorkspace);
    const { triggerRecognitionFridayForWorkspace } = await import("@/lib/jobs/recognitionFriday");

    // Mid-month Friday that is not the last Friday of July 2026
    const midMonthFriday = new Date("2026-07-10T12:00:00.000Z");

    await expect(
      triggerRecognitionFridayForWorkspace("ws-1", {
        ignoreSchedule: true,
        now: midMonthFriday,
      }),
    ).resolves.toEqual({ ok: true });

    expect(postMessageMock).toHaveBeenCalled();
  });

  it("throws SCHEDULE_SKIPPED when schedule would skip and ignoreSchedule is false", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(configuredWorkspace);
    const { triggerRecognitionFridayForWorkspace } = await import("@/lib/jobs/recognitionFriday");

    const midMonthFriday = new Date("2026-07-10T12:00:00.000Z");

    await expect(
      triggerRecognitionFridayForWorkspace("ws-1", {
        ignoreSchedule: false,
        now: midMonthFriday,
      }),
    ).rejects.toMatchObject({
      code: "SCHEDULE_SKIPPED",
      statusCode: 400,
    });

    expect(postMessageMock).not.toHaveBeenCalled();
  });
});
