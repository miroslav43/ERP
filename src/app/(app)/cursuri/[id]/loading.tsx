// src/app/(app)/cursuri/[id]/loading.tsx
import { Schelet } from "@/components/ui/schelet";

export default function Incarcare() {
  return (
    <div className="space-y-6">
      <Schelet forma="detaliu" />
      <Schelet forma="lista" randuri={6} />
    </div>
  );
}
