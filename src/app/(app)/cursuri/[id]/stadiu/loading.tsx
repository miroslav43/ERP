// src/app/(app)/cursuri/[id]/stadiu/loading.tsx
import { Schelet } from "@/components/ui/schelet";

export default function Incarcare() {
  return (
    <div className="space-y-6">
      <Schelet forma="carduri" randuri={3} />
      <Schelet forma="tabel" randuri={6} coloane={5} />
    </div>
  );
}
