"use client";

import { call } from "./client-api";
import type { FoodItem } from "@/modules/diet/service";

/**
 * Elenco alimenti tenuto in memoria nel browser: si scarica una sola volta (in background all'apertura
 * della modalità Dieta) e la ricerca avviene sul telefono, senza richieste a ogni lettera.
 */
let cache: FoodItem[] | null = null;
let inflight: Promise<FoodItem[]> | null = null;

export function loadFoods(): Promise<FoodItem[]> {
  if (cache) return Promise.resolve(cache);
  inflight ??= call<{ foods: FoodItem[] }>("GET", "/api/foods")
    .then((r) => (cache = r.foods))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export const peekFoods = () => cache;
export function addFoodLocal(f: FoodItem) {
  if (cache) cache = [f, ...cache.filter((x) => x.id !== f.id)];
}
export function removeFoodLocal(id: string) {
  if (cache) cache = cache.filter((x) => x.id !== id);
}

export const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
