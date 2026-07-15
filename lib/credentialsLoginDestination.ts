import { safeInternalPath } from "@/lib/safeRedirect";

export type LoginMode = "user" | "admin";

/**
 * Pure post-login routing for user vs admin login entry points.
 */
export function resolveCredentialsLoginDestination(input: {
  mode: LoginMode;
  role: string | undefined | null;
  redirectRaw: string | null;
}): { ok: true; path: string } | { ok: false; reason: "not_admin" } {
  if (input.mode === "admin" && input.role !== "ADMIN") {
    return { ok: false, reason: "not_admin" };
  }

  const defaultDestination = input.mode === "admin" ? "/admin" : "/dashboard";
  const redirectAfterLogin = safeInternalPath(input.redirectRaw);

  if (!redirectAfterLogin) {
    return { ok: true, path: defaultDestination };
  }

  if (redirectAfterLogin.startsWith("/api/slack") && input.role !== "ADMIN") {
    return { ok: true, path: defaultDestination };
  }

  if (input.mode === "user" && redirectAfterLogin.startsWith("/admin")) {
    return { ok: true, path: "/dashboard" };
  }

  return { ok: true, path: redirectAfterLogin };
}
