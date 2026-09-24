import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import test from "node:test";
import { closeDb } from "../lib/db";

const dbPath = path.join(os.tmpdir(), `myhoppies-${process.pid}-${Date.now()}.sqlite`);
process.env.MYHOPPIES_DB = dbPath;

function resetDb() {
  closeDb();
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  }
}

test.beforeEach(() => {
  resetDb();
});

test.after(() => {
  resetDb();
});

test("blank hobby name is rejected", async () => {
  const { POST } = await import("../app/api/hobbies/route");
  const response = await POST(
    new Request("http://localhost/api/hobbies", {
      method: "POST",
      body: JSON.stringify({ name: "   " }),
    }),
  );
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, "Hobby name is required");
});

test("manual log stores date, hobby, and total", async () => {
  const hobbies = await import("../app/api/hobbies/route");
  const entries = await import("../app/api/time-entries/route");

  const created = await hobbies.POST(
    new Request("http://localhost/api/hobbies", {
      method: "POST",
      body: JSON.stringify({ name: " Guitar " }),
    }),
  );
  assert.equal(created.status, 201);
  const hobby = await created.json();
  assert.equal(hobby.name, "Guitar");

  const logged = await entries.POST(
    new Request("http://localhost/api/time-entries", {
      method: "POST",
      body: JSON.stringify({
        hobbyId: hobby.id,
        date: "2026-09-24",
        durationMinutes: 30,
      }),
    }),
  );
  assert.equal(logged.status, 201);
  const entry = await logged.json();
  assert.equal(entry.source, "manual");
  assert.equal(entry.durationSeconds, 1800);
  assert.equal(entry.startedAt, "2026-09-24T00:00:00.000Z");
  assert.equal(entry.hobbyId, hobby.id);

  const listed = await hobbies.GET();
  const body = await listed.json();
  assert.equal(body.hobbies[0].totalSeconds, 1800);
});

test("start then stop records duration and blocks a second timer", async () => {
  const hobbies = await import("../app/api/hobbies/route");
  const start = await import("../app/api/time-entries/start/route");
  const stop = await import("../app/api/time-entries/stop/route");
  const { getDb } = await import("../lib/db");

  const created = await hobbies.POST(
    new Request("http://localhost/api/hobbies", {
      method: "POST",
      body: JSON.stringify({ name: "Reading" }),
    }),
  );
  const hobby = await created.json();

  const running = await start.POST(
    new Request("http://localhost/api/time-entries/start", {
      method: "POST",
      body: JSON.stringify({ hobbyId: hobby.id }),
    }),
  );
  assert.equal(running.status, 201);
  const timer = await running.json();

  const conflict = await start.POST(
    new Request("http://localhost/api/time-entries/start", {
      method: "POST",
      body: JSON.stringify({ hobbyId: hobby.id }),
    }),
  );
  assert.equal(conflict.status, 409);

  const startedAt = new Date(Date.now() - 90_000).toISOString();
  getDb().prepare("UPDATE time_entries SET started_at = ? WHERE id = ?").run(startedAt, timer.id);

  const stopped = await stop.POST();
  assert.equal(stopped.status, 200);
  const entry = await stopped.json();
  assert.equal(entry.source, "timer");
  assert.ok(entry.durationSeconds >= 90);
  assert.ok(entry.endedAt);

  const listed = await hobbies.GET();
  const body = await listed.json();
  assert.equal(body.activeTimer, null);
  assert.equal(body.hobbies[0].totalSeconds, entry.durationSeconds);
});
