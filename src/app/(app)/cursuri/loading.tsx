// src/app/(app)/cursuri/loading.tsx
import { Schelet } from "@/components/ui/schelet";

export default function Incarcare() {
  return (
    <div className="space-y-6">
      <Schelet forma="lista" randuri={2} />
      {/* Numărul de coloane e EXACT cel al tabelului real: un schelet cu alt
          număr face pagina să sară la aterizare. */}
      <Schelet forma="tabel" randuri={8} coloane={5} />
    </div>
  );
}
