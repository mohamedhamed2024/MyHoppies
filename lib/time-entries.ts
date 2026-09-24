import { getDb } from "@/lib/db";
import { requireHobby } from "@/lib/hobbies";
import { HttpError } from "@/lib/http";

export type TimeEntry = {
  id: number;
  hobbyId: number;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  source: "manual" | "timer";
};

export type ActiveTimer = {
  id: number;
  hobbyId: number;
  hobbyName: string;
  startedAt: string;
};

type EntryRow = {
  id: number;
  hobby_id: number;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  source: "manual" | "timer";
};

function toEntry(row: EntryRow): TimeEntry {
  return {
    id: row.id,
    hobbyId: row.hobby_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    source: row.source,
  };
}

function parseHobbyId(hobbyId: unknown) {
  const id = Number(hobbyId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, "Hobby is required");
  }
  return id;
}

export function listTimeEntries(hobbyId: unknown): TimeEntry[] {
  const id = parseHobbyId(hobbyId);
  requireHobby(id);
  const rows = getDb()
    .prepare(
      `SELECT id, hobby_id, started_at, ended_at, duration_seconds, source
       FROM time_entries
       WHERE hobby_id = ?
       ORDER BY started_at DESC, id DESC`,
    )
    .all(id) as EntryRow[];
  return rows.map(toEntry);
}

export function logManualTime(input: {
  hobbyId: unknown;
  date: unknown;
  durationMinutes: unknown;
}): TimeEntry {
  const hobbyId = parseHobbyId(input.hobbyId);
  requireHobby(hobbyId);

  if (typeof input.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new HttpError(400, "Date is required");
  }

  const minutes = Number(input.durationMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new HttpError(400, "Duration must be greater than zero");
  }

  const durationSeconds = Math.round(minutes * 60);
  const startedAt = `${input.date}T00:00:00.000Z`;
  const endedAt = new Date(Date.parse(startedAt) + durationSeconds * 1000).toISOString();

  const result = getDb()
    .prepare(
      `INSERT INTO time_entries (hobby_id, started_at, ended_at, duration_seconds, source)
       VALUES (?, ?, ?, ?, 'manual')`,
    )
    .run(hobbyId, startedAt, endedAt, durationSeconds);

  return {
    id: Number(result.lastInsertRowid),
    hobbyId,
    startedAt,
    endedAt,
    durationSeconds,
    source: "manual",
  };
}

export function getActiveTimer(): ActiveTimer | null {
  const row = getDb()
    .prepare(
      `SELECT te.id, te.hobby_id, te.started_at, h.name AS hobby_name
       FROM time_entries te
       JOIN hobbies h ON h.id = te.hobby_id
       WHERE te.source = 'timer' AND te.ended_at IS NULL
       ORDER BY te.id DESC
       LIMIT 1`,
    )
    .get() as
    | { id: number; hobby_id: number; started_at: string; hobby_name: string }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    hobbyId: row.hobby_id,
    hobbyName: row.hobby_name,
    startedAt: row.started_at,
  };
}

export function startTimer(hobbyId: unknown): ActiveTimer {
  const id = parseHobbyId(hobbyId);
  const hobby = requireHobby(id);
  const open = getActiveTimer();
  if (open) {
    throw new HttpError(409, "A timer is already running");
  }

  const startedAt = new Date().toISOString();
  const result = getDb()
    .prepare(
      `INSERT INTO time_entries (hobby_id, started_at, ended_at, duration_seconds, source)
       VALUES (?, ?, NULL, NULL, 'timer')`,
    )
    .run(id, startedAt);

  return {
    id: Number(result.lastInsertRowid),
    hobbyId: id,
    hobbyName: hobby.name,
    startedAt,
  };
}

export function stopTimer(): TimeEntry {
  const open = getActiveTimer();
  if (!open) {
    throw new HttpError(404, "No timer is running");
  }

  const endedAt = new Date();
  const durationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - Date.parse(open.startedAt)) / 1000),
  );
  const endedAtIso = endedAt.toISOString();

  getDb()
    .prepare(
      `UPDATE time_entries
       SET ended_at = ?, duration_seconds = ?
       WHERE id = ?`,
    )
    .run(endedAtIso, durationSeconds, open.id);

  return {
    id: open.id,
    hobbyId: open.hobbyId,
    startedAt: open.startedAt,
    endedAt: endedAtIso,
    durationSeconds,
    source: "timer",
  };
}
