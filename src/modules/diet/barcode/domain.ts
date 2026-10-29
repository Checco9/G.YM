/**
 * Codici a barre dei prodotti alimentari e normalizzazione dei dati di Open Food Facts.
 * Funzioni pure, senza rete né database: usate sia dal server sia dal browser.
 */

// ───────── Codice a barre ─────────

/** Verifica il codice di controllo GS1 (EAN-8, UPC-A, EAN-13, GTIN-14). */
export function gtinChecksumValid(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Forma canonica: solo cifre, controllo GS1 valido, UPC-A (12 cifre) portato a 13 con uno zero davanti
 * (come fa Open Food Facts). Restituisce null se il codice non è valido.
 */
export function canonicalBarcode(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  if (!gtinChecksumValid(digits)) return null;
  return digits.length === 12 ? `0${digits}` : digits;
}

// ───────── Prodotto scansionato ─────────

export type ProductIssue = "no_name" | "no_kcal" | "no_protein" | "no_carbs" | "no_fat" | "inconsistent" | "kcal_estimated";

export type ScannedProduct = {
  barcode: string;
  name: string | null;
  brand: string | null;
  unit: "g" | "ml";
  /** valori per 100 g / 100 ml; null = dato mancante */
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  servingSize: number | null;
  servingLabel: string | null;
  issues: ProductIssue[];
  /** true se si può usare così com'è, senza controllo dell'utente */
  complete: boolean;
};

/** Problemi che richiedono di far controllare i dati all'utente prima di usarli. */
const BLOCKING: ProductIssue[] = ["no_name", "no_kcal", "no_protein", "no_carbs", "no_fat", "inconsistent"];

export const ISSUE_LABEL: Record<ProductIssue, string> = {
  no_name: "il nome",
  no_kcal: "le calorie",
  no_protein: "le proteine",
  no_carbs: "i carboidrati",
  no_fat: "i grassi",
  inconsistent: "valori incoerenti",
  kcal_estimated: "calorie calcolate dai macronutrienti",
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Numeri di Open Food Facts: possono arrivare come numero o come stringa ("12.5", "12,5"). */
function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? parseFloat(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Trasforma la risposta di Open Food Facts (API v2) in un prodotto con valori per 100 g/ml.
 * Restituisce null se il prodotto non esiste. Non inventa dati: ciò che manca resta null e viene segnalato.
 */
export function normalizeOffProduct(barcode: string, json: unknown): ScannedProduct | null {
  if (!isRecord(json) || json.status !== 1 || !isRecord(json.product)) return null;
  const p = json.product;
  const n = isRecord(p.nutriments) ? p.nutriments : {};
  const issues: ProductIssue[] = [];

  const name = text(p.product_name_it, 80) ?? text(p.product_name, 80) ?? text(p.generic_name_it, 80) ?? text(p.generic_name, 80);
  if (!name) issues.push("no_name");
  const brand = text(typeof p.brands === "string" ? p.brands.split(",")[0] : null, 40);

  // liquidi: i valori sono per 100 ml
  const sizeText = `${typeof p.quantity === "string" ? p.quantity : ""} ${typeof p.serving_size === "string" ? p.serving_size : ""}`;
  const tags = Array.isArray(p.categories_tags) ? p.categories_tags : [];
  const unit: "g" | "ml" = /\b\d+([.,]\d+)?\s*(ml|cl|dl|l)\b/i.test(sizeText) || (!/\b\d+([.,]\d+)?\s*(g|kg)\b/i.test(sizeText) && tags.includes("en:beverages")) ? "ml" : "g";

  let implausible = false;
  const macro = (v: unknown) => {
    const x = num(v);
    if (x === null) return null;
    if (x > 100) {
      implausible = true;
      return null;
    }
    return round1(x);
  };
  const protein = macro(n.proteins_100g);
  const carbs = macro(n.carbohydrates_100g);
  const fat = macro(n.fat_100g);

  // calorie: il campo in kcal, altrimenti i kJ convertiti
  let kcal = num(n["energy-kcal_100g"]);
  if (kcal === null) {
    const kj = num(n.energy_100g);
    kcal = kj !== null ? kj / 4.184 : null;
  }
  if (kcal !== null && kcal > 900) {
    implausible = true;
    kcal = null;
  }
  kcal = kcal !== null ? round1(kcal) : null;

  if (kcal === null && protein !== null && carbs !== null && fat !== null) {
    kcal = Math.round(protein * 4 + carbs * 4 + fat * 9);
    issues.push("kcal_estimated");
  }
  if (kcal === null) issues.push("no_kcal");
  if (protein === null) issues.push("no_protein");
  if (carbs === null) issues.push("no_carbs");
  if (fat === null) issues.push("no_fat");

  // coerenza tra calorie e macronutrienti (gli alcolici hanno calorie in più: non si controllano)
  const alcohol = num(n.alcohol_100g) ?? 0;
  if (kcal !== null && protein !== null && carbs !== null && fat !== null && !issues.includes("kcal_estimated")) {
    const calc = protein * 4 + carbs * 4 + fat * 9;
    if (alcohol <= 0.5 && Math.abs(kcal - calc) > Math.max(30, calc * 0.3)) implausible = true;
  }
  if (protein !== null && carbs !== null && fat !== null && protein + carbs + fat > 101) implausible = true;
  if (implausible) issues.push("inconsistent");

  // porzione indicata sull'etichetta
  let servingSize = num(p.serving_quantity);
  if (servingSize === null) {
    const m = /(\d+(?:[.,]\d+)?)\s*(?:g|ml)\b/i.exec(typeof p.serving_size === "string" ? p.serving_size : "");
    servingSize = m ? num(m[1]) : null;
  }
  if (servingSize !== null && (servingSize < 1 || servingSize > 2000)) servingSize = null;

  return {
    barcode,
    name,
    brand,
    unit,
    kcal,
    protein,
    carbs,
    fat,
    servingSize,
    servingLabel: servingSize !== null ? "1 porzione" : null,
    issues,
    complete: !issues.some((i) => BLOCKING.includes(i)),
  };
}

/** Elenco leggibile dei problemi bloccanti, es. "le proteine e i grassi". */
export function describeIssues(issues: ProductIssue[]): string {
  const labels = issues.filter((i) => i !== "kcal_estimated" && i !== "inconsistent").map((i) => ISSUE_LABEL[i]);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}
