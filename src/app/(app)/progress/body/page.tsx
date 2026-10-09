import type { Metadata } from "next";
import { BodyExplorer } from "@/components/body-explorer";
import { requireUser } from "@/modules/auth/session";
import { getStrengthOverview } from "@/modules/strength/service";
import { loadHistory } from "@/modules/stats/repository";

export const metadata: Metadata = { title: "Corpo" };
export const dynamic = "force-dynamic";

export default async function BodyPage() {
  const user = await requireUser();
  const overview = await getStrengthOverview(user, await loadHistory(user.id));
  return <BodyExplorer muscles={overview.muscles} needs={{ bodyWeight: !overview.bodyWeightKg, sex: !user.sex }} />;
}
