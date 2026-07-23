import type { Config } from "@netlify/functions";
import { runRecognitionFridayJob } from "../../lib/jobs/recognitionFriday";

export default async () => {
  try {
    const result = await runRecognitionFridayJob();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[recognition-friday] Job failed", err);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const config: Config = {
  schedule: "0 8 * * 5",
};
