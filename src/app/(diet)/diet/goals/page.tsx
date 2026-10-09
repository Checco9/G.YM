import type { Metadata } from "next";
import { GoalsForm } from "@/components/goals-form";
import { requireUser } from "@/modules/auth/session";
import { latestWeight } from "@/modules/body/service";
import { getGoals } from "@/modules/diet/service";

export const metadata: Metadata = { title: "Obiettivi dieta" };
export const dynamic = "force-dynamic";

export default async function DietGoalsPage() {
  const user = await requireUser();
  const [goals, weight] = await Promise.all([getGoals(user.id), latestWeight(user.id)]);
  const age = user.birthDate ? Math.floor((Date.now() - new Date(user.birthDate).getTime()) / (365.25 * 86400000)) : null;
  return (
    <div>
      <h1 className="num mb-5 text-5xl font-semibold leading-none">Obiettivi</h1>
      <GoalsForm initial={goals} defaults={{ sex: user.sex, age, heightCm: user.heightCm, weightKg: weight }} />
    </div>
  );
}
