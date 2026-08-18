// src/app/(app)/ssm/stingatoare/loading.tsx
import { SkeletonTable } from "@/components/data/skeleton-table";

export default function SeIncarcaStingatoare() {
  return (
    <main className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="bg-border h-7 w-40 animate-pulse rounded" />
        <div className="bg-border h-4 w-96 animate-pulse rounded" />
      </div>
      <div className="bg-border h-10 w-full animate-pulse rounded" />
      <SkeletonTable cols={6} />
    </main>
  );
}
