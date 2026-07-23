/**
 * One-shot backfill: set username from email local part for users with username IS NULL.
 *
 *   DATABASE_URL='…' node scripts/backfill-usernames.js
 *   Optional: dotenv via .env.local (same pattern as seed-test-users.js)
 */
const fs = require("fs");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");

function loadEnvLocal() {
  const path = ".env.local";
  if (!fs.existsSync(path)) return;
  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function sanitizeUsernameCandidate(raw) {
  let cleaned = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (cleaned.length < 3) {
    cleaned = `${cleaned}user`.slice(0, 30);
    if (cleaned.length < 3) cleaned = "user";
  }
  return cleaned.slice(0, 30);
}

function usernameCandidateFromEmail(email) {
  const local = String(email || "").trim().split("@")[0] || email;
  return sanitizeUsernameCandidate(local);
}

async function allocateUsername(prisma, workspaceId, email, excludeUserId) {
  const base = usernameCandidateFromEmail(email);
  let candidate = base;
  let n = 2;
  for (;;) {
    const clash = await prisma.user.findFirst({
      where: {
        workspaceId,
        id: { not: excludeUserId },
        deletedAt: null,
        username: { equals: candidate, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (!clash) return candidate;
    const suffix = String(n);
    candidate = `${base.slice(0, Math.max(1, 30 - suffix.length))}${suffix}`;
    n += 1;
    if (n > 9999) {
      return sanitizeUsernameCandidate(`${base}${Date.now().toString(36)}`).slice(0, 30);
    }
  }
}

async function main() {
  loadEnvLocal();
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: /localhost|127\.0\.0\.1/i.test(process.env.DATABASE_URL)
      ? undefined
      : { rejectUnauthorized: false },
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const users = await prisma.user.findMany({
      where: { username: null },
      select: { id: true, email: true, workspaceId: true },
      orderBy: { createdAt: "asc" },
    });

    console.error(`[backfill-usernames] Found ${users.length} user(s) without username`);
    let updated = 0;

    for (const user of users) {
      const username = await allocateUsername(prisma, user.workspaceId, user.email, user.id);
      await prisma.user.update({
        where: { id: user.id },
        data: { username },
      });
      updated += 1;
      console.error(`[backfill-usernames] ${user.email} → ${username}`);
    }

    console.log(JSON.stringify({ updated }, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
