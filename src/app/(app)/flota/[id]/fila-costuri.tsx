// src/app/(app)/flota/[id]/fila-costuri.tsx
import Link from "next/link";
import type { ReactElement } from "react";

import { buton } from "@/components/ui/buton";
import { ListaDefinitii } from "@/components/ui/lista-definitii";
import { Paginare } from "@/components/ui/paginare";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { dataDeLaLuni } from "@/domain/fleet/costuri";
import { formatDate } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import {
  cheltuieliVehicul,
  costuriVehicul,
  LIMITA_IMPLICITA_PAGINA,
  type CheltuialaVehicul,
} from "@/lib/queries/fleet-service";
import { PERIOADE_COSTURI, type PerioadaCosturi } from "@/schemas/fleet-service";
import { cn } from "@/lib/ui/cn";

import { formatConsum } from "../etichete";
import { ETICHETE_CATEGORIE_CHELTUIALA, ETICHETE_TIP_SERVICE } from "../etichete-service";
import { ButonStergeService } from "./buton-sterge-service";
import { DialogCheltuiala } from "./dialog-cheltuiala";

const ETICHETE_PERIOADA: Readonly<Record<PerioadaCosturi, string>> = {
  "3": "3 luni",
  "6": "6 luni",
  "12": "12 luni",
  tot: "Tot istoricul",
};

const fmtKm = (n: number): string => n.toLocaleString("ro-RO");
const fmtLitri = (n: number): string => `${n.toLocaleString("ro-RO")} l`;

/**
 * Fila „Costuri” a fișei vehiculului (0200): cât a costat vehiculul într-o
 * perioadă, din patru surse (service, combustibil de pe foile aprobate,
 * cheltuieli fără foaie, documente), cu costul pe kilometru și consumul real.
 *
 * Costul pe km și consumul se calculează DOAR pe kilometrii foilor aprobate din
 * aceeași perioadă. Fără foi aprobate, cifra lipsește (și se spune de ce), nu
 * devine „0 lei/km”. Combustibilul cumpărat fără foaie e în total, dar nu
 * intră în consum: n-are kilometri cu care să fie pereche.
 */
export async function FilaCosturi({
  organizationId,
  vehiculId,
  azi,
  perioada,
  poateAdministra,
  cursor,
}: Readonly<{
  organizationId: string;
  vehiculId: string;
  azi: string;
  perioada: PerioadaCosturi;
  poateAdministra: boolean;
  cursor: string | null;
}>): Promise<ReactElement> {
  const deLa = perioada === "tot" ? null : dataDeLaLuni(azi, Number(perioada));
  const [costuri, pagina] = await Promise.all([
    costuriVehicul(organizationId, vehiculId, deLa, azi),
    cheltuieliVehicul(organizationId, vehiculId, { cursor, limita: LIMITA_IMPLICITA_PAGINA }),
  ]);

  const coloaneCheltuieli: readonly Coloana<CheltuialaVehicul>[] = [
    {
      cheie: "data",
      antet: "Data",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (c) => formatDate(c.data_cheltuielii),
    },
    {
      cheie: "categorie",
      antet: "Categoria",
      peTelefon: "titlu",
      celula: (c) => (
        <>
          {ETICHETE_CATEGORIE_CHELTUIALA[c.categorie]}
          {c.litri === null && c.numar_document === null && c.observatii === null ? null : (
            <span className="text-muted-foreground text-nota block">
              {[
                c.litri === null ? null : fmtLitri(c.litri),
                c.numar_document === null ? null : `doc. ${c.numar_document}`,
                c.observatii,
              ]
                .filter((x) => x !== null)
                .join(" · ")}
            </span>
          )}
        </>
      ),
    },
    {
      cheie: "km",
      antet: "Km bord",
      numeric: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (c) => (c.km_bord === null ? "—" : `${fmtKm(c.km_bord)} km`),
    },
    {
      cheie: "suma",
      antet: "Suma",
      numeric: true,
      latime: "ingusta",
      peTelefon: "insigna",
      celula: (c) => formatLei(c.suma),
    },
    ...(poateAdministra
      ? [
          {
            cheie: "actiuni",
            antet: "Acțiuni",
            antetAscuns: true,
            latime: "ingusta",
            peTelefon: "meta",
            celula: (c: CheltuialaVehicul) => (
              <ButonStergeService
                fel="cheltuiala"
                id={c.id}
                vehiculId={vehiculId}
                descriere={`cheltuiala din ${formatDate(c.data_cheltuielii)}`}
                cifre={[
                  { eticheta: "Data", valoare: formatDate(c.data_cheltuielii) },
                  { eticheta: "Categoria", valoare: ETICHETE_CATEGORIE_CHELTUIALA[c.categorie] },
                  { eticheta: "Suma", valoare: formatLei(c.suma) },
                ]}
              />
            ),
          } satisfies Coloana<CheltuialaVehicul>,
        ]
      : []),
  ];

  const faraFoi = costuri.foi.numar === 0;

  return (
    <div className="space-y-6">
      <section aria-labelledby="costuri-sumar" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="costuri-sumar" className="text-sectiune font-semibold">
            Costuri
          </h2>
          <nav aria-label="Perioada costurilor" className="flex flex-wrap items-center gap-1">
            {PERIOADE_COSTURI.map((p) => (
              <Link
                key={p}
                href={`/flota/${vehiculId}?fila=costuri&perioada=${p}`}
                aria-current={p === perioada ? "true" : undefined}
                className={cn(
                  buton({ varianta: p === perioada ? "primar" : "tertiar" }),
                  "text-nota",
                )}
              >
                {ETICHETE_PERIOADA[p]}
              </Link>
            ))}
          </nav>
        </div>
        <p className="text-muted-foreground text-corp">
          {deLa === null ? "De la început" : `De la ${formatDate(deLa)}`} până la {formatDate(azi)}.
          Totalul adună service-ul, combustibilul de pe foile aprobate, cheltuielile fără foaie și
          documentele (RCA, ITP, rovinietă) cu valabilitatea începută în perioadă.
        </p>
        <div className="border-border rounded-panou border p-4">
          <ListaDefinitii
            coloane={4}
            textNecompletat="Fără foi aprobate"
            definitii={[
              { eticheta: "Cost total", valoare: formatLei(costuri.total) },
              {
                eticheta: "Cost pe kilometru",
                valoare: costuri.costPeKm === null ? null : `${formatLei(costuri.costPeKm)} / km`,
              },
              {
                eticheta: "Consum real (foi aprobate)",
                valoare: costuri.consumReal === null ? null : formatConsum(costuri.consumReal),
              },
              {
                eticheta: "Kilometri pe foi aprobate",
                valoare: faraFoi ? null : `${fmtKm(costuri.foi.km)} km`,
              },
              { eticheta: "Service", valoare: formatLei(costuri.service.total) },
              {
                eticheta: "Combustibil pe foi",
                valoare: formatLei(costuri.foi.costCombustibil),
              },
              { eticheta: "Cheltuieli fără foaie", valoare: formatLei(costuri.cheltuieli.total) },
              { eticheta: "Documente", valoare: formatLei(costuri.documente.total) },
            ]}
          />
        </div>
        {faraFoi ? (
          <p className="text-muted-foreground text-corp">
            Costul pe kilometru și consumul se calculează din foile de parcurs aprobate; în perioada
            aleasă nu există niciuna.
          </p>
        ) : null}
      </section>

      {costuri.service.peTip.length === 0 && costuri.cheltuieli.peCategorie.length === 0 ? null : (
        <section aria-labelledby="costuri-defalcare" className="space-y-3">
          <h2 id="costuri-defalcare" className="text-sectiune font-semibold">
            Defalcare
          </h2>
          <ul className="text-corp grid gap-1 sm:grid-cols-2">
            {costuri.service.peTip.map((t) => (
              <li key={`s-${t.categorie}`} className="flex justify-between gap-3">
                <span>Service — {ETICHETE_TIP_SERVICE[t.categorie]}</span>
                <span className="font-mono tabular-nums">{formatLei(t.suma)}</span>
              </li>
            ))}
            {costuri.cheltuieli.peCategorie.map((t) => (
              <li key={`c-${t.categorie}`} className="flex justify-between gap-3">
                <span>{ETICHETE_CATEGORIE_CHELTUIALA[t.categorie]}</span>
                <span className="font-mono tabular-nums">{formatLei(t.suma)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="cheltuieli" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="cheltuieli" className="text-sectiune font-semibold">
            Cheltuieli fără foaie
          </h2>
          {poateAdministra ? <DialogCheltuiala vehiculId={vehiculId} azi={azi} /> : null}
        </div>
        <Tabel
          caption="Cheltuielile vehiculului care nu sunt service și nu sunt pe foaia de parcurs, cele mai noi întâi."
          coloane={coloaneCheltuieli}
          randuri={pagina.randuri}
          cheieRand={(c) => c.id}
          gol={
            <p className="text-muted-foreground text-corp">
              Nicio cheltuială înregistrată pentru acest vehicul.
            </p>
          }
        />
        {pagina.randuri.length === 0 && cursor === null ? null : (
          <Paginare
            afisate={pagina.randuri.length}
            cursorUrmator={pagina.urmatorulCursor}
            limita={LIMITA_IMPLICITA_PAGINA}
            marimiPosibile={[LIMITA_IMPLICITA_PAGINA]}
            construiesteHref={({ cursor: c }) =>
              `/flota/${vehiculId}?fila=costuri&perioada=${perioada}${c === null ? "" : `&cursor=${encodeURIComponent(c)}`}`
            }
          />
        )}
      </section>
    </div>
  );
}
