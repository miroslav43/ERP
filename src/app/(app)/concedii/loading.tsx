// src/app/(app)/concedii/loading.tsx
import { SkeletonTable } from "@/components/data/skeleton-table";

export default function IncarcareConcedii() {
  return (
    <main className="space-y-6 p-6" aria-busy="true" aria-label="Se încarcă cererile de concediu">
      <SkeletonTable />
    </main>
  );
}
