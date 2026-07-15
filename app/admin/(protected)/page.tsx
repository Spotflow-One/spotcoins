"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, UserPlus, Users } from "lucide-react";
import {
  AdminUserMutationsSheet,
  type AdminMutationUser,
  type AdminUserMutationsRef,
} from "@/components/admin/AdminUserMutationsSheet";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AppToast } from "@/components/ui/toast";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

type Role = "EMPLOYEE" | "MANAGER" | "ADMIN";

type Position = {
  id: string;
  name: string;
  isActive: boolean;
};

type AdminUser = {
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

function userToMutationUser(user: AdminUser): AdminMutationUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    feedDisplayName: user.feedDisplayName,
    role: user.role,
    position: user.position ?? null,
  };
}

function formatLastActive(dateValue: string | null) {
  if (!dateValue) return "Never";
  return new Date(dateValue).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const roleVariant: Record<Role, "neutral" | "accent" | "outline"> = {
  ADMIN: "accent",
  MANAGER: "outline",
  EMPLOYEE: "neutral",
};

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const { toast, showToast } = useToast();
  const mutationsRef = useRef<AdminUserMutationsRef>(null);

  const memberCount = useMemo(() => users.filter((user) => !user.deletedAt).length, [users]);
  const adminCount = useMemo(() => users.filter((user) => user.role === "ADMIN").length, [users]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const [usersRes, positionsRes] = await Promise.all([
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/positions", { cache: "no-store" }),
      ]);
      const usersPayload = (await usersRes.json()) as { data?: AdminUser[]; error?: string };
      const positionsPayload = (await positionsRes.json()) as { data?: Position[]; error?: string };

      if (!usersRes.ok) {
        showToast(usersPayload.error ?? "Failed to load users", "error");
        return;
      }
      setUsers(usersPayload.data ?? []);
      setPositions(positionsPayload.data ?? []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        showToast(payload.error ?? "Invite failed", "error");
        return;
      }
      setShowInviteModal(false);
      setInviteEmail("");
      showToast("Invite sent successfully");
      await loadUsers();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="pb-10">
      <header className="flex items-start justify-between gap-3 py-5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Team</h1>
          <p className="mt-1 text-xs text-muted">
            {memberCount} {memberCount === 1 ? "member" : "members"}
            {adminCount > 0 ? ` · ${adminCount} admin${adminCount === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <Button type="button" onClick={() => setShowInviteModal(true)} variant="outline" size="sm">
          <UserPlus size={14} />
          Invite
        </Button>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[16px] border border-border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teammates yet."
          description="Invite your first teammate to start sending recognition."
          action={
            <Button onClick={() => setShowInviteModal(true)} variant="outline" size="sm">
              <UserPlus size={14} />
              Invite
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex items-center gap-3 rounded-[16px] border border-border bg-card px-4 py-3.5"
            >
              <Link
                href={`/admin/users/${user.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 transition-colors hover:opacity-90"
              >
                <Avatar name={user.feedDisplayName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {user.feedDisplayName}
                    {user.deletedAt ? (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-muted">
                        Deactivated
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {user.name !== user.feedDisplayName ? `${user.name} · ` : ""}
                    {user.position?.name ? `${user.position.name} · ` : ""}
                    {user.email} · Last active {formatLastActive(user.lastActiveAt)}
                  </p>
                </div>
                <Badge variant={roleVariant[user.role]} className="hidden sm:inline-flex">
                  {user.role}
                </Badge>
              </Link>
              <Dropdown>
                <DropdownTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Actions for ${user.feedDisplayName}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card-2 text-muted transition-colors hover:border-border-strong hover:text-foreground"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </DropdownTrigger>
                <DropdownContent align="end">
                  <DropdownItem onClick={() => mutationsRef.current?.openBonus(userToMutationUser(user))}>
                    Grant bonus coins
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => mutationsRef.current?.openRole(userToMutationUser(user))}
                  >
                    Change role
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => mutationsRef.current?.openPosition(userToMutationUser(user))}
                  >
                    Change position
                  </DropdownItem>
                  <DropdownItem
                    className="text-destructive data-[highlighted]:bg-destructive/10"
                    onClick={() => mutationsRef.current?.openDeactivate(userToMutationUser(user))}
                  >
                    Deactivate
                  </DropdownItem>
                  <DropdownItem
                    className="text-destructive data-[highlighted]:bg-destructive/10"
                    onClick={() => mutationsRef.current?.openDelete(userToMutationUser(user))}
                  >
                    Delete permanently
                  </DropdownItem>
                </DropdownContent>
              </Dropdown>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={showInviteModal} onOpenChange={setShowInviteModal}>
        <SheetContent>
          {showInviteModal ? (
            <div className="space-y-4">
              <SheetHeader>
                <SheetTitle>Invite someone</SheetTitle>
                <SheetDescription>
                  We&apos;ll send an email invitation with a magic link.
                </SheetDescription>
              </SheetHeader>
              <Input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                type="email"
                placeholder="name@company.com"
              />
              <Button
                onClick={() => void handleInvite()}
                disabled={isSaving || !inviteEmail}
                className="w-full"
              >
                {isSaving ? "Sending..." : "Send invite"}
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <AdminUserMutationsSheet ref={mutationsRef} positions={positions} onMutated={loadUsers} />

      <AppToast toast={toast} />
    </section>
  );
}
