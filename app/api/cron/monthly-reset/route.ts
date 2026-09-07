import { error, success } from "@/lib/api";
import { assertCronAuthorized } from "@/lib/jobs/cronAuth";
import { runMonthlyResetJob } from "@/lib/jobs/monthlyReset";
import { AppError } from "@/lib/errors";

async function handle(request: Request) {
  try {
    assertCronAuthorized(request);
    const result = await runMonthlyResetJob({ requireLagosMonthStart: true });
    if (!result.ok) {
      throw new AppError(
        "Monthly reset failed for one or more workspaces",
        "MONTHLY_RESET_PARTIAL_FAILURE",
        500,
      );
    }
    return success(result);
  } catch (err) {
    return error(err);
  }
}

export const GET = handle;
export const POST = handle;
