import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { createSlackOAuthState } from "@/lib/slack/oauthState";

const scopes = ["commands", "chat:write", "chat:write.public", "users:read", "users:read.email"];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session.user.workspaceId) {
    const login = new URL(`${env.NEXT_PUBLIC_APP_URL}/admin/login`);
    login.searchParams.set("redirect", "/api/slack/oauth/start");
    return Response.redirect(login.toString(), 302);
  }

  if (session.user.role !== "ADMIN") {
    return Response.redirect(`${env.NEXT_PUBLIC_APP_URL}/dashboard`, 302);
  }

  if (!env.SLACK_CLIENT_ID) {
    return Response.redirect(`${env.NEXT_PUBLIC_APP_URL}/admin/settings?slack=not_configured`, 302);
  }

  const state = createSlackOAuthState(session.user.id, session.user.workspaceId);
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: scopes.join(","),
    redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/api/slack/oauth/callback`,
    state,
  });

  return Response.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`, 302);
}
