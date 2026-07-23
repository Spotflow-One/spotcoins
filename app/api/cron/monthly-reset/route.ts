import { error, success } from "@/lib/api";
import { assertCronAuthorized } from "@/lib/jobs/cronAuth";
import { runMonthlyResetJob } from "@/lib/jobs/monthlyReset";

async function handle(request: Request) {
  try {
    assertCronAuthorized(request);
    const result = await runMonthlyResetJob({ requireLagosMonthStart: true });
    return success(result);
  } catch (err) {
    return error(err);
  }
}

export const GET = handle;
export const POST = handle;
