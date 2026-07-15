import { WebClient } from "@slack/web-api";
import { auth } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { verifySlackOAuthState } from "@/lib/slack/oauthState";

function redirectToAdminSlackStatus(status: string) {
  return Response.redirect(`${env.NEXT_PUBLIC_APP_URL}/admin/settings?slack=${status}`, 302);
}

/** When OAuth fails, send signed-out users straight to login with a retry path (avoids admin layout stripping context). */
async function redirectSlackOAuthIssue(status: string) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    const login = new URL(`${env.NEXT_PUBLIC_APP_URL}/admin/login`);
    login.searchParams.set("slack", status);
    login.searchParams.set("redirect", "/api/slack/oauth/start");
    return Response.redirect(login.toString(), 302);
  }
  return redirectToAdminSlackStatus(status);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");
    if (oauthError) {
      return redirectSlackOAuthIssue("oauth_denied");
    }

    if (!code) {
      return redirectSlackOAuthIssue("missing_code");
    }

    const statePayload = verifySlackOAuthState(state);
    if (!statePayload) {
      return redirectSlackOAuthIssue("invalid_state");
    }

    if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
      return redirectToAdminSlackStatus("not_configured");
    }

    const redirectUri = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/slack/oauth/callback`;

    const client = new WebClient();
    const oauthResponse = await client.oauth.v2.access({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    });

    const teamId = oauthResponse.team?.id;
    const botToken = oauthResponse.access_token;
    const botUserId = oauthResponse.bot_user_id;
    const authedUserId = oauthResponse.authed_user?.id;
    if (!teamId || !botToken || !botUserId || !authedUserId) {
      return redirectToAdminSlackStatus("invalid_response");
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        id: statePayload.workspaceId,
        users: {
          some: {
            id: statePayload.userId,
            role: "ADMIN",
            deletedAt: null,
          },
        },
      },
      select: { id: true },
    });
    if (!workspace) {
      return redirectToAdminSlackStatus("workspace_not_found");
    }

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        slackTeamId: teamId,
        name: oauthResponse.team?.name ?? undefined,
      },
    });

    await prisma.slackInstallation.upsert({
      where: { slackTeamId: teamId },
      update: {
        workspaceId: statePayload.workspaceId,
        botToken: encrypt(botToken),
        botUserId,
        installedById: authedUserId,
      },
      create: {
        workspaceId: statePayload.workspaceId,
        slackTeamId: teamId,
        botToken: encrypt(botToken),
        botUserId,
        installedById: authedUserId,
      },
    });

    return redirectToAdminSlackStatus("connected");
  } catch (err) {
    if (process.env.SPOTCOIN_LAUNCH_DEBUG === "1") {
      console.error("[slack.oauthCallback]", err instanceof Error ? err.message : err);
    }
    return redirectSlackOAuthIssue("oauth_failed");
  }
}
