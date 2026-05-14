/** Popular Nigerian banks for payout setup (NGN). */
export const NG_PAYOUT_BANK_PRESETS = [
  "Access Bank",
  "GTBank",
  "First Bank",
  "Zenith Bank",
  "UBA",
  "Stanbic IBTC",
] as const;

export const NG_PAYOUT_BANK_OTHER = "__other__";

export type NgPayoutBankPreset = (typeof NG_PAYOUT_BANK_PRESETS)[number];

export function isNgPayoutBankPreset(name: string): name is NgPayoutBankPreset {
  return (NG_PAYOUT_BANK_PRESETS as readonly string[]).includes(name);
}
