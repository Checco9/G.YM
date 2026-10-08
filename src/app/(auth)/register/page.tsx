import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Registrati" };
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return <AuthForm mode="register" needsCode={Boolean(env().REGISTRATION_CODE)} />;
}
