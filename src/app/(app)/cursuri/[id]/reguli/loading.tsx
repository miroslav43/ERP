// src/app/(app)/cursuri/[id]/reguli/loading.tsx
import { Schelet } from "@/components/ui/schelet";

export default function Incarcare() {
  return (
    <div className="space-y-6">
      <Schelet forma="lista" randuri={3} />
      <Schelet forma="formular" randuri={3} />
    </div>
  );
}
