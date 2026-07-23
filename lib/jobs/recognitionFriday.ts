import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { AppError } from "@/lib/errors";
import { WebClient } from "@slack/web-api";

const logger = {
  info: (message: string, data?: unknown) =>
    console.info(`[recognition-friday] ${message}`, data ?? ""),
  error: (message: string, data?: unknown) =>
    console.error(`[recognition-friday] ${message}`, data ?? ""),
};

/** True when `date` is the last Friday of its calendar month (job runs on Fridays). */
export function isLastFridayOfMonth(date: Date): boolean {
  const candidate = new Date(date);
  candidate.setDate(candidate.getDate() + 7);
  return candidate.getMonth() !== date.getMonth();
}

export type RecognitionFridayWorkspace = {
  id: string;
  recognitionSchedule: string;
  targetChannelId: string | null;
  slackTeamId: string | null;
};

export type RecognitionFridayResult = {
  ok: boolean;
  posted: number;
  skipped: number;
};

function recognitionFridayBlocks() {
  const body = [
    "Hey <!channel> 🎉",
    "",
    "It's Recognition Friday — time to shout out someone who made a difference this week.",
    "",
    "Who made your workday better? From going above and beyond to just being solid day in, day out — recognition is for all of it.",
    "",
    "👀 *Reminders*",
    "• Pick the value that best matches the impact you want to celebrate",
    "• Unused coins expire at month-end",
    "• Recognition takes less than 60 seconds",
  ].join("\n");

  const slackPreview =
    "It's Recognition Friday — time to shout out someone who made a difference this week.";

  return {
    text: slackPreview,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: body,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Submit Recognition",
              emoji: true,
            },
            action_id: "open_recognition_modal",
            value: "open_recognition_modal",
          },
        ],
      },
    ],
  };
}

/**
 * Posts the Recognition Friday channel nudge for one workspace.
 * Throws AppError when Slack is not fully configured or the Slack API fails.
 */
export async function postRecognitionFridayForWorkspace(
  workspace: RecognitionFridayWorkspace,
): Promise<void> {
  if (!workspace.targetChannelId || !workspace.slackTeamId) {
    throw new AppError(
      "Slack is not fully configured. Connect Slack and set a recognition channel.",
      "SLACK_NOT_CONFIGURED",
      400,
    );
  }

  const installation = await prisma.slackInstallation.findFirst({
    where: {
      workspaceId: workspace.id,
      slackTeamId: workspace.slackTeamId,
    },
    select: { botToken: true },
  });

  if (!installation?.botToken) {
    throw new AppError(
      "Slack bot is not installed for this workspace. Connect Slack from Admin → Settings.",
      "SLACK_NOT_INSTALLED",
      400,
    );
  }

  const payload = recognitionFridayBlocks();
  const client = new WebClient(decrypt(installation.botToken));

  try {
    const resp = await client.chat.postMessage({
      channel: workspace.targetChannelId,
      text: payload.text,
      blocks: payload.blocks,
    });
    if (!resp.ok) {
      throw new AppError("Could not post to Slack. Try again.", "SLACK_POST_FAILED", 502);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error("Slack post failed", {
      workspaceId: workspace.id,
      error: err instanceof Error ? err.message : "Unknown error",
    });
    throw new AppError("Could not post to Slack. Try again.", "SLACK_POST_FAILED", 502);
  }

  logger.info("Recognition Friday posted", {
    workspaceId: workspace.id,
    channel: workspace.targetChannelId,
    timestamp: new Date().toISOString(),
  });
}

export function shouldPostForSchedule(
  schedule: string,
  now: Date,
  ignoreSchedule: boolean,
): boolean {
  if (ignoreSchedule) return true;
  return schedule === "EVERY_FRIDAY" || (schedule === "LAST_FRIDAY" && isLastFridayOfMonth(now));
}

/**
 * Admin/manual path: post for one workspace, optionally ignoring Friday schedule rules.
 */
export async function triggerRecognitionFridayForWorkspace(
  workspaceId: string,
  options?: { ignoreSchedule?: boolean; now?: Date },
): Promise<{ ok: true }> {
  const ignoreSchedule = options?.ignoreSchedule ?? false;
  const now = options?.now ?? new Date();

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      recognitionSchedule: true,
      targetChannelId: true,
      slackTeamId: true,
    },
  });

  if (!workspace) {
    throw new AppError("Workspace not found", "WORKSPACE_NOT_FOUND", 404);
  }

  if (!shouldPostForSchedule(workspace.recognitionSchedule, now, ignoreSchedule)) {
    throw new AppError(
      "Recognition Friday is not scheduled to post today for this workspace.",
      "SCHEDULE_SKIPPED",
      400,
    );
  }

  await postRecognitionFridayForWorkspace(workspace);
  return { ok: true };
}

export async function runRecognitionFridayJob(now = new Date()): Promise<RecognitionFridayResult> {
  logger.info("Job started");

  const workspaces = await prisma.workspace.findMany({
    where: { slackTeamId: { not: null } },
    select: {
      id: true,
      recognitionSchedule: true,
      targetChannelId: true,
      slackTeamId: true,
    },
  });

  let posted = 0;
  let skipped = 0;

  for (const workspace of workspaces) {
    try {
      if (!workspace.targetChannelId || !workspace.slackTeamId) {
        logger.info("Skipping workspace without Slack channel/team", { workspaceId: workspace.id });
        skipped += 1;
        continue;
      }

      if (!shouldPostForSchedule(workspace.recognitionSchedule, now, false)) {
        logger.info("Skipping workspace due to schedule", {
          workspaceId: workspace.id,
          schedule: workspace.recognitionSchedule,
        });
        skipped += 1;
        continue;
      }

      await postRecognitionFridayForWorkspace(workspace);
      posted += 1;
    } catch (workspaceError) {
      skipped += 1;
      logger.error("Failed to post for workspace", {
        workspaceId: workspace.id,
        error: workspaceError instanceof Error ? workspaceError.message : "Unknown error",
      });
    }
  }

  logger.info("Job completed", { posted, skipped });
  return { ok: true, posted, skipped };
}
