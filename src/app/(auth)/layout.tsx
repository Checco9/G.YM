import { redirect } from "next/navigation";
import { getSessionUser } from "@/modules/auth/session";
import { Logo } from "@/components/ui/icons";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSessionUser()) redirect("/home");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-10 flex items-center gap-3">
        <Logo size={44} />
        <span className="num text-6xl font-bold leading-none">G.YM</span>
      </div>
      {children}
    </main>
  );
}
