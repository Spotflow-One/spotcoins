"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { AppToast } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { updateProfileUsername } from "./actions";

type MeResponse = {
  data: {
    username: string | null;
    email: string;
  };
};

export default function DashboardSettingsPage() {
  const router = useRouter();
  const { toast, showToast } = useToast();
  /** Bumped after a successful username PATCH so a slow GET cannot overwrite the saved value. */
  const profileDataGeneration = useRef(0);
  const profileLoadAbortRef = useRef<AbortController | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    profileLoadAbortRef.current = ac;
    const load = async () => {
      const genAtFetch = profileDataGeneration.current;
      try {
        const res = await fetch("/api/users/me", { cache: "no-store", signal: ac.signal });
        const json = (await res.json()) as MeResponse & { error?: string };
        if (genAtFetch !== profileDataGeneration.current) return;
        if (!res.ok) {
          showToast(json.error ?? "Could not load profile", "error");
          return;
        }
        const d = json.data;
        if (d) {
          setUsername(d.username ?? "");
          setEmail(d.email);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        showToast("Could not load profile", "error");
      } finally {
        setProfileLoading(false);
      }
    };
    void load();
    return () => {
      ac.abort();
      if (profileLoadAbortRef.current === ac) {
        profileLoadAbortRef.current = null;
      }
    };
  }, [showToast]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    profileLoadAbortRef.current?.abort();
    setProfileSaving(true);
    try {
      const trimmed = username.trim();
      const result = await updateProfileUsername(trimmed === "" ? null : trimmed);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }

      profileDataGeneration.current += 1;
      showToast("Profile updated");
      setUsername(result.username ?? "");
      setEmail(result.email);
      router.refresh();
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast("New password must be at least 8 characters", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("New password and confirmation do not match", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = (await res.json()) as { error?: string; code?: string };

      if (!res.ok) {
        showToast(payload.error ?? "Could not update password", "error");
        return;
      }

      showToast("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="pb-8">
      <PageHeader
        title="Account"
        description="Manage how you appear on the team feed and your sign-in password."
      />

      <section className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Feed username</h2>
        <p className="mt-1 text-xs text-muted">
          This is how your name appears on the recognition feed and in Slack recognition posts. If you leave
          username empty, the part before @ in your email is shown instead
          {email ? (
            <>
              {" "}
              (<span className="font-mono">{email.split("@")[0] || email}</span>).
            </>
          ) : (
            "."
          )}
        </p>
        {profileLoading ? (
          <p className="mt-4 text-xs text-muted">Loading…</p>
        ) : (
          <form onSubmit={handleProfileSave} className="mt-4 space-y-4">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-xs font-medium text-muted">
                Username (optional)
              </label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. alex_k"
                autoComplete="nickname"
                maxLength={30}
              />
              <p className="mt-1.5 text-[11px] text-muted">
                3–30 characters: letters, numbers, and underscores. Unique in your workspace. Preview:{" "}
                <span className="font-medium text-foreground">{username.trim() || email || "—"}</span>
              </p>
            </div>
            <Button type="submit" disabled={profileSaving}>
              {profileSaving ? "Saving…" : "Save username"}
            </Button>
          </form>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Change password</h2>
        <p className="mt-1 text-xs text-muted">
          You must enter your current password. After saving, sign in again on other devices if needed.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="current-password" className="mb-1.5 block text-xs font-medium text-muted">
              Current password
            </label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-xs font-medium text-muted">
              New password
            </label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-medium text-muted">
              Confirm new password
            </label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <Button type="submit" disabled={saving || !currentPassword || !newPassword || !confirmPassword}>
            {saving ? "Saving…" : "Update password"}
          </Button>
        </form>
      </section>

      <section className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="text-sm font-semibold text-foreground">Sign out</h2>
        <p className="mt-1 text-xs text-muted">End your session on this device.</p>
        <Button
          type="button"
          variant="danger"
          className="mt-4"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            void signOut({ callbackUrl: "/login" });
          }}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </section>
    </div>
    <AppToast toast={toast} />
  </>
  );
}
