type SlackBlock = Record<string, unknown>;

export function buildRecognitionModal(
  values: Array<{ id: string; name: string; emoji: string }>,
  coinsToGive: number,
  prefillUserId?: string,
) {
  const valueOptions = values.map((value) => ({
    text: {
      type: "plain_text",
      text: `${value.emoji} ${value.name}`,
      emoji: true,
    },
    value: value.id,
  }));

  const amountOptions = Array.from({ length: Math.max(1, coinsToGive) }, (_, index) => {
    const amount = String(index + 1);
    return {
      text: { type: "plain_text", text: amount, emoji: true },
      value: amount,
    };
  });

  const blocks: SlackBlock[] = [
    {
      type: "input",
      block_id: "recipient_block",
      label: { type: "plain_text", text: "Who deserves recognition?", emoji: true },
      element: {
        type: "users_select",
        action_id: "recipient",
        ...(prefillUserId ? { initial_user: prefillUserId } : {}),
      },
    },
    {
      type: "input",
      block_id: "message_block",
      label: { type: "plain_text", text: "Tell them why", emoji: true },
      element: {
        type: "plain_text_input",
        action_id: "message",
        multiline: true,
        min_length: 10,
      },
    },
    {
      type: "input",
      block_id: "value_block",
      label: { type: "plain_text", text: "Company value", emoji: true },
      element: {
        type: "static_select",
        action_id: "value",
        options: valueOptions,
      },
    },
    {
      type: "input",
      block_id: "coin_block",
      label: { type: "plain_text", text: "Coins", emoji: true },
      element: {
        type: "static_select",
        action_id: "coin_amount",
        options: amountOptions,
      },
    },
  ];

  return {
    type: "modal",
    callback_id: "submit_recognition",
    title: { type: "plain_text", text: "Send Spotcoin", emoji: true },
    submit: { type: "plain_text", text: "Send", emoji: true },
    close: { type: "plain_text", text: "Cancel", emoji: true },
    blocks,
  };
}

export function buildRecipientDM(
  sender: { name: string },
  recipient: { name: string },
  recognition: { message: string; coinAmount: number },
  value: { name: string; emoji: string },
) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🎉 *${sender.name}* recognized *${recipient.name}* with *${recognition.coinAmount} Spot Token${recognition.coinAmount === 1 ? "" : "s"}*.`,
      },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `>${recognition.message}` },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `${value.emoji} ${value.name}` }],
    },
  ];
}

export function buildPublicPost(
  sender: { name: string },
  recipient: { name: string; slackUserId?: string | null },
  recognition: { message: string; coinAmount: number },
  value: { name: string; emoji: string },
) {
  const valueLabel = value.name.trim() || "our values";
  const recipientLabel = recipient.slackUserId ? `<@${recipient.slackUserId}>` : `*${recipient.name}*`;

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🎉 *${sender.name}* sends a big shoutout to ${recipientLabel} for living our value(s): *${valueLabel}* 👏`,
      },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `>${recognition.message}` },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Keep being the reason our team grows and embodies our core values. ✨",
        },
      ],
    },
  ];
}
