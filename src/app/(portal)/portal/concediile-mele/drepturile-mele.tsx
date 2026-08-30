// src/app/(portal)/portal/concediile-mele/drepturile-mele.tsx
"use client";

import { useState, type ReactElement } from "react";
import { ScrollText } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { Dialog } from "@/components/ui/dialog";
import type { DreptConcediu } from "@/lib/queries/portal";

/**
 * „La ce am dreptul" — lista tipurilor de concediu ale firmei, cu zilele
 * calculate pentru omul care se uită.
 *
 * Datele vin gata calculate de pe server (`drepturileMele`), nu se cer la
 * deschidere: sunt câteva rânduri, deja plătite de randarea paginii, iar o
 * cerere la fiecare clic ar face fereastra să clipească fără niciun câștig.
 *
 * ── DE CE NU SE AFIȘEAZĂ TEMEIUL LEGAL ───────────────────────────────────────
 * `leave_types.temei_legal` există și e citit de interogare, dar NU ajunge pe
 * ecran: fiecare valoare seed-uită se termină azi cu „(DE VERIFICAT)", marcajul
 * din `NOTES.md` pentru cifrele care încă așteaptă confirmarea unui jurist.
 * Până acum îl vedea doar administratorul, în ecranul de setări. Pus în portal,
 * l-ar fi văzut fiecare angajat — „OUG 158/2005 (DE VERIFICAT)" pune la îndoială
 * exact cifra de deasupra lui, tocmai pe ecranul care ar trebui s-o lămurească.
 *
 * Câmpul rămâne în tipul întors de `drepturileMele`: când temeiurile vor fi
 * confirmate, se afișează ștergând condiția, nu refăcând interogarea.
 */
export function DrepturileMele({
  an,
  drepturi,
}: {
  readonly an: number;
  readonly drepturi: readonly DreptConcediu[];
}): ReactElement {
  const [deschis, setDeschis] = useState(false);

  return (
    <>
      <Buton varianta="secundar" onClick={() => setDeschis(true)}>
        <ScrollText aria-hidden="true" className="size-4" />
        La ce am dreptul
      </Buton>

      <Dialog
        deschis={deschis}
        laInchidere={() => setDeschis(false)}
        titlu={`La ce am dreptul în ${String(an)}`}
        descriere="Tipurile de concediu din firma dumneavoastră și zilele care vi se cuvin la fiecare, după setările angajatorului."
      >
        {drepturi.length === 0 ? (
          <p className="text-muted-foreground text-corp">
            Firma nu are deocamdată niciun tip de concediu activ. Întrebați resursele umane.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {drepturi.map((d) => (
              <li key={d.leave_type_id} className="flex items-baseline justify-between gap-4 py-3">
                <span className="text-foreground text-corp min-w-0 font-medium">{d.denumire}</span>
                <span className="text-foreground text-corp shrink-0 font-semibold tabular-nums">
                  {d.zile.toLocaleString("ro-RO")} {d.zile === 1 ? "zi" : "zile"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </>
  );
}
