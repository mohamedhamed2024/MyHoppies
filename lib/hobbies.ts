import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";

export type Hobby = {
  id: number;
  name: string;
  createdAt: string;
  totalSeconds: number;
};

type HobbyRow = {
  id: number;
  name: string;
  created_at: string;
  total_seconds: number;
};

export function listHobbies(): Hobby[] {
  const rows = getDb()
    .prepare(
      `SELECT h.id, h.name, h.created_at,
              COALESCE(SUM(CASE WHEN te.duration_seconds IS NOT NULL THEN te.duration_seconds ELSE 0 END), 0) AS total_seconds
       FROM hobbies h
       LEFT JOIN time_entries te ON te.hobby_id = h.id
       GROUP BY h.id
       ORDER BY h.created_at ASC, h.id ASC`,
    )
    .all() as HobbyRow[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    totalSeconds: row.total_seconds,
  }));
}

export function createHobby(name: unknown): Hobby {
  if (typeof name !== "string" || name.trim() === "") {
    throw new HttpError(400, "Hobby name is required");
  }

  const trimmed = name.trim();
  const createdAt = new Date().toISOString();
  const result = getDb()
    .prepare("INSERT INTO hobbies (name, created_at) VALUES (?, ?)")
    .run(trimmed, createdAt);

  return {
    id: Number(result.lastInsertRowid),
    name: trimmed,
    createdAt,
    totalSeconds: 0,
  };
}

export function requireHobby(hobbyId: number) {
  const hobby = getDb().prepare("SELECT id, name FROM hobbies WHERE id = ?").get(hobbyId) as
    | { id: number; name: string }
    | undefined;
  if (!hobby) {
    throw new HttpError(404, "Hobby not found");
  }
  return hobby;
}
