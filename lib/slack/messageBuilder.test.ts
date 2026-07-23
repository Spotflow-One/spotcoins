import { describe, expect, it } from "vitest";
import { buildPublicPost, buildRecipientDM } from "@/lib/slack/messageBuilder";

describe("buildPublicPost", () => {
  it("names the sender and keeps the shoutout format", () => {
    const blocks = buildPublicPost(
      { name: "michael" },
      { name: "ada", slackUserId: "U123" },
      { message: "Helped ship the payout flow under pressure.", coinAmount: 2 },
      { name: "Ownership", emoji: "🌱" },
    );

    const first = blocks[0] as { text?: { text?: string } };
    expect(first.text?.text).toBe(
      "🎉 *michael* sends a big shoutout to <@U123> for living our value(s): *Ownership* 👏",
    );

    const quote = blocks[1] as { text?: { text?: string } };
    expect(quote.text?.text).toBe(">Helped ship the payout flow under pressure.");
  });

  it("falls back to recipient display name without slack id", () => {
    const blocks = buildPublicPost(
      { name: "michael" },
      { name: "ada", slackUserId: null },
      { message: "Great work", coinAmount: 1 },
      { name: "Ownership", emoji: "🌱" },
    );
    const first = blocks[0] as { text?: { text?: string } };
    expect(first.text?.text).toContain("*michael* sends a big shoutout to *ada*");
  });
});

describe("buildRecipientDM", () => {
  it("still names sender and recipient", () => {
    const blocks = buildRecipientDM(
      { name: "michael" },
      { name: "ada" },
      { message: "Nice work", coinAmount: 1 },
      { name: "Ownership", emoji: "🌱" },
    );
    const first = blocks[0] as { text?: { text?: string } };
    expect(first.text?.text).toContain("*michael* recognized *ada*");
  });
});
