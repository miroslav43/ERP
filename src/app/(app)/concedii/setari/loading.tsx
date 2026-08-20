// src/app/(app)/concedii/setari/loading.tsx
import { SkeletonTable } from "@/components/data/skeleton-table";

export default function IncarcareSetariConcedii() {
  return (
    <main className="space-y-6 p-6" aria-busy="true" aria-label="Se încarcă setările de concedii">
      <SkeletonTable rows={6} cols={4} />
    </main>
  );
}
