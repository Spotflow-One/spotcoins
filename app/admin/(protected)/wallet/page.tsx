"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Check, Download, X } from "lucide-react";
import { AppToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type BalanceRow = {
  id: string;
  name: string;
  email: string;
  feedDisplayName: string;
  spotTokensEarned: number;
  pendingPayoutTokens: number;
};

type PayoutRequestRow = {
  id: string;
  tokenAmount: number;
  currency: "NGN" | "GHS";
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  resolvedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    username: string | null;
    payoutBankName: string | null;
    payoutBankAccountName: string | null;
    payoutBankAccountNumber: string | null;
  };
};

type Tab = "balances" | "requests";

export default function AdminWalletPage() {
  const [tab, setTab] = useState<Tab>("balances");
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [reqFilter, setReqFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");
  const [requests, setRequests] = useState<PayoutRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  const loadBalances = useCallback(async () => {
    const res = await fetch("/api/admin/wallet/balances", { cache: "no-store" });
    const json = (await res.json()) as { data?: BalanceRow[]; error?: string };
    if (!res.ok) {
      showToast(json.error ?? "Failed to load balances", "error");
      return;
    }
    setBalances(json.data ?? []);
  }, [showToast]);

  const loadRequests = useCallback(async () => {
    const q = reqFilter === "ALL" ? "" : `?status=${reqFilter}`;
    const res = await fetch(`/api/admin/payout-requests${q}`, { cache: "no-store" });
    const json = (await res.json()) as { data?: PayoutRequestRow[]; error?: string };
    if (!res.ok) {
      showToast(json.error ?? "Failed to load requests", "error");
      return;
    }
    setRequests(json.data ?? []);
  }, [reqFilter, showToast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadBalances();
        if (!cancelled) await loadRequests();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadBalances, loadRequests]);

  useEffect(() => {
    if (tab !== "requests") return;
    void loadRequests();
  }, [tab, loadRequests]);

  const approve = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/payout-requests/${id}/approve`, { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        showToast(json.error ?? "Could not approve", "error");
        return;
      }
      showToast("Approved");
      await loadBalances();
      await loadRequests();
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/payout-requests/${id}/reject`, { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        showToast(json.error ?? "Could not reject", "error");
        return;
      }
      showToast("Rejected");
      await loadBalances();
      await loadRequests();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="pb-10">
      <PageHeader
        title="Wallet"
        description="Team token balances and payout requests."
        action={
          <Button type="button" variant="outline" size="sm" disabled title="Coming soon">
            <Download size={14} />
            Download approved payout
          </Button>
        }
      />

      <div className="mb-4">
        <Segmented
          items={[
            { id: "balances", label: "Balances" },
            { id: "requests", label: "Payout requests" },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : tab === "balances" ? (
        balances.length === 0 ? (
          <EmptyState icon={Banknote} title="No members" />
        ) : (
          <ul className="space-y-2">
            {balances.map((row) => (
              <li
                key={row.id}
                className="rounded-[16px] border border-border bg-card px-4 py-3.5 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{row.feedDisplayName}</p>
                    <p className="truncate text-xs text-muted">
                      {row.name} · {row.email}
                    </p>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <p className="text-foreground">{row.spotTokensEarned} tokens</p>
                    {row.pendingPayoutTokens > 0 ? (
                      <p className="text-muted">Pending: {row.pendingPayoutTokens}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={reqFilter === s ? "default" : "outline"}
                onClick={() => setReqFilter(s)}
              >
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </Button>
            ))}
          </div>
          {requests.length === 0 ? (
            <EmptyState icon={Banknote} title="No requests in this view." />
          ) : (
            <ul className="space-y-2">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="rounded-[16px] border border-border bg-card px-4 py-3.5 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{r.user.name}</p>
                      <p className="text-xs text-muted">{r.user.email}</p>
                      <p className="mt-1 font-mono text-xs text-foreground">
                        {r.tokenAmount} tokens · {r.currency}
                      </p>
                      <p className="mt-1 text-[11px] text-muted">
                        Bank: {r.user.payoutBankName ?? "—"} · Holder: {r.user.payoutBankAccountName ?? "—"} · Acct:{" "}
                        {r.user.payoutBankAccountNumber ?? "—"}
                      </p>
                      <Badge variant={r.status === "PENDING" ? "outline" : r.status === "APPROVED" ? "accent" : "neutral"} className="mt-2">
                        {r.status}
                      </Badge>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      {r.status === "PENDING" ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            className="gap-1"
                            disabled={busyId === r.id}
                            onClick={() => void approve(r.id)}
                          >
                            <Check size={14} />
                            Approve
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={busyId === r.id}
                            onClick={() => void reject(r.id)}
                          >
                            <X size={14} />
                            Reject
                          </Button>
                        </>
                      ) : r.status === "APPROVED" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled
                          title="PDF download will be available in a later version"
                        >
                          <Download size={14} />
                          PDF
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <AppToast toast={toast} />
    </section>
  );
}
