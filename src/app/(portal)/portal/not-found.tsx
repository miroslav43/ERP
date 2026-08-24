// src/app/(portal)/portal/not-found.tsx
import Link from "next/link";
import { Compass } from "lucide-react";

import { StareGoala } from "@/components/ui/stare-goala";

/**
 * 404-ul portalului.
 *
 * Prinde toate `notFound()`-urile de aici: modul dezactivat (`requireFeature`),
 * gărzile de proprietate de pe rutele `[id]`, identificatorii inventați. Fără
 * el, oricare dintre ele scoate angajatul din portal, în 404-ul rădăcină — care
 * n-are nici bară, nici antet, nici drum înapoi.
 */
export default function NegasitPortal() {
  return (
    <div className="mx-auto max-w-2xl p-4">
      <StareGoala
        fel="restrictionata"
        pictograma={Compass}
        titlu="Pagina nu există"
        descriere="Fie adresa e greșită, fie secțiunea nu e activată pentru firma dumneavoastră."
      />
      <p className="mt-4">
        <Link href="/portal" className="text-primary text-corp underline-offset-2 hover:underline">
          Înapoi la pagina de start
        </Link>
      </p>
    </div>
  );
}
