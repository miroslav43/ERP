// src/app/(app)/flota/rapoarte/prezentare-raport.tsx
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { abatereNotabila } from "@/domain/fleet/consum";
import {
  etichetaLuna,
  PLAFON_FOI_PACHET,
  type FoiNeaprobate,
  type RaportLunar,
  type RandConsum,
  type RandCost,
  type RandSofer,
} from "@/domain/fleet/rapoarte";
import { formatAmount, formatLei } from "@/lib/format/money";
import { cn } from "@/lib/ui/cn";

import { adresaExport, adresaFoileLunii } from "./adrese";

const km = (n: number): string => n.toLocaleString("ro-RO");
const zecimale = (n: number): string => formatAmount(n);

function abatere(v: number | null): string {
  if (v === null) return "—";
  return `${v > 0 ? "+" : ""}${v.toLocaleString("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** „9,00 l/100 km”, sau „—” când nu există cifră. */
const la100 = (v: number | null, unitate: "l" | "kWh"): string =>
  v === null ? "—" : `${zecimale(v)} ${unitate}/100 km`;

const SUBSOL = "border-border border-t font-semibold";

/** „Luna mai are 2 foi neaprobate (1 în ciornă, 1 trimisă).” — acordul cu numărul, nu „foi neaprobată”. */
function textNeaprobate(n: FoiNeaprobate): string {
  const total = n.ciorne + n.trimise + n.respinse;
  const parti = [
    n.ciorne === 0 ? null : `${String(n.ciorne)} în ciornă`,
    n.trimise === 0 ? null : `${String(n.trimise)} ${n.trimise === 1 ? "trimisă" : "trimise"}`,
    n.respinse === 0 ? null : `${String(n.respinse)} ${n.respinse === 1 ? "respinsă" : "respinse"}`,
  ].filter((p): p is string => p !== null);
  const cate = total === 1 ? "o foaie neaprobată" : `${String(total)} foi neaprobate`;
  return `Luna mai are ${cate} (${parti.join(", ")}).`;
}

/**
 * Corpul raportului unei luni: cifrele-cheie, foile care NU intră în cifre,
 * descărcările și cele trei tabele. PREZENTARE pură — primește raportul gata
 * calculat, nu atinge baza (și nici `server-only`), ca să poată fi randată în
 * teste. Poarta paginii e deja verificată de apelant (`poateVedeaRapoarte`);
 * `poateExporta` decide doar butoanele de descărcare.
 */
export function PrezentareRaport({
  raport,
  poateExporta,
  poateAproba,
}: Readonly<{
  raport: RaportLunar;
  poateExporta: boolean;
  /** Poarta lui `/flota/aprobari`: legătura „De aprobat” apare doar cu ea. */
  poateAproba: boolean;
}>): ReactElement {
  const { luna, vehicul, totaluri, totalCost, foiNeaprobate } = raport;
  const neaprobate = foiNeaprobate.ciorne + foiNeaprobate.trimise + foiNeaprobate.respinse;
  const faraActivitate = totaluri.foi === 0 && raport.costuri.length === 0;

  if (faraActivitate && neaprobate === 0) {
    return (
      <StareGoala
        fel="initiala"
        pictograma={BarChart3}
        titlu={`Nicio activitate în ${etichetaLuna(luna)}`}
        descriere="Luna nu are foi aprobate, intervenții de service, cheltuieli sau documente începute în ea. Alegeți altă lună."
      />
    );
  }

  const pachetPosibil = totaluri.foi > 0 && totaluri.foi <= PLAFON_FOI_PACHET;

  const coloaneCost: readonly Coloana<RandCost>[] = [
    {
      cheie: "vehicul",
      antet: "Vehicul",
      peTelefon: "titlu",
      celula: (r) => <span className="font-medium">{r.vehicul}</span>,
    },
    {
      cheie: "service",
      antet: "Service",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => formatLei(r.service),
    },
    {
      cheie: "cheltuieli",
      antet: "Cheltuieli",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => formatLei(r.cheltuieli),
    },
    {
      cheie: "documente",
      antet: "Documente",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => formatLei(r.documente),
    },
    {
      cheie: "combustibil",
      antet: "Combustibil (foi)",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => formatLei(r.combustibilFoi),
    },
    {
      cheie: "total",
      antet: "Total",
      numeric: true,
      peTelefon: "insigna",
      celula: (r) => <span className="font-semibold">{formatLei(r.total)}</span>,
    },
    {
      cheie: "km",
      antet: "Km",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => (r.km === 0 ? "—" : `${km(r.km)} km`),
    },
    {
      cheie: "lei-km",
      antet: "Lei/km",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => (r.costPeKm === null ? "—" : zecimale(r.costPeKm)),
    },
  ];

  const coloaneConsum: readonly Coloana<RandConsum>[] = [
    {
      cheie: "vehicul",
      antet: "Vehicul",
      peTelefon: "titlu",
      celula: (r) => <span className="font-medium">{r.vehicul}</span>,
    },
    {
      cheie: "foi",
      antet: "Foi",
      numeric: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (r) => r.foi,
    },
    {
      cheie: "km",
      antet: "Km",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => `${km(r.km)} km`,
    },
    {
      cheie: "alimentat",
      antet: "Alimentat",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => `${zecimale(r.litri)} ${r.unitate}`,
    },
    {
      cheie: "real",
      antet: "Consum real",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => la100(r.consumReal, r.unitate),
    },
    {
      cheie: "norma",
      antet: "Norma",
      numeric: true,
      peTelefon: "meta",
      celula: (r) =>
        r.normaMedie === null && r.foiFaraNorma > 0 ? (
          <span title={`${String(r.foiFaraNorma)} foi fără normă proprie pe vehicul`}>
            lipsește
          </span>
        ) : (
          la100(r.normaMedie, r.unitate)
        ),
    },
    {
      cheie: "abatere",
      antet: "Abatere",
      numeric: true,
      peTelefon: "insigna",
      celula: (r) =>
        r.abatere !== null && abatereNotabila(r.abatere) ? (
          <Badge ton="atentie">{abatere(r.abatere)}</Badge>
        ) : (
          abatere(r.abatere)
        ),
    },
  ];

  const coloaneSoferi: readonly Coloana<RandSofer>[] = [
    {
      cheie: "sofer",
      antet: "Șofer",
      peTelefon: "titlu",
      celula: (r) => <span className="font-medium">{r.sofer}</span>,
    },
    {
      cheie: "foi",
      antet: "Foi",
      numeric: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (r) => r.foi,
    },
    {
      cheie: "zile",
      antet: "Zile",
      numeric: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (r) => r.zile,
    },
    {
      cheie: "vehicule",
      antet: "Vehicule",
      numeric: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (r) => r.vehicule,
    },
    {
      cheie: "km",
      antet: "Km",
      numeric: true,
      peTelefon: "insigna",
      celula: (r) => <span className="font-semibold">{`${km(r.km)} km`}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cifra eticheta="Foi aprobate" valoare={String(totaluri.foi)} />
        <Cifra eticheta="Kilometri pe foi" valoare={`${km(totaluri.km)} km`} />
        <Cifra eticheta="Cost total" valoare={formatLei(totalCost.total)} />
        <Cifra
          eticheta="Cost pe km"
          valoare={totalCost.costPeKm === null ? "—" : `${zecimale(totalCost.costPeKm)} lei`}
          nota={totalCost.costPeKm === null ? "Fără kilometri pe foi aprobate" : undefined}
        />
      </dl>

      {neaprobate > 0 ? (
        <Callout
          fel="atentie"
          titlu="Foi care nu intră în cifre"
          actiune={
            poateAproba && foiNeaprobate.trimise > 0 ? (
              <Link href="/flota/aprobari" className={buton({ varianta: "secundar" })}>
                De aprobat
              </Link>
            ) : undefined
          }
        >
          {textNeaprobate(foiNeaprobate)} Kilometrii, consumul și combustibilul se numără doar de pe
          foile aprobate.
        </Callout>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {poateExporta ? (
          <>
            <a
              href={adresaExport("xlsx", luna, vehicul)}
              className={buton({ varianta: "secundar" })}
            >
              Descarcă Excel
            </a>
            {pachetPosibil ? (
              <a
                href={adresaExport("pachet", luna, vehicul)}
                className={buton({ varianta: "primar" })}
              >
                Pachet pentru contabil (ZIP)
              </a>
            ) : (
              <span className="text-muted-foreground text-nota">
                {totaluri.foi === 0
                  ? "Pachetul pentru contabil are nevoie de cel puțin o foaie aprobată în lună."
                  : `Luna are ${String(totaluri.foi)} de foi aprobate, iar pachetul cuprinde cel mult ${String(PLAFON_FOI_PACHET)}. Alegeți un vehicul și descărcați pachetul pe fiecare mașină.`}
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground text-nota">
            Descărcarea Excelului și a pachetului cere dreptul de export al flotei.
          </span>
        )}
        {totaluri.foi > 0 ? (
          <Link
            href={adresaFoileLunii(luna, vehicul)}
            className={cn(buton({ varianta: "link" }), "ml-auto")}
          >
            Vezi foile aprobate ale lunii
          </Link>
        ) : null}
      </div>

      <section aria-labelledby="titlu-cost" className="space-y-2">
        <h3 id="titlu-cost" className="text-sectiune font-semibold">
          Cost pe vehicul
        </h3>
        <p className="text-muted-foreground text-nota">
          Service, cheltuieli fără foaie, documente cu valabilitatea începută în lună și
          combustibilul de pe foile aprobate. Lei/km se calculează doar cu kilometri pe foi.
        </p>
        <Tabel
          caption={`Costul pe vehicul în ${etichetaLuna(luna)}`}
          coloane={coloaneCost}
          randuri={raport.costuri}
          cheieRand={(r) => r.vehicleId}
          gol={
            <StareGoala
              fel="initiala"
              compact
              titlu="Niciun cost în lună"
              descriere="Nu sunt intervenții, cheltuieli sau foi aprobate pe vehiculele alese."
            />
          }
          subsol={
            raport.costuri.length === 0 ? undefined : (
              <tr className={SUBSOL}>
                <th scope="row" className="px-4 py-3 text-left">
                  Total flotă
                </th>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatLei(totalCost.service)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatLei(totalCost.cheltuieli)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatLei(totalCost.documente)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatLei(totalCost.combustibilFoi)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatLei(totalCost.total)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {totalCost.km === 0 ? "—" : `${km(totalCost.km)} km`}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {totalCost.costPeKm === null ? "—" : zecimale(totalCost.costPeKm)}
                </td>
              </tr>
            )
          }
        />
      </section>

      <section aria-labelledby="titlu-consum" className="space-y-2">
        <h3 id="titlu-consum" className="text-sectiune font-semibold">
          Consum față de normă
        </h3>
        <p className="text-muted-foreground text-nota">
          Consum real = alimentat ÷ km × 100, pe foile aprobate. Norma e media normelor de pe foi,
          ponderată cu kilometrii. Abaterea apare marcată de la 15%.
        </p>
        <Tabel
          caption={`Consumul pe vehicul în ${etichetaLuna(luna)}`}
          coloane={coloaneConsum}
          randuri={raport.consum}
          cheieRand={(r) => r.vehicleId}
          gol={
            <StareGoala
              fel="initiala"
              compact
              titlu="Nicio foaie aprobată"
              descriere="Consumul se calculează pe foile aprobate ale lunii."
            />
          }
        />
      </section>

      <section aria-labelledby="titlu-soferi" className="space-y-2">
        <h3 id="titlu-soferi" className="text-sectiune font-semibold">
          Kilometri pe șofer
        </h3>
        <Tabel
          caption={`Kilometrii pe șofer în ${etichetaLuna(luna)}`}
          coloane={coloaneSoferi}
          randuri={raport.soferi}
          cheieRand={(r) => r.employeeId ?? "fara-sofer"}
          gol={
            <StareGoala
              fel="initiala"
              compact
              titlu="Nicio foaie aprobată"
              descriere="Kilometrii pe șofer se numără de pe foile aprobate ale lunii."
            />
          }
        />
      </section>
    </div>
  );
}

function Cifra({
  eticheta,
  valoare,
  nota,
}: Readonly<{ eticheta: string; valoare: string; nota?: string | undefined }>): ReactElement {
  return (
    <div className="border-border bg-surface rounded-panou border p-4">
      <dt className="text-muted-foreground text-nota">{eticheta}</dt>
      <dd className="text-titlu mt-1 font-semibold tabular-nums">{valoare}</dd>
      {nota === undefined ? null : <p className="text-muted-foreground text-nota mt-1">{nota}</p>}
    </div>
  );
}
