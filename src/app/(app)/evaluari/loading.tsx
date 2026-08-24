// src/app/(app)/evaluari/loading.tsx
import { Schelet } from "@/components/ui/schelet";

/**
 * Cinci coloane, fiindcă tabelul real are cinci: Angajat, Șablon, Data,
 * Punctaj, Stare. Cinci schelete din proiect desenau alt număr de coloane decât
 * tabelul de sub ele, adică fix saltul de layout pe care propriul lor comentariu
 * pretindea că-l evită.
 */
export default function Incarcare() {
  return (
    <div className="space-y-6">
      <Schelet forma="carduri" randuri={4} />
      <Schelet forma="tabel" randuri={8} coloane={5} />
    </div>
  );
}
