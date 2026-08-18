// src/app/(app)/mentenanta/loading.tsx
import { SkeletonTable } from "@/components/data/skeleton-table";

export default function SeIncarcaMentenanta() {
  return (
    <main className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="bg-border h-7 w-48 animate-pulse rounded" />
        <div className="bg-border h-4 w-96 animate-pulse rounded" />
      </div>
      <div className="bg-border h-10 w-full animate-pulse rounded" />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonTable rows={4} cols={3} />
        <SkeletonTable rows={4} cols={3} />
        <SkeletonTable rows={4} cols={3} />
        <SkeletonTable rows={4} cols={3} />
      </div>
    </main>
  );
}
