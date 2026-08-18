// src/app/(app)/mentenanta/echipamente/[id]/loading.tsx
import { SkeletonTable } from "@/components/data/skeleton-table";

export default function SeIncarcaEchipament() {
  return (
    <main className="space-y-8 p-6">
      <div className="space-y-2">
        <div className="bg-border h-4 w-32 animate-pulse rounded" />
        <div className="bg-border h-7 w-48 animate-pulse rounded" />
        <div className="bg-border h-4 w-72 animate-pulse rounded" />
      </div>
      <div className="bg-border h-40 w-full animate-pulse rounded-lg" />
      <SkeletonTable rows={4} cols={5} />
      <SkeletonTable rows={4} cols={6} />
    </main>
  );
}
