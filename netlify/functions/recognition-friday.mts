import type { Config } from "@netlify/functions";
import { WebClient } from "@slack/web-api";
import { prisma } from "../../lib/db";
import { decrypt } from "../../lib/encryption";

const logger = {
  info: (message: string, data?: unknown) =>
    console.info(`[recognition-friday] ${message}`, data ?? ""),
  error: (message: string, data?: unknown) =>
    console.error(`[recognition-friday] ${message}`, data ?? ""),
};

/** True when `date` is the last Friday of its calendar month (job runs on Fridays). */
function isLastFridayOfMonth(date: Date): boolean {
  const candidate = new Date(date);
  candidate.setDate(candidate.getDate() + 7);
  return candidate.getMonth() !== date.getMonth();
}

export default async () => {
  try {
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

    const today = new Date();

    for (const workspace of workspaces) {
      try {
        if (!workspace.targetChannelId || !workspace.slackTeamId) {
          logger.info("Skipping workspace without Slack channel/team", { workspaceId: workspace.id });
          continue;
        }

        const schedule = workspace.recognitionSchedule;
        const shouldPost =
          schedule === "EVERY_FRIDAY" || (schedule === "LAST_FRIDAY" && isLastFridayOfMonth(today));

        if (!shouldPost) {
          logger.info("Skipping workspace due to schedule", {
            workspaceId: workspace.id,
            schedule,
          });
          continue;
        }

        const installation = await prisma.slackInstallation.findFirst({
          where: {
            workspaceId: workspace.id,
            slackTeamId: workspace.slackTeamId,
          },
          select: { botToken: true },
        });

        if (!installation?.botToken) {
          logger.info("No Slack installation token found", { workspaceId: workspace.id });
          continue;
        }

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

        const client = new WebClient(decrypt(installation.botToken));
        await client.chat.postMessage({
          channel: workspace.targetChannelId,
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
        });

        logger.info("Recognition Friday posted", {
          workspaceId: workspace.id,
          channel: workspace.targetChannelId,
          timestamp: new Date().toISOString(),
        });
      } catch (workspaceError) {
        logger.error("Failed to post for workspace", {
          workspaceId: workspace.id,
          error: workspaceError instanceof Error ? workspaceError.message : "Unknown error",
        });
      }
    }

    logger.info("Job completed");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    logger.error("Job failed", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const config: Config = {
  schedule: "0 8 * * 5",
};
