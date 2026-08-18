// src/app/(app)/concedii/sold/loading.tsx
import { SkeletonTable } from "@/components/data/skeleton-table";

export default function IncarcareSoldConcedii() {
  return (
    <main className="space-y-6 p-6" aria-busy="true" aria-label="Se încarcă soldul de concediu">
      <SkeletonTable rows={4} cols={6} />
    </main>
  );
}
