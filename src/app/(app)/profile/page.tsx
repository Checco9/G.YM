import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ProfileForm } from "@/components/profile-form";
import { LogoutButton, ThemeSwitcher } from "@/components/theme-and-logout";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Profilo" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const raw = (await cookies()).get("ghisa_theme")?.value;
  const theme = raw === "light" || raw === "system" ? raw : "dark";
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="num text-5xl font-semibold leading-none">Profilo</h1>
        <p className="mt-2 text-muted">{user.email}</p>
      </div>
      <Card>
        <ProfileForm
          initial={{
            displayName: user.displayName,
            sex: user.sex,
            heightCm: user.heightCm,
            birthDate: user.birthDate,
            timezone: user.timezone,
            weeklyTarget: user.weeklyTarget,
          }}
        />
      </Card>
      <Card className="space-y-3">
        <h2 className="num text-2xl font-semibold">Aspetto</h2>
        <ThemeSwitcher initial={theme} />
      </Card>
      <LogoutButton />
    </div>
  );
}
