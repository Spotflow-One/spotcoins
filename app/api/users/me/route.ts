import { z } from "zod";
import { error, success } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { userService } from "@/lib/services/userService";

export const dynamic = "force-dynamic";

const patchMeSchema = z.object({
  username: z.string().nullable(),
});

function withNoStoreHeaders(response: Response) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export const GET = requireAuth(async (_request, _context, session) => {
  try {
    const data = await userService.getMe(session.user.id);
    return withNoStoreHeaders(success(data));
  } catch (err) {
    return withNoStoreHeaders(error(err));
  }
});

export const PATCH = requireAuth(async (request, _context, session) => {
  try {
    const body = patchMeSchema.parse(await request.json());
    const data = await userService.updateOwnUsername(session.user.id, body.username);
    return withNoStoreHeaders(success(data));
  } catch (err) {
    return withNoStoreHeaders(error(err));
  }
});
