"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Award, BarChart2, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { AppToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardRole } from "@/components/DashboardRoleProvider";
import { useToast } from "@/hooks/use-toast";

type PresetPeriod = "this_month" | "last_month" | "ytd";
type RangeTab = PresetPeriod | "custom";
type LeaderboardTab = "senders" | "receivers";

type AnalyticsPayload = {
  summary: {
    totalRecognitions: number;
    totalCoinsGiven: number;
    activeUsers: number;
    avgPerUser: number;
  };
  leaderboard: {
    topSenders: Array<{ userId: string; name: string; count: number }>;
    topReceivers: Array<{ userId: string; name: string; count: number }>;
  };
  valueCounts: Array<{ valueId: string; name: string; emoji: string; count: number }>;
  disengaged: Array<{
    id: string;
    name: string;
    email: string;
    lastActiveAt: string | null;
  }>;
};

const presetLabels: Record<PresetPeriod, string> = {
  this_month: "This month",
  last_month: "Last month",
  ytd: "Year",
};

const rangeTabItems: { id: RangeTab; label: string }[] = [
  { id: "this_month", label: presetLabels.this_month },
  { id: "last_month", label: presetLabels.last_month },
  { id: "ytd", label: presetLabels.ytd },
  { id: "custom", label: "Custom" },
];

function isCustomActiveQuery(q: string) {
  const p = new URLSearchParams(q);
  return p.has("year") && (p.has("month") || p.has("quarter"));
}

function parseCustomQuery(q: string): {
  kind: "month" | "quarter";
  year: number;
  month: number;
  quarter: number;
} | null {
  const p = new URLSearchParams(q);
  const year = p.get("year");
  const month = p.get("month");
  const quarter = p.get("quarter");
  if (year && month) {
    return { kind: "month", year: Number(year), month: Number(month), quarter: 1 };
  }
  if (year && quarter) {
    return { kind: "quarter", year: Number(year), month: 1, quarter: Number(quarter) };
  }
  return null;
}

function draftToQuery(kind: "month" | "quarter", year: number, month: number, quarter: number) {
  if (kind === "month") return `year=${year}&month=${month}`;
  return `year=${year}&quarter=${quarter}`;
}

/** Display label for the analytics range; mirrors query params (local calendar for presets). */
function formatAnalyticsPeriodHeading(query: string): string {
  const params = new URLSearchParams(query);
  const period = params.get("period");
  const yearStr = params.get("year");
  const monthStr = params.get("month");
  const quarterStr = params.get("quarter");

  if (yearStr && monthStr) {
    const y = Number(yearStr);
    const mo = Number(monthStr);
    if (!Number.isNaN(y) && !Number.isNaN(mo) && mo >= 1 && mo <= 12) {
      return new Date(y, mo - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
    }
  }
  if (yearStr && quarterStr) {
    const y = Number(yearStr);
    const q = Number(quarterStr);
    if (!Number.isNaN(y) && !Number.isNaN(q) && q >= 1 && q <= 4) {
      return `Q${q} ${y}`;
    }
  }

  const now = new Date();
  if (period === "last_month") {
    return new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });
  }
  if (period === "ytd") {
    const y = now.getFullYear();
    return `Jan - Dec ${y}`;
  }
  return now.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function formatLastActive(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

type WorkspaceAnalyticsClientProps = {
  pageTitle: string;
  /** Admin analytics only; omit on dashboard leaderboard */
  showNeedsAttention?: boolean;
};

export function WorkspaceAnalyticsClient({
  pageTitle,
  showNeedsAttention = false,
}: WorkspaceAnalyticsClientProps) {
  const role = useDashboardRole();
  const canNudge = role === "ADMIN";

  const now = useMemo(() => new Date(), []);
  const defaultYear = now.getFullYear();

  const [activeQuery, setActiveQuery] = useState("period=this_month");
  const [rangeTab, setRangeTab] = useState<RangeTab>("this_month");
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const modalRevertRef = useRef<{ rangeTab: RangeTab; activeQuery: string } | null>(null);

  const [draftKind, setDraftKind] = useState<"month" | "quarter">("month");
  const [draftYear, setDraftYear] = useState(defaultYear);
  const [draftMonth, setDraftMonth] = useState(now.getMonth() + 1);
  const [draftQuarter, setDraftQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);

  const [leaderboardTab, setLeaderboardTab] = useState<LeaderboardTab>("senders");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNudging, setIsNudging] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return Array.from({ length: 7 }, (_, i) => y - 3 + i);
  }, [now]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/analytics?${activeQuery}`, { cache: "no-store" });
        const payload = (await response.json()) as { data?: AnalyticsPayload; error?: string };
        if (!response.ok || !payload.data) {
          showToast(payload.error ?? "Failed to load analytics", "error");
          return;
        }
        setData(payload.data);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [activeQuery, showToast]);

  const openCustomModalFromPreset = () => {
    modalRevertRef.current = { rangeTab, activeQuery };
    const parsed = isCustomActiveQuery(activeQuery) ? parseCustomQuery(activeQuery) : null;
    let kind: "month" | "quarter" = "month";
    let y = defaultYear;
    let mo = now.getMonth() + 1;
    let qtr = Math.floor(now.getMonth() / 3) + 1;
    if (parsed) {
      kind = parsed.kind;
      y = parsed.year;
      mo = parsed.month;
      qtr = parsed.quarter;
    }
    setDraftKind(kind);
    setDraftYear(y);
    setDraftMonth(mo);
    setDraftQuarter(qtr);
    const query = draftToQuery(kind, y, mo, qtr);
    setRangeTab("custom");
    setActiveQuery(query);
    setCustomModalOpen(true);
  };

  const openCustomModalToEdit = () => {
    modalRevertRef.current = { rangeTab: "custom", activeQuery };
    const parsed = parseCustomQuery(activeQuery);
    if (parsed) {
      setDraftKind(parsed.kind);
      setDraftYear(parsed.year);
      setDraftMonth(parsed.month);
      setDraftQuarter(parsed.quarter);
    } else {
      setDraftKind("month");
      setDraftYear(defaultYear);
      setDraftMonth(now.getMonth() + 1);
      setDraftQuarter(Math.floor(now.getMonth() / 3) + 1);
    }
    setCustomModalOpen(true);
  };

  const handleRangeTabChange = (next: string) => {
    if (next === "custom") {
      if (rangeTab === "custom") {
        openCustomModalToEdit();
        return;
      }
      openCustomModalFromPreset();
      return;
    }
    modalRevertRef.current = null;
    setCustomModalOpen(false);
    setRangeTab(next as PresetPeriod);
    setActiveQuery(`period=${next}`);
  };

  const applyCustomFromModal = () => {
    const q = draftToQuery(draftKind, draftYear, draftMonth, draftQuarter);
    modalRevertRef.current = null;
    setActiveQuery(q);
    setRangeTab("custom");
    setCustomModalOpen(false);
  };

  const handleCustomSheetOpenChange = (open: boolean) => {
    if (!open) {
      setCustomModalOpen(false);
      const snap = modalRevertRef.current;
      if (snap) {
        modalRevertRef.current = null;
        setRangeTab(snap.rangeTab);
        setActiveQuery(snap.activeQuery);
      }
      return;
    }
    setCustomModalOpen(true);
  };

  const periodHeading = useMemo(() => formatAnalyticsPeriodHeading(activeQuery), [activeQuery]);

  const leaderboardRows = useMemo(() => {
    if (!data) return [];
    return leaderboardTab === "senders" ? data.leaderboard.topSenders : data.leaderboard.topReceivers;
  }, [data, leaderboardTab]);

  const maxValueCount = useMemo(
    () => Math.max(1, ...(data?.valueCounts.map((item) => item.count) ?? [1])),
    [data],
  );

  const handleNudge = async (userId: string) => {
    setIsNudging(userId);
    try {
      const response = await fetch("/api/admin/analytics/nudge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        showToast(payload.error ?? "Could not send nudge", "error");
        return;
      }
      showToast("Nudge sent");
    } finally {
      setIsNudging(null);
    }
  };

  return (
    <section className="pb-10">
      <header className="py-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{pageTitle}</h1>
        <p className="mt-1 text-xs text-muted">Track recognition health across your team.</p>
      </header>

      <div className="mb-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Date range</p>
        <Segmented
          className="[&_button]:px-2 [&_button]:text-[10px] sm:[&_button]:px-3 sm:[&_button]:text-xs"
          items={rangeTabItems}
          value={rangeTab}
          onChange={handleRangeTabChange}
        />
      </div>

      <Sheet open={customModalOpen} onOpenChange={handleCustomSheetOpenChange}>
        <SheetContent className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Custom range</SheetTitle>
            <SheetDescription>
              Choose a month or quarter, then apply. The Custom tab stays selected after you close this.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted">Type</label>
              <select
                value={draftKind}
                onChange={(e) => setDraftKind(e.target.value as "month" | "quarter")}
                className="h-10 rounded-[10px] border border-border bg-input pl-3 pr-10 text-sm text-foreground outline-none"
              >
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted">Year</label>
              <select
                value={draftYear}
                onChange={(e) => setDraftYear(Number(e.target.value))}
                className="h-10 rounded-[10px] border border-border bg-input pl-3 pr-10 text-sm text-foreground outline-none"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            {draftKind === "month" ? (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted">Month</label>
                <select
                  value={draftMonth}
                  onChange={(e) => setDraftMonth(Number(e.target.value))}
                  className="h-10 rounded-[10px] border border-border bg-input pl-3 pr-10 text-sm text-foreground outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1, 1).toLocaleString("en-US", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted">Quarter</label>
                <select
                  value={draftQuarter}
                  onChange={(e) => setDraftQuarter(Number(e.target.value))}
                  className="h-10 rounded-[10px] border border-border bg-input pl-3 pr-10 text-sm text-foreground outline-none"
                >
                  {[1, 2, 3, 4].map((q) => (
                    <option key={q} value={q}>
                      Q{q}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="button" className="flex-1 sm:flex-none" onClick={() => applyCustomFromModal()}>
              Apply
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => handleCustomSheetOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <h2 className="mb-4 text-xl font-semibold tracking-tight text-foreground md:text-2xl">{periodHeading}</h2>

      {isLoading || !data ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-[20px] border border-border bg-card p-5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-8 w-16" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Recognitions", value: data.summary.totalRecognitions, icon: Sparkles },
              { label: "Coins given", value: data.summary.totalCoinsGiven, icon: BarChart2 },
              { label: "Active people", value: data.summary.activeUsers, icon: TrendingUp },
              { label: "Avg per person", value: data.summary.avgPerUser, icon: Award },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-[20px] border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                      {item.label}
                    </p>
                    <Icon size={14} className="text-muted" />
                  </div>
                  <p className="mt-2 font-mono text-[28px] font-bold leading-none text-foreground">
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                Leaderboard
              </h2>
              <div className="w-44">
                <Segmented
                  items={[
                    { id: "senders", label: "Senders" },
                    { id: "receivers", label: "Receivers" },
                  ]}
                  value={leaderboardTab}
                  onChange={(next) => setLeaderboardTab(next as LeaderboardTab)}
                />
              </div>
            </div>

            {leaderboardRows.length === 0 ? (
              <EmptyState title="No data for this period yet." />
            ) : (
              <ul className="overflow-hidden rounded-[16px] border border-border bg-card">
                {leaderboardRows.map((row, index) => {
                  const isPodium = index < 3;
                  return (
                    <li
                      key={row.userId}
                      className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                    >
                      <span
                        className={
                          isPodium
                            ? "flex h-7 w-7 items-center justify-center rounded-full border border-accent/30 bg-accent/10 font-mono text-xs font-semibold text-accent"
                            : "flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card-2 font-mono text-xs text-muted"
                        }
                      >
                        {index + 1}
                      </span>
                      <span className="flex-1 truncate text-sm text-foreground">{row.name}</span>
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {row.count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              By value
            </h2>
            {data.valueCounts.length === 0 ? (
              <EmptyState title="No values used yet." />
            ) : (
              <div className="space-y-2">
                {data.valueCounts.map((item) => (
                  <div
                    key={item.valueId}
                    className="rounded-[16px] border border-border bg-card px-4 py-3.5"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-foreground">
                        <span className="text-base">{item.emoji}</span>
                        <span>{item.name}</span>
                      </span>
                      <span className="font-mono text-xs text-muted">{item.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-card-2">
                      <div
                        className="h-full rounded-full bg-foreground/80 transition-[width]"
                        style={{ width: `${(item.count / maxValueCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {showNeedsAttention ? (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-warning">
              <TrendingDown size={12} />
              Needs attention
            </h2>
            {data.disengaged.length === 0 ? (
              <EmptyState title="Everyone's active." description="No disengaged teammates this period." />
            ) : (
              <div className="space-y-2">
                {data.disengaged.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-3 rounded-[16px] border border-border bg-card px-4 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                      <p className="truncate text-[11px] text-muted">
                        Last active {formatLastActive(user.lastActiveAt)}
                      </p>
                    </div>
                    {canNudge ? (
                      <Button
                        onClick={() => void handleNudge(user.id)}
                        disabled={isNudging === user.id}
                        variant="outline"
                        size="sm"
                      >
                        {isNudging === user.id ? "Sending..." : "Nudge"}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
          ) : null}
        </div>
      )}

      <AppToast toast={toast} />
    </section>
  );
}
