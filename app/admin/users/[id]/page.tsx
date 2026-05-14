"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, MoreHorizontal } from "lucide-react";
import {
  AdminUserMutationsSheet,
  type AdminMutationPosition,
  type AdminMutationUser,
  type AdminUserMutationsRef,
} from "@/components/admin/AdminUserMutationsSheet";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow } from "@/components/ui/list-row";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AppToast } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

type Role = "EMPLOYEE" | "MANAGER" | "ADMIN";

type OverviewProfile = {
  id: string;
  name: string;
  email: string;
  feedDisplayName: string;
  avatarUrl: string | null;
  role: Role;
  coinsToGive: number;
  spotTokensEarned: number;
  lastActiveAt: string | null;
  deletedAt: string | null;
  position: { id: string; name: string } | null;
};

type RecognitionRow = {
  id: string;
  senderId: string;
  recipientId: string;
  message: string;
  coinAmount: number;
  createdAt: string;
  sender: { displayName: string; avatarUrl: string | null };
  recipient: { displayName: string; avatarUrl: string | null };
  value: { name: string; emoji: string };
};

type CoinTxRow = {
  id: string;
  type: string;
  amount: number;
  referenceId: string | null;
  createdAt: string;
};

type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
};

type OverviewData = {
  profile: OverviewProfile;
  coinsSentThisMonth: number;
  coinsReceivedThisMonth: number;
  recognitions: RecognitionRow[];
  recognitionMeta: PageMeta;
  coinTransactions: CoinTxRow[];
  coinTransactionMeta: PageMeta;
};

const roleVariant: Record<Role, "neutral" | "accent" | "outline"> = {
  ADMIN: "accent",
  MANAGER: "outline",
  EMPLOYEE: "neutral",
};

function toDateLabel(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatLastActive(dateValue: string | null) {
  if (!dateValue) return "Never";
  return toDateLabel(dateValue);
}

function coinTxTypeLabel(type: string) {
  const map: Record<string, string> = {
    ALLOWANCE_GRANT: "Monthly allowance",
    RECOGNITION_SENT: "Recognition sent",
    RECOGNITION_RECEIVED: "Recognition received",
    BONUS_GRANT: "Bonus grant",
    PAYOUT: "Payout",
  };
  return map[type] ?? type;
}

function profileToMutationUser(profile: OverviewProfile): AdminMutationUser {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    feedDisplayName: profile.feedDisplayName,
    role: profile.role,
    position: profile.position,
  };
}

export default function AdminUserOverviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = params.id;
  const mutationsRef = useRef<AdminUserMutationsRef>(null);
  const { toast, showToast } = useToast();

  const [positions, setPositions] = useState<AdminMutationPosition[]>([]);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recPage, setRecPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const initialLoadRef = useRef(true);

  const loadPositions = useCallback(async () => {
    const response = await fetch("/api/admin/positions", { cache: "no-store" });
    const payload = (await response.json()) as { data?: AdminMutationPosition[]; error?: string };
    if (!response.ok) {
      showToast(payload.error ?? "Failed to load positions", "error");
      return;
    }
    setPositions(payload.data ?? []);
  }, [showToast]);

  const loadOverview = useCallback(async () => {
    if (!userId) return;
    if (initialLoadRef.current) setIsLoading(true);
    try {
      const qs = new URLSearchParams({
        recognitionPage: String(recPage),
        recognitionPageSize: "20",
        coinTxPage: String(txPage),
        coinTxPageSize: "25",
      });
      const response = await fetch(`/api/admin/users/${userId}/overview?${qs}`, { cache: "no-store" });
      const payload = (await response.json()) as { data?: OverviewData; error?: string };
      if (!response.ok) {
        showToast(payload.error ?? "Could not load overview", "error");
        setOverview(null);
        return;
      }
      setOverview(payload.data ?? null);
    } finally {
      if (initialLoadRef.current) {
        setIsLoading(false);
        initialLoadRef.current = false;
      }
    }
  }, [userId, recPage, txPage, showToast]);

  useLayoutEffect(() => {
    initialLoadRef.current = true;
    setOverview(null);
    setRecPage(1);
    setTxPage(1);
  }, [userId]);

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const onMutated = useCallback(async () => {
    await loadOverview();
  }, [loadOverview]);

  const profile = overview?.profile;
  const isDeactivated = !!profile?.deletedAt;

  const recMeta = overview?.recognitionMeta;
  const txMeta = overview?.coinTransactionMeta;

  const recTotalPages = useMemo(() => {
    if (!recMeta) return 1;
    return Math.max(1, Math.ceil(recMeta.total / recMeta.pageSize));
  }, [recMeta]);

  const txTotalPages = useMemo(() => {
    if (!txMeta) return 1;
    return Math.max(1, Math.ceil(txMeta.total / txMeta.pageSize));
  }, [txMeta]);

  const mutationUser = profile ? profileToMutationUser(profile) : null;

  return (
    <section className="pb-10">
      <PageHeader
        title={profile?.feedDisplayName ?? "Teammate"}
        description={
          profile
            ? `${profile.email} · Last active ${formatLastActive(profile.lastActiveAt)}${
                isDeactivated ? " · Deactivated" : ""
              }`
            : "Loading…"
        }
        backHref="/admin"
        action={
          mutationUser && !isDeactivated ? (
            <Dropdown>
              <DropdownTrigger asChild>
                <button
                  type="button"
                  aria-label="Teammate actions"
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-border bg-card text-muted transition-colors hover:border-border-strong hover:text-foreground"
                >
                  <MoreHorizontal size={16} />
                </button>
              </DropdownTrigger>
              <DropdownContent align="end">
                <DropdownItem onClick={() => mutationsRef.current?.openBonus(mutationUser)}>Grant bonus coins</DropdownItem>
                <DropdownItem onClick={() => mutationsRef.current?.openRole(mutationUser)}>Change role</DropdownItem>
                <DropdownItem onClick={() => mutationsRef.current?.openPosition(mutationUser)}>Change position</DropdownItem>
                <DropdownItem
                  className="text-destructive data-[highlighted]:bg-destructive/10"
                  onClick={() => mutationsRef.current?.openDeactivate(mutationUser)}
                >
                  Deactivate
                </DropdownItem>
              </DropdownContent>
            </Dropdown>
          ) : null
        }
      />

      {isLoading && !overview ? (
        <div className="space-y-4">
          <div className="flex gap-3">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-28 rounded-[20px]" />
            <Skeleton className="h-28 rounded-[20px]" />
          </div>
        </div>
      ) : !profile ? (
        <p className="text-sm text-muted">User not found or you do not have access.</p>
      ) : (
        <>
          <div className="-mt-2 mb-6 flex flex-wrap items-center gap-2">
            <Avatar name={profile.feedDisplayName} />
            <Badge variant={roleVariant[profile.role]}>{profile.role}</Badge>
            {profile.position ? (
              <span className="text-xs text-muted">{profile.position.name}</span>
            ) : (
              <span className="text-xs text-muted">No position</span>
            )}
          </div>

          {isDeactivated ? (
            <p className="mb-6 rounded-[14px] border border-border bg-card-2 px-4 py-3 text-xs text-muted">
              This account is deactivated and can no longer send or receive recognition.
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[20px] border border-border bg-card p-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">Coins sent (this month)</p>
              <p className="mt-2 font-mono text-[32px] font-bold leading-none tracking-tight text-foreground">
                {overview?.coinsSentThisMonth ?? 0}
              </p>
            </div>
            <div className="rounded-[20px] border border-border bg-card p-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">Coins received (this month)</p>
              <p className="mt-2 font-mono text-[32px] font-bold leading-none tracking-tight text-accent">
                {overview?.coinsReceivedThisMonth ?? 0}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[20px] border border-border bg-card p-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">Coins to give</p>
              <p className="mt-2 font-mono text-[32px] font-bold leading-none text-foreground">{profile.coinsToGive}</p>
            </div>
            <div className="rounded-[20px] border border-border bg-card p-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">Spot tokens</p>
              <p className="mt-2 font-mono text-[32px] font-bold leading-none text-accent">{profile.spotTokensEarned}</p>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Token history</h2>
              {txMeta && txMeta.total > 0 ? (
                <span className="text-[11px] text-muted">
                  Page {txMeta.page} of {txTotalPages} ({txMeta.total} total)
                </span>
              ) : null}
            </div>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-[16px]" />
                ))}
              </div>
            ) : !overview?.coinTransactions.length ? (
              <EmptyState title="No token transactions yet." description="Ledger entries appear when coins move or payouts occur." />
            ) : (
              <>
                <ul className="space-y-2">
                  {overview.coinTransactions.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-3 rounded-[16px] border border-border bg-card px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{coinTxTypeLabel(row.type)}</p>
                        <p className="truncate text-xs text-muted">{toDateLabel(row.createdAt)}</p>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-semibold text-foreground">{row.amount}</span>
                    </li>
                  ))}
                </ul>
                {txMeta && txTotalPages > 1 ? (
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={txPage <= 1}
                      onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={txPage >= txTotalPages}
                      onClick={() => setTxPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Recognition activity</h2>
              {recMeta && recMeta.total > 0 ? (
                <span className="text-[11px] text-muted">
                  Page {recMeta.page} of {recTotalPages} ({recMeta.total} total)
                </span>
              ) : null}
            </div>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-[16px]" />
                ))}
              </div>
            ) : !overview?.recognitions.length ? (
              <EmptyState title="No recognition activity yet." description="Recognitions involving this teammate will show here." />
            ) : (
              <>
                <div className="space-y-2">
                  {overview.recognitions.map((item) => {
                    const isReceived = item.recipientId === profile.id;
                    const isSent = item.senderId === profile.id;
                    const amountText = isReceived ? `+${item.coinAmount}` : `-${item.coinAmount}`;
                    const description = isReceived
                      ? `From ${item.sender.displayName} · ${item.value.emoji} ${item.value.name}`
                      : isSent
                        ? `To ${item.recipient.displayName} · ${item.value.emoji} ${item.value.name}`
                        : `${item.sender.displayName} → ${item.recipient.displayName} · ${item.value.emoji} ${item.value.name}`;

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
                {recMeta && recTotalPages > 1 ? (
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={recPage <= 1}
                      onClick={() => setRecPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={recPage >= recTotalPages}
                      onClick={() => setRecPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </>
      )}

      <AdminUserMutationsSheet
        ref={mutationsRef}
        positions={positions}
        onMutated={onMutated}
        afterDeactivate={() => router.push("/admin")}
      />

      <AppToast toast={toast} />
    </section>
  );
}
