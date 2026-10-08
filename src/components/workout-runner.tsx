"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { fmtNum } from "@/lib/format";
import { Button, IconButton } from "./ui/button";
import { ExercisePicker, type PickerExercise } from "./exercise-picker";
import { Icon } from "./ui/icons";
import { Sheet } from "./ui/sheet";

type S = { id: string; weight: string; reps: string; completed: boolean };
type E = { id: string; exerciseId: string; name: string; sets: S[] };
type State = { name: string; exercises: E[] };
type Prev = { weightKg: number; reps: number }[];

export type RunnerWorkout = {
  id: string;
  name: string;
  startedAt: string;
  exercises: { id: string; exerciseId: string; name: string; sets: { id: string; weightKg: number; reps: number; completed: boolean }[] }[];
};

const uid = () => crypto.randomUUID();
const toStr = (n: number) => (n > 0 ? String(n).replace(".", ",") : "");
const parseNum = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const draftKey = (id: string) => `ghisa:draft:${id}`;

function fromServer(w: RunnerWorkout): State {
  return {
    name: w.name,
    exercises: w.exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      name: e.name,
      sets: e.sets.map((s) => ({ id: s.id, weight: toStr(s.weightKg), reps: toStr(s.reps), completed: s.completed })),
    })),
  };
}

function payload(s: State) {
  return {
    name: s.name,
    exercises: s.exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      sets: e.sets.map((x) => ({
        id: x.id,
        weightKg: Math.round(parseNum(x.weight) * 100) / 100,
        reps: Math.max(0, Math.round(parseNum(x.reps))),
        completed: x.completed,
      })),
    })),
  };
}

function formatElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
}

export function WorkoutRunner({
  workout,
  prev: initialPrev,
  exercises,
}: {
  workout: RunnerWorkout;
  prev: Record<string, Prev>;
  exercises: PickerExercise[];
}) {
  const router = useRouter();
  const [state, setState] = useState<State>(() => fromServer(workout));
  const [prev, setPrev] = useState(initialPrev);
  const [library, setLibrary] = useState(exercises);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const [focus, setFocus] = useState<{ eid: string; sid: string; field: "weight" | "reps" } | null>(null);
  const [picker, setPicker] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [removeFor, setRemoveFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // ───────── Autosave ─────────
  const stateRef = useRef(state);
  stateRef.current = state;
  const dirty = useRef(false);
  const inflight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finished = useRef(false);

  const schedule = useCallback((ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), ms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = useCallback(
    async (keepalive = false) => {
      if (finished.current || !dirty.current) return;
      if (inflight.current) return;
      inflight.current = true;
      dirty.current = false;
      setStatus("saving");
      try {
        await call("PUT", `/api/workouts/${workout.id}`, payload(stateRef.current), { keepalive });
        if (!dirty.current) {
          setStatus("saved");
          try {
            localStorage.removeItem(draftKey(workout.id));
          } catch {}
        }
      } catch (e) {
        dirty.current = true;
        setStatus("error");
        const offline = e instanceof ApiError && e.status === 0;
        schedule(offline ? 4000 : 12000);
      } finally {
        inflight.current = false;
        if (dirty.current && !finished.current) schedule(300);
      }
    },
    [workout.id, schedule],
  );

  /** Ogni modifica: aggiorna lo stato, salva una bozza locale e programma l'invio al server. */
  const update = useCallback(
    (fn: (s: State) => State) => {
      setState((s) => {
        const next = fn(s);
        stateRef.current = next;
        return next;
      });
      dirty.current = true;
      try {
        localStorage.setItem(draftKey(workout.id), JSON.stringify(stateRef.current));
      } catch {}
      setStatus((st) => (st === "error" ? st : "saving"));
      schedule(600);
    },
    [workout.id, schedule],
  );

  // Recupero di una bozza non inviata (pagina chiusa o connessione persa)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(workout.id));
      if (raw) {
        const draft = JSON.parse(raw) as State;
        if (draft && Array.isArray(draft.exercises)) {
          setState(draft);
          stateRef.current = draft;
          dirty.current = true;
          setStatus("saving");
          schedule(200);
        }
      }
    } catch {}
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush(true);
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide as () => void);
    const online = () => dirty.current && schedule(200);
    window.addEventListener("online", online);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide as () => void);
      window.removeEventListener("online", online);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [workout.id, flush, schedule]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ───────── Operazioni sulle serie ─────────
  const setField = (eid: string, sid: string, field: "weight" | "reps", value: string) => {
    const ok = field === "weight" ? /^\d{0,4}([.,]\d{0,2})?$/.test(value) : /^\d{0,4}$/.test(value);
    if (!ok) return;
    update((s) => ({
      ...s,
      exercises: s.exercises.map((e) =>
        e.id !== eid ? e : { ...e, sets: e.sets.map((x) => (x.id === sid ? { ...x, [field]: value } : x)) },
      ),
    }));
  };

  const adjust = (eid: string, sid: string, field: "weight" | "reps", delta: number) => {
    update((s) => ({
      ...s,
      exercises: s.exercises.map((e) =>
        e.id !== eid
          ? e
          : {
              ...e,
              sets: e.sets.map((x) => {
                if (x.id !== sid) return x;
                const cur = parseNum(x[field]);
                const nv = Math.max(0, Math.round((cur + delta) * 100) / 100);
                return { ...x, [field]: toStr(nv) };
              }),
            },
      ),
    }));
  };

  const toggle = (e: E, idx: number) => {
    const set = e.sets[idx];
    if (!set.completed) {
      let reps = parseNum(set.reps);
      let weight = parseNum(set.weight);
      const p = prev[e.exerciseId]?.[idx] ?? prev[e.exerciseId]?.[prev[e.exerciseId].length - 1];
      const lastSet = e.sets[idx - 1];
      if (reps <= 0) {
        reps = p?.reps ?? (lastSet ? parseNum(lastSet.reps) : 0);
        if (reps <= 0) {
          document.getElementById(`reps-${set.id}`)?.focus();
          return;
        }
      }
      if (weight <= 0 && p && p.weightKg > 0) weight = p.weightKg;
      if (weight <= 0 && lastSet && parseNum(lastSet.weight) > 0) weight = parseNum(lastSet.weight);
      update((s) => ({
        ...s,
        exercises: s.exercises.map((x) =>
          x.id !== e.id
            ? x
            : { ...x, sets: x.sets.map((y) => (y.id === set.id ? { ...y, reps: toStr(reps), weight: toStr(weight), completed: true } : y)) },
        ),
      }));
      setFocus(null);
    } else {
      update((s) => ({
        ...s,
        exercises: s.exercises.map((x) =>
          x.id !== e.id ? x : { ...x, sets: x.sets.map((y) => (y.id === set.id ? { ...y, completed: false } : y)) },
        ),
      }));
    }
  };

  const addSet = (eid: string) =>
    update((s) => ({
      ...s,
      exercises: s.exercises.map((e) => {
        if (e.id !== eid) return e;
        const last = e.sets[e.sets.length - 1];
        return { ...e, sets: [...e.sets, { id: uid(), weight: last?.weight ?? "", reps: last?.reps ?? "", completed: false }] };
      }),
    }));

  const removeSet = (eid: string, sid: string) => {
    setFocus(null);
    update((s) => ({
      ...s,
      exercises: s.exercises.map((e) => (e.id !== eid ? e : { ...e, sets: e.sets.filter((x) => x.id !== sid) })),
    }));
  };

  const moveExercise = (eid: string, d: -1 | 1) =>
    update((s) => {
      const i = s.exercises.findIndex((e) => e.id === eid);
      const j = i + d;
      if (i < 0 || j < 0 || j >= s.exercises.length) return s;
      const c = [...s.exercises];
      [c[i], c[j]] = [c[j], c[i]];
      return { ...s, exercises: c };
    });

  const removeExercise = (eid: string) =>
    update((s) => ({ ...s, exercises: s.exercises.filter((e) => e.id !== eid) }));

  async function addExercise(ex: PickerExercise) {
    setPicker(false);
    let last: Prev = prev[ex.id] ?? [];
    if (!prev[ex.id]) {
      try {
        const r = await call<{ sets: Prev }>("GET", `/api/exercises/${ex.id}/last`);
        last = r.sets;
        setPrev((p) => ({ ...p, [ex.id]: last }));
      } catch {}
    }
    const sets: S[] = last.length
      ? last.map((x) => ({ id: uid(), weight: toStr(x.weightKg), reps: toStr(x.reps), completed: false }))
      : Array.from({ length: 3 }, () => ({ id: uid(), weight: "", reps: "", completed: false }));
    update((s) => ({ ...s, exercises: [...s.exercises, { id: uid(), exerciseId: ex.id, name: ex.name, sets }] }));
  }

  // ───────── Fine allenamento ─────────
  const totals = useMemo(() => {
    let done = 0;
    let all = 0;
    for (const e of state.exercises) for (const s of e.sets) { all++; if (s.completed) done++; }
    return { done, all };
  }, [state]);

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      if (timer.current) clearTimeout(timer.current);
      await call("POST", `/api/workouts/${workout.id}/finish`, { ...payload(stateRef.current), discardIncomplete: true });
      finished.current = true;
      try {
        localStorage.removeItem(draftKey(workout.id));
      } catch {}
      router.replace(`/gym/workout/${workout.id}/summary`);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
      setBusy(false);
    }
  }

  async function discard() {
    setBusy(true);
    setError(null);
    try {
      await call("DELETE", `/api/workouts/${workout.id}`);
      finished.current = true;
      try {
        localStorage.removeItem(draftKey(workout.id));
      } catch {}
      router.replace("/gym");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Errore");
      setBusy(false);
    }
  }

  const elapsed = formatElapsed(now - new Date(workout.startedAt).getTime());
  const menuEx = state.exercises.find((e) => e.id === menuFor);
  const removeEx = state.exercises.find((e) => e.id === removeFor);

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Barra superiore fissa */}
      <header
        className="sticky top-0 z-30 -mx-4 border-b border-line bg-bg/95 px-4 pb-3 backdrop-blur md:mx-0 md:rounded-b-3xl md:px-5"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-1">
          <Link href="/gym" aria-label="Torna alla sezione Gym" className="-ml-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-surface2">
            <Icon name="left" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-muted">{state.name}</div>
            <div className="flex items-baseline gap-3">
              <span className="num text-[34px] font-semibold leading-none" aria-label="Tempo trascorso">{elapsed}</span>
              <span className="text-sm text-muted">
                {totals.done}/{totals.all} serie
              </span>
            </div>
          </div>
          <SaveDot status={status} />
          <Button size="sm" onClick={() => setFinishing(true)}>
            Termina
          </Button>
        </div>
      </header>

      <div className="mt-4 space-y-4 pb-40">
        {state.exercises.length === 0 && (
          <div className="rounded-[22px] border border-dashed border-line p-8 text-center">
            <div className="num text-2xl font-semibold">Allenamento vuoto</div>
            <p className="mt-1 text-muted">Aggiungi il primo esercizio per cominciare.</p>
          </div>
        )}

        {state.exercises.map((e) => {
          const p = prev[e.exerciseId];
          const doneCount = e.sets.filter((s) => s.completed).length;
          return (
            <section key={e.id} className="rounded-[22px] bg-surface p-4" aria-label={e.name}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="num text-[26px] font-semibold leading-tight">{e.name}</h2>
                  {p && p.length > 0 ? (
                    <p className="truncate text-sm text-muted">
                      Ultima volta: {p.map((x) => `${fmtNum(x.weightKg, 2)}×${x.reps}`).join(", ")}
                    </p>
                  ) : (
                    <p className="text-sm text-muted">Prima volta con questo esercizio</p>
                  )}
                </div>
                <span className="num pt-1 text-lg text-muted">
                  {doneCount}/{e.sets.length}
                </span>
                <IconButton icon="more" label={`Opzioni per ${e.name}`} className="-mr-2 -mt-1" onClick={() => setMenuFor(e.id)} />
              </div>

              <div className="mt-3 grid grid-cols-[2rem_1fr_1fr_3.5rem] items-center gap-x-2 px-1 text-sm text-muted">
                <span>Serie</span>
                <span className="pl-2">Kg</span>
                <span className="pl-2">Rip.</span>
                <span />
              </div>

              <div className="mt-1 space-y-2">
                {e.sets.map((s, idx) => {
                  const isFocus = focus?.sid === s.id;
                  return (
                    <div key={s.id}>
                      <div
                        className={`grid grid-cols-[2rem_1fr_1fr_3.5rem] items-center gap-x-2 rounded-2xl px-1 py-1 ${
                          s.completed ? "bg-surface2" : ""
                        }`}
                      >
                        <span className="num text-center text-xl text-muted">{idx + 1}</span>
                        <input
                          id={`weight-${s.id}`}
                          inputMode="decimal"
                          aria-label={`Peso serie ${idx + 1}`}
                          placeholder={p?.[idx] ? toStr(p[idx].weightKg) || "0" : "0"}
                          value={s.weight}
                          onFocus={(ev) => {
                            ev.currentTarget.select();
                            setFocus({ eid: e.id, sid: s.id, field: "weight" });
                          }}
                          onChange={(ev) => setField(e.id, s.id, "weight", ev.target.value)}
                          className="num h-14 w-full rounded-xl bg-bg px-3 text-center text-[28px] font-semibold outline-none ring-1 ring-transparent placeholder:text-muted/40 focus:ring-fg"
                        />
                        <input
                          id={`reps-${s.id}`}
                          inputMode="numeric"
                          aria-label={`Ripetizioni serie ${idx + 1}`}
                          placeholder={p?.[idx] ? String(p[idx].reps) : "0"}
                          value={s.reps}
                          onFocus={(ev) => {
                            ev.currentTarget.select();
                            setFocus({ eid: e.id, sid: s.id, field: "reps" });
                          }}
                          onChange={(ev) => setField(e.id, s.id, "reps", ev.target.value)}
                          className="num h-14 w-full rounded-xl bg-bg px-3 text-center text-[28px] font-semibold outline-none ring-1 ring-transparent placeholder:text-muted/40 focus:ring-fg"
                        />
                        <button
                          type="button"
                          aria-label={s.completed ? `Serie ${idx + 1} completata, tocca per annullare` : `Completa serie ${idx + 1}`}
                          aria-pressed={s.completed}
                          onClick={() => toggle(e, idx)}
                          className={`flex h-14 w-full items-center justify-center rounded-xl transition-colors ${
                            s.completed ? "pop bg-fg text-onfg" : "bg-surface2 text-muted"
                          }`}
                        >
                          <Icon name="check" size={26} strokeWidth={3} />
                        </button>
                      </div>

                      {isFocus && (
                        <div
                          className="fade-in mt-1.5 flex flex-wrap items-center gap-2 px-1"
                          onPointerDown={(ev) => ev.preventDefault()}
                        >
                          {focus!.field === "weight"
                            ? ([-2.5, -1, 1, 2.5] as const).map((d) => (
                                <Quick key={d} onClick={() => adjust(e.id, s.id, "weight", d)}>
                                  {d > 0 ? "+" : "−"}
                                  {fmtNum(Math.abs(d))}
                                </Quick>
                              ))
                            : ([-1, 1] as const).map((d) => (
                                <Quick key={d} onClick={() => adjust(e.id, s.id, "reps", d)}>
                                  {d > 0 ? "+1" : "−1"}
                                </Quick>
                              ))}
                          <button
                            type="button"
                            onClick={() => removeSet(e.id, s.id)}
                            className="ml-auto flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-danger"
                          >
                            <Icon name="trash" size={18} />
                            Elimina serie
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <Button variant="secondary" size="sm" icon="plus" className="mt-3 w-full" onClick={() => addSet(e.id)}>
                Aggiungi serie
              </Button>
            </section>
          );
        })}

        <Button variant="secondary" size="lg" icon="plus" className="w-full" onClick={() => setPicker(true)}>
          Aggiungi esercizio
        </Button>
        {status === "error" && (
          <p role="status" className="rounded-xl bg-danger/12 px-4 py-3 text-sm text-danger">
            Non riesco a salvare ora. I dati sono al sicuro su questo telefono e riprovo da solo.
          </p>
        )}
      </div>

      {picker && (
        <ExercisePicker
          exercises={library}
          onClose={() => setPicker(false)}
          onCreated={(ex) => setLibrary((l) => [...l, ex])}
          onPick={addExercise}
        />
      )}

      {menuEx && (
        <Sheet title={menuEx.name} onClose={() => setMenuFor(null)}>
          <div className="flex flex-col gap-2">
            <Button variant="secondary" icon="up" className="justify-start" onClick={() => { moveExercise(menuEx.id, -1); setMenuFor(null); }}>
              Sposta su
            </Button>
            <Button variant="secondary" icon="down" className="justify-start" onClick={() => { moveExercise(menuEx.id, 1); setMenuFor(null); }}>
              Sposta giù
            </Button>
            <Button
              variant="danger"
              icon="trash"
              className="justify-start"
              onClick={() => {
                const hasDone = menuEx.sets.some((s) => s.completed);
                setMenuFor(null);
                if (hasDone) setRemoveFor(menuEx.id);
                else removeExercise(menuEx.id);
              }}
            >
              Rimuovi esercizio
            </Button>
          </div>
        </Sheet>
      )}

      {removeEx && (
        <Sheet
          title="Rimuovere l'esercizio?"
          onClose={() => setRemoveFor(null)}
          footer={
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setRemoveFor(null)}>
                Annulla
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => { removeExercise(removeEx.id); setRemoveFor(null); }}>
                Rimuovi
              </Button>
            </div>
          }
        >
          <p className="text-muted">Le serie già completate di {removeEx.name} andranno perse.</p>
        </Sheet>
      )}

      {finishing && (
        <Sheet
          title="Termina allenamento"
          onClose={() => setFinishing(false)}
          footer={
            <div className="space-y-2">
              {totals.done > 0 ? (
                <div className="flex gap-3">
                  <Button variant="secondary" className="flex-1" onClick={() => setFinishing(false)}>
                    Continua
                  </Button>
                  <Button className="flex-1" onClick={finish} disabled={busy}>
                    {busy ? "Salvo…" : "Termina e salva"}
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" className="w-full" onClick={() => setFinishing(false)}>
                  Continua
                </Button>
              )}
              <Button
                variant="ghost"
                className="w-full text-danger"
                onClick={() => {
                  setFinishing(false);
                  setDiscarding(true);
                }}
              >
                Scarta allenamento
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-surface2 p-4">
              <div className="text-sm text-muted">Durata</div>
              <div className="num text-3xl font-semibold">{elapsed}</div>
            </div>
            <div className="rounded-2xl bg-surface2 p-4">
              <div className="text-sm text-muted">Serie completate</div>
              <div className="num text-3xl font-semibold">
                {totals.done}
                <span className="text-lg text-muted"> / {totals.all}</span>
              </div>
            </div>
          </div>
          {totals.done === 0 ? (
            <p className="mt-4 text-muted">Completa almeno una serie per salvare l'allenamento, oppure scartalo.</p>
          ) : totals.all > totals.done ? (
            <p className="mt-4 text-muted">
              {totals.all - totals.done} {totals.all - totals.done === 1 ? "serie non completata verrà scartata" : "serie non completate verranno scartate"}.
            </p>
          ) : null}
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        </Sheet>
      )}

      {discarding && (
        <Sheet
          title="Scartare l'allenamento?"
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
          <p className="text-muted">Tutto quello che hai registrato in questo allenamento verrà eliminato.</p>
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        </Sheet>
      )}
    </div>
  );
}

function Quick({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="num h-10 min-w-14 rounded-xl bg-surface2 px-3 text-xl font-semibold active:bg-line">
      {children}
    </button>
  );
}

function SaveDot({ status }: { status: "saved" | "saving" | "error" }) {
  const label = status === "saved" ? "Salvato" : status === "saving" ? "Salvataggio" : "Salvataggio non riuscito";
  return (
    <span className="mr-1 flex items-center gap-1.5 text-xs text-muted" role="status" aria-label={label} title={label}>
      <span
        className={`size-2.5 rounded-full ${status === "saved" ? "bg-fg" : status === "saving" ? "bg-muted" : "bg-danger"}`}
      />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
