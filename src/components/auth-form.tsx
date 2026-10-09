"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { call, ApiError } from "@/lib/client-api";
import { Button } from "./ui/button";
import { Field, FormError, TextInput } from "./ui/field";

export function AuthForm({ mode, needsCode }: { mode: "login" | "register"; needsCode?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    try {
      await call("POST", `/api/auth/${mode}`, body);
      router.replace("/home");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields ?? {});
      } else setError("Si è verificato un errore. Riprova.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="num text-4xl font-semibold">{isRegister ? "Crea il tuo account" : "Bentornato"}</h1>
      {isRegister && (
        <Field label="Nome" error={fields.displayName}>
          <TextInput name="displayName" autoComplete="given-name" required maxLength={40} />
        </Field>
      )}
      <Field label="Email" error={fields.email}>
        <TextInput name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field label="Password" hint={isRegister ? "Almeno 10 caratteri" : undefined} error={fields.password}>
        <TextInput
          name="password"
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          required
          minLength={isRegister ? 10 : 1}
        />
      </Field>
      {isRegister && needsCode && (
        <Field label="Codice di invito" error={fields.code}>
          <TextInput name="code" autoComplete="off" required />
        </Field>
      )}
      <FormError message={error} />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? (isRegister ? "Registrazione…" : "Accesso in corso…") : isRegister ? "Registrati" : "Accedi"}
      </Button>
      <p className="pt-2 text-center text-muted">
        {isRegister ? (
          <>
            Hai già un account?{" "}
            <Link href="/login" className="font-semibold text-fg underline underline-offset-4">
              Accedi
            </Link>
          </>
        ) : (
          <>
            Non hai un account?{" "}
            <Link href="/register" className="font-semibold text-fg underline underline-offset-4">
              Registrati
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
