import { describe, expect, it } from "vitest";
import { dueSlot, daysFromList, describeDays, generateTimes, inQuietHours, pickMessage, renderMessage } from "./schedule";
import { isAllowedPushEndpoint } from "./endpoint";
import { strengthMet, workoutCalories, runCalories, runMet, weightOn } from "@/modules/stats/domain/calories";
import { fmtClock, fmtPace, paceSecPerKm, parseDuration, runRecords } from "@/modules/runs/domain/run";
import { localClock, zonedToUtc } from "@/lib/dates";

const TZ = "Europe/Rome";
// 12 ottobre 2026 è lunedì; Roma è UTC+2 (ora legale fino al 25 ottobre)
const at = (hhmm: string, day = "2026-10-12") => zonedToUtc(day, hhmm, TZ);

describe("fuso orario", () => {
  it("converte data e ora locali in UTC", () => {
    expect(at("09:00").toISOString()).toBe("2026-10-12T07:00:00.000Z");
    expect(zonedToUtc("2026-01-15", "09:00", TZ).toISOString()).toBe("2026-01-15T08:00:00.000Z");
    expect(zonedToUtc("2026-10-12", "00:30", TZ).toISOString()).toBe("2026-10-11T22:30:00.000Z");
  });
  it("orologio locale", () => {
    expect(localClock(at("18:45"), TZ)).toEqual({ day: "2026-10-12", minutes: 18 * 60 + 45, weekday: 0 });
  });
});

describe("pianificazione promemoria", () => {
  const base = { tz: TZ, times: ["09:00", "13:00"], daysMask: 127, lastSlot: null as string | null };
  it("parte all'orario e dentro la tolleranza", () => {
    expect(dueSlot({ ...base, now: at("09:00") })).toBe("2026-10-12 09:00");
    expect(dueSlot({ ...base, now: at("09:20") })).toBe("2026-10-12 09:00");
  });
  it("non parte prima o troppo tardi", () => {
    expect(dueSlot({ ...base, now: at("08:55") })).toBeNull();
    expect(dueSlot({ ...base, now: at("09:40") })).toBeNull();
  });
  it("non si ripete per lo stesso orario", () => {
    expect(dueSlot({ ...base, now: at("09:05"), lastSlot: "2026-10-12 09:00" })).toBeNull();
    expect(dueSlot({ ...base, now: at("13:05"), lastSlot: "2026-10-12 09:00" })).toBe("2026-10-12 13:00");
  });
  it("rispetta i giorni scelti", () => {
    const solo = daysFromList([1, 3]); // martedì e giovedì
    expect(dueSlot({ ...base, daysMask: solo, now: at("09:00") })).toBeNull(); // lunedì
    expect(dueSlot({ ...base, daysMask: solo, now: at("09:00", "2026-10-13") })).toBe("2026-10-13 09:00");
  });
  it("descrive i giorni", () => {
    expect(describeDays(127)).toBe("Ogni giorno");
    expect(describeDays(31)).toBe("Lunedì-venerdì");
    expect(describeDays(daysFromList([0, 2]))).toBe("Lun, Mer");
  });
  it("genera gli orari", () => {
    expect(generateTimes("09:00", "13:00", 120)).toEqual(["09:00", "11:00", "13:00"]);
    expect(generateTimes("09:00", "13:00", 5)).toEqual([]);
  });
});

describe("ore di silenzio", () => {
  it("fascia normale e a cavallo della mezzanotte", () => {
    expect(inQuietHours(13 * 60, "12:00", "14:00")).toBe(true);
    expect(inQuietHours(15 * 60, "12:00", "14:00")).toBe(false);
    expect(inQuietHours(23 * 60, "22:00", "07:00")).toBe(true);
    expect(inQuietHours(3 * 60, "22:00", "07:00")).toBe(true);
    expect(inQuietHours(12 * 60, "22:00", "07:00")).toBe(false);
    expect(inQuietHours(12 * 60, null, null)).toBe(false);
  });
});

describe("messaggi", () => {
  it("sostituisce i segnaposto noti e lascia gli altri", () => {
    expect(renderMessage("Ciao {nome}, hai bevuto {bevuti}. {boh}", { nome: "Franci", bevuti: "1,5 L" })).toBe("Ciao Franci, hai bevuto 1,5 L. {boh}");
  });
  it("sceglie un messaggio", () => {
    expect(pickMessage(["a", "b", "c"], () => 0.99)).toBe("c");
    expect(pickMessage([], () => 0.5)).toBe("");
  });
});

describe("indirizzi push ammessi", () => {
  it("accetta solo i servizi dei browser", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/abc")).toBe(true);
  });
  it("rifiuta tutto il resto", () => {
    for (const u of ["http://fcm.googleapis.com/x", "https://evil.com/x", "https://fcm.googleapis.com.evil.com/x", "https://localhost/x", "https://169.254.169.254/latest", "https://user:pw@fcm.googleapis.com/x", "non-un-url"])
      expect(isAllowedPushEndpoint(u)).toBe(false);
  });
  it("host aggiuntivi solo se dichiarati", () => {
    expect(isAllowedPushEndpoint("https://localhost/x", ["localhost"])).toBe(true);
  });
});

describe("calorie stimate", () => {
  it("pesi: dipende da quanto è fitta la sessione", () => {
    expect(strengthMet(0.1)).toBe(3);
    expect(strengthMet(0.3)).toBe(4.5);
    expect(strengthMet(0.5)).toBe(5.5);
    expect(workoutCalories({ weightKg: 80, durationMin: 60, sets: 20 })).toBe(360);
  });
  it("senza peso o durata non stima", () => {
    expect(workoutCalories({ weightKg: null, durationMin: 60, sets: 20 })).toBeNull();
    expect(workoutCalories({ weightKg: 80, durationMin: 2, sets: 20 })).toBeNull();
    expect(workoutCalories({ weightKg: 80, durationMin: 60, sets: 0 })).toBeNull();
  });
  it("corsa: MET dalla velocità", () => {
    expect(runMet(10)).toBeCloseTo(10.5, 0);
    expect(runMet(5)).toBeLessThan(runMet(10));
    expect(runCalories({ weightKg: 80, distanceM: 5000, durationS: 1800 })).toBe(420);
    expect(runCalories({ weightKg: 80, distanceM: 0, durationS: 1800 })).toBeNull();
    expect(runCalories({ weightKg: 80, distanceM: 50000, durationS: 1800 })).toBeNull();
  });
  it("peso alla data", () => {
    const w = [{ measuredOn: "2026-09-01", weightKg: 86 }, { measuredOn: "2026-10-01", weightKg: 84 }];
    expect(weightOn(w, "2026-09-15")).toBe(86);
    expect(weightOn(w, "2026-10-10")).toBe(84);
    expect(weightOn(w, "2026-08-01")).toBe(86);
    expect(weightOn([], "2026-08-01")).toBeNull();
  });
});

describe("corsa", () => {
  it("passo e formati", () => {
    expect(paceSecPerKm(5000, 1500)).toBe(300);
    expect(fmtPace(300)).toBe("5:00");
    expect(fmtPace(334.6)).toBe("5:35");
    expect(paceSecPerKm(50, 10)).toBeNull();
    expect(fmtClock(3909)).toBe("1:05:09");
    expect(fmtClock(1470)).toBe("24:30");
  });
  it("durata scritta a mano", () => {
    expect(parseDuration("1:05:09")).toBe(3909);
    expect(parseDuration("24:30")).toBe(1470);
    expect(parseDuration("45")).toBe(2700);
    for (const bad of ["", "abc", "1:99", "1:2:3:4", "-5"]) expect(parseDuration(bad)).toBeNull();
  });
  it("record: il miglior passo conta solo da 3 km", () => {
    const d = new Date();
    const r = runRecords([
      { id: "a", startedAt: d, distanceM: 1000, durationS: 200 },
      { id: "b", startedAt: d, distanceM: 5000, durationS: 1500 },
      { id: "c", startedAt: d, distanceM: 10000, durationS: 3300 },
    ]);
    expect(r.longest?.id).toBe("c");
    expect(r.bestPace?.run.id).toBe("b");
    expect(runRecords([]).longest).toBeNull();
  });
});
