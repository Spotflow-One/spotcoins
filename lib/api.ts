import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

export function success<T>(data: T, meta?: object) {
  return NextResponse.json(meta ? { data, meta } : { data });
}

export function error(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      {
        error: err.message,
        code: err.code,
      },
      { status: err.statusCode },
    );
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: err.flatten(),
      },
      { status: 400 },
    );
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2022") {
      return NextResponse.json(
        {
          error:
            "The database is missing a required column. Apply migrations: npx prisma migrate deploy (or prisma migrate dev locally).",
          code: "SCHEMA_MIGRATION_REQUIRED",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        error: "Database operation failed",
        code: "DATABASE_ERROR",
      },
      { status: 500 },
    );
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? err.message
            : "Invalid data for this operation. If you recently pulled code, run database migrations.",
        code: "PRISMA_VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    const msg = err.message ?? "";
    if (/column .* does not exist/i.test(msg) || /does not exist.*column/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Database schema is out of date. Apply pending migrations (e.g. npx prisma migrate deploy).",
          code: "SCHEMA_MIGRATION_REQUIRED",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Database request failed", code: "DATABASE_UNKNOWN" },
      { status: 500 },
    );
  }

  if (err instanceof SyntaxError) {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_JSON" }, { status: 400 });
  }

  return NextResponse.json(
    {
      error: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
    },
    { status: 500 },
  );
}
