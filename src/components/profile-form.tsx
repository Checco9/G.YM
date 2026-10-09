"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { Button } from "./ui/button";
import { Field, FormError, Select, TextInput } from "./ui/field";
import { Icon } from "./ui/icons";

type P = {
  displayName: string;
  sex: "male" | "female" | null;
  heightCm: number | null;
  birthDate: string | null;
  timezone: string;
  weeklyTarget: number;
};

export function ProfileForm({ initial }: { initial: P }) {
  const router = useRouter();
  const [p, setP] = useState({ ...initial, heightCm: initial.heightCm?.toString() ?? "", birthDate: initial.birthDate ?? "", sex: initial.sex ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => {
    setP((x) => ({ ...x, [k]: v }));
    setSaved(false);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await call("PUT", "/api/profile", {
        displayName: p.displayName,
        sex: p.sex || null,
        heightCm: p.heightCm ? Number(p.heightCm) : null,
        birthDate: p.birthDate || null,
        timezone: p.timezone,
        weeklyTarget: Number(p.weeklyTarget),
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Nome">
        <TextInput value={p.displayName} onChange={(e) => set("displayName", e.target.value)} maxLength={40} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sesso" hint="Serve per i livelli di forza">
          <Select value={p.sex} onChange={(e) => set("sex", e.target.value as typeof p.sex)}>
            <option value="">Non indicato</option>
            <option value="male">Uomo</option>
            <option value="female">Donna</option>
          </Select>
        </Field>
        <Field label="Altezza (cm)">
          <TextInput inputMode="numeric" value={p.heightCm} onChange={(e) => set("heightCm", e.target.value.replace(/\D/g, ""))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data di nascita">
          <TextInput type="date" value={p.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
        </Field>
        <Field label="Allenamenti a settimana" hint="Il tuo obiettivo">
          <Select value={p.weeklyTarget} onChange={(e) => set("weeklyTarget", Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Fuso orario" hint="Decide in che giorno cade un allenamento">
        <TextInput value={p.timezone} onChange={(e) => set("timezone", e.target.value)} />
      </Field>
      <FormError message={error} />
      <Button type="submit" className="w-full" disabled={busy}>
        {saved ? (<><Icon name="check" size={18} /> Salvato</>) : "Salva profilo"}
      </Button>
    </form>
  );
}
