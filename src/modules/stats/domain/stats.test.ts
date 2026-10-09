import { describe, expect, it } from "vitest";
import { estimateOneRepMax } from "./one-rep-max";
import { computePRTimeline } from "./records";
import { averagePerWeek, weeklyStreak } from "./streak";
import { workoutVolume } from "./volume";
import type { HistoricalWorkout } from "./types";
import { classify, muscleLevel } from "@/modules/strength/domain/levels";
import { goalProgress } from "@/modules/goals/domain/progress";
import { dayKey, weekStartKey } from "@/lib/dates";

const w = (id: string, iso: string, sets: [number, number][], ex = "bench"): HistoricalWorkout => ({
  id,
  name: id,
  startedAt: new Date(iso),
  endedAt: new Date(new Date(iso).getTime() + 3600_000),
  exercises: [{ exerciseId: ex, sets: sets.map(([weightKg, reps]) => ({ weightKg, reps })) }],
});

describe("volume", () => {
  it("somma peso × ripetizioni", () => {
    expect(workoutVolume(w("a", "2026-01-01T10:00:00Z", [[45, 8], [45, 8], [47.5, 6]]))).toBe(1005);
  });
});

describe("1RM", () => {
  it("Epley", () => expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 1));
  it("1 rep = carico", () => expect(estimateOneRepMax(100, 1)).toBe(100));
  it("ignora serie oltre le 12 reps o senza carico", () => {
    expect(estimateOneRepMax(20, 20)).toBeNull();
    expect(estimateOneRepMax(0, 10)).toBeNull();
  });
});

describe("PR", () => {
  it("il primo workout non produce PR", () => {
    expect(computePRTimeline([w("a", "2026-01-01T10:00:00Z", [[40, 8]])])).toHaveLength(0);
  });
  it("riconosce PR di 1RM e carico", () => {
    const ev = computePRTimeline([
      w("a", "2026-01-01T10:00:00Z", [[40, 8]]),
      w("b", "2026-01-08T10:00:00Z", [[42.5, 8]]),
    ]);
    expect(ev).toHaveLength(1);
    expect(ev[0].kinds).toEqual(["estimated_1rm", "weight"]);
  });
  it("uguagliare non è PR", () => {
    const ev = computePRTimeline([
      w("a", "2026-01-01T10:00:00Z", [[40, 8]]),
      w("b", "2026-01-08T10:00:00Z", [[40, 8]]),
    ]);
    expect(ev).toHaveLength(0);
  });
  it("un solo evento per esercizio per workout", () => {
    const ev = computePRTimeline([
      w("a", "2026-01-01T10:00:00Z", [[40, 8]]),
      w("b", "2026-01-08T10:00:00Z", [[42.5, 8], [45, 8], [47.5, 6]]),
    ]);
    expect(ev).toHaveLength(1);
  });
  it("più reps allo stesso carico è PR di 1RM ma non di carico", () => {
    const ev = computePRTimeline([
      w("a", "2026-01-01T10:00:00Z", [[40, 8]]),
      w("b", "2026-01-08T10:00:00Z", [[40, 10]]),
    ]);
    expect(ev[0].kinds).toEqual(["estimated_1rm"]);
  });
});

describe("livelli", () => {
  const t = { beginner: 0, intermediate: 0.75, advanced: 1.25, elite: 1.75 };
  it("non classificato senza peso corporeo o dati", () => {
    expect(classify({ estimatedOneRepMax: 60, bodyWeightKg: null, thresholds: t })).toBe("unranked");
    expect(classify({ estimatedOneRepMax: null, bodyWeightKg: 80, thresholds: t })).toBe("unranked");
    expect(classify({ estimatedOneRepMax: 60, bodyWeightKg: 80, thresholds: null })).toBe("unranked");
  });
  it("usa il rapporto col peso corporeo", () => {
    expect(classify({ estimatedOneRepMax: 40, bodyWeightKg: 80, thresholds: t })).toBe("beginner");
    expect(classify({ estimatedOneRepMax: 60, bodyWeightKg: 80, thresholds: t })).toBe("intermediate");
    expect(classify({ estimatedOneRepMax: 100, bodyWeightKg: 80, thresholds: t })).toBe("advanced");
    expect(classify({ estimatedOneRepMax: 140, bodyWeightKg: 80, thresholds: t })).toBe("elite");
  });
  it("il muscolo prende il miglior esercizio primario", () => {
    expect(
      muscleLevel([
        { exerciseId: "a", role: "primary", level: "beginner" },
        { exerciseId: "b", role: "primary", level: "advanced" },
        { exerciseId: "c", role: "secondary", level: "elite" },
      ]),
    ).toBe("advanced");
  });
});

describe("date, streak, obiettivi", () => {
  it("giorno locale rispetta il fuso", () => {
    expect(dayKey(new Date("2026-10-04T23:30:00Z"), "Europe/Rome")).toBe("2026-10-05");
  });
  it("settimana inizia di lunedì", () => expect(weekStartKey("2026-10-05")).toBe("2026-10-05"));
  it("streak settimanale", () => {
    expect(weeklyStreak(["2026-09-22", "2026-09-30", "2026-10-05"], "2026-10-05")).toBe(3);
    expect(weeklyStreak(["2026-09-22", "2026-09-30"], "2026-10-05")).toBe(2);
    expect(weeklyStreak(["2026-09-01"], "2026-10-05")).toBe(0);
  });
  it("media settimanale", () => expect(averagePerWeek(["2026-10-01", "2026-10-02"], "2026-10-05", 4)).toBe(0.5));
  it("progresso obiettivo in salita e in discesa", () => {
    expect(goalProgress(40, 50, 60)).toEqual({ percent: 50, achieved: false });
    expect(goalProgress(86, 82.4, 80)).toEqual({ percent: 60, achieved: false });
    expect(goalProgress(86, 79, 80)).toEqual({ percent: 100, achieved: true });
    expect(goalProgress(40, 30, 60).percent).toBe(0);
  });
});
