"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { userService } from "@/lib/services/userService";

export type UpdateUsernameResult =
  | { ok: true; username: string | null; email: string }
  | { ok: false; error: string; code?: string };

export async function updateProfileUsername(username: string | null): Promise<UpdateUsernameResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.workspaceId) {
    return { ok: false, error: "Not signed in", code: "UNAUTHORIZED" };
  }
  try {
    const data = await userService.updateOwnUsername(session.user.id, username);
    revalidatePath("/dashboard", "layout");
    return { ok: true, username: data.username, email: data.email };
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, error: err.message, code: err.code };
    }
    return { ok: false, error: "Could not update username", code: "INTERNAL_ERROR" };
  }
}
