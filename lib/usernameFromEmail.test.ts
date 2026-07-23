import { describe, expect, it } from "vitest";
import {
  allocateUsernameFromEmail,
  emailLocalPart,
  sanitizeUsernameCandidate,
  usernameCandidateFromEmail,
} from "@/lib/usernameFromEmail";

describe("usernameFromEmail", () => {
  it("extracts the local part", () => {
    expect(emailLocalPart("michael@spotflow.one")).toBe("michael");
  });

  it("sanitizes invalid characters", () => {
    expect(sanitizeUsernameCandidate("ada.okoro")).toBe("ada_okoro");
    expect(sanitizeUsernameCandidate("pat+intern")).toBe("pat_intern");
    expect(usernameCandidateFromEmail("a.b@corp.com")).toBe("a_b");
  });

  it("pads short local parts to at least 3 chars", () => {
    expect(sanitizeUsernameCandidate("ab")).toBe("abuser".slice(0, 30));
    expect(sanitizeUsernameCandidate("ab").length).toBeGreaterThanOrEqual(3);
  });

  it("allocates with numeric suffix on collision", async () => {
    const taken = new Set(["michael"]);
    const username = await allocateUsernameFromEmail("michael@spotflow.one", async (c) =>
      taken.has(c),
    );
    expect(username).toBe("michael2");
  });
});
