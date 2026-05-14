"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoBanner } from "@/components/ui/info-banner";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCanCreatePollsOrEvents } from "@/components/DashboardRoleProvider";

type PollOptionDto = {
  id: string;
  label: string;
  optionUserId: string | null;
  optionUser: { id: string; name: string; avatarUrl: string | null } | null;
  sortOrder: number;
  voteCount: number;
};

type PollDto = {
  id: string;
  kind: "POLL" | "AWARD";
  title: string;
  description: string | null;
  multiSelect: boolean;
  startsAt: string;
  endsAt: string;
  resultVisibility: "AUTO_AFTER_END" | "MANUAL";
  resultsEffectiveVisible: boolean;
  votingOpen: boolean;
  votesAnonymous: boolean;
  createdBy: { id: string; name: string };
  options: PollOptionDto[];
  viewerOptionIds: string[];
};

type PollsResponse = { data: PollDto[] };

type SearchUser = { id: string; name: string; email: string; avatarUrl: string | null };

export default function PollsPage() {
  const { showToast } = useToast();
  const canCreate = useCanCreatePollsOrEvents();
  const [status, setStatus] = useState<"open" | "ended" | "all">("open");
  const [polls, setPolls] = useState<PollDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [kind, setKind] = useState<"POLL" | "AWARD">("POLL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [multiSelect, setMultiSelect] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [resultVisibility, setResultVisibility] = useState<"AUTO_AFTER_END" | "MANUAL">("AUTO_AFTER_END");
  const [votesAnonymous, setVotesAnonymous] = useState(false);
  const [pollLabels, setPollLabels] = useState(["", ""]);
  const [awardUsers, setAwardUsers] = useState<{ id: string; name: string }[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<SearchUser[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/polls?status=${status}`, { cache: "no-store" });
      const json = (await res.json()) as PollsResponse & { error?: string };
      if (!res.ok) {
        showToast(json.error ?? "Failed to load polls", "error");
        return;
      }
      setPolls(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [showToast, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (kind !== "AWARD" || searchQ.trim().length < 2) {
      setSearchHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQ.trim())}`);
      const json = (await res.json()) as { data?: SearchUser[] };
      setSearchHits(json.data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [kind, searchQ]);

  const resetForm = () => {
    setKind("POLL");
    setTitle("");
    setDescription("");
    setMultiSelect(false);
    setStartsAt("");
    setEndsAt("");
    setResultVisibility("AUTO_AFTER_END");
    setVotesAnonymous(false);
    setPollLabels(["", ""]);
    setAwardUsers([]);
    setSearchQ("");
  };

  const submitCreate = async () => {
    if (!startsAt || !endsAt) {
      showToast("Start and end time are required", "error");
      return;
    }
    const options =
      kind === "POLL"
        ? pollLabels
            .map((label, i) => ({ label: label.trim(), optionUserId: null as string | null, sortOrder: i }))
            .filter((o) => o.label.length > 0)
        : awardUsers.map((u, i) => ({ label: u.name, optionUserId: u.id, sortOrder: i }));

    if (options.length < 2) {
      showToast("Add at least two options", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          title,
          description: description || null,
          multiSelect,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          resultVisibility,
          votesAnonymous,
          options,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        showToast(json.error ?? "Could not create poll", "error");
        return;
      }
      showToast("Poll created");
      setSheetOpen(false);
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const submitVote = async (poll: PollDto, selected: string[]) => {
    const res = await fetch(`/api/polls/${poll.id}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ optionIds: selected }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      showToast(json.error ?? "Vote failed", "error");
      return;
    }
    showToast(
      poll.votesAnonymous
        ? "Vote saved. Your choice is anonymous—others only see totals, not who voted for what."
        : "Vote saved",
    );
    await load();
  };

  return (
    <section className="pb-10">
      <PageHeader
        title="Polls & Awards"
        description="Vote on team polls and award categories while they are open."
        action={
          canCreate ? (
            <Button type="button" size="sm" onClick={() => setSheetOpen(true)} className="gap-1.5">
              <Plus size={14} />
              New
            </Button>
          ) : null
        }
      />

      <div className="mb-4">
        <Segmented
          items={[
            { id: "open", label: "Open" },
            { id: "ended", label: "Ended" },
            { id: "all", label: "All" },
          ]}
          value={status}
          onChange={(v) => setStatus(v as typeof status)}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : polls.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No polls here yet."
          description={canCreate ? "Create a poll or award for the team to vote on." : "Check back when an admin posts a poll."}
        />
      ) : (
        <div className="space-y-4">
          {polls.map((poll) => (
            <article key={poll.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={poll.kind === "AWARD" ? "accent" : "neutral"}>{poll.kind === "AWARD" ? "Award" : "Poll"}</Badge>
                    {poll.votingOpen ? <Badge variant="outline">Live voting</Badge> : null}
                    {poll.resultsEffectiveVisible ? <Badge variant="neutral">Results visible</Badge> : null}
                    {poll.votesAnonymous ? <Badge variant="neutral">Anonymous</Badge> : null}
                  </div>
                  <h2 className="mt-2 text-base font-semibold text-foreground">{poll.title}</h2>
                  {poll.description ? <p className="mt-1 text-xs text-muted">{poll.description}</p> : null}
                  <p className="mt-2 text-[11px] text-muted">
                    {new Date(poll.startsAt).toLocaleString()} → {new Date(poll.endsAt).toLocaleString()}
                  </p>
                </div>
                <Link href={`/dashboard/polls/${poll.id}`} className="text-xs font-medium text-foreground underline-offset-4 hover:underline">
                  Details
                </Link>
              </div>

              {poll.resultsEffectiveVisible ? (
                <ul className="mt-3 space-y-2">
                  {poll.options.map((opt) => {
                    const max = Math.max(1, ...poll.options.map((o) => o.voteCount));
                    const pct = Math.round((opt.voteCount / max) * 100);
                    return (
                      <li key={opt.id} className="text-xs">
                        <div className="flex justify-between gap-2">
                          <span className="text-foreground">{opt.label}</span>
                          <span className="text-muted">{opt.voteCount} votes</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-card-2">
                          <div className="h-full bg-foreground/70" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {poll.votingOpen ? (
                <VoteInline poll={poll} onSubmit={(ids) => void submitVote(poll, ids)} />
              ) : null}
            </article>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New poll or award</SheetTitle>
            <SheetDescription>Set the schedule, voting rules, and options.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-6">
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Type</p>
              <Segmented
                items={[
                  { id: "POLL", label: "Poll" },
                  { id: "AWARD", label: "Award" },
                ]}
                value={kind}
                onChange={(v) => setKind(v as typeof kind)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Favorite venue for codehouse" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input type="checkbox" checked={multiSelect} onChange={(e) => setMultiSelect(e.target.checked)} />
              Allow multiple choices
            </label>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={votesAnonymous}
                onChange={(e) => setVotesAnonymous(e.target.checked)}
              />
              Anonymous voting (voters are told their vote is private; only aggregate counts are shown)
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Starts</label>
                <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Ends</label>
                <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted">When to show results</p>
              <Segmented
                items={[
                  { id: "AUTO_AFTER_END", label: "After end" },
                  { id: "MANUAL", label: "Manual" },
                ]}
                value={resultVisibility}
                onChange={(v) => setResultVisibility(v as typeof resultVisibility)}
              />
            </div>

            {kind === "POLL" ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted">Options</p>
                {pollLabels.map((label, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input value={label} onChange={(e) => {
                      const next = [...pollLabels];
                      next[idx] = e.target.value;
                      setPollLabels(next);
                    }} placeholder={`Option ${idx + 1}`} />
                    {pollLabels.length > 2 ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => setPollLabels(pollLabels.filter((_, i) => i !== idx))}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                ))}
                {pollLabels.length < 10 ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setPollLabels([...pollLabels, ""])}>
                    Add option
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted">Nominees (search teammates)</p>
                <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search by name…" />
                {searchHits.length > 0 ? (
                  <ul className="max-h-36 overflow-auto rounded-xl border border-border bg-card-2 p-1">
                    {searchHits.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          className="w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-card"
                          onClick={() => {
                            if (awardUsers.some((x) => x.id === u.id)) return;
                            setAwardUsers([...awardUsers, { id: u.id, name: u.name }]);
                            setSearchQ("");
                            setSearchHits([]);
                          }}
                        >
                          {u.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <ul className="flex flex-wrap gap-2">
                  {awardUsers.map((u) => (
                    <Badge key={u.id} variant="neutral" className="gap-1">
                      {u.name}
                      <button
                        type="button"
                        className="ml-1 text-muted hover:text-foreground"
                        onClick={() => setAwardUsers(awardUsers.filter((x) => x.id !== u.id))}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </ul>
              </div>
            )}

            <Button type="button" disabled={saving} onClick={() => void submitCreate()}>
              {saving ? "Creating…" : "Create"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}

function VoteInline({ poll, onSubmit }: { poll: PollDto; onSubmit: (ids: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(poll.viewerOptionIds);

  useEffect(() => {
    setSelected(poll.viewerOptionIds);
  }, [poll.id, JSON.stringify(poll.viewerOptionIds)]);

  const toggle = (id: string) => {
    if (poll.multiSelect) {
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    } else {
      setSelected([id]);
    }
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      {poll.votesAnonymous ? (
        <InfoBanner
          variant="accent"
          className="mb-4"
          title="Anonymous voting"
          body="Your choices are not shown to teammates—only combined vote totals are visible. You can change your vote while the poll is open."
        />
      ) : null}
      <p className="mb-2 text-xs font-medium text-muted">Your vote</p>
      <div className="space-y-2">
        {poll.options.map((opt) => (
          <label key={opt.id} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type={poll.multiSelect ? "checkbox" : "radio"}
              name={`vote-${poll.id}`}
              checked={selected.includes(opt.id)}
              onChange={() => toggle(opt.id)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      <Button type="button" className="mt-3" size="sm" onClick={() => onSubmit(selected)}>
        Submit vote
      </Button>
    </div>
  );
}
