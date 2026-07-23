import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    CRON_SECRET: "test-cron-secret",
  },
}));

describe("assertCronAuthorized", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("accepts Authorization Bearer", async () => {
    const { assertCronAuthorized } = await import("@/lib/jobs/cronAuth");
    expect(() =>
      assertCronAuthorized(
        new Request("http://localhost/api/cron/recognition-friday", {
          headers: { authorization: "Bearer test-cron-secret" },
        }),
      ),
    ).not.toThrow();
  });

  it("accepts x-cron-secret", async () => {
    const { assertCronAuthorized } = await import("@/lib/jobs/cronAuth");
    expect(() =>
      assertCronAuthorized(
        new Request("http://localhost/api/cron/recognition-friday", {
          headers: { "x-cron-secret": "test-cron-secret" },
        }),
      ),
    ).not.toThrow();
  });

  it("rejects missing or wrong secret", async () => {
    const { assertCronAuthorized } = await import("@/lib/jobs/cronAuth");
    try {
      assertCronAuthorized(new Request("http://localhost/api/cron/x"));
      expect.unreachable();
    } catch (err) {
      expect(err).toMatchObject({ code: "CRON_UNAUTHORIZED", statusCode: 401 });
    }

    try {
      assertCronAuthorized(
        new Request("http://localhost/api/cron/x", {
          headers: { authorization: "Bearer wrong" },
        }),
      );
      expect.unreachable();
    } catch (err) {
      expect(err).toMatchObject({ code: "CRON_UNAUTHORIZED" });
    }
  });
});

describe("assertCronAuthorized without CRON_SECRET", () => {
  it("returns 503 when cron secret is unset", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: { CRON_SECRET: undefined },
    }));
    const { assertCronAuthorized } = await import("@/lib/jobs/cronAuth");
    try {
      assertCronAuthorized(
        new Request("http://localhost/api/cron/x", {
          headers: { authorization: "Bearer anything" },
        }),
      );
      expect.unreachable();
    } catch (err) {
      expect(err).toMatchObject({ code: "CRON_NOT_CONFIGURED", statusCode: 503 });
    }
  });
});
