"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { ALL_DAYS, DAY_LABELS, PLACEHOLDERS, PRESETS, daysToList, daysFromList, describeDays, generateTimes, renderMessage } from "@/modules/notifications/domain/schedule";
import type { DeviceView, ReminderView } from "@/modules/notifications/service";
import { Button, IconButton } from "./ui/button";
import { Card } from "./ui/card";
import { Field, FormError, Select, TextInput } from "./ui/field";
import { Icon } from "./ui/icons";
import { Sheet } from "./ui/sheet";
import { Switch } from "./ui/switch";

type Settings = { enabled: boolean; quietStart: string | null; quietEnd: string | null };
type Support = "checking" | "ready" | "unsupported" | "needs-install";

function keyToBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function NotificationSettings({
  configured,
  publicKey,
  settings: initialSettings,
  reminders,
  devices,
}: {
  configured: boolean;
  publicKey: string | null;
  settings: Settings;
  reminders: ReminderView[];
  devices: DeviceView[];
}) {
  const router = useRouter();
  const [support, setSupport] = useState<Support>("checking");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [settings, setSettings] = useState(initialSettings);
  const [editing, setEditing] = useState<ReminderView | { kind: "water" | "motivation"; fresh: true } | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (ios && !standalone) return setSupport("needs-install");
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setSupport("unsupported");
    setSupport("ready");
    setPermission(Notification.permission);
    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => setSubscribed(Boolean(await reg?.pushManager.getSubscription())));
  }, []);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Si è verificato un errore. Riprova.");
    } finally {
      setBusy(false);
    }
  };

  const enableDevice = () =>
    guard(async () => {
      if (!publicKey) throw new Error("Notifiche non disponibili");
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") throw new Error("Permesso negato: abilita le notifiche per G.YM dalle impostazioni del browser.");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
      await call("POST", "/api/notifications/subscribe", sub.toJSON());
      setSubscribed(true);
      setNotice("Notifiche attivate su questo dispositivo.");
      router.refresh();
    });

  const disableDevice = () =>
    guard(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await call("POST", "/api/notifications/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      setSubscribed(false);
      router.refresh();
    });

  const test = (reminderId?: string) =>
    guard(async () => {
      await call("POST", "/api/notifications/test", { reminderId: reminderId ?? null });
      setNotice("Notifica inviata.");
    });

  const saveSettings = (next: Settings) => {
    setSettings(next);
    void call("PUT", "/api/notifications/settings", next).catch(() => setError("Impostazioni non salvate. Riprova."));
  };

  const toggleReminder = async (r: ReminderView, enabled: boolean) => {
    try {
      await call("PUT", `/api/notifications/reminders/${r.id}`, { ...r, enabled });
      router.refresh();
    } catch {
      setError("Impossibile aggiornare il promemoria.");
    }
  };

  const quiet = settings.quietStart !== null && settings.quietEnd !== null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="num text-2xl font-semibold">Questo dispositivo</h2>
            <p className="mt-0.5 text-sm text-muted">
              {!configured
                ? "Le notifiche non sono disponibili su questa installazione."
                : support === "needs-install"
                  ? "Su iPhone e iPad le notifiche funzionano dopo aver aggiunto G.YM alla schermata Home."
                  : support === "unsupported"
                    ? "Questo browser non supporta le notifiche."
                    : permission === "denied"
                      ? "Le notifiche sono bloccate nelle impostazioni del browser."
                      : subscribed
                        ? "Riceverai i promemoria su questo dispositivo."
                        : "Attiva le notifiche per ricevere i promemoria."}
            </p>
          </div>
          {configured && support === "ready" && permission !== "denied" && <Switch checked={subscribed} onChange={(v) => (v ? enableDevice() : disableDevice())} label="Notifiche su questo dispositivo" disabled={busy} />}
        </div>
        {support === "needs-install" && (
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Apri G.YM in Safari.</li>
            <li>Tocca Condividi, poi “Aggiungi alla schermata Home”.</li>
            <li>Apri G.YM dall'icona appena creata e torna in questa pagina.</li>
          </ol>
        )}
        {subscribed && (
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => test()} disabled={busy}>
            Invia una notifica di prova
          </Button>
        )}
        {notice && <p role="status" className="mt-3 text-sm font-semibold">{notice}</p>}
        <div className="mt-3"><FormError message={error} /></div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="num text-2xl font-semibold">Ricevi notifiche</h2>
            <p className="text-sm text-muted">Interruttore generale: spento, nessun promemoria viene inviato.</p>
          </div>
          <Switch checked={settings.enabled} onChange={(v) => saveSettings({ ...settings, enabled: v })} label="Ricevi notifiche" />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <div>
            <div className="font-semibold">Ore di silenzio</div>
            <p className="text-sm text-muted">Nessuna notifica in questa fascia oraria.</p>
          </div>
          <Switch checked={quiet} onChange={(v) => saveSettings({ ...settings, quietStart: v ? "22:00" : null, quietEnd: v ? "07:00" : null })} label="Ore di silenzio" />
        </div>
        {quiet && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dalle">
              <TextInput type="time" value={settings.quietStart ?? ""} onChange={(e) => e.target.value && saveSettings({ ...settings, quietStart: e.target.value })} />
            </Field>
            <Field label="Alle">
              <TextInput type="time" value={settings.quietEnd ?? ""} onChange={(e) => e.target.value && saveSettings({ ...settings, quietEnd: e.target.value })} />
            </Field>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="num text-3xl font-semibold">Promemoria</h2>
        <Button size="sm" icon="plus" onClick={() => setAdding(true)}>
          Aggiungi
        </Button>
      </div>
      {reminders.length === 0 && <p className="rounded-[22px] border border-dashed border-line p-6 text-center text-muted">Nessun promemoria. Aggiungine uno per l'acqua o per la motivazione.</p>}
      <div className="space-y-3">
        {reminders.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start gap-3">
              <button type="button" onClick={() => setEditing(r)} className="min-w-0 flex-1 text-left" aria-label={`Modifica ${r.label}`}>
                <div className="num truncate text-2xl font-semibold">{r.label}</div>
                <div className="text-sm text-muted">
                  {describeDays(r.days)}, {r.times.length === 1 ? r.times[0] : `${r.times.length} orari (${r.times[0]}-${r.times[r.times.length - 1]})`}
                </div>
                <div className="mt-1 truncate text-sm text-muted">{r.messages[0]}</div>
              </button>
              <Switch checked={r.enabled} onChange={(v) => toggleReminder(r, v)} label={`${r.label} attivo`} />
            </div>
          </Card>
        ))}
      </div>

      {devices.length > 0 && (
        <Card>
          <h2 className="num text-2xl font-semibold">Dispositivi collegati</h2>
          <ul className="mt-2 divide-y divide-line">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-1.5">
                <span>{d.label}</span>
                <IconButton
                  icon="trash"
                  label={`Rimuovi ${d.label}`}
                  onClick={async () => {
                    await call("DELETE", `/api/notifications/devices/${d.id}`).catch(() => {});
                    router.refresh();
                  }}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {adding && (
        <Sheet title="Nuovo promemoria" onClose={() => setAdding(false)}>
          <div className="space-y-2">
            {(["water", "motivation"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setAdding(false);
                  setEditing({ kind: k, fresh: true });
                }}
                className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-surface2 px-4 text-left"
              >
                <Icon name={k === "water" ? "drop" : "flame"} />
                <div>
                  <div className="font-semibold">{k === "water" ? "Acqua" : "Motivazione"}</div>
                  <div className="text-sm text-muted">{k === "water" ? "Ti ricorda di bere durante la giornata" : "Un messaggio per darti la spinta giusta"}</div>
                </div>
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {editing && <ReminderEditor initial={editing} canTest={subscribed} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} onTest={test} />}
    </div>
  );
}

function ReminderEditor({
  initial,
  canTest,
  onClose,
  onSaved,
  onTest,
}: {
  initial: ReminderView | { kind: "water" | "motivation"; fresh: true };
  canTest: boolean;
  onClose: () => void;
  onSaved: () => void;
  onTest: (id: string) => void;
}) {
  const existing = "id" in initial ? initial : null;
  const kind = initial.kind;
  const preset = PRESETS[kind];
  const [label, setLabel] = useState(existing?.label ?? preset.label);
  const [messages, setMessages] = useState<string[]>(existing?.messages ?? [...preset.messages]);
  const [times, setTimes] = useState<string[]>(existing?.times ?? [...preset.times]);
  const [days, setDays] = useState(existing?.days ?? ALL_DAYS);
  const [skip, setSkip] = useState(existing?.skipIfGoalMet ?? preset.skipIfGoalMet);
  const [gen, setGen] = useState({ start: "09:00", end: "21:00", every: "120" });
  const [showGen, setShowGen] = useState(false);
  const [focused, setFocused] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sample: Record<string, string | number> = kind === "water" ? { nome: "Francesco", bevuti: "1,25 L", mancano: "1,25 L", obiettivo: "2,5 L" } : { nome: "Francesco", settimana: 3, serie: 5 };
  const selectedDays = daysToList(days);

  async function save() {
    setBusy(true);
    setError(null);
    const body = { kind, label, enabled: existing?.enabled ?? true, messages: messages.filter((m) => m.trim()), times: times.filter(Boolean), days, skipIfGoalMet: skip };
    try {
      if (existing) await call("PUT", `/api/notifications/reminders/${existing.id}`, body);
      else await call("POST", "/api/notifications/reminders", body);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Si è verificato un errore. Riprova.");
      setBusy(false);
    }
  }
  async function remove() {
    if (!existing) return;
    setBusy(true);
    try {
      await call("DELETE", `/api/notifications/reminders/${existing.id}`);
      onSaved();
    } catch {
      setError("Impossibile eliminare il promemoria.");
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={existing ? "Modifica promemoria" : kind === "water" ? "Promemoria acqua" : "Promemoria motivazione"}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          {existing && (
            <Button variant="danger" icon="trash" onClick={remove} disabled={busy} aria-label="Elimina promemoria">
              Elimina
            </Button>
          )}
          <Button className="flex-1" onClick={save} disabled={busy}>
            Salva
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Nome">
          <TextInput value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} />
        </Field>

        <div>
          <div className="mb-1.5 text-sm font-medium text-muted">Messaggi</div>
          <p className="mb-2 text-sm text-muted">A ogni invio ne viene scelto uno a caso. Scrivi quello che vuoi.</p>
          <div className="space-y-2">
            {messages.map((m, i) => (
              <div key={i} className="flex items-start gap-1">
                <textarea
                  value={m}
                  onFocus={() => setFocused(i)}
                  onChange={(e) => setMessages(messages.map((x, k) => (k === i ? e.target.value : x)))}
                  maxLength={140}
                  rows={2}
                  aria-label={`Messaggio ${i + 1}`}
                  className="min-h-14 flex-1 resize-none rounded-xl bg-surface2 px-4 py-3 outline-none ring-1 ring-transparent focus:ring-fg"
                />
                {messages.length > 1 && <IconButton icon="x" label={`Rimuovi messaggio ${i + 1}`} onClick={() => setMessages(messages.filter((_, k) => k !== i))} />}
              </div>
            ))}
          </div>
          {messages.length < 10 && (
            <Button variant="ghost" size="sm" icon="plus" className="mt-1" onClick={() => { setMessages([...messages, ""]); setFocused(messages.length); }}>
              Aggiungi messaggio
            </Button>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {PLACEHOLDERS[kind].map(([token, hint]) => (
              <button
                key={token}
                type="button"
                title={hint}
                onClick={() => setMessages(messages.map((x, k) => (k === Math.min(focused, messages.length - 1) ? `${x}${x && !x.endsWith(" ") ? " " : ""}${token}` : x)))}
                className="h-9 rounded-full bg-surface2 px-3 text-sm font-semibold"
              >
                {token}
              </button>
            ))}
          </div>
          {messages[0] && <p className="mt-2 rounded-xl bg-surface2 px-4 py-3 text-sm"><span className="text-muted">Anteprima: </span>{renderMessage(messages[Math.min(focused, messages.length - 1)] || messages[0], sample)}</p>}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium text-muted">Orari</span>
            <button type="button" className="text-sm font-semibold underline underline-offset-4" onClick={() => setShowGen(!showGen)}>
              Genera orari
            </button>
          </div>
          {showGen && (
            <div className="mb-3 grid grid-cols-3 items-end gap-2 rounded-2xl bg-surface2 p-3">
              <Field label="Dalle"><TextInput type="time" value={gen.start} onChange={(e) => setGen({ ...gen, start: e.target.value })} /></Field>
              <Field label="Alle"><TextInput type="time" value={gen.end} onChange={(e) => setGen({ ...gen, end: e.target.value })} /></Field>
              <Field label="Ogni">
                <Select value={gen.every} onChange={(e) => setGen({ ...gen, every: e.target.value })}>
                  {[60, 90, 120, 180, 240].map((m) => (<option key={m} value={m}>{m >= 60 ? `${m / 60} h` : `${m} min`}</option>))}
                </Select>
              </Field>
              <Button size="sm" className="col-span-3" onClick={() => { const t = generateTimes(gen.start, gen.end, Number(gen.every)); if (t.length) { setTimes(t); setShowGen(false); } }}>
                Applica
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {times.map((t, i) => (
              <div key={i} className="flex items-center rounded-xl bg-surface2">
                <input type="time" value={t} aria-label={`Orario ${i + 1}`} onChange={(e) => setTimes(times.map((x, k) => (k === i ? e.target.value : x)))} className="h-11 rounded-xl bg-transparent px-3 outline-none" />
                {times.length > 1 && <IconButton icon="x" label={`Rimuovi orario ${t}`} className="size-9" onClick={() => setTimes(times.filter((_, k) => k !== i))} />}
              </div>
            ))}
            {times.length < 12 && (
              <button type="button" onClick={() => setTimes([...times, "12:00"])} className="h-11 rounded-xl border border-dashed border-line px-4 text-sm font-semibold text-muted">
                + Orario
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-sm font-medium text-muted">Giorni</div>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((d, i) => {
              const on = selectedDays.includes(i);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDays(daysFromList(on ? selectedDays.filter((x) => x !== i) : [...selectedDays, i]) || days)}
                  className={`h-10 min-w-12 rounded-full px-3 text-sm font-semibold ${on ? "bg-fg text-onfg" : "bg-surface2 text-muted"}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {kind === "water" && (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Salta se hai già bevuto abbastanza</div>
              <p className="text-sm text-muted">Niente promemoria quando l'obiettivo di oggi è raggiunto.</p>
            </div>
            <Switch checked={skip} onChange={setSkip} label="Salta se l'obiettivo è raggiunto" />
          </div>
        )}
        {existing && canTest && (
          <Button variant="secondary" size="sm" onClick={() => onTest(existing.id)}>
            Prova ora questo promemoria
          </Button>
        )}
        <FormError message={error} />
      </div>
    </Sheet>
  );
}
