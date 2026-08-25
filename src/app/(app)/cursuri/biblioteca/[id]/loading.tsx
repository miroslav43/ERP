// src/app/(app)/cursuri/biblioteca/[id]/loading.tsx
import { Schelet } from "@/components/ui/schelet";

export default function Incarcare() {
  return (
    <div className="space-y-6">
      <Schelet forma="detaliu" />
      <Schelet forma="tabel" randuri={3} coloane={5} />
    </div>
  );
}
