import { listTimeEntries, logManualTime } from "@/lib/time-entries";
import { jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";

export function GET(request: Request) {
  try {
    const hobbyId = new URL(request.url).searchParams.get("hobbyId");
    return Response.json({ entries: listTimeEntries(hobbyId) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const entry = logManualTime({
      hobbyId: body?.hobbyId,
      date: body?.date,
      durationMinutes: body?.durationMinutes,
    });
    return Response.json(entry, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
