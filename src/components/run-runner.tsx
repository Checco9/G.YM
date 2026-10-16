"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { fmtNum } from "@/lib/format";
import { fmtClock, fmtPace, paceSecPerKm, parseDuration } from "@/modules/runs/domain/run";
import type { RunView } from "@/modules/runs/service";
import { EffortPicker } from "./manual-run-sheet";
import { Button } from "./ui/button";
import { Field, FormError, TextInput } from "./ui/field";
import { Icon } from "./ui/icons";
import { Sheet } from "./ui/sheet";

type Draft = { kind: "outdoor" | "treadmill"; baseS: number; sinceMs: number | null; distanceKm: string };
const draftKey = (id: string) => `ghisa:rundraft:${id}`;
const num = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const toKm = (m: number) => (m > 0 ? String(m / 1000).replace(".", ",") : "");

export function RunRunner({ run }: { run: RunView }) {
  const router = useRouter();
  const [kind, setKind] = useState(run.kind);
  const [baseS, setBaseS] = useState(run.elapsedS);
  const [sinceMs, setSinceMs] = useState<number | null>(run.timerStartedAt ? Date.parse(run.timerStartedAt) : null);
  const [distanceKm, setDistanceKm] = useState(toKm(run.distanceM));
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const [finishing, setFinishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeText, setTimeText] = useState("");
  const [distText, setDistText] = useState("");
  const [effort, setEffort] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const elapsed = baseS + (sinceMs ? Math.max(0, (now - sinceMs) / 1000) : 0);
  const distM = Math.round(num(distanceKm) * 1000);

  // ───────── Salvataggio continuo ─────────
  const stateRef = useRef({ kind, baseS, sinceMs, distanceKm });
  stateRef.current = { kind, baseS, sinceMs, distanceKm };
  const dirty = useRef(false);
  const inflight = useRef(false);
  const finished = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const payload = () => {
    const s = stateRef.current;
    const el = s.baseS + (s.sinceMs ? Math.max(0, (Date.now() - s.sinceMs) / 1000) : 0);
    return { kind: s.kind, elapsedS: Math.floor(el), running: s.sinceMs !== null, distanceM: Math.round(num(s.distanceKm) * 1000), notes: null };
  };

  const flush = useCallback(
    async (keepalive = false) => {
      if (finished.current || !dirty.current || inflight.current) return;
      inflight.current = true;
      dirty.current = false;
      setStatus("saving");
      try {
        await call("PUT", `/api/runs/${run.id}`, payload(), { keepalive });
        if (!dirty.current) {
          setStatus("saved");
          try {
            localStorage.removeItem(draftKey(run.id));
          } catch {}
        }
      } catch (e) {
        dirty.current = true;
        setStatus("error");
        timer.current = setTimeout(() => void flush(), e instanceof ApiError && e.status === 0 ? 4000 : 12000);
      } finally {
        inflight.current = false;
        if (dirty.current && !finished.current && status !== "error") {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => void flush(), 400);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run.id],
  );

  /** Ogni modifica (avvia, pausa, distanza, tipo): bozza locale subito, invio al server poco dopo. */
  const touch = useCallback(() => {
    dirty.current = true;
    try {
      const s = stateRef.current;
      localStorage.setItem(draftKey(run.id), JSON.stringify({ kind: s.kind, baseS: s.baseS, sinceMs: s.sinceMs, distanceKm: s.distanceKm } satisfies Draft));
    } catch {}
    setStatus((st) => (st === "error" ? st : "saving"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 500);
  }, [run.id, flush]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    touch();
  }, [kind, baseS, sinceMs, distanceKm, touch]);

  // Recupero di una bozza non inviata (pagina chiusa o connessione persa)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(run.id));
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        setKind(d.kind);
        setBaseS(d.baseS);
        setSinceMs(d.sinceMs);
        setDistanceKm(d.distanceKm);
      }
    } catch {}
    const onHide = () => document.visibilityState === "hidden" && void flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [run.id, flush]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // ───────── Comandi ─────────
  const running = sinceMs !== null;
  const toggle = () => {
    const t = Date.now();
    if (running) {
      setBaseS(baseS + Math.max(0, (t - sinceMs!) / 1000));
      setSinceMs(null);
    } else {
      setSinceMs(t);
    }
    setNow(t);
  };
  const bump = (kmDelta: number) => setDistanceKm(toKm(Math.max(0, Math.round((num(distanceKm) + kmDelta) * 1000)))) ;

  const openFinish = () => {
    const t = Date.now();
    if (running) {
      setBaseS(baseS + Math.max(0, (t - sinceMs!) / 1000));
      setSinceMs(null);
    }
    setTimeText(fmtClock(elapsed));
    setDistText(distanceKm);
    setError(null);
    setFinishing(true);
  };

  async function finish() {
    const durationS = parseDuration(timeText);
    const km = num(distText);
    if (!durationS) return setError("Durata non valida: scrivi per esempio 28:30 oppure 1:05:00");
    if (km <= 0) return setError("Inserisci la distanza percorsa");
    setBusy(true);
    setError(null);
    try {
      if (timer.current) clearTimeout(timer.current);
      await call("POST", `/api/runs/${run.id}/finish`, { kind, elapsedS: durationS, distanceM: Math.round(km * 1000), effort, notes: notes || null });
      finished.current = true;
      try {
        localStorage.removeItem(draftKey(run.id));
      } catch {}
      router.replace(`/gym/run/${run.id}/summary`);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Si è verificato un errore. Riprova.");
      setBusy(false);
    }
  }

  async function discard() {
    setBusy(true);
    try {
      await call("DELETE", `/api/runs/${run.id}`);
      finished.current = true;
      try {
        localStorage.removeItem(draftKey(run.id));
      } catch {}
      router.replace("/gym/runs");
      router.refresh();
    } catch {
      setError("Impossibile scartare la corsa.");
      setBusy(false);
    }
  }

  const pace = paceSecPerKm(distM, elapsed);
  const speed = distM >= 100 && elapsed > 0 ? (distM / 1000) / (elapsed / 3600) : null;

  return (
    <div className="mx-auto w-full max-w-xl pb-10">
      <header className="sticky top-0 z-30 -mx-4 flex items-center gap-1 border-b border-line bg-bg/95 px-4 pb-3 backdrop-blur md:mx-0" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <Link href="/gym/runs" aria-label="Torna alla sezione Corsa" className="-ml-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-surface2">
          <Icon name="left" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted">Corsa</div>
          <div className="font-semibold">{kind === "treadmill" ? "Tapis roulant" : "All'aperto"}</div>
        </div>
        <span className="mr-2 flex items-center gap-1.5 text-xs text-muted" role="status" aria-label={status === "saved" ? "Salvato" : status === "saving" ? "Salvataggio" : "Salvataggio non riuscito"}>
          <span className={`size-2.5 rounded-full ${status === "saved" ? "bg-fg" : status === "saving" ? "bg-muted" : "bg-danger"}`} />
          <span className="hidden sm:inline">{status === "saved" ? "Salvato" : status === "saving" ? "Salvataggio" : "Non salvato"}</span>
        </span>
        <Button size="sm" onClick={openFinish} disabled={elapsed < 1 && distM === 0}>
          Termina
        </Button>
      </header>

      <section className="mt-8 text-center" aria-label="Cronometro">
        <div className="num text-[96px] font-bold leading-none tracking-tight" aria-live="off">
          {fmtClock(elapsed)}
        </div>
        <div className="mt-2 text-muted">{running ? "In corsa" : elapsed > 0 ? "In pausa" : "Pronto a partire"}</div>
        <button
          type="button"
          onClick={toggle}
          aria-label={running ? "Metti in pausa" : elapsed > 0 ? "Riprendi" : "Avvia"}
          className={`mx-auto mt-6 flex size-28 items-center justify-center rounded-full transition-transform active:scale-95 ${running ? "bg-surface2 text-fg" : "bg-fg text-onfg"}`}
        >
          {running ? <Icon name="minus" size={44} strokeWidth={3} /> : <Icon name="play" size={44} />}
        </button>
      </section>

      <section className="mt-10 rounded-[22px] bg-surface p-5" aria-label="Distanza">
        <div className="flex items-center justify-between">
          <h2 className="num text-2xl font-semibold">Distanza</h2>
          <button type="button" onClick={() => setKind(kind === "outdoor" ? "treadmill" : "outdoor")} className="h-9 rounded-full bg-surface2 px-3 text-sm font-semibold">
            {kind === "outdoor" ? "All'aperto" : "Tapis roulant"}
          </button>
        </div>
        <div className="mt-3 flex items-baseline justify-center gap-2">
          <input
            inputMode="decimal"
            value={distanceKm}
            placeholder="0"
            onChange={(e) => /^\d{0,3}([.,]\d{0,3})?$/.test(e.target.value) && setDistanceKm(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Distanza in chilometri"
            className="num w-44 rounded-xl bg-bg py-2 text-center text-[56px] font-bold leading-none outline-none ring-1 ring-transparent placeholder:text-muted/40 focus:ring-fg"
          />
          <span className="num text-3xl text-muted">km</span>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {([[-0.1, "−0,1"], [0.1, "+0,1"], [0.5, "+0,5"], [1, "+1"]] as const).map(([d, label]) => (
            <button key={label} type="button" onClick={() => bump(d)} className="num h-12 rounded-xl bg-surface2 text-xl font-semibold active:bg-line">
              {label}
            </button>
          ))}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-2xl bg-surface2 p-3">
            <dd className="num text-3xl font-semibold leading-none">{fmtPace(pace)}</dd>
            <dt className="mt-1 text-xs text-muted">Passo al km</dt>
          </div>
          <div className="rounded-2xl bg-surface2 p-3">
            <dd className="num text-3xl font-semibold leading-none">{speed ? fmtNum(speed, 1) : "—"}</dd>
            <dt className="mt-1 text-xs text-muted">Velocità km/h</dt>
          </div>
        </dl>
        <p className="mt-3 text-center text-sm text-muted">Aggiorna la distanza dal display del tapis roulant o a fine corsa.</p>
      </section>

      {status === "error" && (
        <p role="status" className="mt-4 rounded-xl bg-danger/12 px-4 py-3 text-sm text-danger">
          Salvataggio non riuscito. I dati sono al sicuro su questo dispositivo e verranno inviati appena possibile.
        </p>
      )}

      {finishing && (
        <Sheet
          title="Termina la corsa"
          onClose={() => setFinishing(false)}
          footer={
            <div className="space-y-2">
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setFinishing(false)}>
                  Continua
                </Button>
                <Button className="flex-1" onClick={finish} disabled={busy}>
                  {busy ? "Salvataggio…" : "Salva corsa"}
                </Button>
              </div>
              <Button variant="ghost" className="w-full text-danger" onClick={() => { setFinishing(false); setDiscarding(true); }}>
                Scarta la corsa
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Durata">
                <TextInput value={timeText} onChange={(e) => setTimeText(e.target.value)} aria-label="Durata" />
              </Field>
              <Field label="Distanza (km)">
                <TextInput inputMode="decimal" value={distText} onChange={(e) => setDistText(e.target.value)} aria-label="Distanza in chilometri" />
              </Field>
            </div>
            <EffortPicker value={effort} onChange={setEffort} />
            <Field label="Note (facoltative)">
              <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
            </Field>
            <FormError message={error} />
          </div>
        </Sheet>
      )}

      {discarding && (
        <Sheet
          title="Scartare la corsa?"
          onClose={() => setDiscarding(false)}
          footer={
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setDiscarding(false)}>
                Annulla
              </Button>
              <Button variant="danger" className="flex-1" onClick={discard} disabled={busy}>
                Scarta
              </Button>
            </div>
          }
        >
          <p className="text-muted">Tempo e distanza registrati andranno persi.</p>
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        </Sheet>
      )}
    </div>
  );
}
