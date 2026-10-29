"use client";

import type { DecodeHintType } from "@zxing/library";
import { useEffect, useRef, useState } from "react";
import { canonicalBarcode } from "@/modules/diet/barcode/domain";
import { Button } from "./ui/button";
import { Field, FormError, TextInput } from "./ui/field";
import { Icon } from "./ui/icons";

type State = "starting" | "scanning" | "denied" | "nocamera" | "busy" | "unsupported" | "error";

const PROBLEM: Record<Exclude<State, "starting" | "scanning">, { title: string; text: string }> = {
  denied: {
    title: "Accesso alla fotocamera negato",
    text: "Consenti la fotocamera per G.YM: nel browser tocca il lucchetto accanto all'indirizzo, poi Autorizzazioni, Fotocamera, Consenti. Se usi l'app installata, apri Impostazioni di Android, App, G.YM, Autorizzazioni.",
  },
  nocamera: { title: "Nessuna fotocamera disponibile", text: "Non trovo una fotocamera su questo dispositivo. Puoi inserire il codice a mano." },
  busy: { title: "Fotocamera non disponibile", text: "È in uso da un'altra app. Chiudila e riprova." },
  unsupported: { title: "Fotocamera non utilizzabile qui", text: "Il browser non permette l'accesso alla fotocamera in questa pagina. Puoi inserire il codice a mano." },
  error: { title: "Impossibile avviare la fotocamera", text: "Riprova. Se il problema continua, inserisci il codice a mano." },
};

function classify(err: unknown): State {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "nocamera";
  if (name === "NotReadableError" || name === "TrackStartError") return "busy";
  return "error";
}

/**
 * Scanner di codici a barre (EAN-13, EAN-8, UPC-A) con la fotocamera posteriore, basato su ZXing.
 * La libreria si carica solo quando si apre lo scanner, quindi non pesa sul resto dell'app.
 * Un codice è accettato dopo due letture uguali ravvicinate con codice di controllo GS1 valido.
 */
export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<State>("starting");
  const [attempt, setAttempt] = useState(0);
  const [torch, setTorch] = useState({ supported: false, on: false });
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const done = useRef(false);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    let cancelled = false;
    let controls: { stop: () => void } | null = null;
    done.current = false;
    setState("starting");
    setTorch({ supported: false, on: false });

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return setState("unsupported");
      try {
        const perm = await navigator.permissions?.query({ name: "camera" as PermissionName });
        if (perm?.state === "denied") return setState("denied");
      } catch {
        /* alcuni browser non supportano la query del permesso: si prova direttamente */
      }
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType: Hint }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        if (cancelled || !videoRef.current) return;
        const hints = new Map<DecodeHintType, unknown>([
          [Hint.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]],
          [Hint.TRY_HARDER, true],
        ]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 400 });
        let last = { code: "", at: 0, n: 0 };
        const c = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          (result, _error, ctrl) => {
            if (!result || done.current) return; // l'errore "nessun codice nell'immagine" è normale mentre si inquadra
            const code = canonicalBarcode(result.getText());
            if (!code) return; // controllo GS1 non valido: lettura sbagliata, si continua
            const t = Date.now();
            last = code === last.code && t - last.at < 1500 ? { code, at: t, n: last.n + 1 } : { code, at: t, n: 1 };
            if (last.n < 2) return;
            done.current = true;
            ctrl.stop();
            navigator.vibrate?.(60);
            onDetectedRef.current(code);
          },
        );
        if (cancelled) return c.stop();
        controls = c;
        setState("scanning");
        const track = (videoRef.current.srcObject as MediaStream | null)?.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
        setTorch({ supported: Boolean(caps?.torch), on: false });
      } catch (err) {
        if (!cancelled) setState(classify(err));
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
      const v = videoRef.current;
      (v?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
      if (v) v.srcObject = null;
    };
  }, [attempt]);

  // Tornando all'app dopo averla lasciata in secondo piano, il flusso video può essere fermo: si riavvia.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && !done.current && setAttempt((a) => a + 1);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  async function toggleTorch() {
    const track = (videoRef.current?.srcObject as MediaStream | null)?.getVideoTracks()[0];
    try {
      await track?.applyConstraints({ advanced: [{ torch: !torch.on } as unknown as MediaTrackConstraintSet] });
      setTorch({ supported: true, on: !torch.on });
    } catch {
      setTorch({ supported: false, on: false });
    }
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const code = canonicalBarcode(manualCode);
    if (!code) return setManualError("Codice non valido: controlla le cifre (di solito sono 13, oppure 8).");
    setManualError(null);
    done.current = true;
    onDetected(code);
  }

  const problem = state !== "starting" && state !== "scanning" ? PROBLEM[state] : null;

  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} muted playsInline autoPlay aria-label="Anteprima della fotocamera" className={`size-full object-cover ${problem ? "invisible" : ""}`} />
        {state === "scanning" && (
          <div className="pointer-events-none absolute inset-x-[8%] inset-y-[26%] rounded-xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]">
            <div className="scan-line absolute inset-x-2 h-0.5 rounded-full bg-white/90" />
          </div>
        )}
        {state === "starting" && <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Avvio della fotocamera…</div>}
        {problem && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface2 p-5 text-center">
            <Icon name="camera" size={32} />
            <div className="num text-2xl font-semibold">{problem.title}</div>
            <p className="text-sm text-muted">{problem.text}</p>
            {(state === "denied" || state === "busy" || state === "error") && (
              <Button size="sm" onClick={() => setAttempt((a) => a + 1)}>
                Riprova
              </Button>
            )}
          </div>
        )}
      </div>

      <p role="status" className="mt-3 text-center text-sm text-muted">
        {state === "scanning" ? "Inquadra il codice a barre del prodotto, con buona luce." : state === "starting" ? "Consenti l'accesso alla fotocamera se richiesto." : "\u00A0"}
      </p>

      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {torch.supported && (
          <Button variant="secondary" size="sm" onClick={toggleTorch} aria-pressed={torch.on}>
            {torch.on ? "Spegni la luce" : "Accendi la luce"}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setManual((m) => !m)} aria-expanded={manual}>
          Inserisci il codice a mano
        </Button>
      </div>

      {manual && (
        <form onSubmit={submitManual} className="mt-3 space-y-3">
          <Field label="Codice a barre" hint="Le cifre sotto le barre del prodotto">
            <TextInput inputMode="numeric" autoComplete="off" value={manualCode} onChange={(e) => setManualCode(e.target.value.replace(/[^\d\s-]/g, "").slice(0, 20))} placeholder="3017620422003" autoFocus />
          </Field>
          <FormError message={manualError} />
          <Button type="submit" className="w-full" disabled={!manualCode.trim()}>
            Cerca prodotto
          </Button>
        </form>
      )}
    </div>
  );
}
