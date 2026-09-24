"use client";

import { FormEvent, useEffect, useState } from "react";

type Hobby = {
  id: number;
  name: string;
  createdAt: string;
  totalSeconds: number;
};

type ActiveTimer = {
  id: number;
  hobbyId: number;
  hobbyName: string;
  startedAt: string;
};

type Notice = {
  tone: "ok" | "warn";
  text: string;
};

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remain = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(remain).padStart(2, "0")}s`;
  }
  return `${remain}s`;
}

function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "Something went wrong";
}

export function HobbyTracker() {
  const [hobbies, setHobbies] = useState<Hobby[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayInputValue);
  const [minutes, setMinutes] = useState("30");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);

  async function refresh(nextSelectedId?: number) {
    const response = await fetch("/api/hobbies");
    if (!response.ok) {
      setNotice({ tone: "warn", text: await readError(response) });
      return;
    }
    const body = (await response.json()) as { hobbies: Hobby[]; activeTimer: ActiveTimer | null };
    setHobbies(body.hobbies);
    setActiveTimer(body.activeTimer);
    setSelectedId((current) => {
      if (nextSelectedId) return nextSelectedId;
      if (current && body.hobbies.some((hobby) => hobby.id === current)) return current;
      return body.hobbies[0]?.id ?? null;
    });
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeTimer) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeTimer]);

  const selected = hobbies.find((hobby) => hobby.id === selectedId) ?? null;
  const elapsedSeconds = activeTimer
    ? Math.max(0, Math.round((now - Date.parse(activeTimer.startedAt)) / 1000))
    : 0;

  async function onAddHobby(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/hobbies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      setNotice({ tone: "warn", text: await readError(response) });
      return;
    }
    const hobby = (await response.json()) as Hobby;
    setName("");
    setNotice({ tone: "ok", text: `${hobby.name} added.` });
    await refresh(hobby.id);
  }

  async function onLogTime(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const response = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hobbyId: selected.id,
        date,
        durationMinutes: Number(minutes),
      }),
    });
    if (!response.ok) {
      setNotice({ tone: "warn", text: await readError(response) });
      return;
    }
    setNotice({ tone: "ok", text: `Time saved for ${selected.name}.` });
    await refresh(selected.id);
  }

  async function onStart() {
    if (!selected) return;
    const response = await fetch("/api/time-entries/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hobbyId: selected.id }),
    });
    if (!response.ok) {
      setNotice({ tone: "warn", text: await readError(response) });
      return;
    }
    setNow(Date.now());
    setNotice({ tone: "ok", text: `Timer started for ${selected.name}.` });
    await refresh(selected.id);
  }

  async function onStop() {
    const response = await fetch("/api/time-entries/stop", { method: "POST" });
    if (!response.ok) {
      setNotice({ tone: "warn", text: await readError(response) });
      return;
    }
    const entry = (await response.json()) as { hobbyId: number };
    setNotice({ tone: "ok", text: "Time saved." });
    await refresh(entry.hobbyId);
  }

  return (
    <main className="app">
      <header className="masthead">
        <h1>MyHoppies</h1>
        <p>Log time on the things you actually do, by hand or with a timer.</p>
      </header>

      {notice ? (
        <p className={`notice ${notice.tone}`} role="status">
          {notice.text}
        </p>
      ) : null}

      <div className="layout">
        <section className="panel">
          <h2>Hobbies</h2>
          <form onSubmit={onAddHobby}>
            <label>
              Name
              <input
                name="hobby-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Guitar"
                required
              />
            </label>
            <button className="primary" type="submit">
              Add hobby
            </button>
          </form>
          {loading ? <p className="empty">Loading hobbies…</p> : null}
          {!loading && hobbies.length === 0 ? (
            <p className="empty">Add a hobby to start tracking time.</p>
          ) : null}
          <ul className="hobby-list">
            {hobbies.map((hobby) => (
              <li key={hobby.id}>
                <button
                  type="button"
                  className={hobby.id === selectedId ? "hobby selected" : "hobby"}
                  onClick={() => setSelectedId(hobby.id)}
                >
                  <strong>{hobby.name}</strong>
                  <span className="total">{formatDuration(hobby.totalSeconds)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>{selected ? selected.name : "Track time"}</h2>
          {!selected ? <p className="empty">Choose a hobby after you add one.</p> : null}
          {selected ? (
            <>
              <p className="empty">Total {formatDuration(selected.totalSeconds)}</p>
              <form onSubmit={onLogTime}>
                <div className="fields">
                  <label>
                    Date
                    <input
                      name="entry-date"
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Minutes
                    <input
                      name="entry-minutes"
                      type="number"
                      min="1"
                      step="1"
                      value={minutes}
                      onChange={(event) => setMinutes(event.target.value)}
                      required
                    />
                  </label>
                </div>
                <button className="primary" type="submit">
                  Log time
                </button>
              </form>

              <div className="timer-row">
                {activeTimer ? (
                  <>
                    <p className="elapsed">{formatDuration(elapsedSeconds)}</p>
                    <p className="empty">Running for {activeTimer.hobbyName}</p>
                    <button className="secondary" type="button" onClick={onStop}>
                      Stop timer
                    </button>
                  </>
                ) : (
                  <button className="secondary" type="button" onClick={onStart}>
                    Start timer
                  </button>
                )}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
