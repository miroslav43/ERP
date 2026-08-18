// src/app/(app)/diurna/politica/loading.tsx
import { SkeletonTable } from "@/components/data/skeleton-table";

export default function SeIncarcaPolitica() {
  return (
    <main className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="bg-border h-7 w-64 animate-pulse rounded" />
        <div className="bg-border h-4 w-96 max-w-full animate-pulse rounded" />
      </div>
      <SkeletonTable cols={5} />
    </main>
  );
}
