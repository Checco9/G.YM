import { and, eq, isNull } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { HttpError, badRequest, notFound, tooMany } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { foods } from "@/db/schema";
import type { SessionUser } from "@/modules/auth/session";
import type { FoodItem } from "../service";
import { canonicalBarcode, normalizeOffProduct, type ScannedProduct } from "./domain";

export type LookupResult = { source: "own"; food: FoodItem } | { source: "openfoodfacts"; product: ScannedProduct };

const OFF_FIELDS = "code,product_name,product_name_it,generic_name,generic_name_it,brands,quantity,serving_size,serving_quantity,categories_tags,nutriments";

/**
 * Richiesta a Open Food Facts (API v2, lettura senza chiave). Rispetta le regole del servizio: User-Agent
 * descrittivo con contatto e pochissime richieste. Il limite globale è prudente (12 al minuto per tutta l'app)
 * perché tutte le richieste partono dallo stesso indirizzo IP del server.
 */
async function fetchFromOff(code: string): Promise<ScannedProduct> {
  await rateLimit("off-global", 12, 60).catch(() => {
    throw tooMany("Troppe richieste al servizio dei prodotti: riprova tra un minuto");
  });
  const e = env();
  const base = (e.OFF_BASE_URL ?? "https://world.openfoodfacts.org").replace(/\/$/, "");
  const ua = `G.YM/1.0 (${e.OFF_CONTACT || "self-hosted"})`;

  let res: Response;
  try {
    res = await fetch(`${base}/api/v2/product/${code}.json?fields=${OFF_FIELDS}`, {
      headers: { "User-Agent": ua, Accept: "application/json" },
      signal: AbortSignal.timeout(Number(e.OFF_TIMEOUT_MS) || 6000),
      cache: "no-store",
    });
  } catch (err) {
    const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new HttpError(timeout ? 504 : 502, timeout ? "Il servizio dei prodotti non risponde. Riprova." : "Servizio dei prodotti non raggiungibile. Riprova.");
  }
  if (res.status === 404) throw notFound("Prodotto non trovato");
  if (res.status === 429) throw tooMany("Troppe richieste al servizio dei prodotti: riprova tra un minuto");
  if (!res.ok) throw new HttpError(502, "Il servizio dei prodotti non è disponibile al momento");

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new HttpError(502, "Risposta del servizio dei prodotti non valida");
  }
  const product = normalizeOffProduct(code, json);
  if (!product) throw notFound("Prodotto non trovato");
  return product;
}

/**
 * Cerca un prodotto per codice a barre: prima tra gli alimenti già salvati dall'utente (istantaneo, nessuna rete),
 * poi su Open Food Facts. I prodotti trovati restano in cache un giorno; i "non trovato" e gli errori non vengono
 * messi in cache, così un prodotto aggiunto in seguito al database si trova subito.
 */
export async function lookupBarcode(user: SessionUser, raw: string): Promise<LookupResult> {
  const code = canonicalBarcode(raw);
  if (!code) throw badRequest("Codice a barre non valido");
  await rateLimit(`barcode:${user.id}`, 20, 60);

  const [own] = await db()
    .select({
      id: foods.id,
      name: foods.name,
      brand: foods.brand,
      category: foods.category,
      unit: foods.unit,
      kcal: foods.kcal,
      protein: foods.protein,
      carbs: foods.carbs,
      fat: foods.fat,
      servingSize: foods.servingSize,
      servingLabel: foods.servingLabel,
      barcode: foods.barcode,
    })
    .from(foods)
    .where(and(eq(foods.ownerId, user.id), eq(foods.barcode, code), isNull(foods.archivedAt)))
    .limit(1);
  if (own) return { source: "own", food: { ...own, isCustom: true } };

  const product = await unstable_cache(() => fetchFromOff(code), ["off-product-v1", code], { revalidate: 86400 })();
  return { source: "openfoodfacts", product };
}
