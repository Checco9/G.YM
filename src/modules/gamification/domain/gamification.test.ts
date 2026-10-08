import { describe, expect, it } from "vitest";
import { computeXp, levelFromXp, xpForLevel } from "./xp";
import { evaluateBadges, streakInfo } from "./achievements";
import { challengeProgress } from "./challenges";
import type { HistoricalWorkout } from "@/modules/stats/domain/types";
import { dayKey } from "@/lib/dates";

const dayOf = (d: Date) => dayKey(d, "Europe/Rome");
const w = (id: string, iso: string, nSets = 4, weight = 50): HistoricalWorkout => ({
  id,
  name: id,
  startedAt: new Date(iso),
  endedAt: new Date(new Date(iso).getTime() + 3600_000),
  exercises: [{ exerciseId: "e1", sets: Array.from({ length: nSets }, () => ({ weightKg: weight, reps: 10 })) }],
});

describe("livelli dell'account", () => {
  it("soglie crescenti", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(400);
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(399).level).toBe(2);
    expect(levelFromXp(400).level).toBe(3);
  });
  it("percentuale verso il livello successivo", () => {
    expect(levelFromXp(250).percent).toBe(50); // 100→400, 150/300
    expect(levelFromXp(250).title).toBe("Matricola");
    expect(levelFromXp(2500).title).toBe("Costante");
  });
});

describe("XP", () => {
  const base = { prCount: 0, badgeXp: 0, challengesCompleted: 0, dayOf };
  it("workout e serie", () => {
    const x = computeXp({ ...base, workouts: [w("a", "2026-10-01T10:00:00Z")] });
    expect(x.workouts).toBe(50);
    expect(x.sets).toBe(8);
    expect(x.total).toBe(58);
  });
  it("niente XP sotto le 3 serie", () => {
    expect(computeXp({ ...base, workouts: [w("a", "2026-10-01T10:00:00Z", 2)] }).total).toBe(0);
  });
  it("un solo workout al giorno conta", () => {
    const x = computeXp({ ...base, workouts: [w("a", "2026-10-01T08:00:00Z"), w("b", "2026-10-01T18:00:00Z")] });
    expect(x.workouts).toBe(50);
  });
  it("tetto di 30 serie e bonus settimana piena", () => {
    const x = computeXp({
      ...base,
      workouts: [w("a", "2026-10-05T10:00:00Z", 50), w("b", "2026-10-06T10:00:00Z"), w("c", "2026-10-07T10:00:00Z")],
    });
    expect(x.weeks).toBe(60);
    expect(x.sets).toBe((30 + 4 + 4) * 2);
  });
  it("record, sfide e badge si sommano", () => {
    const x = computeXp({ workouts: [], prCount: 2, badgeXp: 100, challengesCompleted: 1, dayOf });
    expect(x.total).toBe(80 + 100 + 150);
  });
});

describe("badge", () => {
  const ctx = (workouts: HistoricalWorkout[]) => ({ workouts, prs: [], weightDates: [], dayOf });
  it("primo allenamento si sblocca con quel workout", () => {
    const b = evaluateBadges(ctx([w("a", "2026-10-01T10:00:00Z")])).find((x) => x.id === "workouts-1")!;
    expect(b.unlocked).toBe(true);
    expect(b.workoutId).toBe("a");
  });
  it("progresso dei badge bloccati", () => {
    const ws = Array.from({ length: 4 }, (_, i) => w("w" + i, `2026-10-0${i + 1}T10:00:00Z`));
    const b = evaluateBadges(ctx(ws)).find((x) => x.id === "workouts-10")!;
    expect(b.unlocked).toBe(false);
    expect(b.current).toBe(4);
    expect(b.percent).toBe(40);
  });
  it("volume cumulativo: sblocca nel workout che supera la soglia", () => {
    // ogni workout = 4 serie × 50 kg × 10 = 2000 kg
    const ws = Array.from({ length: 6 }, (_, i) => w("v" + i, `2026-10-0${i + 1}T10:00:00Z`));
    const b = evaluateBadges(ctx(ws)).find((x) => x.id === "volume-10000")!;
    expect(b.unlocked).toBe(true);
    expect(b.workoutId).toBe("v4");
  });
  it("streak: settimane consecutive e record", () => {
    const ws = [w("a", "2026-09-14T10:00:00Z"), w("b", "2026-09-22T10:00:00Z"), w("c", "2026-10-01T10:00:00Z"), w("d", "2026-10-20T10:00:00Z")];
    const info = streakInfo({ workouts: ws, dayOf });
    expect(info.best).toBe(3);
    expect(info.reached.get(3)!.id).toBe("c");
  });
  it("badge di forza solo con i dati di livello", () => {
    const none = evaluateBadges(ctx([])).find((x) => x.id === "strength-intermediate")!;
    expect(none.unlocked).toBe(false);
    const yes = evaluateBadges({ ...ctx([]), strength: { exerciseLevels: ["beginner", "advanced"], rankedMuscles: 3, totalMuscles: 20 } });
    expect(yes.find((x) => x.id === "strength-intermediate")!.unlocked).toBe(true);
    expect(yes.find((x) => x.id === "strength-advanced")!.unlocked).toBe(true);
    expect(yes.find((x) => x.id === "strength-elite")!.unlocked).toBe(false);
  });
});

describe("sfide", () => {
  const ws = [w("a", "2026-10-01T10:00:00Z"), w("b", "2026-10-03T10:00:00Z"), w("c", "2026-10-20T10:00:00Z")];
  const data = { workouts: ws, prs: [], dayOf };
  it("conta solo nell'intervallo", () => {
    const p = challengeProgress({ kind: "workouts", targetValue: 4, startsOn: "2026-10-01", endsOn: "2026-10-07" }, data, "2026-10-05");
    expect(p).toMatchObject({ current: 2, percent: 50, status: "active", daysLeft: 2 });
  });
  it("completata", () => {
    expect(challengeProgress({ kind: "workouts", targetValue: 2, startsOn: "2026-10-01", endsOn: "2026-10-07" }, data, "2026-10-05").status).toBe("completed");
  });
  it("fallita dopo la scadenza", () => {
    const p = challengeProgress({ kind: "workouts", targetValue: 4, startsOn: "2026-10-01", endsOn: "2026-10-07" }, data, "2026-10-09");
    expect(p.status).toBe("failed");
    expect(p.daysLeft).toBe(0);
  });
  it("volume", () => {
    const p = challengeProgress({ kind: "volume", targetValue: 10000, startsOn: "2026-10-01", endsOn: "2026-10-31" }, data, "2026-10-25");
    expect(p.current).toBe(6000);
  });
});
