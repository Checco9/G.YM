import { PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}>
      <PageSkeleton />
    </div>
  );
}
