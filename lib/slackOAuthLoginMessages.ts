/** Query param `slack=` from OAuth callback redirects (see /api/slack/oauth/callback). */
export function getSlackOAuthLoginMessage(status: string | null): string | null {
  if (!status) return null;

  const messages: Record<string, string> = {
    invalid_state:
      "This install link did not come from Spotcoin (missing signed state), or the link expired. Do not paste Slack’s oauth/authorize URL from the Slack API site. Sign in as an admin at /admin/login, open Admin → Settings, and use Connect Slack. If you already did, check Netlify: NEXT_PUBLIC_APP_URL (https) and SLACK_STATE_SECRET match your Slack app redirect URL.",
    oauth_denied: "Slack connection was cancelled.",
    oauth_failed: "Something went wrong connecting Slack. Try again from Admin → Settings.",
    missing_code: "Slack did not return an authorization code. Try Connect Slack again.",
    not_configured: "Slack app credentials are missing in the server environment.",
    invalid_response: "Slack returned an unexpected response. Try again or check your Slack app config.",
    workspace_not_found: "Your workspace could not be matched for this install. Contact an admin.",
    connected: "Slack connected. Open Admin → Settings if you need to verify installation.",
  };

  return messages[status] ?? null;
}
