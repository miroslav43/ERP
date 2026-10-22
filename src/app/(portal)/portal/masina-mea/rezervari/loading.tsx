// src/app/(portal)/portal/masina-mea/rezervari/loading.tsx
import { Schelet } from "@/components/ui/schelet";

export default function Incarcare() {
  return (
    <div className="space-y-4 p-4">
      <Schelet forma="carduri" randuri={3} />
    </div>
  );
}
