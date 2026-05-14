/**
 * Label shown on the public recognition feed (and related team-facing surfaces).
 * Prefer workspace username when set; otherwise fall back to email.
 */
export function publicFeedDisplayName(user: { username: string | null; email: string }): string {
  const handle = user.username?.trim();
  if (handle) return handle;
  return user.email;
}

/**
 * Dashboard home “Hey …” line: feed handle when set, else first name token, else email local part.
 * Matches client refresh from GET /api/users/me.
 */
export function dashboardHeroGreetingName(user: {
  username: string | null;
  name: string | null;
  email: string;
}): string {
  const handle = user.username?.trim();
  if (handle) return handle;
  const nm = (user.name || "").trim();
  const first = nm.split(/\s+/)[0] || nm;
  if (first) return first;
  const emailLocal = user.email.split("@")[0] || user.email;
  return emailLocal;
}
