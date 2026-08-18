// src/app/(app)/pontaj/perioade/loading.tsx
import { SkeletonTable } from "@/components/data/skeleton-table";

export default function SeIncarcaPerioadePontaj() {
  return (
    <main className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="bg-border h-7 w-56 animate-pulse rounded" />
        <div className="bg-border h-4 w-80 animate-pulse rounded" />
      </div>
      <SkeletonTable cols={4} rows={12} />
    </main>
  );
}
