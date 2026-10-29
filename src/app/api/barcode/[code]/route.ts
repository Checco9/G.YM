import { api } from "@/lib/http";
import { lookupBarcode } from "@/modules/diet/barcode/service";

/** Ricerca di un prodotto per codice a barre (alimenti dell'utente, poi Open Food Facts). */
export const GET = api<{ code: string }>(async ({ user, params }) => lookupBarcode(user, decodeURIComponent(params.code)));
