"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Plus, Slack, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type WorkspaceResponse = {
  data: {
    id: string;
    onboardingComplete: boolean;
    values: Array<{ id: string; name: string; emoji: string; isActive: boolean }>;
  };
};

const suggestedValues = [
  { name: "Ownership", emoji: "🔥" },
  { name: "Collaboration", emoji: "🤝" },
  { name: "Innovation", emoji: "💡" },
  { name: "Customer First", emoji: "🎯" },
  { name: "Excellence", emoji: "🏆" },
  { name: "Integrity", emoji: "🧭" },
  { name: "Speed", emoji: "⚡" },
  { name: "Quality", emoji: "✅" },
];

const stepLabels = ["Welcome", "Values", "Slack", "Invites"];

function parseInviteInput(raw: string) {
  return raw
    .split(/[\n,]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export default function AdminOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedValues, setSelectedValues] = useState<Array<{ name: string; emoji: string }>>([]);
  const [customValueName, setCustomValueName] = useState("");
  const [customValueEmoji, setCustomValueEmoji] = useState("✨");
  const [inviteInput, setInviteInput] = useState("");
  const [inviteResults, setInviteResults] = useState<
    Array<{ email: string; status: "success" | "failed"; message: string }>
  >([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/admin/workspace", { cache: "no-store" });
      const payload = (await response.json()) as WorkspaceResponse;
      if (!response.ok || !payload.data) return;

      if (payload.data.onboardingComplete) {
        router.replace("/admin");
        return;
      }

      if (payload.data.values.length > 0) {
        setSelectedValues(
          payload.data.values.map((value) => ({
            name: value.name,
            emoji: value.emoji,
          })),
        );
      }
    };

    void load();
  }, [router]);

  const canContinueValues = useMemo(() => selectedValues.length >= 3, [selectedValues.length]);

  const toggleSuggested = (value: { name: string; emoji: string }) => {
    setSelectedValues((current) => {
      const exists = current.some((item) => item.name.toLowerCase() === value.name.toLowerCase());
      if (exists) {
        return current.filter((item) => item.name.toLowerCase() !== value.name.toLowerCase());
      }
      return [...current, value];
    });
  };

  const addCustomValue = () => {
    const name = customValueName.trim();
    const emoji = customValueEmoji.trim() || "✨";
    if (!name) return;

    setSelectedValues((current) => {
      if (current.some((item) => item.name.toLowerCase() === name.toLowerCase())) return current;
      return [...current, { name, emoji }];
    });
    setCustomValueName("");
  };

  const persistValuesIfNeeded = async () => {
    if (!canContinueValues) return false;
    setIsSaving(true);
    try {
      const workspaceRes = await fetch("/api/admin/workspace", { cache: "no-store" });
      const workspacePayload = (await workspaceRes.json()) as WorkspaceResponse;
      if (!workspaceRes.ok || !workspacePayload.data) return false;

      const existingNames = new Set(
        workspacePayload.data.values.map((value) => value.name.trim().toLowerCase()),
      );
      const toCreate = selectedValues.filter(
        (value) => !existingNames.has(value.name.trim().toLowerCase()),
      );

      await Promise.all(
        toCreate.map((value) =>
          fetch("/api/admin/values", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: value.name, emoji: value.emoji, isActive: true }),
          }),
        ),
      );
      return true;
    } finally {
      setIsSaving(false);
    }
  };

  const sendInvites = async () => {
    const emails = parseInviteInput(inviteInput);
    if (emails.length === 0) {
      setInviteResults([]);
      return;
    }

    setIsSaving(true);
    try {
      const uniqueEmails = Array.from(new Set(emails));
      const results = await Promise.all(
        uniqueEmails.map(async (email) => {
          try {
            const response = await fetch("/api/admin/users/invite", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ email }),
            });
            const payload = (await response.json().catch(() => ({}))) as { error?: string };
            if (response.ok) {
              return { email, status: "success" as const, message: "Invite sent" };
            }
            return {
              email,
              status: "failed" as const,
              message: payload.error ?? "Invite failed",
            };
          } catch {
            return { email, status: "failed" as const, message: "Network error while sending invite" };
          }
        }),
      );
      setInviteResults(results);
    } finally {
      setIsSaving(false);
    }
  };

  const inviteSummary = useMemo(() => {
    const successCount = inviteResults.filter((result) => result.status === "success").length;
    const failedCount = inviteResults.length - successCount;
    return { successCount, failedCount };
  }, [inviteResults]);

  const completeOnboarding = async () => {
    setIsSaving(true);
    try {
      await fetch("/api/admin/workspace", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ onboardingComplete: true }),
      });
      router.push("/admin");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="pb-[calc(env(safe-area-inset-bottom)+96px)] pt-2">
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            Step {step} of 4
          </p>
          <p className="text-[11px] font-medium tracking-tight text-foreground">
            {stepLabels[step - 1]}
          </p>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {stepLabels.map((_, index) => (
            <span
              key={index}
              className={cn(
                "h-1 rounded-full transition-colors",
                index + 1 <= step ? "bg-foreground" : "bg-card-2",
              )}
            />
          ))}
        </div>
      </div>

      {step === 1 ? (
        <div className="rounded-[20px] border border-border bg-card p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[14px] border border-border bg-card-2">
            <Image src="/logomark.png" alt="Spotcoin" width={26} height={26} />
          </div>
          <h1 className="mt-5 text-[26px] font-bold leading-tight tracking-tight text-foreground">
            Welcome to Spotcoin
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
            Every month your team gets coins to recognize colleagues. Coins received become Spot
            Tokens. At year-end, each token converts to cash.
          </p>
          <Button onClick={() => setStep(2)} className="mt-7 w-full">
            Get started
            <ArrowRight size={14} />
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              What does your team stand for?
            </h2>
            <p className="mt-2 text-sm text-muted">Select at least 3 values to continue.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {suggestedValues.map((value) => {
              const selected = selectedValues.some(
                (item) => item.name.toLowerCase() === value.name.toLowerCase(),
              );
              return (
                <Chip
                  key={value.name}
                  onClick={() => toggleSuggested(value)}
                  selected={selected}
                >
                  {value.emoji} {value.name}
                </Chip>
              );
            })}
          </div>

          <div className="rounded-[16px] border border-border bg-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              Add custom value
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                value={customValueEmoji}
                onChange={(event) => setCustomValueEmoji(event.target.value)}
                className="w-16 text-center"
                aria-label="Emoji"
              />
              <Input
                value={customValueName}
                onChange={(event) => setCustomValueName(event.target.value)}
                placeholder="Value name"
                className="flex-1"
              />
            </div>
            <Button onClick={addCustomValue} className="mt-3" variant="outline" size="sm">
              <Plus size={14} />
              Add value
            </Button>
          </div>

          <Button
            disabled={!canContinueValues || isSaving}
            onClick={async () => {
              const ok = await persistValuesIfNeeded();
              if (ok) setStep(3);
            }}
            className="w-full"
          >
            {isSaving ? "Saving..." : (
              <>
                Continue
                <ArrowRight size={14} />
              </>
            )}
          </Button>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Bring Spotcoin into Slack
            </h2>
            <p className="mt-2 text-sm text-muted">
              Connect your Slack workspace so your team can recognize colleagues without leaving
              Slack.
            </p>
          </div>

          <div className="rounded-[16px] border border-border bg-card p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-border bg-card-2">
              <Slack size={20} className="text-foreground" />
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">Slack workspace</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              We&apos;ll request permission to post recognition messages and listen for slash
              commands.
            </p>
            <Button className="mt-5 w-full" asChild>
              <a href="/api/slack/oauth/start">
                <Slack size={14} />
                Connect Slack
              </a>
            </Button>
          </div>

          <Button onClick={() => setStep(4)} className="w-full" variant="ghost">
            Skip for now
          </Button>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Who&apos;s on your team?
            </h2>
            <p className="mt-2 text-sm text-muted">
              Add one email per line (or comma-separated) and send invites. Your team can pick a
              position later in Settings.
            </p>
          </div>

          <div className="rounded-[16px] border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Users size={14} className="text-muted" />
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                Invite teammates
              </p>
            </div>
            <Textarea
              rows={6}
              value={inviteInput}
              onChange={(event) => setInviteInput(event.target.value)}
              placeholder={"alice@company.com\nbob@company.com"}
            />
            <Button
              disabled={isSaving || inviteInput.trim().length === 0}
              onClick={() => void sendInvites()}
              className="mt-3 w-full"
            >
              {isSaving ? "Sending..." : "Send invites"}
            </Button>
          </div>

          {inviteResults.length > 0 ? (
            <div className="rounded-[16px] border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">
                {inviteSummary.successCount} sent
                {inviteSummary.failedCount > 0
                  ? ` · ${inviteSummary.failedCount} failed`
                  : ""}
              </p>
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                {inviteResults.map((result) => (
                  <p
                    key={result.email}
                    className="flex items-start gap-1.5 text-[11px] text-muted"
                  >
                    {result.status === "success" ? (
                      <Check size={12} className="mt-0.5 shrink-0 text-accent" />
                    ) : (
                      <Sparkles size={12} className="mt-0.5 shrink-0 text-destructive" />
                    )}
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-foreground">{result.email}</span>
                      <span className="ml-1 text-muted">— {result.message}</span>
                    </span>
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          <Button
            disabled={isSaving}
            onClick={() => void completeOnboarding()}
            className="w-full"
            variant="outline"
          >
            Go to dashboard
            <ArrowRight size={14} />
          </Button>
        </div>
      ) : null}
    </section>
  );
}
