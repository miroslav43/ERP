// src/app/(app)/revisal/loading.tsx
import { SkeletonTable } from "@/components/data/skeleton-table";

export default function IncarcareRevisal() {
  return (
    <main className="space-y-6 p-6" aria-busy="true" aria-label="Se încarcă evenimentele REVISAL">
      <SkeletonTable />
    </main>
  );
}
