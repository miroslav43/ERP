// src/app/(app)/inventar/loading.tsx
import { SkeletonTable } from "@/components/data/skeleton-table";

export default function SeIncarcaInventar() {
  return (
    <main className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="bg-border h-7 w-40 animate-pulse rounded" />
          <div className="bg-border h-4 w-72 animate-pulse rounded" />
        </div>
      </div>
      <div className="bg-border h-24 w-full animate-pulse rounded-lg" />
      <SkeletonTable cols={7} />
    </main>
  );
}
