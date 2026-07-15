import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaUrl?: string;
};

function connectionStringOrPlaceholder() {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required to initialize Prisma with the PostgreSQL driver adapter.");
  }
  // `next build` may load modules that import `prisma` without a local `.env`; no queries run until runtime.
  return "postgresql://prisma:prisma@127.0.0.1:5432/prisma";
}

function needsSsl(connectionString: string) {
  if (/sslmode=disable/i.test(connectionString)) return false;
  if (/localhost|127\.0\.0\.1/i.test(connectionString)) return false;
  // Managed Postgres (RDS, Supabase, etc.) typically requires TLS.
  return true;
}

function createPrismaClient() {
  const connectionString = connectionStringOrPlaceholder();
  const pool = new Pool({
    connectionString,
    ...(needsSsl(connectionString) ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const runtimeUrlKey = process.env.DATABASE_URL || connectionStringOrPlaceholder();

if (!globalForPrisma.prisma || globalForPrisma.prismaUrl !== runtimeUrlKey) {
  globalForPrisma.prisma = createPrismaClient();
  globalForPrisma.prismaUrl = runtimeUrlKey;
}

export const prisma = globalForPrisma.prisma;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaUrl = runtimeUrlKey;
}
