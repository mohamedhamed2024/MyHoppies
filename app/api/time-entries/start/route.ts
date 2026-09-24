import { startTimer } from "@/lib/time-entries";
import { jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const timer = startTimer(body?.hobbyId);
    return Response.json(timer, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
