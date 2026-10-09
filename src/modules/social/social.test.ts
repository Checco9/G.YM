import { describe, expect, it } from "vitest";
import { buildSnapshot } from "./domain/snapshot";
import { parseJpeg, PHOTO_PATH_RE } from "./storage";
import { periodMetrics } from "@/modules/gamification/domain/leaderboard";
import type { HistoricalWorkout } from "@/modules/stats/domain/types";
import type { PREvent } from "@/modules/stats/domain/records";
import type { WorkoutDetail } from "@/modules/stats/service";

const w = (id: string, iso: string, minutes: number, ex: [string, number, number][]): HistoricalWorkout => ({
  id,
  name: id,
  startedAt: new Date(iso),
  endedAt: new Date(new Date(iso).getTime() + minutes * 60000),
  exercises: ex.map(([exerciseId, weightKg, reps]) => ({ exerciseId, sets: [{ weightKg, reps }, { weightKg, reps }] })),
});

describe("metriche della classifica", () => {
  const ws = [
    w("old", "2026-08-01T10:00:00Z", 60, [["bench", 50, 10]]),
    w("a", "2026-10-05T10:00:00Z", 45, [["bench", 60, 10], ["squat", 80, 5]]),
    w("b", "2026-10-06T10:00:00Z", 30, [["bench", 60, 8]]),
  ];
  const prs = [{ date: new Date("2026-10-05T10:00:00Z") }, { date: new Date("2026-08-01T10:00:00Z") }] as PREvent[];
  it("da sempre", () => {
    const m = periodMetrics(ws, prs, null);
    expect(m).toMatchObject({ workouts: 3, minutes: 135, sets: 8, records: 2, variety: 2 });
    expect(m.volume).toBe(1000 + 1200 + 800 + 960);
  });
  it("finestra temporale", () => {
    const m = periodMetrics(ws, prs, new Date("2026-10-01T00:00:00Z"));
    expect(m).toMatchObject({ workouts: 2, minutes: 75, records: 1, variety: 2 });
  });
  it("finestra vuota", () => {
    expect(periodMetrics(ws, prs, new Date("2027-01-01T00:00:00Z"))).toEqual({ workouts: 0, volume: 0, minutes: 0, sets: 0, records: 0, variety: 0 });
  });
});

describe("istantanea del post", () => {
  const detail = {
    name: "Push A",
    startedAt: "2026-10-05T10:00:00.000Z",
    durationMin: 50,
    exerciseCount: 6,
    setCount: 18,
    volume: 5000,
    prs: [{}],
    exercises: [
      { name: "Alzate", sets: [{ weightKg: 10, reps: 12 }], volume: 120, pr: null },
      { name: "Panca", sets: [{ weightKg: 40, reps: 8 }, { weightKg: 45, reps: 8 }], volume: 680, pr: { kinds: ["estimated_1rm"] } },
      { name: "Squat", sets: [{ weightKg: 80, reps: 5 }], volume: 400, pr: null },
      { name: "Curl", sets: [{ weightKg: 15, reps: 10 }], volume: 150, pr: null },
      { name: "Dip", sets: [{ weightKg: 0, reps: 12 }], volume: 0, pr: null },
      { name: "Croci", sets: [{ weightKg: 12, reps: 10 }], volume: 120, pr: null },
    ],
  } as unknown as WorkoutDetail;
  it("max 4 esercizi, prima i record, poi il volume", () => {
    const s = buildSnapshot(detail);
    expect(s.highlights).toHaveLength(4);
    expect(s.highlights[0]).toEqual({ name: "Panca", weightKg: 45, reps: 8, pr: true });
    expect(s.highlights[1].name).toBe("Squat");
    expect(s).toMatchObject({ name: "Push A", prCount: 1, setCount: 18, volume: 5000 });
  });
});

describe("foto", () => {
  // JPEG minimo: SOI, APP0, SOF0 (3x2), EOI
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x02, 0x00, 0x03, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9]);
  it("legge le dimensioni", () => expect(parseJpeg(jpeg)).toEqual({ width: 3, height: 2 }));
  it("rifiuta ciò che non è un JPEG", () => {
    expect(parseJpeg(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(parseJpeg(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
  it("percorsi: solo uuid/uuid.jpg", () => {
    const u = "123e4567-e89b-12d3-a456-426614174000";
    expect(PHOTO_PATH_RE.test(`${u}/${u}.jpg`)).toBe(true);
    expect(PHOTO_PATH_RE.test(`${u}/../../etc/passwd`)).toBe(false);
    expect(PHOTO_PATH_RE.test(`${u}/${u}.html`)).toBe(false);
  });
});
