import { stopTimer } from "@/lib/time-entries";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export function POST() {
  try {
    return Response.json(stopTimer());
  } catch (error) {
    return jsonError(error);
  }
}
