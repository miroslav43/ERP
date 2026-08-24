// src/app/(app)/concedii/echipa/loading.tsx
import { SkeletonTable } from "@/components/data/skeleton-table";

export default function IncarcareConcediiEchipa() {
  return (
    <main
      className="space-y-6 p-6"
      aria-busy="true"
      aria-label="Se încarcă cererile de concediu ale echipei"
    >
      <SkeletonTable />
    </main>
  );
}
