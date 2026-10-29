import { describe, expect, it } from "vitest";
import { canonicalBarcode, describeIssues, gtinChecksumValid, normalizeOffProduct } from "./domain";

const withCheck = (base: string) => {
  const d = base.split("").map(Number).reverse();
  const sum = d.reduce((a, x, i) => a + x * (i % 2 === 0 ? 3 : 1), 0);
  return base + ((10 - (sum % 10)) % 10);
};

describe("codice a barre", () => {
  it("accetta codici reali (EAN-13, EAN-8, UPC-A)", () => {
    for (const c of ["3017620422003", "5449000000996", "4006381333931", "96385074", "036000291452"]) expect(gtinChecksumValid(c)).toBe(true);
  });
  it("rifiuta controllo errato, lunghezze e caratteri non validi", () => {
    for (const c of ["3017620422004", "123", "", "30176204220031", "abcdefghijklm", "3017620 22003"]) expect(gtinChecksumValid(c)).toBe(false);
  });
  it("forma canonica: spazi e trattini ignorati, UPC-A a 13 cifre", () => {
    expect(canonicalBarcode("3017 6204-22003")).toBe("3017620422003");
    expect(canonicalBarcode("036000291452")).toBe("0036000291452");
    expect(canonicalBarcode("96385074")).toBe("96385074");
    expect(canonicalBarcode("3017620422004")).toBeNull();
    expect(canonicalBarcode("0036000291452")).toBe("0036000291452");
  });
  it("genera e valida codici di prova", () => expect(gtinChecksumValid(withCheck("800123456789"))).toBe(true));
});

const off = (product: Record<string, unknown>) => ({ code: "x", status: 1, product });

describe("normalizzazione Open Food Facts", () => {
  const nutella = off({
    product_name: "Nutella",
    brands: "Ferrero,Nutella",
    quantity: "400 g",
    serving_size: "15 g",
    serving_quantity: 15,
    nutriments: { "energy-kcal_100g": 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
  });
  it("prodotto completo", () => {
    const p = normalizeOffProduct("3017620422003", nutella)!;
    expect(p).toMatchObject({ name: "Nutella", brand: "Ferrero", unit: "g", kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9, servingSize: 15, servingLabel: "1 porzione", complete: true, issues: [] });
  });
  it("preferisce il nome italiano", () => {
    expect(normalizeOffProduct("1", off({ product_name: "Hazelnut spread", product_name_it: "Crema di nocciole", nutriments: { "energy-kcal_100g": 500, proteins_100g: 5, carbohydrates_100g: 50, fat_100g: 30 } }))!.name).toBe("Crema di nocciole");
  });
  it("numeri come stringhe, anche con la virgola", () => {
    const p = normalizeOffProduct("1", off({ product_name: "X", nutriments: { "energy-kcal_100g": "250", proteins_100g: "10,5", carbohydrates_100g: "30", fat_100g: "9" } }))!;
    expect(p).toMatchObject({ kcal: 250, protein: 10.5, carbs: 30, fat: 9, complete: true });
  });
  it("solo kJ: convertiti in kcal", () => {
    const p = normalizeOffProduct("1", off({ product_name: "X", nutriments: { energy_100g: 1000, proteins_100g: 10, carbohydrates_100g: 40, fat_100g: 8 } }))!;
    expect(p.kcal).toBeCloseTo(239, 0);
    expect(p.complete).toBe(true);
  });
  it("calorie mancanti ma macro presenti: stimate e segnalate, senza bloccare", () => {
    const p = normalizeOffProduct("1", off({ product_name: "X", nutriments: { proteins_100g: 10, carbohydrates_100g: 20, fat_100g: 5 } }))!;
    expect(p.kcal).toBe(165);
    expect(p.issues).toEqual(["kcal_estimated"]);
    expect(p.complete).toBe(true);
  });
  it("dati incompleti: servono i controlli dell'utente", () => {
    const p = normalizeOffProduct("1", off({ product_name: "X", nutriments: { "energy-kcal_100g": 120, proteins_100g: 4 } }))!;
    expect(p.issues).toEqual(expect.arrayContaining(["no_carbs", "no_fat"]));
    expect(p.complete).toBe(false);
    expect(describeIssues(p.issues)).toBe("i carboidrati e i grassi");
  });
  it("senza nome né valori", () => {
    const p = normalizeOffProduct("1", off({ nutriments: {} }))!;
    expect(p.complete).toBe(false);
    expect(p.issues).toEqual(expect.arrayContaining(["no_name", "no_kcal"]));
    expect(normalizeOffProduct("1", off({}))!.complete).toBe(false);
  });
  it("valori incoerenti (kcal che non tornano coi macro)", () => {
    const p = normalizeOffProduct("1", off({ product_name: "X", nutriments: { "energy-kcal_100g": 800, proteins_100g: 5, carbohydrates_100g: 10, fat_100g: 2 } }))!;
    expect(p.issues).toContain("inconsistent");
    expect(p.complete).toBe(false);
  });
  it("valori impossibili vengono scartati", () => {
    const p = normalizeOffProduct("1", off({ product_name: "X", nutriments: { "energy-kcal_100g": 5000, proteins_100g: 400, carbohydrates_100g: -3, fat_100g: "abc" } }))!;
    expect(p.kcal).toBeNull();
    expect(p.protein).toBeNull();
    expect(p.carbs).toBeNull();
    expect(p.fat).toBeNull();
    expect(p.complete).toBe(false);
  });
  it("macro oltre 100 g in totale", () => {
    expect(normalizeOffProduct("1", off({ product_name: "X", nutriments: { "energy-kcal_100g": 600, proteins_100g: 50, carbohydrates_100g: 50, fat_100g: 30 } }))!.issues).toContain("inconsistent");
  });
  it("bevande: valori per 100 ml; gli alcolici non danno incoerenza", () => {
    const cola = normalizeOffProduct("1", off({ product_name: "Cola", quantity: "330 ml", nutriments: { "energy-kcal_100g": 42, proteins_100g: 0, carbohydrates_100g: 10.6, fat_100g: 0 } }))!;
    expect(cola.unit).toBe("ml");
    const beer = normalizeOffProduct("2", off({ product_name: "Birra", quantity: "33 cl", nutriments: { "energy-kcal_100g": 43, proteins_100g: 0.4, carbohydrates_100g: 3.1, fat_100g: 0, alcohol_100g: 5 } }))!;
    expect(beer.unit).toBe("ml");
    expect(beer.issues).toEqual([]);
    expect(normalizeOffProduct("3", off({ product_name: "Acqua", categories_tags: ["en:beverages"], nutriments: { "energy-kcal_100g": 0, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 } }))!.unit).toBe("ml");
    expect(normalizeOffProduct("4", off({ product_name: "Latte in polvere", quantity: "400 g", categories_tags: ["en:beverages"], nutriments: { "energy-kcal_100g": 480, proteins_100g: 25, carbohydrates_100g: 40, fat_100g: 26 } }))!.unit).toBe("g");
  });
  it("porzione dal testo quando manca il valore numerico", () => {
    expect(normalizeOffProduct("1", off({ product_name: "X", serving_size: "30 g (2 biscotti)", nutriments: { "energy-kcal_100g": 400, proteins_100g: 8, carbohydrates_100g: 70, fat_100g: 9 } }))!.servingSize).toBe(30);
  });
  it("prodotto non trovato o risposta anomala", () => {
    expect(normalizeOffProduct("1", { status: 0, status_verbose: "product not found" })).toBeNull();
    for (const bad of [null, undefined, "x", 42, [], {}, { status: 1 }, { status: 1, product: "no" }]) expect(normalizeOffProduct("1", bad)).toBeNull();
  });
  it("tronca nomi molto lunghi", () => {
    expect(normalizeOffProduct("1", off({ product_name: "a".repeat(300), nutriments: {} }))!.name).toHaveLength(80);
  });
});
