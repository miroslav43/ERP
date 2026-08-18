// src/app/(app)/onboarding/sabloane/loading.tsx
import { SkeletonTable } from "@/components/data/skeleton-table";

export default function SeIncarcaSabloane() {
  return (
    <main className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="bg-border h-7 w-56 animate-pulse rounded" />
        <div className="bg-border h-4 w-80 animate-pulse rounded" />
      </div>
      <div className="bg-border h-10 w-full animate-pulse rounded" />
      <SkeletonTable cols={4} />
    </main>
  );
}
