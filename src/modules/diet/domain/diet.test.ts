import { describe, expect, it } from "vitest";
import { addUp, dayProgress, kcalFromMacros, rescale, scale } from "./nutrition";
import { bmr, macroMismatchPercent, splitByPercent, suggestTargets } from "./targets";
import { FOOD_CATALOG } from "@/config/foods";

describe("valori nutrizionali", () => {
  const pasta = { kcal: 355, protein: 12, carbs: 72, fat: 1.5 };
  it("scala sulla quantità", () => {
    expect(scale(pasta, 80)).toEqual({ kcal: 284, protein: 9.6, carbs: 57.6, fat: 1.2 });
    expect(scale(pasta, 0)).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
  it("somma", () => {
    expect(addUp([scale(pasta, 100), scale(pasta, 50)])).toEqual({ kcal: 532.5, protein: 18, carbs: 108, fat: 2.3 });
    expect(addUp([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
  it("ricalcola un'annotazione per una nuova quantità", () => {
    const e = { quantity: 100, kcal: 200, protein: 10, carbs: 20, fat: 8 };
    expect(rescale(e, 150)).toEqual({ kcal: 300, protein: 15, carbs: 30, fat: 12 });
    expect(rescale({ ...e, quantity: 0 }, 50).kcal).toBe(0);
  });
  it("calorie dai macro", () => expect(kcalFromMacros(150, 250, 70)).toBe(2230));
});

describe("avanzamento giornaliero", () => {
  const goals = { kcal: 2000, proteinG: 150, carbsG: 200, fatG: 70, waterMl: 2500 };
  it("senza obiettivi non c'è avanzamento", () => expect(dayProgress({ kcal: 100, protein: 1, carbs: 1, fat: 1 }, null)).toBeNull());
  it("calorie rimaste e percentuali", () => {
    const p = dayProgress({ kcal: 1500, protein: 75, carbs: 210, fat: 40 }, goals)!;
    expect(p.kcalRemaining).toBe(500);
    expect(p.kcalPercent).toBe(75);
    expect(p.over).toBe(false);
    expect(p.macros.map((m) => m.percent)).toEqual([50, 100, 57]);
    expect(p.macros[1].over).toBe(false); // 5% di tolleranza
  });
  it("segnala il superamento", () => {
    const p = dayProgress({ kcal: 2300, protein: 100, carbs: 260, fat: 70 }, goals)!;
    expect(p.over).toBe(true);
    expect(p.kcalRemaining).toBe(-300);
    expect(p.macros[1].over).toBe(true);
  });
});

describe("obiettivi suggeriti", () => {
  const base = { sex: "male" as const, age: 30, heightCm: 180, weightKg: 80, activity: "moderate" as const, objective: "maintain" as const };
  it("metabolismo basale (Mifflin-St Jeor)", () => {
    expect(bmr(base)).toBe(1780);
    expect(bmr({ ...base, sex: "female" })).toBe(1614);
  });
  it("mantenimento", () => {
    const t = suggestTargets(base);
    expect(t.kcal).toBe(2760);
    expect(t.proteinG).toBe(128);
    expect(t.fatG).toBe(77);
    expect(t.carbsG).toBe(389);
    expect(t.waterMl).toBe(2750);
    expect(Math.abs(kcalFromMacros(t.proteinG, t.carbsG, t.fatG) - t.kcal)).toBeLessThan(15);
  });
  it("dimagrimento: meno calorie e più proteine; aumento: più calorie", () => {
    const lose = suggestTargets({ ...base, objective: "lose" });
    const gain = suggestTargets({ ...base, objective: "gain" });
    expect(lose.kcal).toBeLessThan(2760);
    expect(gain.kcal).toBeGreaterThan(2760);
    expect(lose.proteinG).toBe(160);
  });
  it("non scende sotto una soglia minima di sicurezza", () => {
    const t = suggestTargets({ sex: "female", age: 60, heightCm: 150, weightKg: 45, activity: "sedentary", objective: "lose" });
    expect(t.kcal).toBe(1200);
    expect(t.carbsG).toBeGreaterThanOrEqual(0);
  });
  it("ripartizione per percentuale", () => {
    expect(splitByPercent(2000, { protein: 25, carbs: 45, fat: 30 })).toEqual({ proteinG: 125, carbsG: 225, fatG: 67 });
    expect(macroMismatchPercent(2000, 150, 200, 70)).toBe(2);
  });
});

describe("catalogo alimenti", () => {
  it("slug unici e nomi non vuoti", () => {
    const slugs = FOOD_CATALOG.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(FOOD_CATALOG.every((f) => f.name.length > 1 && f.slug.length > 1)).toBe(true);
  });
  it("calorie coerenti con i macronutrienti (esclusi gli alcolici)", () => {
    const bad = FOOD_CATALOG.filter((f) => f.category !== "Alcolici").filter((f) => {
      const calc = f.protein * 4 + f.carbs * 4 + f.fat * 9;
      return Math.abs(f.kcal - calc) > Math.max(15, calc * 0.15);
    });
    expect(bad.map((f) => `${f.name}: ${f.kcal} vs ${f.protein * 4 + f.carbs * 4 + f.fat * 9}`)).toEqual([]);
  });
  it("macro entro i 100 g e porzioni sensate", () => {
    for (const f of FOOD_CATALOG) {
      expect(f.protein + f.carbs + f.fat).toBeLessThanOrEqual(101);
      if (f.servingSize) expect(f.servingSize).toBeGreaterThan(0);
    }
  });
});
