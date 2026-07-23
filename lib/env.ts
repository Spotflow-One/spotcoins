import { z } from "zod";

/** Netlify often stores “unset” optional vars as empty strings — treat those as undefined. */
function emptyToUndefined(val: unknown) {
  if (val === "" || val === null) return undefined;
  return val;
}

const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalEmail = z.preprocess(emptyToUndefined, z.string().email().optional());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: optionalString,
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_STATE_SECRET: z.string().min(1),
  ENCRYPTION_KEY: z.string().min(32),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  SLACK_CLIENT_ID: optionalString,
  SLACK_CLIENT_SECRET: optionalString,
  RESEND_API_KEY: optionalString,
  /** Full Resend "from", e.g. `Spotcoin <noreply@yourdomain.com>` (domain must be verified in Resend). */
  RESEND_FROM: optionalString,
  REDIS_URL: optionalString,
  NEXT_PUBLIC_SUPPORT_EMAIL: optionalEmail,
  NETLIFY_BLOB_READ_WRITE_TOKEN: optionalString,
  NETLIFY_SITE_ID: optionalString,
  /** Shared secret for Vercel Cron / manual job triggers (`Authorization: Bearer …`). */
  CRON_SECRET: optionalString,
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const message = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${message}`);
}

export const env = result.data;
