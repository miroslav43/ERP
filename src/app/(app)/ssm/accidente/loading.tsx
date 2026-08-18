// src/app/(app)/ssm/accidente/loading.tsx
import { SkeletonTable } from "@/components/data/skeleton-table";

export default function SeIncarcaAccidente() {
  return (
    <main className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="bg-border h-7 w-56 animate-pulse rounded" />
        <div className="bg-border h-4 w-96 animate-pulse rounded" />
      </div>
      <div className="bg-border h-10 w-full animate-pulse rounded" />
      <SkeletonTable cols={5} />
    </main>
  );
}
