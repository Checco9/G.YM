import type { Metadata } from "next";
import { WeightManager } from "@/components/weight-manager";
import { requireUser } from "@/modules/auth/session";
import { listWeights, todayKey } from "@/modules/body/service";

export const metadata: Metadata = { title: "Peso corporeo" };
export const dynamic = "force-dynamic";

export default async function WeightPage() {
  const user = await requireUser();
  const entries = await listWeights(user.id);
  return <WeightManager entries={entries} today={todayKey(user.timezone)} tz={user.timezone} />;
}
