import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { RunRunner } from "@/components/run-runner";
import { requireUser } from "@/modules/auth/session";
import { getRun } from "@/modules/runs/service";

export const metadata: Metadata = { title: "Corsa in corso" };
export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const run = await getRun(user.id, id);
  if (!run) notFound();
  if (run.status === "completed") redirect(`/gym/runs/${id}`);
  return <RunRunner run={run} />;
}
