import Link from "next/link";
import type { ReactElement } from "react";

import { Callout } from "@/components/ui/callout";
import type { Custodie } from "@/domain/inventory/fisa";
import { formatDate, formatDateTime, toBucharestDateString } from "@/lib/format/date";

import { ETICHETE_STARE } from "../etichete";
import { ButonReaduInStoc } from "./buton-readu-in-stoc";
import { DialogPredare } from "./dialog-predare";
import { DialogReturnare } from "./dialog-returnare";

/**
 * „Unde e obiectul” — răspunsul pentru care există un registru de inventar.
 *
 * ── CE ÎNLOCUIEȘTE ───────────────────────────────────────────────────────
 * Un lanț ternar de trei secțiuni care se excludeau reciproc: „Predare
 * curentă” (cu un `<dl>` de patru câmpuri și formularul de returnare lipit
 * dedesubt), un `Callout` pentru reparație, și „Predă obiectul unui angajat”
 * (cu formularul desfăcut). Trei containere de forme diferite pentru aceeași
 * întrebare, deci ecranul se rearanja complet la fiecare schimbare de stare.
 *
 * Aici containerul e mereu același, iar starea schimbă doar ce scrie în el.
 * Cardul e singurul loc din fișă unde propoziția e mai importantă decât tabelul
 * de date — restul paginii rămâne liniștit ca să se vadă asta.
 *
 * ── DE CE HAȘURA LA „CASAT” ──────────────────────────────────────────────
 * `hasura` e notația proiectului pentru „nu s-a întâmplat și nu se mai poate
 * scrie aici” (globals.css:143) — folosită azi pentru zile în afara
 * contractului și luni de pontaj închise. Un obiect casat e exact asta. E și
 * singurul semnal care supraviețuiește tipăririi alb-negru: are `print-color-adjust`.
 */
interface OptiuneAngajat {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

interface Proprietati {
  readonly custodie: Custodie;
  readonly obiectId: string;
  /** `created_at` al obiectului — de când e în evidența firmei. */
  readonly creatLa: string;
  readonly zileInEvidenta: number;
  readonly angajati: readonly OptiuneAngajat[];
  readonly poateScrie: boolean;
}

function zile(numar: number): string {
  if (numar === 0) return "de azi";
  if (numar === 1) return "de ieri";
  return `de ${String(numar)} zile`;
}

export function CardCustodie({
  custodie,
  obiectId,
  creatLa,
  zileInEvidenta,
  angajati,
  poateScrie,
}: Proprietati): ReactElement {
  if (custodie.fel === "alocat") {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sectiune font-medium">
            {custodie.detinator === null
              ? "Obiectul e predat unui angajat."
              : `La ${custodie.detinator}.`}
          </p>
          <p className="text-muted-foreground text-corp mt-1">
            Predat la {formatDateTime(custodie.predatLa)} · stare la predare:{" "}
            {ETICHETE_STARE[custodie.stareLaPredare]}.
          </p>
          <p className="text-muted-foreground text-corp mt-1">
            {custodie.confirmatLa === null
              ? "Angajatul nu a confirmat încă primirea."
              : `Primirea a fost confirmată la ${formatDateTime(custodie.confirmatLa)}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {poateScrie ? <DialogReturnare alocareId={custodie.alocareId} /> : null}
          {/*
            Procesul-verbal e singura piesă cu valoare juridică din modul, iar
            momentul în care se caută e chiar acesta — predarea deschisă.
          */}
          <Link
            href={`/inventar/${obiectId}/pv/${custodie.alocareId}`}
            className="text-corp underline-offset-2 hover:underline"
          >
            Proces-verbal de predare-primire
          </Link>
        </div>
      </div>
    );
  }

  if (custodie.fel === "in_reparatie") {
    return (
      <Callout
        fel="atentie"
        titlu="Obiectul e în reparație"
        {...(poateScrie ? { actiune: <ButonReaduInStoc obiectId={obiectId} /> } : {})}
      >
        A fost returnat cu starea „defect”, deci nu poate fi predat mai departe până nu confirmă
        cineva că a revenit din service. Confirmarea îl mută înapoi în stoc și se scrie în jurnalul
        de audit.
      </Callout>
    );
  }

  if (custodie.fel === "casat") {
    return (
      <div className="space-y-3">
        <span aria-hidden="true" className="hasura border-border block h-4 w-full border" />
        <p className="text-sectiune font-medium">Scos din uz.</p>
        <p className="text-muted-foreground text-corp">
          Obiectul nu mai poate fi predat nimănui. Rămâne în evidența firmei, cu tot istoricul de
          predări-primiri — un număr de inventar nu se refolosește niciodată.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sectiune font-medium">Nimeni nu are obiectul.</p>
        <p className="text-muted-foreground text-corp mt-1">
          {/* Ziua în Europe/Bucharest, nu tăierea ISO-ului: un obiect adăugat
              după ora 22 iarna ar fi datat cu o zi înainte. */}
          Stă în evidență {zile(zileInEvidenta)}, din{" "}
          {formatDate(toBucharestDateString(new Date(creatLa)))}.
        </p>
      </div>
      {poateScrie ? <DialogPredare itemId={obiectId} angajati={angajati} /> : null}
    </div>
  );
}
