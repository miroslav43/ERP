// src/app/(app)/cursuri/conformitate/loading.tsx
import { Schelet } from "@/components/ui/schelet";

/**
 * Fără `forma="tabel"`: acela cere un număr de coloane, iar matricea are
 * `1 + numărul de cursuri obligatorii` — necunoscut până la citire. Un schelet
 * cu alt număr de coloane decât tabelul de sub el produce exact saltul de
 * layout pe care `redesign/1-livrat.md` îl consemnează ca defect real.
 */
export default function Incarcare() {
  return (
    <div className="space-y-6">
      <Schelet forma="carduri" randuri={3} />
      <Schelet forma="lista" randuri={8} />
    </div>
  );
}
