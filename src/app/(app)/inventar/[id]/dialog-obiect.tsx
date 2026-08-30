"use client";

import { Pencil } from "lucide-react";
import type { ReactElement } from "react";

import { FormularDialog } from "@/components/ui/formular-dialog";

import { actualizeazaObiect } from "../actions";
import { CampuriObiect, type OptiuneCategorie, type ValoriInitialeObiect } from "../campuri-obiect";
import { valoriObiect } from "../valori-obiect";

/**
 * Modificarea datelor obiectului.
 *
 * Înainte, formularul înlocuia secțiunea „Acțiuni” din SUBSOLUL fișei — ultima
 * dintre cinci secțiuni, după istoric și după tichete. Ca să corectezi o serie
 * scrisă greșit, trebuia să derulezi pe lângă tot ce nu te interesa, iar
 * formularul se desfăcea acolo, jos, departe de datele pe care le corectai.
 *
 * ── DE CE ETICHETA SE SCHIMBĂ ────────────────────────────────────────────
 * Pe o fișă cu goluri, verbul potrivit nu e „Editează” — nimic nu e greșit, doar
 * lipsește. „Completează” spune ce e de făcut; „Editează” spune ce unealtă se
 * deschide. Alegerea o face fișa, care știe câte câmpuri sunt scrise.
 */
interface Proprietati {
  readonly obiect: ValoriInitialeObiect & Readonly<{ id: string }>;
  readonly categorii: readonly OptiuneCategorie[];
  /** „Completează” cât fișa are goluri, „Editează” când e întreagă. */
  readonly eticheta: string;
}

export function DialogObiect({ obiect, categorii, eticheta }: Proprietati): ReactElement {
  async function trimite(date: FormData) {
    return actualizeazaObiect({ id: obiect.id, ...valoriObiect(date) });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta,
        varianta: "secundar",
        pictograma: <Pencil aria-hidden="true" className="size-4" />,
      }}
      titlu={`Modifică „${obiect.denumire}”`}
      descriere="Starea de circuit — în stoc, alocat, în reparație — nu se schimbă de aici: o mișcă predările și returnările."
      marime="lucru"
      actiune={trimite}
      mesajReusita="Obiectul a fost salvat."
      etichetaTrimite="Salvează"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <CampuriObiect stare={stare} idc={idc} categorii={categorii} obiect={obiect} />
      )}
    </FormularDialog>
  );
}
