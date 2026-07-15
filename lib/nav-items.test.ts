import { describe, expect, it } from "vitest";

import { getEmployeeNavItems, getNavItems } from "@/lib/nav-items";

describe("nav-items", () => {
  it("returns employee items for the dashboard shell", () => {
    const items = getNavItems(false);
    expect(items.map((item) => item.href)).toContain("/dashboard/recognise");
    expect(items.map((item) => item.href)).not.toContain("/admin");
  });

  it("adds admin escape hatch for admin users on employee shell", () => {
    const items = getEmployeeNavItems({ includeAdminLink: true });
    expect(items.some((item) => item.href === "/admin" && item.label === "Admin")).toBe(true);
    expect(items.map((item) => item.href)).toContain("/dashboard/feed");
  });

  it("keeps the admin console nav separate", () => {
    const items = getNavItems(true);
    expect(items[0]?.href).toBe("/admin");
    expect(items.map((item) => item.href)).toContain("/admin/settings");
  });
});
