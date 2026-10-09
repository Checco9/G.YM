import type { Metadata } from "next";
import { FoodManager } from "@/components/food-manager";
import { requireUser } from "@/modules/auth/session";
import { listOwnFoods } from "@/modules/diet/service";

export const metadata: Metadata = { title: "Alimenti" };
export const dynamic = "force-dynamic";

export default async function FoodsPage() {
  const user = await requireUser();
  return (
    <div>
      <h1 className="num mb-5 text-5xl font-semibold leading-none">Alimenti</h1>
      <FoodManager initial={await listOwnFoods(user.id)} />
    </div>
  );
}
