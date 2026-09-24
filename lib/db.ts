import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

let database: Database.Database | null = null;

function databasePath() {
  return process.env.MYHOPPIES_DB ?? path.join(process.cwd(), "data", "myhoppies.sqlite");
}

export function getDb() {
  if (database) return database;

  const file = databasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  database = new Database(file);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS hobbies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hobby_id INTEGER NOT NULL REFERENCES hobbies(id),
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_seconds INTEGER,
      source TEXT NOT NULL CHECK (source IN ('manual', 'timer'))
    );
  `);

  return database;
}

export function closeDb() {
  database?.close();
  database = null;
}
