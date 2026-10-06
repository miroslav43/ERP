// src/app/(portal)/portal/doar-pe-saptamana.tsx
import { CalendarRange } from "lucide-react";

import { StareGoala } from "@/components/ui/stare-goala";

/**
 * Ce vede omul pe un ecran de pontare PE ZI când firma se pontează pe săptămână
 * (0165): ceasul, ținta codului QR, formularul zilei.
 *
 * Nu e o redirecționare tăcută. Cine ajunge aici a apăsat ceva — scurtătura de
 * pe telefon, afișul de la intrare, linkul dintr-o notificare veche — și trebuie
 * să afle de ce nu mai pontează de aici și unde se face acum. `StareGoala`, nu
 * `AccesRestrictionat`: omul are toate drepturile, doar drumul s-a mutat.
 *
 * `saptamana`: lunea săptămânii pe care trebuie s-o deschidă linkul — a zilei
 * deschise, nu neapărat săptămâna curentă.
 */
export function DoarPeSaptamana({ saptamana }: { readonly saptamana: string | null }) {
  return (
    <StareGoala
      fel="initiala"
      pictograma={CalendarRange}
      titlu="Firma se pontează pe săptămână"
      descriere="Ziua nu se mai pontează separat. Completați zilele, cu intervalul și locul, în pontajul săptămânii și trimiteți-l."
      actiune={{
        eticheta: "Completează pontajul săptămânii",
        href:
          saptamana === null
            ? "/portal/pontajul-meu/saptamana"
            : `/portal/pontajul-meu/saptamana?saptamana=${saptamana}`,
      }}
    />
  );
}
