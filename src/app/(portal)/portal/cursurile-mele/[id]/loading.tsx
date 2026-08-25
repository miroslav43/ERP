// src/app/(portal)/portal/cursurile-mele/[id]/loading.tsx
import { Schelet } from "@/components/ui/schelet";

export default function Incarcare() {
  return (
    <div className="space-y-4 p-4">
      <Schelet forma="detaliu" />
      <Schelet forma="lista" randuri={4} />
    </div>
  );
}
