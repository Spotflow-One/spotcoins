"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Clock,
  Coins,
  Hash,
  LogOut,
  Plus,
  Slack,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AppToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

type CompanyValue = {
  id: string;
  name: string;
  emoji: string;
  isActive: boolean;
};

type Position = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  feedDisplayName: string;
  role: "EMPLOYEE" | "MANAGER" | "ADMIN";
  deletedAt: string | null;
  position: { id: string; name: string } | null;
};

type WorkspaceSettings = {
  id: string;
  name: string;
  companyLegalName: string | null;
  monthlyAllowance: number;
  tokenValueNaira: number;
  tokenValueGhs: number;
  slackTeamId: string | null;
  targetChannelId: string | null;
  recognitionSchedule: string;
  timezone: string;
  values: CompanyValue[];
};

type ModalState =
  | { type: "workspaceName"; value: string }
  | { type: "companyLegalName"; value: string }
  | { type: "monthlyAllowance"; value: number }
  | { type: "tokenValueNaira"; value: number }
  | { type: "tokenValueGhs"; value: number }
  | { type: "channelId"; value: string }
  | { type: "timezone"; value: string }
  | { type: "addValue"; name: string; emoji: string }
  | { type: "addPosition"; name: string }
  | { type: "editPosition"; id: string; name: string }
  | null;

const scheduleOptions = [
  { id: "EVERY_FRIDAY", label: "Every Friday" },
  { id: "LAST_FRIDAY", label: "Last Friday" },
] as const;

const emojiChoices = ["🔥", "🚀", "🤝", "🎯", "💡", "🌟", "⚡", "🧠", "🏆", "🙌"];

type SettingRowProps = {
  icon: React.ReactNode;
  title: string;
  description?: string;
  value?: React.ReactNode;
  onClick?: () => void;
};

function SettingRow({ icon, title, description, value, onClick }: SettingRowProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[16px] border border-border bg-card px-4 py-3.5 text-left transition-colors ${
        onClick ? "hover:border-border-strong hover:bg-card-2" : ""
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card-2 text-muted">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="truncate text-[11px] text-muted">{description}</p>
        ) : null}
      </div>
      {value !== undefined ? (
        <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted">
          {value}
          {onClick ? <ChevronRight size={14} /> : null}
        </span>
      ) : onClick ? (
        <ChevronRight size={14} className="shrink-0 text-muted" />
      ) : null}
    </Comp>
  );
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [workspace, setWorkspace] = useState<WorkspaceSettings | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [positionsExpanded, setPositionsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [sendingFriday, setSendingFriday] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const { toast, showToast } = useToast();
  const [oauthBanner, setOauthBanner] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const activeValuesCount = useMemo(
    () => workspace?.values.filter((value) => value.isActive).length ?? 0,
    [workspace],
  );

  const loadPositions = async () => {
    const response = await fetch("/api/admin/positions", { cache: "no-store" });
    const payload = (await response.json()) as { data?: Position[]; error?: string };
    if (!response.ok) {
      showToast(payload.error ?? "Failed to load positions", "error");
      return;
    }
    setPositions(payload.data ?? []);
  };

  const loadUsers = async () => {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    const payload = (await response.json()) as { data?: AdminUser[]; error?: string };
    if (!response.ok) {
      showToast(payload.error ?? "Failed to load users", "error");
      return;
    }
    setUsers(payload.data ?? []);
  };

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const [workspaceRes] = await Promise.all([
        fetch("/api/admin/workspace", { cache: "no-store" }),
        loadPositions(),
        loadUsers(),
      ]);
      const payload = (await workspaceRes.json()) as { data?: WorkspaceSettings; error?: string };
      if (!workspaceRes.ok || !payload.data) {
        showToast(payload.error ?? "Failed to load workspace settings", "error");
        return;
      }
      setWorkspace(payload.data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  useEffect(() => {
    const slackStatus = searchParams.get("slack");
    if (!slackStatus) return;

    const statusMessageMap: Record<string, { message: string; type: "success" | "error" }> = {
      connected: { type: "success", message: "Slack workspace connected successfully." },
      oauth_denied: { type: "error", message: "Slack connection was canceled." },
      missing_code: { type: "error", message: "Slack OAuth code is missing. Please try again." },
      invalid_state: { type: "error", message: "Slack OAuth session expired. Please reconnect." },
      not_configured: { type: "error", message: "Slack OAuth is not configured in environment." },
      invalid_response: { type: "error", message: "Slack returned an invalid response." },
      workspace_not_found: { type: "error", message: "Workspace could not be resolved for Slack install." },
      oauth_failed: { type: "error", message: "Slack connection failed. Please try again." },
    };

    setOauthBanner(
      statusMessageMap[slackStatus] ?? { type: "error", message: "Slack connection failed." },
    );

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("slack");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const patchWorkspace = async (data: Partial<WorkspaceSettings>) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/workspace", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = (await response.json()) as { data?: WorkspaceSettings; error?: string };
      if (!response.ok || !payload.data) {
        showToast(payload.error ?? "Unable to save changes", "error");
        return false;
      }
      setWorkspace(payload.data);
      showToast("Settings updated");
      return true;
    } finally {
      setIsSaving(false);
    }
  };

  const toggleValue = async (value: CompanyValue) => {
    if (!workspace) return;
    if (!value.isActive && activeValuesCount >= 10) {
      showToast("Maximum 10 active values allowed", "error");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/values/${value.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !value.isActive }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        showToast(payload.error ?? "Unable to update value", "error");
        return;
      }
      await loadSettings();
      showToast("Value updated");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteValue = async (value: CompanyValue) => {
    if (
      !window.confirm(
        `Delete company value “${value.name}”? This cannot be undone. Values used in recognition history cannot be deleted.`,
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/values/${value.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        showToast(payload.error ?? "Unable to delete value", "error");
        return;
      }
      await loadSettings();
      showToast("Company value deleted");
    } finally {
      setIsSaving(false);
    }
  };

  const togglePosition = async (position: Position) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/positions/${position.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !position.isActive }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        showToast(payload.error ?? "Unable to update position", "error");
        return;
      }
      await loadPositions();
      showToast("Position updated");
    } finally {
      setIsSaving(false);
    }
  };

  const deletePositionPermanently = async (position: Position) => {
    const count = users.filter((u) => !u.deletedAt && u.position?.id === position.id).length;
    if (count > 0) {
      showToast("Reassign users before deleting this position", "error");
      return;
    }
    if (!window.confirm(`Delete position “${position.name}”? This cannot be undone.`)) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/positions/${position.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        showToast(payload.error ?? "Could not delete position", "error");
        return;
      }
      showToast("Position deleted");
      await Promise.all([loadPositions(), loadUsers()]);
    } finally {
      setIsSaving(false);
    }
  };

  const saveModal = async () => {
    if (!workspace || !modal) return;

    if (modal.type === "workspaceName") {
      if (!modal.value.trim()) return;
      const ok = await patchWorkspace({ name: modal.value.trim() });
      if (ok) setModal(null);
      return;
    }

    if (modal.type === "monthlyAllowance") {
      const ok = await patchWorkspace({ monthlyAllowance: Math.max(1, modal.value) });
      if (ok) setModal(null);
      return;
    }

    if (modal.type === "tokenValueNaira") {
      const ok = await patchWorkspace({ tokenValueNaira: Math.max(1, modal.value) });
      if (ok) setModal(null);
      return;
    }

    if (modal.type === "tokenValueGhs") {
      const ok = await patchWorkspace({ tokenValueGhs: Math.max(0, modal.value) });
      if (ok) setModal(null);
      return;
    }

    if (modal.type === "companyLegalName") {
      const ok = await patchWorkspace({ companyLegalName: modal.value.trim() || null });
      if (ok) setModal(null);
      return;
    }

    if (modal.type === "channelId") {
      const ok = await patchWorkspace({ targetChannelId: modal.value.trim() || null });
      if (ok) setModal(null);
      return;
    }

    if (modal.type === "timezone") {
      if (!modal.value.trim()) return;
      const ok = await patchWorkspace({ timezone: modal.value.trim() });
      if (ok) setModal(null);
      return;
    }

    if (modal.type === "addValue") {
      if (!modal.name.trim() || !modal.emoji.trim()) return;
      if (activeValuesCount >= 10) {
        showToast("Maximum 10 active values allowed", "error");
        return;
      }
      setIsSaving(true);
      try {
        const response = await fetch("/api/admin/values", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: modal.name.trim(), emoji: modal.emoji.trim(), isActive: true }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          showToast(payload.error ?? "Unable to add value", "error");
          return;
        }
        setModal(null);
        await loadSettings();
        showToast("Value added");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (modal.type === "addPosition") {
      if (!modal.name.trim()) return;
      setIsSaving(true);
      try {
        const response = await fetch("/api/admin/positions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: modal.name.trim() }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          showToast(payload.error ?? "Unable to add position", "error");
          return;
        }
        setModal(null);
        await Promise.all([loadPositions(), loadUsers()]);
        showToast("Position added");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (modal.type === "editPosition") {
      if (!modal.name.trim()) return;
      setIsSaving(true);
      try {
        const response = await fetch(`/api/admin/positions/${modal.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: modal.name.trim() }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          showToast(payload.error ?? "Unable to rename position", "error");
          return;
        }
        setModal(null);
        await Promise.all([loadPositions(), loadUsers()]);
        showToast("Position renamed");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleExport = async () => {
    const response = await fetch("/api/admin/export");
    if (!response.ok) {
      showToast("Export failed", "error");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "spotcoin-export.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleSendRecognitionFriday = async () => {
    setSendingFriday(true);
    try {
      const response = await fetch("/api/admin/recognition-friday", { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        showToast(payload.error ?? "Could not send Recognition Friday", "error");
        return;
      }
      showToast("Recognition Friday posted to Slack");
    } finally {
      setSendingFriday(false);
    }
  };

  if (isLoading || !workspace) {
    return (
      <section className="pb-10">
        <header className="py-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        </header>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[16px] border border-border bg-card p-4"
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const userCountByPositionId = users.reduce<Record<string, number>>((acc, user) => {
    if (user.position?.id) {
      acc[user.position.id] = (acc[user.position.id] ?? 0) + 1;
    }
    return acc;
  }, {});

  return (
    <section className="pb-10">
      <header className="py-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-xs text-muted">
          Configure how recognition works across {workspace.name}.
        </p>
      </header>

      <div className="space-y-8">
        <section className="space-y-2">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">General</h2>
          <SettingRow
            icon={<Coins size={15} />}
            title="Monthly coins per person"
            description="Refilled the 1st of each month"
            value={<span className="font-mono">{workspace.monthlyAllowance}</span>}
            onClick={() =>
              setModal({ type: "monthlyAllowance", value: workspace.monthlyAllowance })
            }
          />
          <SettingRow
            icon={<Sparkles size={15} />}
            title="Token value (NGN)"
            description="Naira per Spot Token for Nigeria payouts"
            value={<span className="font-mono">₦{workspace.tokenValueNaira}</span>}
            onClick={() =>
              setModal({ type: "tokenValueNaira", value: workspace.tokenValueNaira })
            }
          />
          <SettingRow
            icon={<Sparkles size={15} />}
            title="Token value (GHS)"
            description="Cedi per Spot Token for Ghana payouts (0 = not set)"
            value={<span className="font-mono">GH₵{workspace.tokenValueGhs}</span>}
            onClick={() => setModal({ type: "tokenValueGhs", value: workspace.tokenValueGhs })}
          />
          <SettingRow
            icon={<Hash size={15} />}
            title="Company legal name"
            value={
              <span className="truncate">{workspace.companyLegalName || workspace.name}</span>
            }
            onClick={() =>
              setModal({
                type: "companyLegalName",
                value: workspace.companyLegalName ?? workspace.name,
              })
            }
          />
          <SettingRow
            icon={<Hash size={15} />}
            title="Workspace name"
            value={<span className="truncate">{workspace.name}</span>}
            onClick={() => setModal({ type: "workspaceName", value: workspace.name })}
          />
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              Company values
            </h2>
            <span className="text-[11px] text-muted">
              {activeValuesCount} / 10 active
            </span>
          </div>
          <div className="space-y-2">
            {workspace.values.map((value) => (
              <div
                key={value.id}
                className="flex items-center justify-between gap-3 rounded-[16px] border border-border bg-card px-4 py-3.5"
              >
                <span className="flex min-w-0 items-center gap-2.5 text-sm text-foreground">
                  <span className="text-base">{value.emoji}</span>
                  <span className="truncate">{value.name}</span>
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <Chip
                    disabled={isSaving}
                    onClick={() => void toggleValue(value)}
                    selected={value.isActive}
                  >
                    {value.isActive ? "Active" : "Inactive"}
                  </Chip>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void deleteValue(value)}
                    className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-destructive/30 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                    title={`Delete ${value.name}`}
                    aria-label={`Delete ${value.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setModal({ type: "addValue", name: "", emoji: "🔥" })}
              className="flex w-full items-center justify-center gap-2 rounded-[16px] border border-dashed border-border bg-card/40 px-4 py-3.5 text-sm font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground"
            >
              <Plus size={14} />
              Add value
            </button>
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              Positions
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted">
                {positions.filter((position) => position.isActive).length} active
              </span>
              <button
                type="button"
                onClick={() => setPositionsExpanded((current) => !current)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card-2 px-2 py-1 text-[11px] text-muted transition-colors hover:border-border-strong hover:text-foreground"
              >
                {positionsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {positionsExpanded ? "Collapse" : "Expand"}
              </button>
            </div>
          </div>
          {positionsExpanded ? (
            <div className="space-y-2">
            {positions.length === 0 ? (
              <p className="rounded-[16px] border border-dashed border-border bg-card/40 px-4 py-3.5 text-xs text-muted">
                No positions yet. Add the first one below.
              </p>
            ) : (
              positions.map((position) => (
                <div
                  key={position.id}
                  className="flex items-center justify-between gap-3 rounded-[16px] border border-border bg-card px-4 py-3.5"
                >
                  <button
                    type="button"
                    onClick={() => setModal({ type: "editPosition", id: position.id, name: position.name })}
                    className="flex min-w-0 items-center gap-2.5 text-left text-sm text-foreground"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-border bg-card-2 text-muted">
                      <Briefcase size={13} />
                    </span>
                    <span className="truncate">{position.name}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-border bg-card-2 px-2 py-0.5 text-[11px] text-muted">
                      {userCountByPositionId[position.id] ?? 0} users
                    </span>
                    <Chip
                      disabled={isSaving}
                      onClick={() => void togglePosition(position)}
                      selected={position.isActive}
                    >
                      {position.isActive ? "Active" : "Inactive"}
                    </Chip>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted hover:text-destructive"
                      disabled={isSaving}
                      title="Delete position"
                      onClick={() => void deletePositionPermanently(position)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))
            )}

            <button
              type="button"
              onClick={() => setModal({ type: "addPosition", name: "" })}
              className="flex w-full items-center justify-center gap-2 rounded-[16px] border border-dashed border-border bg-card/40 px-4 py-3.5 text-sm font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground"
            >
              <Plus size={14} />
              Add position
            </button>
            </div>
          ) : null}
        </section>

        <section className="space-y-2">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Slack</h2>
          {oauthBanner ? (
            <div
              className={`flex items-start gap-2 rounded-[14px] border px-3 py-2.5 text-xs ${
                oauthBanner.type === "success"
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              {oauthBanner.type === "success" ? (
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              ) : (
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
              )}
              <span>{oauthBanner.message}</span>
            </div>
          ) : null}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 rounded-[16px] border border-border bg-card px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-card-2 text-muted">
                  <Slack size={15} />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-medium text-foreground">Slack workspace</p>
                  <p className="text-[11px] text-muted">Sync recognition into Slack</p>
                </div>
              </div>
              {workspace.slackTeamId ? (
                <Badge variant="accent">Connected</Badge>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <a href="/api/slack/oauth/start">Connect</a>
                </Button>
              )}
            </div>

            <SettingRow
              icon={<Hash size={15} />}
              title="Recognition channel"
              description="Where Spotcoin posts public messages"
              value={
                <span className="truncate">
                  {workspace.targetChannelId || "Not set"}
                </span>
              }
              onClick={() =>
                setModal({ type: "channelId", value: workspace.targetChannelId ?? "" })
              }
            />

            <div className="rounded-[16px] border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">Recognition Friday</p>
              <p className="mt-0.5 text-[11px] text-muted">
                When Spotcoin nudges your team on Slack to send recognition
              </p>
              <div className="mt-3">
                <Segmented
                  items={scheduleOptions.map((option) => ({
                    id: option.id,
                    label: option.label,
                  }))}
                  value={
                    workspace.recognitionSchedule === "EVERY_MONDAY"
                      ? "EVERY_FRIDAY"
                      : workspace.recognitionSchedule === "LAST_MONDAY"
                        ? "LAST_FRIDAY"
                        : workspace.recognitionSchedule
                  }
                  onChange={(next) => void patchWorkspace({ recognitionSchedule: next })}
                />
              </div>
              <div className="mt-3 space-y-1.5">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={
                    sendingFriday ||
                    !workspace.slackTeamId ||
                    !workspace.targetChannelId
                  }
                  onClick={() => void handleSendRecognitionFriday()}
                >
                  {sendingFriday ? "Sending..." : "Send now"}
                </Button>
                {(!workspace.slackTeamId || !workspace.targetChannelId) && (
                  <p className="text-[11px] text-muted">
                    Connect Slack and set a recognition channel to send now.
                  </p>
                )}
              </div>
            </div>

            <SettingRow
              icon={<Clock size={15} />}
              title="Timezone"
              description="Used for monthly reset and reminders"
              value={<span>{workspace.timezone}</span>}
              onClick={() => setModal({ type: "timezone", value: workspace.timezone })}
            />
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-destructive">
            Danger
          </h2>
          <button
            onClick={() => void handleExport()}
            className="flex w-full items-center justify-between gap-3 rounded-[16px] border border-destructive/30 bg-destructive/5 px-4 py-3.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <span>Export all data</span>
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              void signOut({ callbackUrl: "/admin/login" });
            }}
            className="flex w-full items-center justify-between gap-3 rounded-[16px] border border-destructive/30 bg-destructive/5 px-4 py-3.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
          >
            <span className="flex items-center gap-2">
              <LogOut size={14} />
              {signingOut ? "Signing out…" : "Sign out"}
            </span>
            <ChevronRight size={14} />
          </button>
        </section>
      </div>

      <Sheet open={!!modal} onOpenChange={(open) => !open && setModal(null)}>
        <SheetContent>
          {modal ? (
            <div className="space-y-4">
              <SheetHeader>
                <SheetTitle>
                  {modal.type === "workspaceName" && "Workspace name"}
                  {modal.type === "companyLegalName" && "Company legal name"}
                  {modal.type === "monthlyAllowance" && "Monthly coins per person"}
                  {modal.type === "tokenValueNaira" && "Token value (NGN)"}
                  {modal.type === "tokenValueGhs" && "Token value (GH₵)"}
                  {modal.type === "channelId" && "Recognition channel"}
                  {modal.type === "timezone" && "Timezone"}
                  {modal.type === "addValue" && "Add company value"}
                  {modal.type === "addPosition" && "Add position"}
                  {modal.type === "editPosition" && "Edit position"}
                </SheetTitle>
                {modal.type === "editPosition" ? (
                  <SheetDescription>Rename this position for your workspace.</SheetDescription>
                ) : null}
              </SheetHeader>

              {modal.type === "addValue" ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted">Emoji</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {emojiChoices.map((emoji) => (
                        <button
                          type="button"
                          key={emoji}
                          onClick={() => setModal({ ...modal, emoji })}
                          className={`flex h-10 w-10 items-center justify-center rounded-[10px] border text-base transition-colors ${
                            modal.emoji === emoji
                              ? "border-accent/40 bg-accent/15"
                              : "border-border bg-card hover:border-border-strong"
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted">Name</label>
                    <Input
                      value={modal.name}
                      onChange={(event) => setModal({ ...modal, name: event.target.value })}
                      placeholder="e.g. Ownership"
                      className="mt-2"
                    />
                  </div>
                </div>
              ) : modal.type === "addPosition" ? (
                <div>
                  <label className="text-xs font-medium text-muted">Position name</label>
                  <Input
                    value={modal.name}
                    onChange={(event) => setModal({ ...modal, name: event.target.value })}
                    placeholder="e.g. Frontend Lead"
                    className="mt-2"
                  />
                </div>
              ) : modal.type === "editPosition" ? (
                <div>
                  <label className="text-xs font-medium text-muted">Position name</label>
                  <Input
                    value={modal.name}
                    onChange={(event) => setModal({ ...modal, name: event.target.value })}
                    placeholder="e.g. Frontend Lead"
                    className="mt-2"
                  />
                </div>
              ) : modal.type === "tokenValueGhs" ? (
                <Input
                  value={modal.value}
                  onChange={(event) =>
                    setModal({
                      ...modal,
                      value: Math.max(0, Number(event.target.value) || 0),
                    })
                  }
                  type="number"
                  min={0}
                />
              ) : modal.type === "monthlyAllowance" || modal.type === "tokenValueNaira" ? (
                <Input
                  value={modal.value}
                  onChange={(event) =>
                    setModal({
                      ...modal,
                      value: Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                  type="number"
                  min={1}
                />
              ) : (
                <Input
                  value={modal.value}
                  onChange={(event) => setModal({ ...modal, value: event.target.value })}
                />
              )}

              <Button onClick={() => void saveModal()} disabled={isSaving} className="w-full">
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <AppToast toast={toast} />
    </section>
  );
}
