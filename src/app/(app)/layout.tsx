import { AppNav } from "@/components/app-nav";
import { requireUser } from "@/modules/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <AppNav name={user.displayName} />
      <div className="md:pl-60">
        <main
          className="page-pad mx-auto w-full max-w-5xl px-4 md:px-8"
          style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
        >
          {children}
        </main>
      </div>
    </>
  );
}
