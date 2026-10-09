"use client";

import { useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { addFoodLocal, removeFoodLocal } from "@/lib/food-library";
import { fmtNum } from "@/lib/format";
import type { FoodItem } from "@/modules/diet/service";
import { FoodForm } from "./food-form";
import { Button, IconButton } from "./ui/button";
import { Card, EmptyState } from "./ui/card";
import { Sheet } from "./ui/sheet";

export function FoodManager({ initial }: { initial: FoodItem[] }) {
  const [foods, setFoods] = useState(initial);
  const [editing, setEditing] = useState<FoodItem | "new" | null>(null);
  const [confirm, setConfirm] = useState<FoodItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(f: FoodItem) {
    try {
      await call("DELETE", `/api/foods/${f.id}`);
      removeFoodLocal(f.id);
      setFoods((l) => l.filter((x) => x.id !== f.id));
      setConfirm(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted">Prodotti e ricette che hai creato tu</p>
        <Button size="sm" icon="plus" onClick={() => setEditing("new")}>
          Nuovo alimento
        </Button>
      </div>

      {foods.length === 0 ? (
        <EmptyState
          title="Nessun alimento personale"
          text="Crea un alimento con i valori riportati sull'etichetta: lo ritroverai nella ricerca quando registri un pasto."
          action={<Button icon="plus" onClick={() => setEditing("new")}>Crea alimento</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {foods.map((f) => (
            <Card key={f.id} className="flex items-center gap-2 p-4">
              <div className="min-w-0 flex-1">
                <div className="num truncate text-2xl font-semibold">{f.name}</div>
                {f.brand && <div className="text-sm text-muted">{f.brand}</div>}
                <div className="mt-0.5 text-sm text-muted">
                  {fmtNum(f.kcal, 0)} kcal, P {fmtNum(f.protein)} C {fmtNum(f.carbs)} G {fmtNum(f.fat)} per 100 {f.unit}
                </div>
              </div>
              <IconButton icon="edit" label={`Modifica ${f.name}`} onClick={() => setEditing(f)} />
              <IconButton icon="trash" label={`Elimina ${f.name}`} onClick={() => setConfirm(f)} />
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Sheet title={editing === "new" ? "Nuovo alimento" : "Modifica alimento"} onClose={() => setEditing(null)}>
          <FoodForm
            initial={editing === "new" ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSaved={(f) => {
              addFoodLocal(f);
              setFoods((l) => [f, ...l.filter((x) => x.id !== f.id)].sort((a, b) => a.name.localeCompare(b.name)));
              setEditing(null);
            }}
          />
        </Sheet>
      )}
      {confirm && (
        <Sheet
          title="Eliminare l'alimento?"
          onClose={() => setConfirm(null)}
          footer={
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirm(null)}>
                Annulla
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => remove(confirm)}>
                Elimina
              </Button>
            </div>
          }
        >
          <p className="text-muted">Il diario dei giorni passati non cambia: gli elementi già registrati restano com'erano.</p>
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        </Sheet>
      )}
    </div>
  );
}
