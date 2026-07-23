import { timingSafeEqual } from "crypto";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

function secretsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Validates cron requests via `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret`.
 */
export function assertCronAuthorized(request: Request): void {
  const secret = env.CRON_SECRET;
  if (!secret) {
    throw new AppError("Cron is not configured", "CRON_NOT_CONFIGURED", 503);
  }

  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret && secretsEqual(headerSecret, secret)) {
    return;
  }

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    if (token && secretsEqual(token, secret)) {
      return;
    }
  }

  throw new AppError("Unauthorized cron request", "CRON_UNAUTHORIZED", 401);
}
