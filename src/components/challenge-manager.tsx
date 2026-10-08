"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { fmtDate, fmtNum } from "@/lib/format";
import { CHALLENGE_KIND_LABEL, CHALLENGE_TEMPLATES, type ChallengeKind } from "@/modules/gamification/domain/challenges";
import type { ChallengeView } from "@/modules/gamification/service";
import { Button, IconButton } from "./ui/button";
import { Card } from "./ui/card";
import { Field, FormError, Select, TextInput } from "./ui/field";
import { Icon } from "./ui/icons";
import { ProgressBar } from "./ui/progress";
import { Sheet } from "./ui/sheet";

export function ChallengeManager({ items, tz }: { items: ChallengeView[]; tz: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(id: string) {
    setBusyId(id);
    try {
      await call("DELETE", `/api/challenges/${id}`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted">{items.length ? "Sfide a tempo, con XP in premio" : "Una sfida è un traguardo a tempo: completala entro la scadenza e guadagni XP."}</p>
        <Button size="sm" icon="plus" onClick={() => setOpen(true)}>
          Nuova sfida
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((c) => {
          const meta = CHALLENGE_KIND_LABEL[c.kind];
          const { status, percent, current, daysLeft } = c.progress;
          return (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="num text-[24px] font-semibold leading-tight">{c.title}</h3>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                    {status === "completed" && (<><Icon name="check" size={15} /> <span className="font-semibold text-fg">Completata, +150 XP</span></>)}
                    {status === "failed" && "Scaduta"}
                    {status === "active" && (daysLeft === 0 ? "Ultimo giorno" : `${daysLeft} ${daysLeft === 1 ? "giorno" : "giorni"} rimasti`)}
                  </p>
                </div>
                <IconButton icon="trash" label="Elimina sfida" onClick={() => remove(c.id)} disabled={busyId === c.id} className="-mr-2 -mt-1" />
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="num text-4xl font-semibold">{percent}%</span>
                <span className="text-sm text-muted">
                  {fmtNum(current, 0)} di {fmtNum(c.targetValue, 0)} {meta.unit}
                </span>
              </div>
              <ProgressBar percent={percent} className={`mt-2 ${status === "failed" ? "opacity-40" : ""}`} />
              <p className="mt-2 text-sm text-muted">
                Dal {fmtDate(c.startsOn + "T12:00:00Z", "UTC")} al {fmtDate(c.endsOn + "T12:00:00Z", "UTC")}
              </p>
            </Card>
          );
        })}
      </div>
      {open && <NewChallenge onClose={() => setOpen(false)} onDone={() => { setOpen(false); router.refresh(); }} tz={tz} />}
    </div>
  );
}

function NewChallenge({ onClose, onDone }: { onClose: () => void; onDone: () => void; tz: string }) {
  const [kind, setKind] = useState<ChallengeKind>("workouts");
  const [target, setTarget] = useState("");
  const [days, setDays] = useState("14");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(body: { kind: ChallengeKind; targetValue: number; days: number }) {
    setBusy(true);
    setError(null);
    try {
      await call("POST", "/api/challenges", body);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
      setBusy(false);
    }
  }

  return (
    <Sheet
      title="Nuova sfida"
      onClose={onClose}
      footer={
        <Button
          className="w-full"
          disabled={busy}
          onClick={() => {
            const t = parseInt(target.replace(/\D/g, ""), 10);
            if (!t) return setError("Inserisci un obiettivo valido");
            void create({ kind, targetValue: t, days: parseInt(days, 10) });
          }}
        >
          Avvia sfida
        </Button>
      }
    >
      <p className="mb-2 text-sm font-medium text-muted">Parti da un'idea</p>
      <div className="mb-5 flex flex-col gap-2">
        {CHALLENGE_TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            disabled={busy}
            onClick={() => create({ kind: t.kind, targetValue: t.target, days: t.days })}
            className="min-h-12 rounded-2xl bg-surface2 px-4 py-2 text-left text-[15px] font-semibold"
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mb-2 text-sm font-medium text-muted">Oppure creane una tua</p>
      <div className="space-y-3">
        <Field label="Cosa conta">
          <Select value={kind} onChange={(e) => setKind(e.target.value as ChallengeKind)}>
            {(Object.keys(CHALLENGE_KIND_LABEL) as ChallengeKind[]).map((k) => (
              <option key={k} value={k}>
                {CHALLENGE_KIND_LABEL[k].label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Obiettivo (${CHALLENGE_KIND_LABEL[kind].unit})`}>
            <TextInput inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="12" />
          </Field>
          <Field label="Durata">
            <Select value={days} onChange={(e) => setDays(e.target.value)}>
              {[7, 14, 30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d} giorni
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <FormError message={error} />
      </div>
    </Sheet>
  );
}
