import { error, success } from "@/lib/api";
import { assertCronAuthorized } from "@/lib/jobs/cronAuth";
import { runRecognitionFridayJob } from "@/lib/jobs/recognitionFriday";

async function handle(request: Request) {
  try {
    assertCronAuthorized(request);
    const result = await runRecognitionFridayJob();
    return success(result);
  } catch (err) {
    return error(err);
  }
}

export const GET = handle;
export const POST = handle;
