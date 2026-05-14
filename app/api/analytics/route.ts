import { z } from "zod";
import { error, success } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { type AnalyticsSpec, analyticsService } from "@/lib/services/analyticsService";

const querySchema = z
  .object({
    period: z.enum(["this_month", "last_month", "ytd"]).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    quarter: z.coerce.number().int().min(1).max(4).optional(),
  })
  .superRefine((val, ctx) => {
    const hasMonth = val.year != null && val.month != null;
    const hasQuarter = val.year != null && val.quarter != null;
    if (hasMonth && hasQuarter) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Specify either month or quarter, not both",
      });
    }
  });

function toSpec(query: z.infer<typeof querySchema>): AnalyticsSpec {
  const hasMonth = query.year != null && query.month != null;
  const hasQuarter = query.year != null && query.quarter != null;
  if (hasMonth) {
    return { mode: "month", year: query.year!, month: query.month! };
  }
  if (hasQuarter) {
    return { mode: "quarter", year: query.year!, quarter: query.quarter! };
  }
  return { mode: "preset", period: query.period ?? "this_month" };
}

export const GET = requireAuth(async (request, _context, session) => {
  try {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      period: searchParams.get("period") ?? undefined,
      year: searchParams.get("year") ?? undefined,
      month: searchParams.get("month") ?? undefined,
      quarter: searchParams.get("quarter") ?? undefined,
    });

    const spec = toSpec(query);
    const data = await analyticsService.getAnalytics(session.user.workspaceId, spec);
    return success(data);
  } catch (err) {
    return error(err);
  }
});
