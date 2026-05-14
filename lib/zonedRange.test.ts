import { describe, expect, it } from "vitest";
import { startOfZonedMonth } from "@/lib/zonedRange";

describe("zonedRange", () => {
  it("returns Jan 1 2026 in Africa/Lagos as UTC before Feb 1 local", () => {
    const d = startOfZonedMonth("Africa/Lagos", 2026, 1);
    expect(d.getUTCFullYear()).toBe(2025);
    expect(d.getUTCMonth()).toBe(11);
    expect(d.getUTCDate()).toBe(31);
    expect(d.getUTCHours()).toBe(23);
  });
});
