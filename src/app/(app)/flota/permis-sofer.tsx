// src/app/(app)/flota/permis-sofer.tsx
import type { ReactElement } from "react";

import { ListaDefinitii } from "@/components/ui/lista-definitii";
import { Scadenta } from "@/components/ui/scadenta";
import { stareScadentaFlota } from "@/domain/fleet/scadente";
import { formatDate } from "@/lib/format/date";
import { permisulAngajatului, verificariSoferi } from "@/lib/queries/soferi";

import { ButonStergePermis } from "./buton-sterge-permis";
import { DialogPermis } from "./dialog-permis";
import { ETICHETE_SCADENTA } from "./etichete";

/**
 * Permisul de conducere și avizul medical al unui angajat (0204, F9), ca
 * secțiune de pagină. Pe fișa angajatului (HR și administratorul scriu,
 * managerul citește echipa) și în „Mașina mea” (șoferul își citește permisul).
 *
 * Avizul vine din `app.stare_aviz_sofer` prin faptele verificărilor: doar
 * apt / expirat / lipsă, niciodată rezultatul medical (art. 9 GDPR), și EXACT
 * doar pentru cine are acces SSM pe fișa omului (sau administrează parcul).
 * Oricine altcineva primește `null` și rândul de aviz nu apare: nici „apt”, nici
 * un semnal generic. La fel cu SSM oprit.
 */
interface Proprietati {
  readonly organizationId: string;
  readonly employeeId: string;
  readonly numeAngajat: string;
  /** `AAAA-LL-ZZ`, ziua României. */
  readonly azi: string;
  readonly poateCrea: boolean;
  readonly poateModifica: boolean;
  readonly titlu?: string;
  readonly className?: string;
}

const ETICHETE_AVIZ: Readonly<Record<string, string>> = {
  apt: "Apt — fișă de aptitudine valabilă",
  expirat: "Expirat — fișa de aptitudine trebuie refăcută",
  lipsa: "Lipsește — nu există o fișă de aptitudine valabilă",
};

export async function PermisSofer({
  organizationId,
  employeeId,
  numeAngajat,
  azi,
  poateCrea,
  poateModifica,
  titlu = "Permis de conducere",
  className,
}: Proprietati): Promise<ReactElement> {
  const [permis, fapte] = await Promise.all([
    permisulAngajatului(organizationId, employeeId),
    verificariSoferi(organizationId, [employeeId], azi),
  ]);
  const aviz = fapte.get(employeeId)?.aviz ?? null;
  const treapta = stareScadentaFlota(permis?.expira_la ?? null, azi);
  const idTitlu = `titlu-permis-${employeeId}`;

  return (
    <section aria-labelledby={idTitlu} className={className}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id={idTitlu} className="text-sectiune font-medium">
          {titlu}
        </h2>
        <div className="flex items-center gap-1">
          {permis === null && poateCrea ? (
            <DialogPermis employeeId={employeeId} numeAngajat={numeAngajat} permis={null} />
          ) : null}
          {permis !== null && poateModifica ? (
            <>
              <DialogPermis employeeId={employeeId} numeAngajat={numeAngajat} permis={permis} />
              <ButonStergePermis
                permisId={permis.id}
                employeeId={employeeId}
                numar={permis.numar}
              />
            </>
          ) : null}
        </div>
      </div>

      {permis === null ? (
        <p className="text-muted-foreground text-corp">
          Niciun permis de conducere înregistrat.
          {poateCrea
            ? " Înregistrați-l ca foile de parcurs și predările de vehicul să poată verifica valabilitatea lui."
            : ""}
        </p>
      ) : (
        <ListaDefinitii
          coloane={4}
          textNecompletat="Necompletat"
          definitii={[
            { eticheta: "Număr", valoare: permis.numar, identificator: true },
            { eticheta: "Categorii", valoare: permis.categorii.join(", ") },
            {
              eticheta: "Eliberat la",
              valoare: permis.eliberat_la === null ? null : formatDate(permis.eliberat_la),
            },
            {
              eticheta: "Valabil până la",
              valoare: (
                <span className="flex flex-wrap items-center gap-2">
                  {formatDate(permis.expira_la)}
                  <Scadenta treapta={treapta}>{ETICHETE_SCADENTA[treapta]}</Scadenta>
                </span>
              ),
            },
            ...(permis.observatii === null
              ? []
              : [{ eticheta: "Observații", valoare: permis.observatii, lat: true }]),
          ]}
        />
      )}

      {aviz === null ? null : (
        <p className="text-corp mt-4">
          <span className="text-muted-foreground">Aviz medical pentru conducere: </span>
          {ETICHETE_AVIZ[aviz] ?? aviz}
        </p>
      )}
    </section>
  );
}
