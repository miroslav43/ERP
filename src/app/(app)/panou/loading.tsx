// src/app/(app)/panou/loading.tsx
import { Schelet } from "@/components/ui/schelet";

/**
 * Scheletul urmează forma REALĂ a panoului, nu o grilă generică de carduri:
 * antet, apoi coada de lucru, apoi banda de scadențe. Un schelet care nu
 * seamănă cu ce urmează produce exact saltul de layout pe care ar trebui să-l
 * prevină.
 */
export default function Incarcare() {
  return (
    <div className="flex flex-col gap-6">
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className="bg-border/70 h-8 w-40 animate-pulse rounded" />
        <div className="bg-border/70 h-4 w-64 animate-pulse rounded" />
      </div>
      <Schelet forma="coada" randuri={3} />
      <Schelet forma="carduri" randuri={4} />
    </div>
  );
}
