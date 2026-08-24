// src/app/(app)/diurna/[id]/decont/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { cn } from "@/lib/ui/cn";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import {
  angajatiDupaId,
  baremeleTarilor,
  calculeazaDiurnaDeplasare,
  cheltuielile,
  citesteDeplasare,
  etapele,
  politicaLaData,
} from "@/lib/queries/per-diem";

import {
  ETICHETE_MIJLOC_TRANSPORT,
  ETICHETE_STATUS_DEPLASARE,
  ETICHETE_TIP_CHELTUIALA,
  textZile,
} from "../../etichete";
import { ButonTipar } from "./buton-tipar";

export const metadata: Metadata = { title: "Decont deplasare" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * Pagină printabilă — layout propriu, ascuns de meniu la tipărire.
 *
 * Ascunderea învelișului la tipărire NU mai stă aici. Pagina avea un `<style>`
 * propriu care ascundea `aside` și `header:not(.antet-decont)` — pe SELECTOR DE
 * ELEMENT, fiindcă bara laterală și antetul trăiesc în `(app)/layout.tsx`.
 * Mergea, dar lega documentul de faptul că bara laterală se întâmplă să fie un
 * `<aside>`, iar propriul lui antet trebuia exceptat pe nume de clasă, altfel
 * se tipărea fără titlu.
 *
 * Acum învelișul poartă `data-tipar="ascunde"`, iar regula e o singură dată în
 * `globals.css`. Un antet de document nu poartă atributul, deci nu are ce
 * excepta — și orice ecran din produs se tipărește curat, nu doar cele două
 * care și-au reparat singure problema.
 */
export default async function PaginaDecont({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "per_diem");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "per_diem:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta deplasările. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const deplasare = await citesteDeplasare(tenant.organizationId, id);
  if (deplasare === null) notFound();

  const [etapeTrip, cheltuieliTrip, angajati] = await Promise.all([
    etapele(deplasare.id),
    cheltuielile(deplasare.id),
    angajatiDupaId(tenant.organizationId, [deplasare.employee_id]),
  ]);
  const angajat = angajati.get(deplasare.employee_id);

  const politica = await politicaLaData(tenant.organizationId, deplasare.plecare_la.slice(0, 10));
  const idTariImplicate = [
    ...new Set(
      [
        deplasare.country_id,
        politica?.country_id_intern ?? null,
        ...etapeTrip.flatMap((e) => [e.from_country_id, e.to_country_id]),
      ].filter((v): v is string => v !== null),
    ),
  ];
  const baremuri = await baremeleTarilor(idTariImplicate);

  const calcul =
    politica === null
      ? null
      : calculeazaDiurnaDeplasare(
          {
            countryId: deplasare.country_id,
            plecareLa: deplasare.plecare_la,
            sosireLa: deplasare.sosire_la,
            plecareEfectivaLa: deplasare.plecare_efectiva_la,
            sosireEfectivaLa: deplasare.sosire_efectiva_la,
            cursDiurna: deplasare.curs_diurna,
          },
          etapeTrip.map((e) => ({
            ordine: e.ordine,
            fromCountryId: e.from_country_id,
            toCountryId: e.to_country_id,
            sosireLa: e.sosire_la,
          })),
          politica,
          baremuri,
        );

  const diurnaLei = calcul?.rezultat.valoareLei ?? null;
  const cheltuieliAprobate = cheltuieliTrip.filter((c) => c.aprobata);
  /**
   * Rândurile care NU intră în total. Se tipăresc separat, nu se ascund: omul
   * care semnează decontul trebuie să vadă ce bonuri au fost depuse și lăsate
   * pe dinafară, altfel diferența dintre teancul de hârtii și sumă nu se poate
   * explica. Până acum ecranul le omitea complet.
   */
  const cheltuieliNeaprobate = cheltuieliTrip.filter((c) => !c.aprobata);
  const cheltuieliAprobateLei = cheltuieliAprobate.reduce((sum, c) => sum + c.suma_lei, 0);
  const cheltuieliNeaprobateLei = cheltuieliNeaprobate.reduce((sum, c) => sum + c.suma_lei, 0);
  const totalDecont =
    diurnaLei === null ? null : diurnaLei + cheltuieliAprobateLei - deplasare.avans_acordat;

  return (
    <div className={cn(LATIMI.formular, "space-y-6 print:max-w-none")}>
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/diurna/${deplasare.id}`} className="text-corp underline underline-offset-2">
          ← Înapoi la fișa deplasării
        </Link>
        <ButonTipar />
      </div>

      <AntetPagina
        className="border-foreground/60 gap-1 border-b pb-4"
        titlu="Decont de deplasare"
        descriere={`Nr. document: ${deplasare.numar_document ?? "(fără număr)"} · Stare: ${ETICHETE_STATUS_DEPLASARE[deplasare.status]}`}
        file={
          <div className="text-muted-foreground text-corp space-y-1">
            <p>
              {angajat === undefined ? "" : `${angajat.full_name ?? "—"} (${angajat.marca}) · `}
              {deplasare.scop}
            </p>
            <p>
              {formatDateTime(new Date(deplasare.plecare_la))} –{" "}
              {formatDateTime(new Date(deplasare.sosire_la))}
              {deplasare.localitate === null ? "" : ` · ${deplasare.localitate}`} ·{" "}
              {ETICHETE_MIJLOC_TRANSPORT[deplasare.mijloc_transport]}
            </p>
          </div>
        }
      />

      <section aria-labelledby="titlu-diurna">
        <h2 id="titlu-diurna" className="text-sectiune mb-2 font-medium">
          Diurnă
        </h2>
        {politica === null ? (
          <p className="text-muted-foreground text-corp">
            Nu există o politică de diurnă valabilă la data plecării.
          </p>
        ) : calcul === null ? null : (
          <p className="text-corp">
            {textZile(calcul.rezultat.zileTotal)} ={" "}
            {diurnaLei === null ? "sumă necunoscută (curs sau barem lipsă)" : formatLei(diurnaLei)}
          </p>
        )}
      </section>

      <section aria-labelledby="titlu-cheltuieli">
        <h2 id="titlu-cheltuieli" className="text-sectiune mb-2 font-medium">
          Cheltuieli aprobate
        </h2>
        {cheltuieliAprobate.length === 0 ? (
          <p className="text-muted-foreground text-corp">
            Nicio cheltuială aprobată — în total intră doar cheltuielile pe care un aprobator le-a
            aprobat pe fișa deplasării.
          </p>
        ) : (
          <TabelCheltuieli
            caption="Cheltuielile aprobate, cuprinse în totalul decontului."
            randuri={cheltuieliAprobate}
          />
        )}
      </section>

      {cheltuieliNeaprobate.length === 0 ? null : (
        <section aria-labelledby="titlu-cheltuieli-neaprobate">
          <h2 id="titlu-cheltuieli-neaprobate" className="text-sectiune mb-2 font-medium">
            Cheltuieli care NU intră în decont
          </h2>
          <TabelCheltuieli
            caption="Cheltuielile respinse sau încă nedecise, în afara totalului."
            randuri={cheltuieliNeaprobate}
            arataMotiv
          />
          <p className="text-muted-foreground text-corp mt-1">
            Total în afara decontului: {formatLei(cheltuieliNeaprobateLei)}.
          </p>
        </section>
      )}

      <section aria-labelledby="titlu-total" className="border-foreground/60 border-t pt-4">
        <h2 id="titlu-total" className="text-sectiune mb-2 font-medium">
          Total decont
        </h2>
        <dl className="text-corp space-y-1">
          <div className="flex justify-between">
            <dt>Diurnă</dt>
            <dd>{diurnaLei === null ? "—" : formatLei(diurnaLei)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Cheltuieli aprobate</dt>
            <dd>{formatLei(cheltuieliAprobateLei)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Avans acordat</dt>
            <dd>− {formatLei(deplasare.avans_acordat)}</dd>
          </div>
          <div className="border-foreground/60 flex justify-between border-t pt-1 font-semibold">
            <dt>Total de decontat</dt>
            <dd>{totalDecont === null ? "necunoscut" : formatLei(totalDecont)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

/**
 * Tabelul de cheltuieli al decontului.
 *
 * Rămâne scris de mână, nu `<Tabel>`: primitiva randează AMBELE marcaje —
 * tabel peste 768px și carduri sub — și ascunde unul prin media query. La
 * tipărire, lățimea de referință e a hârtiei, deci pe foaie ar fi putut ieși
 * varianta de card. Ce lipsea, și se adaugă aici, e marcajul de accesibilitate
 * pe care restul modulului îl are deja: `scope="col"` pe antete și un
 * `<caption>` care spune al cui e tabelul.
 */
function TabelCheltuieli({
  caption,
  randuri,
  arataMotiv = false,
}: {
  readonly caption: string;
  readonly randuri: readonly Readonly<{
    id: string;
    tip: keyof typeof ETICHETE_TIP_CHELTUIALA;
    descriere: string | null;
    data_cheltuielii: string;
    suma_lei: number;
    aprobata: boolean;
    motiv_respingere: string | null;
  }>[];
  readonly arataMotiv?: boolean;
}) {
  return (
    <table className="text-corp w-full">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-foreground/60 border-b text-left">
          <th scope="col" className="py-1 font-medium">
            Tip
          </th>
          <th scope="col" className="py-1 font-medium">
            Data
          </th>
          {arataMotiv ? (
            <th scope="col" className="py-1 font-medium">
              Stare
            </th>
          ) : null}
          <th scope="col" className="py-1 text-right font-medium">
            Lei
          </th>
        </tr>
      </thead>
      <tbody>
        {randuri.map((c) => (
          <tr key={c.id} className="border-border border-b">
            <td className="py-1">
              {ETICHETE_TIP_CHELTUIALA[c.tip]}
              {c.descriere === null ? "" : ` · ${c.descriere}`}
            </td>
            <td className="py-1">{formatDate(c.data_cheltuielii)}</td>
            {arataMotiv ? (
              <td className="py-1">
                {c.motiv_respingere === null
                  ? "În așteptarea deciziei"
                  : `Respinsă: ${c.motiv_respingere}`}
              </td>
            ) : null}
            <td className="py-1 text-right tabular-nums">{formatLei(c.suma_lei)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
