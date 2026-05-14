"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Pencil } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { AppToast } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { EventCoverMedia } from "@/components/events/EventCoverMedia";

type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  venue: string | null;
  coverImageUrl: string | null;
  linkUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  createdBy: { id: string; name: string; avatarUrl: string | null };
  rsvpCounts: { going: number; interested: number; notGoing: number };
  viewerRsvp: "GOING" | "INTERESTED" | "NOT_GOING" | null;
  canEdit: boolean;
};

type CommentRow = {
  id: string;
  message: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
};

function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { toast, showToast } = useToast();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editVenue, setEditVenue] = useState("");
  const [editLinkUrl, setEditLinkUrl] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editRemoveCover, setEditRemoveCover] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [evRes, cRes] = await Promise.all([
        fetch(`/api/events/${id}`, { cache: "no-store" }),
        fetch(`/api/events/${id}/comments`, { cache: "no-store" }),
      ]);
      const evJson = (await evRes.json()) as { data?: EventDetail; error?: string };
      const cJson = (await cRes.json()) as { data?: CommentRow[]; error?: string };
      if (!evRes.ok) {
        showToast(evJson.error ?? "Event not found", "error");
        setEvent(null);
        return;
      }
      setEvent(evJson.data ?? null);
      setComments(cJson.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = () => {
    if (!event) return;
    setEditTitle(event.title);
    setEditDescription(event.description ?? "");
    setEditLocation(event.location ?? "");
    setEditVenue(event.venue ?? "");
    setEditLinkUrl(event.linkUrl ?? "");
    setEditStartsAt(isoToDatetimeLocalValue(event.startsAt));
    setEditEndsAt(event.endsAt ? isoToDatetimeLocalValue(event.endsAt) : "");
    setEditCoverFile(null);
    setEditRemoveCover(false);
    if (coverFileInputRef.current) coverFileInputRef.current.value = "";
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!id || !editTitle.trim() || !editStartsAt) {
      showToast("Title and start time are required", "error");
      return;
    }
    setSaving(true);
    try {
      let coverImageUrl: string | null = event?.coverImageUrl ?? null;
      if (editCoverFile) {
        const fd = new FormData();
        fd.append("file", editCoverFile);
        const up = await fetch("/api/events/cover-upload", { method: "POST", body: fd });
        const uj = (await up.json()) as { data?: { url: string }; error?: string };
        if (!up.ok) {
          showToast(uj.error ?? "Could not upload cover image", "error");
          return;
        }
        coverImageUrl = uj.data?.url ?? null;
      } else if (editRemoveCover) {
        coverImageUrl = null;
      }

      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          location: editLocation.trim() || null,
          venue: editVenue.trim() || null,
          coverImageUrl,
          linkUrl: editLinkUrl.trim() || null,
          startsAt: new Date(editStartsAt).toISOString(),
          endsAt: editEndsAt ? new Date(editEndsAt).toISOString() : null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        showToast(json.error ?? "Could not update event", "error");
        return;
      }
      showToast("Event updated");
      setEditOpen(false);
      setEditCoverFile(null);
      setEditRemoveCover(false);
      if (coverFileInputRef.current) coverFileInputRef.current.value = "";
      await load();
    } finally {
      setSaving(false);
    }
  };

  const setRsvp = async (status: "GOING" | "INTERESTED" | "NOT_GOING") => {
    if (!id) return;
    const res = await fetch(`/api/events/${id}/rsvp`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      showToast(json.error ?? "RSVP failed", "error");
      return;
    }
    showToast("RSVP updated");
    await load();
  };

  const postComment = async () => {
    if (!id || !commentText.trim()) return;
    const res = await fetch(`/api/events/${id}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: commentText }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      showToast(json.error ?? "Could not post comment", "error");
      return;
    }
    setCommentText("");
    await load();
  };

  if (loading) {
    return (
      <section className="pb-10">
        <Skeleton className="aspect-[2/1] w-full max-w-3xl rounded-2xl" />
        <Skeleton className="mt-4 h-24 w-full rounded-2xl" />
      </section>
    );
  }

  if (!event) {
    return (
      <section className="pb-10 text-center text-sm text-muted">
        <Link href="/dashboard/events" className="underline">
          Back to events
        </Link>
      </section>
    );
  }

  return (
    <section className="pb-10">
      <div className="mb-4 max-w-3xl">
        <EventCoverMedia
          url={event.coverImageUrl}
          frameClassName="aspect-[2/1] w-full rounded-2xl"
          iconSize={40}
        />
      </div>

      <PageHeader
        title={event.title}
        description={event.description ?? "Event details"}
        backHref="/dashboard/events"
        action={
          event.canEdit ? (
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => openEdit()}>
              <Pencil size={14} />
              Edit
            </Button>
          ) : null
        }
      />

      <p className="mt-1 text-xs text-muted">
        {new Date(event.startsAt).toLocaleString()}
        {event.endsAt ? ` → ${new Date(event.endsAt).toLocaleString()}` : ""}
      </p>
      {(event.venue || event.location) && <p className="mt-2 text-sm text-foreground">{[event.venue, event.location].filter(Boolean).join(" · ")}</p>}
      {event.linkUrl ? (
        <a href={event.linkUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-medium text-foreground underline">
          Open link
        </a>
      ) : null}

      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted">RSVP</p>
        <p className="mt-1 text-[11px] text-muted">
          Going {event.rsvpCounts.going} · Interested {event.rsvpCounts.interested} · Can&apos;t go {event.rsvpCounts.notGoing}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={event.viewerRsvp === "GOING" ? "default" : "outline"} onClick={() => void setRsvp("GOING")}>
            Going
          </Button>
          <Button type="button" size="sm" variant={event.viewerRsvp === "INTERESTED" ? "default" : "outline"} onClick={() => void setRsvp("INTERESTED")}>
            Interested
          </Button>
          <Button type="button" size="sm" variant={event.viewerRsvp === "NOT_GOING" ? "default" : "outline"} onClick={() => void setRsvp("NOT_GOING")}>
            Can&apos;t go
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-foreground">Comments</h2>
        <ul className="mt-3 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <Avatar name={c.user.name} size="sm" />
                <span className="text-xs font-medium text-foreground">{c.user.name}</span>
                <span className="text-[10px] text-muted">{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-sm text-foreground/90">{c.message}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2">
          <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment…" />
          <Button type="button" size="sm" onClick={() => void postComment()}>
            Post
          </Button>
        </div>
      </div>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit event</SheetTitle>
            <SheetDescription>Update details for everyone in the workspace.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3 pb-6">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Title</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Venue</label>
                <Input value={editVenue} onChange={(e) => setEditVenue(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Location</label>
                <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Cover image</label>
              <input
                ref={coverFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-card-2 file:px-3 file:py-2 file:text-xs file:font-medium"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setEditCoverFile(f);
                  if (f) setEditRemoveCover(false);
                }}
              />
              {(event.coverImageUrl || editCoverFile) && !editRemoveCover ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setEditRemoveCover(true);
                    setEditCoverFile(null);
                    if (coverFileInputRef.current) coverFileInputRef.current.value = "";
                  }}
                >
                  Remove cover image
                </Button>
              ) : null}
              {editRemoveCover && event.coverImageUrl ? (
                <button
                  type="button"
                  className="mt-2 text-[11px] font-medium text-muted underline decoration-border underline-offset-2 hover:text-foreground"
                  onClick={() => setEditRemoveCover(false)}
                >
                  Undo remove
                </button>
              ) : null}
              <p className="mt-1.5 text-[11px] text-muted">
                {editRemoveCover
                  ? "Cover will be removed after you save. Choose a file to use a new image instead."
                  : "Leave empty to keep the current image. Recommended 2:1 (e.g. 1200×630). JPEG, PNG, or WebP."}
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">External link</label>
              <Input value={editLinkUrl} onChange={(e) => setEditLinkUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Starts</label>
                <Input type="datetime-local" value={editStartsAt} onChange={(e) => setEditStartsAt(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Ends (optional)</label>
                <Input type="datetime-local" value={editEndsAt} onChange={(e) => setEditEndsAt(e.target.value)} />
              </div>
            </div>
            <Button type="button" disabled={saving} onClick={() => void saveEdit()}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AppToast toast={toast} />
    </section>
  );
}
