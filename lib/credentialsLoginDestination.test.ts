import { describe, expect, it } from "vitest";

import { resolveCredentialsLoginDestination } from "@/lib/credentialsLoginDestination";

describe("resolveCredentialsLoginDestination", () => {
  it("sends user login to dashboard for any role", () => {
    expect(
      resolveCredentialsLoginDestination({
        mode: "user",
        role: "ADMIN",
        redirectRaw: null,
      }),
    ).toEqual({ ok: true, path: "/dashboard" });

    expect(
      resolveCredentialsLoginDestination({
        mode: "user",
        role: "EMPLOYEE",
        redirectRaw: null,
      }),
    ).toEqual({ ok: true, path: "/dashboard" });
  });

  it("sends admin login to /admin for admin role", () => {
    expect(
      resolveCredentialsLoginDestination({
        mode: "admin",
        role: "ADMIN",
        redirectRaw: null,
      }),
    ).toEqual({ ok: true, path: "/admin" });
  });

  it("rejects non-admin credentials on admin login", () => {
    expect(
      resolveCredentialsLoginDestination({
        mode: "admin",
        role: "EMPLOYEE",
        redirectRaw: null,
      }),
    ).toEqual({ ok: false, reason: "not_admin" });
  });

  it("blocks user-mode redirect into /admin", () => {
    expect(
      resolveCredentialsLoginDestination({
        mode: "user",
        role: "ADMIN",
        redirectRaw: "/admin/settings",
      }),
    ).toEqual({ ok: true, path: "/dashboard" });
  });

  it("honors safe redirects for admin mode", () => {
    expect(
      resolveCredentialsLoginDestination({
        mode: "admin",
        role: "ADMIN",
        redirectRaw: "/api/slack/oauth/start",
      }),
    ).toEqual({ ok: true, path: "/api/slack/oauth/start" });
  });
});
