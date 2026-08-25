// src/app/(app)/cursuri/conformitate/loading.tsx
import { Schelet } from "@/components/ui/schelet";

export default function Incarcare() {
  return (
    <div className="space-y-6">
      <Schelet forma="carduri" randuri={3} />
      <Schelet forma="tabel" randuri={8} coloane={4} />
    </div>
  );
}
