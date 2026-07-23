import type { Config } from "@netlify/functions";
import { runMonthlyResetJob } from "../../lib/jobs/monthlyReset";

export default async () => {
  try {
    // Netlify schedule already targets month start; do not double-gate on Lagos date here.
    const result = await runMonthlyResetJob({ requireLagosMonthStart: false });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[monthly-reset] Job failed", err);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const config: Config = {
  schedule: "1 0 1 * *",
};
