"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ListRow } from "@/components/ui/list-row";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { AppToast } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import {
  isNgPayoutBankPreset,
  NG_PAYOUT_BANK_OTHER,
  NG_PAYOUT_BANK_PRESETS,
} from "@/lib/ngPayoutBankPresets";

type MeResponse = {
  data: {
    id: string;
    coinsToGive: number;
    spotTokensEarned: number;
    payoutBankName: string | null;
    payoutBankAccountName: string | null;
    payoutBankAccountNumber: string | null;
    workspace: {
      name: string;
      tokenValueNaira: number;
      tokenValueGhs: number;
    };
  };
};

type RecognitionItem = {
  id: string;
  senderId: string;
  recipientId: string;
  sender: { displayName: string };
  recipient: { displayName: string };
  value: { name: string };
  coinAmount: number;
  createdAt: string;
};

type RecognitionHistoryResponse = {
  data: RecognitionItem[];
};

type PayoutRequestRow = {
  id: string;
  tokenAmount: number;
  currency: "NGN" | "GHS";
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
};

type FilterTab = "all" | "received" | "sent";
type MainTab = "wallet" | "payouts";

function formatNaira(value: number) {
  return `₦${value.toLocaleString("en-NG")}`;
}

function formatGhs(value: number) {
  return `GH₵${value.toLocaleString("en-GH")}`;
}

function toDateLabel(isoDate: string) {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function payoutFiatLabel(
  row: PayoutRequestRow,
  tokenValueNaira: number,
  tokenValueGhs: number,
): string {
  if (row.currency === "NGN") {
    return formatNaira(row.tokenAmount * tokenValueNaira);
  }
  if (tokenValueGhs > 0) {
    return formatGhs(row.tokenAmount * tokenValueGhs);
  }
  return "GHS rate not set";
}

export default function WalletPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mainTab: MainTab = searchParams.get("tab") === "payouts" ? "payouts" : "wallet";

  const setMainTab = useCallback(
    (tab: MainTab) => {
      if (tab === "payouts") {
        router.replace(`${pathname}?tab=payouts`);
      } else {
        router.replace(pathname);
      }
    },
    [pathname, router],
  );

  const [coinsToGive, setCoinsToGive] = useState(0);
  const [spotTokensEarned, setSpotTokensEarned] = useState(0);
  const [tokenValueNaira, setTokenValueNaira] = useState(1000);
  const [tokenValueGhs, setTokenValueGhs] = useState(0);
  const [history, setHistory] = useState<RecognitionItem[]>([]);
  const [userId, setUserId] = useState("");
  const [bankSelect, setBankSelect] = useState("");
  const [otherBankName, setOtherBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState(1);
  const [payoutCurrency, setPayoutCurrency] = useState<"NGN" | "GHS">("NGN");
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const { toast, showToast } = useToast();

  const bankInstitutionResolved = useMemo(() => {
    if (!bankSelect) return "";
    if (bankSelect === NG_PAYOUT_BANK_OTHER) return otherBankName.trim();
    return bankSelect;
  }, [bankSelect, otherBankName]);

  const bankComplete = useMemo(
    () =>
      Boolean(
        bankInstitutionResolved &&
          /^\d{10}$/.test(accountNumber.replace(/\s/g, "")) &&
          accountHolder.trim(),
      ),
    [accountHolder, accountNumber, bankInstitutionResolved],
  );

  const loadAll = useCallback(async () => {
    const [meRes, historyRes, prRes] = await Promise.all([
      fetch("/api/users/me", { cache: "no-store" }),
      fetch("/api/users/me/recognitions?page=1&pageSize=50", { cache: "no-store" }),
      fetch("/api/users/me/payout-requests", { cache: "no-store" }),
    ]);

    const meJson = (await meRes.json()) as MeResponse & { error?: string };
    const historyJson = (await historyRes.json()) as RecognitionHistoryResponse;
    const prJson = (await prRes.json()) as { data?: PayoutRequestRow[] };

    if (meRes.ok && meJson.data) {
      setCoinsToGive(meJson.data.coinsToGive ?? 0);
      setSpotTokensEarned(meJson.data.spotTokensEarned ?? 0);
      setUserId(meJson.data.id ?? "");
      setTokenValueNaira(meJson.data.workspace?.tokenValueNaira ?? 1000);
      setTokenValueGhs(meJson.data.workspace?.tokenValueGhs ?? 0);
      const bn = meJson.data.payoutBankName ?? "";
      if (isNgPayoutBankPreset(bn)) {
        setBankSelect(bn);
        setOtherBankName("");
      } else if (bn) {
        setBankSelect(NG_PAYOUT_BANK_OTHER);
        setOtherBankName(bn);
      } else {
        setBankSelect("");
        setOtherBankName("");
      }
      setAccountHolder(meJson.data.payoutBankAccountName ?? "");
      setAccountNumber((meJson.data.payoutBankAccountNumber ?? "").replace(/\D/g, "").slice(0, 10));
    }
    setHistory(historyJson.data ?? []);
    setPayoutRequests(prJson.data ?? []);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        await loadAll();
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [loadAll]);

  const projectedNaira = spotTokensEarned * tokenValueNaira;
  const projectedGhs = tokenValueGhs > 0 ? spotTokensEarned * tokenValueGhs : 0;

  const pendingTotal = useMemo(
    () => payoutRequests.filter((r) => r.status === "PENDING").reduce((s, r) => s + r.tokenAmount, 0),
    [payoutRequests],
  );
  const availableForPayout = Math.max(0, spotTokensEarned - pendingTotal);

  const filteredHistory = useMemo(() => {
    if (!userId) return history;
    if (activeFilter === "sent") {
      return history.filter((item) => item.senderId === userId);
    }
    if (activeFilter === "received") {
      return history.filter((item) => item.recipientId === userId);
    }
    return history;
  }, [activeFilter, history, userId]);

  const saveBankDetails = async () => {
    if (!bankSelect) {
      showToast("Select your bank", "error");
      return;
    }
    if (bankSelect === NG_PAYOUT_BANK_OTHER && !otherBankName.trim()) {
      showToast("Enter your bank name", "error");
      return;
    }
    const digits = accountNumber.replace(/\s/g, "");
    if (!/^\d{10}$/.test(digits)) {
      showToast("Account number must be exactly 10 digits", "error");
      return;
    }
    if (!accountHolder.trim()) {
      showToast("Enter account holder name", "error");
      return;
    }
    setBankSaving(true);
    try {
      const res = await fetch("/api/users/me/payout-bank", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payoutBankName: bankInstitutionResolved.trim() || null,
          payoutBankAccountName: accountHolder.trim() || null,
          payoutBankAccountNumber: digits || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        showToast(json.error ?? "Could not save bank details", "error");
        return;
      }
      showToast("Account details saved");
      setBankSheetOpen(false);
      await loadAll();
      setMainTab("payouts");
    } finally {
      setBankSaving(false);
    }
  };

  const submitPayout = async () => {
    if (payoutAmount < 1 || payoutAmount > availableForPayout) {
      showToast(`Enter 1–${availableForPayout} tokens`, "error");
      return;
    }
    setPayoutSaving(true);
    try {
      const res = await fetch("/api/users/me/payout-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenAmount: payoutAmount, currency: payoutCurrency }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        showToast(json.error ?? "Request failed", "error");
        return;
      }
      showToast("Payout requested");
      setPayoutOpen(false);
      setPayoutAmount(1);
      await loadAll();
    } finally {
      setPayoutSaving(false);
    }
  };

  return (
    <section className="pb-10">
      <PageHeader title="My Wallet" description="Balances, recognition history, and payout requests." />

      <div className="mb-4">
        <Segmented
          items={[
            { id: "wallet", label: "Wallet" },
            { id: "payouts", label: "Payout requests" },
          ]}
          value={mainTab}
          onChange={(v) => setMainTab(v as MainTab)}
        />
      </div>

      {mainTab === "wallet" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[20px] border border-border bg-card p-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                Coins to Give
              </p>
              <p className="mt-2 font-mono text-[40px] font-bold leading-none tracking-tight text-foreground">
                {coinsToGive}
              </p>
              <p className="mt-2 text-[11px] text-muted">Resets 1st of month</p>
            </div>

            <div className="rounded-[20px] border border-border bg-card p-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                Spot Tokens
              </p>
              <p className="mt-2 font-mono text-[40px] font-bold leading-none tracking-tight text-accent">
                {spotTokensEarned}
              </p>
              <p className="mt-2 text-[11px] text-muted">≈ {formatNaira(projectedNaira)}</p>
              {tokenValueGhs > 0 ? (
                <p className="mt-0.5 text-[11px] text-muted">≈ {formatGhs(projectedGhs)}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-6">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setBankSheetOpen(true)}
            >
              {bankComplete ? "Edit payout account" : "Setup payout account"}
            </Button>
            <p className="mt-2 text-xs text-muted">
              {bankComplete
                ? "Payouts use this account. You can update it any time."
                : "Complete payout account setup before you can request a payout."}
            </p>
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                Recognition history
              </h2>
              {history.length > 0 ? (
                <span className="text-[11px] text-muted">{history.length} entries</span>
              ) : null}
            </div>

            <div className="mb-3">
              <Segmented
                items={[
                  { id: "all", label: "All" },
                  { id: "received", label: "Received" },
                  { id: "sent", label: "Sent" },
                ]}
                value={activeFilter}
                onChange={(next) => setActiveFilter(next as FilterTab)}
              />
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-[16px] border border-border bg-card p-4"
                  >
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="mt-2 h-3 w-24" />
                  </div>
                ))}
              </div>
            ) : filteredHistory.length === 0 ? (
              <EmptyState
                icon={WalletIcon}
                title="No recognition history yet."
                description="Send or receive your first Spotcoin to fill this in."
              />
            ) : (
              <div className="space-y-2">
                {filteredHistory.map((item) => {
                  const isReceived = userId ? item.recipientId === userId : false;
                  const isSent = userId ? item.senderId === userId : false;
                  const amountText = isReceived ? `+${item.coinAmount}` : `-${item.coinAmount}`;
                  const description = isReceived
                    ? `From ${item.sender.displayName} · ${item.value.name}`
                    : isSent
                      ? `To ${item.recipient.displayName} · ${item.value.name}`
                      : `${item.sender.displayName} → ${item.recipient.displayName} · ${item.value.name}`;

                  return (
                    <ListRow
                      key={item.id}
                      left={
                        <span
                          className={
                            isReceived
                              ? "flex h-9 w-9 items-center justify-center rounded-[10px] border border-accent/30 bg-accent/10 text-accent"
                              : "flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-card-2 text-muted"
                          }
                        >
                          {isReceived ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                        </span>
                      }
                      title={description}
                      description={toDateLabel(item.createdAt)}
                      right={
                        <Badge variant={isReceived ? "accent" : "neutral"} className="font-mono">
                          {amountText}
                        </Badge>
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Payout requests</h2>
              <p className="mt-0.5 text-xs text-muted">
                Available to request: <span className="font-mono font-medium text-foreground">{availableForPayout}</span>{" "}
                tokens
                {pendingTotal > 0 ? (
                  <span className="text-muted"> ({pendingTotal} pending)</span>
                ) : null}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (!bankComplete) {
                  showToast("Configure your payout account on the Wallet tab first", "error");
                  return;
                }
                setPayoutOpen(true);
              }}
            >
              Request payout
            </Button>
          </div>
          {payoutRequests.length === 0 ? (
            <p className="mt-2 text-xs text-muted">No payout requests yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {payoutRequests.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-1 rounded-[14px] border border-border bg-card px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{payoutFiatLabel(r, tokenValueNaira, tokenValueGhs)}</p>
                    <p className="text-[11px] text-muted">
                      {r.tokenAmount} tokens · {r.currency} · {toDateLabel(r.createdAt)}
                    </p>
                  </div>
                  <Badge variant={r.status === "PENDING" ? "outline" : r.status === "APPROVED" ? "accent" : "neutral"}>
                    {r.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Sheet open={bankSheetOpen} onOpenChange={setBankSheetOpen}>
        <SheetContent className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{bankComplete ? "Edit payout account" : "Setup payout account"}</SheetTitle>
            <SheetDescription>
              Choose your bank, enter your 10-digit account number, and the account holder name as on bank records.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3 pb-6">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Bank</label>
              <select
                value={bankSelect}
                onChange={(e) => {
                  const v = e.target.value;
                  setBankSelect(v);
                  if (v !== NG_PAYOUT_BANK_OTHER) {
                    setOtherBankName("");
                  }
                }}
                className="h-12 w-full rounded-[12px] border border-border bg-input pl-4 pr-10 text-sm text-foreground outline-none"
              >
                <option value="">Select bank…</option>
                {NG_PAYOUT_BANK_PRESETS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
                <option value={NG_PAYOUT_BANK_OTHER}>Other (enter bank name)</option>
              </select>
            </div>
            {bankSelect === NG_PAYOUT_BANK_OTHER ? (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Bank name</label>
                <Input
                  value={otherBankName}
                  onChange={(e) => setOtherBankName(e.target.value)}
                  placeholder="e.g. Fidelity Bank"
                  maxLength={120}
                />
              </div>
            ) : null}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Account number</label>
              <Input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10 digits"
                inputMode="numeric"
                maxLength={10}
                autoComplete="off"
              />
              <p className="mt-1 text-[11px] text-muted">Must be exactly 10 digits ({accountNumber.length}/10)</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Account holder name</label>
              <Input
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                placeholder="As on bank records"
              />
            </div>
            <Button type="button" onClick={() => void saveBankDetails()} disabled={bankSaving} className="w-full">
              {bankSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={payoutOpen} onOpenChange={setPayoutOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Request payout</SheetTitle>
            <SheetDescription>
              Choose how many tokens to cash out and the currency for your transfer.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Tokens (max {availableForPayout})</label>
              <Input
                type="number"
                min={1}
                max={availableForPayout}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Currency</label>
              <select
                value={payoutCurrency}
                onChange={(e) => setPayoutCurrency(e.target.value as "NGN" | "GHS")}
                className="h-12 w-full rounded-[12px] border border-border bg-input pl-4 pr-10 text-sm text-foreground outline-none"
              >
                <option value="NGN">🇳🇬 NGN — Nigerian naira</option>
                <option value="GHS">🇬🇭 GHS — Ghanaian cedi</option>
              </select>
            </div>
            <Button type="button" className="w-full" disabled={payoutSaving} onClick={() => void submitPayout()}>
              {payoutSaving ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AppToast toast={toast} />
    </section>
  );
}
