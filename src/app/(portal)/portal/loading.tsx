// src/app/(portal)/portal/loading.tsx
import { ScheletCarduri } from "@/components/feedback/schelet";

/**
 * Portalul e `force-dynamic` și fiecare ecran face câteva interogări. Pe o
 * conexiune mobilă slabă, fără acest fișier navigarea arată ca o pagină moartă:
 * bara răspunde la atingere, dar conținutul rămâne cel vechi până sosesc datele.
 */
export default function IncarcarePortal() {
  return (
    <div className="mx-auto max-w-2xl p-4">
      <ScheletCarduri carduri={4} />
    </div>
  );
}
