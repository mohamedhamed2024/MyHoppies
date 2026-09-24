import { createHobby, listHobbies } from "@/lib/hobbies";
import { getActiveTimer } from "@/lib/time-entries";
import { jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";

export function GET() {
  try {
    return Response.json({
      hobbies: listHobbies(),
      activeTimer: getActiveTimer(),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const hobby = createHobby(body?.name);
    return Response.json(hobby, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
