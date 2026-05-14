import { describe, expect, it } from "vitest";
import { dashboardHeroGreetingName, publicFeedDisplayName } from "@/lib/publicDisplayName";

describe("publicFeedDisplayName", () => {
  it("uses trimmed username when present", () => {
    expect(publicFeedDisplayName({ username: "  alex_k ", email: "alex@corp.com" })).toBe("alex_k");
  });

  it("falls back to email when username is empty", () => {
    expect(publicFeedDisplayName({ username: null, email: "pat@corp.com" })).toBe("pat@corp.com");
    expect(publicFeedDisplayName({ username: "", email: "pat@corp.com" })).toBe("pat@corp.com");
  });
});

describe("dashboardHeroGreetingName", () => {
  it("prefers trimmed username over name and email", () => {
    expect(
      dashboardHeroGreetingName({
        username: "  cool_dev ",
        name: "Pat Smith",
        email: "pat@corp.com",
      }),
    ).toBe("cool_dev");
  });

  it("uses first name token when username is empty", () => {
    expect(
      dashboardHeroGreetingName({ username: null, name: "Pat Smith", email: "pat@corp.com" }),
    ).toBe("Pat");
  });

  it("uses email local part when name is empty", () => {
    expect(dashboardHeroGreetingName({ username: null, name: "", email: "pat@corp.com" })).toBe("pat");
  });
});
