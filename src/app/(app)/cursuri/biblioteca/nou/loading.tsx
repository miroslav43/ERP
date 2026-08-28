// src/app/(app)/cursuri/biblioteca/nou/loading.tsx
import { Schelet } from "@/components/ui/schelet";

export default function Incarcare() {
  return (
    <div className="space-y-6">
      <Schelet forma="lista" randuri={1} />
      <Schelet forma="formular" randuri={4} />
    </div>
  );
}
