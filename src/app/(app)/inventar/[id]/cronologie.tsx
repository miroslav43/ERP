import { HandCoins, PackagePlus, PackageX, Undo2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";

import type { EvenimentFisa, FelEveniment } from "@/domain/inventory/fisa";
import { formatDateTime } from "@/lib/format/date";

import { ETICHETE_STARE } from "../etichete";

/**
 * Ce s-a întâmplat cu obiectul, de la cel mai recent înapoi.
 *
 * Înlocuiește lista de carduri „Istoric predări-primiri”, în care fiecare
 * predare era o cutie cu un `<dl>` de trei coloane înăuntru — deci patru
 * predări însemnau patru table de date pe care ochiul trebuia să le compare pe
 * verticală ca să reconstituie o poveste care e, de fapt, liniară.
 *
 * ── DE CE E CONSTRUITĂ DIN PRIMITIVE ─────────────────────────────────────
 * Proiectul n-are componentă de cronologie și n-are nici o convenție care s-o
 * contrazică. Cel mai apropiat lucru existent e istoricul din fișa angajatului
 * (`angajati/[id]/page.tsx:822`), o listă cu `border-l-2 border-border pl-4`.
 * Aici e aceeași linie, cu pastile de pictogramă peste ea.
 *
 * ── DE CE FIECARE FEL ARE PICTOGRAMA LUI ─────────────────────────────────
 * Aceeași regulă ca la `Scadenta`: culoarea e redundantă, forma e a doua marcă,
 * cuvântul a treia. O cronologie tipărită alb-negru, sau citită de cineva care
 * nu distinge nuanțele, rămâne la fel de clară.
 *
 * ── DE CE CASAREA N-ARE DATĂ ─────────────────────────────────────────────
 * `inventory_items` n-are `casat_la`. Motivul complet, plus de ce `updated_at`
 * nu ține locul, e în `@/domain/inventory/fisa`.
 */
const PICTOGRAMA: Readonly<Record<FelEveniment, LucideIcon>> = {
  inregistrare: PackagePlus,
  predare: HandCoins,
  returnare: Undo2,
  casare: PackageX,
};

function titlulEvenimentului(eveniment: EvenimentFisa): string {
  const cine = eveniment.angajat ?? "un angajat";
  switch (eveniment.fel) {
    case "inregistrare":
      return "Obiect înregistrat în evidență";
    case "predare":
      return `Predat lui ${cine}`;
    case "returnare":
      return `Returnat de ${cine}`;
    case "casare":
      return "Scos din uz";
  }
}

function detaliulEvenimentului(eveniment: EvenimentFisa): string | null {
  if (eveniment.stare === null) return null;
  const eticheta = ETICHETE_STARE[eveniment.stare];
  return eveniment.fel === "predare"
    ? `Stare la predare: ${eticheta}`
    : `Stare la returnare: ${eticheta}`;
}

interface Proprietati {
  readonly evenimente: readonly EvenimentFisa[];
}

export function Cronologie({ evenimente }: Proprietati): ReactElement {
  return (
    <ol className="border-border space-y-5 border-l-2 pl-6">
      {evenimente.map((eveniment) => {
        const Pictograma = PICTOGRAMA[eveniment.fel];
        const detaliu = detaliulEvenimentului(eveniment);
        return (
          <li key={eveniment.cheie} className="relative">
            {/*
              Pastila stă PESTE linie, cu fundalul cardului, ca linia să pară că
              trece pe sub ea. `-left-6` o duce înapoi peste `pl-6` al listei,
              iar `-translate-x-1/2` o centrează exact pe cele 2px ale liniei.
            */}
            <span
              aria-hidden="true"
              className="bg-surface border-border absolute top-0.5 -left-6 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border"
            >
              <Pictograma className="text-muted-foreground size-3.5" />
            </span>
            <p className="text-corp font-medium">{titlulEvenimentului(eveniment)}</p>
            <p className="text-muted-foreground text-nota mt-0.5">
              {eveniment.moment === null
                ? "Fără dată înregistrată"
                : formatDateTime(eveniment.moment)}
              {detaliu === null ? "" : ` · ${detaliu}`}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
