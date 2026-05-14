import { z } from "zod";
import { error, success } from "@/lib/api";
import { requireAdminOrManager, requireAuth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import type { UpdateEventInput } from "@/lib/services/eventService";
import { eventService } from "@/lib/services/eventService";

const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  venue: z.string().max(500).optional().nullable(),
  coverImageUrl: z.string().max(2000).optional().nullable(),
  linkUrl: z.string().max(2000).optional().nullable(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional().nullable(),
});

export const GET = requireAuth(async (_request, context, session) => {
  try {
    const id = context.params?.id;
    if (!id) throw new AppError("Missing event id", "INVALID_REQUEST", 400);
    const event = await eventService.get(id, session.user.workspaceId, session.user.id);
    const canEdit = session.user.role === "ADMIN" || event.createdById === session.user.id;
    return success({ ...event, canEdit });
  } catch (err) {
    return error(err);
  }
});

export const PATCH = requireAdminOrManager(async (request, context, session) => {
  try {
    const id = context.params?.id;
    if (!id) throw new AppError("Missing event id", "INVALID_REQUEST", 400);
    const body = updateEventSchema.parse(await request.json());
    const patch: UpdateEventInput = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.description !== undefined) patch.description = body.description;
    if (body.location !== undefined) patch.location = body.location;
    if (body.venue !== undefined) patch.venue = body.venue;
    if (body.coverImageUrl !== undefined) patch.coverImageUrl = body.coverImageUrl || null;
    if (body.linkUrl !== undefined) patch.linkUrl = body.linkUrl || null;
    if (body.startsAt !== undefined) patch.startsAt = new Date(body.startsAt);
    if (body.endsAt !== undefined) patch.endsAt = body.endsAt ? new Date(body.endsAt) : null;

    const event = await eventService.update(id, session.user.workspaceId, session.user.id, session.user.role, patch);
    return success(event);
  } catch (err) {
    return error(err);
  }
});

export const DELETE = requireAdminOrManager(async (_request, context, session) => {
  try {
    const id = context.params?.id;
    if (!id) throw new AppError("Missing event id", "INVALID_REQUEST", 400);
    await eventService.deleteEvent(id, session.user.workspaceId, session.user.id, session.user.role);
    return success({ ok: true as const });
  } catch (err) {
    return error(err);
  }
});
