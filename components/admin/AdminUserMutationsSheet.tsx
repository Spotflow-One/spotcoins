import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

export type AdminMutationUser = {
  id: string;
  name: string;
  email: string;
  feedDisplayName: string;
  role: "EMPLOYEE" | "MANAGER" | "ADMIN";
  position: { id: string; name: string } | null;
};

export type AdminMutationPosition = {
  id: string;
  name: string;
  isActive: boolean;
};

export type AdminUserMutationsRef = {
  openBonus: (user: AdminMutationUser) => void;
  openRole: (user: AdminMutationUser) => void;
  openPosition: (user: AdminMutationUser) => void;
  openDeactivate: (user: AdminMutationUser) => void;
  openDelete: (user: AdminMutationUser) => void;
};

type Props = {
  positions: AdminMutationPosition[];
  onMutated: () => Promise<void>;
  /** Called after successful deactivate (e.g. redirect to team list). */
  afterDeactivate?: () => void | Promise<void>;
  /** Called after successful permanent delete. */
  afterDelete?: () => void | Promise<void>;
};

export const AdminUserMutationsSheet = forwardRef<AdminUserMutationsRef, Props>(function AdminUserMutationsSheet(
  { positions, onMutated, afterDeactivate, afterDelete },
  ref,
) {
  const { showToast } = useToast();
  const [bonusUser, setBonusUser] = useState<AdminMutationUser | null>(null);
  const [bonusAmount, setBonusAmount] = useState(1);
  const [bonusReason, setBonusReason] = useState("");
  const [roleUser, setRoleUser] = useState<AdminMutationUser | null>(null);
  const [roleValue, setRoleValue] = useState<AdminMutationUser["role"]>("EMPLOYEE");
  const [positionUser, setPositionUser] = useState<AdminMutationUser | null>(null);
  const [positionValue, setPositionValue] = useState("");
  const [deactivateUser, setDeactivateUser] = useState<AdminMutationUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminMutationUser | null>(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const activePositions = useMemo(
    () => positions.filter((position) => position.isActive),
    [positions],
  );

  useImperativeHandle(ref, () => ({
    openBonus: (user) => {
      setBonusUser(user);
      setBonusAmount(1);
      setBonusReason("");
    },
    openRole: (user) => {
      setRoleUser(user);
      setRoleValue(user.role);
    },
    openPosition: (user) => {
      setPositionUser(user);
      setPositionValue(user.position?.id ?? "");
    },
    openDeactivate: (user) => setDeactivateUser(user),
    openDelete: (user) => {
      setDeleteUser(user);
      setDeleteConfirmEmail("");
    },
  }));

  const closeAll = () => {
    setBonusUser(null);
    setRoleUser(null);
    setPositionUser(null);
    setPositionValue("");
    setDeactivateUser(null);
    setDeleteUser(null);
    setDeleteConfirmEmail("");
  };

  const handleBonusGrant = async () => {
    if (!bonusUser) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${bonusUser.id}/bonus`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: bonusAmount, reason: bonusReason || undefined }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        showToast(payload.error ?? "Bonus update failed", "error");
        return;
      }
      setBonusUser(null);
      setBonusAmount(1);
      setBonusReason("");
      showToast("Bonus coins granted");
      await onMutated();
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleChange = async () => {
    if (!roleUser) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${roleUser.id}/role`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: roleValue }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        showToast(payload.error ?? "Role update failed", "error");
        return;
      }
      setRoleUser(null);
      showToast("User role updated");
      await onMutated();
    } finally {
      setIsSaving(false);
    }
  };

  const handlePositionChange = async () => {
    if (!positionUser) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${positionUser.id}/position`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ positionId: positionValue || null }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        showToast(payload.error ?? "Position update failed", "error");
        return;
      }
      setPositionUser(null);
      setPositionValue("");
      showToast("Position updated");
      await onMutated();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateUser) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${deactivateUser.id}/deactivate`, {
        method: "PATCH",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        showToast(payload.error ?? "Deactivate failed", "error");
        return;
      }
      setDeactivateUser(null);
      showToast("User deactivated");
      await onMutated();
      await afterDeactivate?.();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    if (deleteConfirmEmail.trim().toLowerCase() !== deleteUser.email.toLowerCase()) {
      showToast("Type the user’s email exactly to confirm", "error");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${deleteUser.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        showToast(payload.error ?? "Delete failed", "error");
        return;
      }
      setDeleteUser(null);
      setDeleteConfirmEmail("");
      showToast("User deleted permanently");
      await onMutated();
      await afterDelete?.();
    } finally {
      setIsSaving(false);
    }
  };

  const open = !!(bonusUser || roleUser || positionUser || deactivateUser || deleteUser);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeAll();
      }}
    >
      <SheetContent>
        {bonusUser ? (
          <div className="space-y-4">
            <SheetHeader>
              <SheetTitle>Grant bonus coins</SheetTitle>
              <SheetDescription>For {bonusUser.feedDisplayName}</SheetDescription>
            </SheetHeader>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted">How many bonus coins?</label>
              <Input
                value={bonusAmount}
                onChange={(event) => setBonusAmount(Math.max(1, Number(event.target.value) || 1))}
                type="number"
                min={1}
                max={50}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted">Reason (optional)</label>
              <Input
                value={bonusReason}
                onChange={(event) => setBonusReason(event.target.value)}
                type="text"
                placeholder="e.g. great work on Q4 launch"
              />
            </div>
            <Button onClick={() => void handleBonusGrant()} disabled={isSaving} className="w-full">
              {isSaving ? "Granting..." : "Grant"}
            </Button>
          </div>
        ) : null}

        {roleUser ? (
          <div className="space-y-4">
            <SheetHeader>
              <SheetTitle>Change role</SheetTitle>
              <SheetDescription>For {roleUser.feedDisplayName}</SheetDescription>
            </SheetHeader>
            <select
              value={roleValue}
              onChange={(event) => setRoleValue(event.target.value as AdminMutationUser["role"])}
              className="h-12 w-full rounded-[12px] border border-border bg-input pl-4 pr-10 text-sm text-foreground outline-none transition-colors focus:border-border-strong"
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
            <Button onClick={() => void handleRoleChange()} disabled={isSaving} className="w-full">
              {isSaving ? "Saving..." : "Save role"}
            </Button>
          </div>
        ) : null}

        {positionUser ? (
          <div className="space-y-4">
            <SheetHeader>
              <SheetTitle>Change position</SheetTitle>
              <SheetDescription>For {positionUser.feedDisplayName}</SheetDescription>
            </SheetHeader>
            {activePositions.length === 0 ? (
              <p className="text-xs text-muted">No positions configured yet. Add some in Settings first.</p>
            ) : (
              <select
                value={positionValue}
                onChange={(event) => setPositionValue(event.target.value)}
                className="h-12 w-full rounded-[12px] border border-border bg-input pl-4 pr-10 text-sm text-foreground outline-none transition-colors focus:border-border-strong"
              >
                <option value="">None</option>
                {activePositions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </select>
            )}
            <Button onClick={() => void handlePositionChange()} disabled={isSaving} className="w-full">
              {isSaving ? "Saving..." : "Save position"}
            </Button>
          </div>
        ) : null}

        {deactivateUser ? (
          <div className="space-y-4">
            <SheetHeader>
              <SheetTitle>Deactivate user</SheetTitle>
              <SheetDescription>
                {deactivateUser.feedDisplayName} will no longer be able to send or receive recognition.
              </SheetDescription>
            </SheetHeader>
            <Button onClick={() => void handleDeactivate()} disabled={isSaving} variant="danger" className="w-full">
              {isSaving ? "Deactivating..." : "Confirm deactivate"}
            </Button>
            <Button onClick={() => setDeactivateUser(null)} variant="outline" className="w-full">
              Cancel
            </Button>
          </div>
        ) : null}

        {deleteUser ? (
          <div className="space-y-4">
            <SheetHeader>
              <SheetTitle>Delete permanently</SheetTitle>
              <SheetDescription>
                This cannot be undone. {deleteUser.feedDisplayName}&apos;s account, recognition history
                involving them, and related records will be removed. Their email can be invited again.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted">
                Type {deleteUser.email} to confirm
              </label>
              <Input
                value={deleteConfirmEmail}
                onChange={(event) => setDeleteConfirmEmail(event.target.value)}
                type="email"
                autoComplete="off"
                placeholder={deleteUser.email}
              />
            </div>
            <Button
              onClick={() => void handleDelete()}
              disabled={
                isSaving ||
                deleteConfirmEmail.trim().toLowerCase() !== deleteUser.email.toLowerCase()
              }
              variant="danger"
              className="w-full"
            >
              {isSaving ? "Deleting..." : "Delete permanently"}
            </Button>
            <Button
              onClick={() => {
                setDeleteUser(null);
                setDeleteConfirmEmail("");
              }}
              variant="outline"
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
});

AdminUserMutationsSheet.displayName = "AdminUserMutationsSheet";
