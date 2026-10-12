import type { Metadata } from "next";
import Link from "next/link";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge, type TonStare } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { FileModul } from "@/components/ui/file-modul";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { FILE_FLOTA } from "@/config/file-module";
import {
  ETICHETE_REGIM_FISCAL,
  ETICHETE_REGIM_IMPOZITARE,
  TEMEI_ART_25,
  mutaLuna,
  verdictLuna,
  type VerdictLuna,
} from "@/domain/fleet/fiscal";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { formatDate, formatMonthYear, todayInBucharest } from "@/lib/format/date";
import { lunaFiscala, regimImpozitareFirma } from "@/lib/queries/flota-fiscal";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { lunaDinParametru } from "@/schemas/flota-fiscal";

import { FormularRegimImpozitare } from "./formular-regim-impozitare";

export const metadata: Metadata = { title: "Fiscal parc auto" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const TON_VERDICT: Readonly<Record<VerdictLuna["ton"], TonStare>> = {
  ok: "succes",
  atentie: "atentie",
  pericol: "pericol",
  neutru: "neutru",
};

function numeLuna(luna: string): string {
  const [an, nr] = luna.split("-").map(Number) as [number, number];
  return formatMonthYear(an, nr);
}

/**
 * Fiscalul parcului auto (0202, F10): regimul de impozitare al firmei și, pe
 * fiecare vehicul, luna judecată după regimul lui de deducere — în special
 * vehiculele cu deducere integrală care n-au nicio foaie de parcurs în lună.
 *
 * Poarta e `vehicles:read = all`, EXACT poarta politicilor tabelelor fiscale:
 * managerul și angajatul văd vehiculele lor, nu regimul fiscal al parcului.
 * Regimul de impozitare se scrie cu `organizations:update = all`.
 *
 * Tot ce se arată aici e SUGESTIE: nu scrie nimic pe statul de plată și nu
 * decide încadrarea în locul contabilului.
 */
export default async function PaginaFiscalFlota({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  const [, permisiuni, parametri] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    searchParams,
  ]);

  if (!can(permisiuni, "vehicles:read", "all")) {
    return (
      <AccesRestrictionat mesaj="Fiscalul parcului auto îl văd cei care administrează tot parcul. Fiecare vehicul își arată regimul fiscal pe fișa lui, doar pentru ei." />
    );
  }

  const azi = todayInBucharest();
  const lunaCurenta = azi.slice(0, 7);
  const luna = lunaDinParametru(
    typeof parametri["luna"] === "string" ? parametri["luna"] : undefined,
    lunaCurenta,
  );
  const poateSchimbaRegimul = can(permisiuni, "organizations:update", "all");

  const [randuri, regimImpozitare] = await Promise.all([
    lunaFiscala(tenant.organizationId, luna),
    regimImpozitareFirma(tenant.organizationId),
  ]);
  const cuVerdict = randuri.map((rand) => ({ rand, verdict: verdictLuna(rand) }));
  const faraFoi = cuVerdict.filter((x) => x.verdict.stare === "fara_foi");

  const coloane: readonly Coloana<(typeof cuVerdict)[number]>[] = [
    {
      cheie: "vehicul",
      antet: "Vehicul",
      peTelefon: "titlu",
      celula: ({ rand }) => (
        <>
          <Link
            href={`/flota/${rand.vehicle_id}#fiscal`}
            className="font-medium underline-offset-2 hover:underline"
          >
            {rand.nr_inmatriculare}
          </Link>
          <span className="text-muted-foreground text-nota block">
            {rand.marca} {rand.model}
          </span>
        </>
      ),
    },
    {
      cheie: "regim",
      antet: "Regim la sfârșitul lunii",
      peTelefon: "meta",
      celula: ({ rand }) =>
        rand.regim === null ? (
          <span className="text-muted-foreground">Nestabilit</span>
        ) : (
          <>
            {ETICHETE_REGIM_FISCAL[rand.regim]}
            {rand.regim_de_la === null ? null : (
              <span className="text-muted-foreground text-nota block">
                din {formatDate(rand.regim_de_la)}
              </span>
            )}
          </>
        ),
    },
    {
      cheie: "zile",
      antet: "Zile cu deducere integrală",
      numeric: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: ({ rand }) => `${String(rand.zile_integral)} din ${String(rand.zile_luna)}`,
    },
    {
      cheie: "norma",
      antet: "Normă (l/100 km)",
      numeric: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: ({ rand }) =>
        rand.norma_l_100km === null ? "—" : rand.norma_l_100km.toLocaleString("ro-RO"),
    },
    {
      cheie: "foi",
      antet: "Foi în lună",
      peTelefon: "meta",
      celula: ({ rand }) => (
        <>
          {String(rand.foi_aprobate)} aprobate
          {rand.foi_neaprobate === 0 ? null : (
            <span className="text-muted-foreground text-nota block">
              {String(rand.foi_neaprobate)} neaprobate
            </span>
          )}
          {rand.km_aprobati === 0 ? null : (
            <span className="text-muted-foreground text-nota block">
              {rand.km_aprobati.toLocaleString("ro-RO")} km
            </span>
          )}
        </>
      ),
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: ({ verdict }) => (
        <>
          <Badge ton={TON_VERDICT[verdict.ton]}>
            {verdict.stare === "fara_foi"
              ? "Fără foi"
              : verdict.stare === "foi_neaprobate"
                ? "De aprobat"
                : verdict.stare === "acoperit"
                  ? "Acoperit"
                  : verdict.stare === "limitat"
                    ? "Deducere 50%"
                    : "Regim nestabilit"}
          </Badge>
          <span className="text-muted-foreground text-nota mt-1 block">{verdict.mesaj}</span>
        </>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Fiscal parc auto"
        descriere="Regimul de deducere al fiecărui vehicul și ce cere el de la foile de parcurs, luna cu zilele numărate după regimul în vigoare, plus regimul de impozitare al firmei."
        file={<FileModul eticheta="Navigare parc auto" file={FILE_FLOTA} tenant={tenant} />}
      />

      <Callout fel="informativ" titlu="Sugestii, nu încadrări">
        <p>
          {TEMEI_ART_25}: cheltuielile vehiculelor folosite și în alt scop decât cel economic sunt
          deductibile 50%, cu excepțiile din lege; deducerea integrală se justifică, între altele,
          prin foaia de parcurs. Încadrarea o face firma, nu aplicația: valorile și verdictele de pe
          această pagină se confirmă cu contabilul.
        </p>
      </Callout>

      <section aria-labelledby="titlu-regim-impozitare" className="space-y-3">
        <h2 id="titlu-regim-impozitare" className="text-sectiune font-semibold">
          Regimul de impozitare al firmei
        </h2>
        {poateSchimbaRegimul ? (
          <div className={LATIMI.formular}>
            <FormularRegimImpozitare regimCurent={regimImpozitare} />
          </div>
        ) : (
          <p className="text-corp">
            {regimImpozitare === null
              ? "Nestabilit. Îl completează administratorul organizației."
              : ETICHETE_REGIM_IMPOZITARE[regimImpozitare]}
          </p>
        )}
      </section>

      <section aria-labelledby="titlu-luna-fiscala" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titlu-luna-fiscala" className="text-sectiune font-semibold">
            Luna fiscală: {numeLuna(luna)}
          </h2>
          <nav aria-label="Luna fiscală" className="flex flex-wrap items-center gap-2">
            <Link
              href={`/flota/fiscal?luna=${mutaLuna(luna, -1)}`}
              className={buton({ varianta: "secundar" })}
            >
              {numeLuna(mutaLuna(luna, -1))}
            </Link>
            {luna === lunaCurenta ? null : (
              <Link href="/flota/fiscal" className={buton({ varianta: "secundar" })}>
                Luna curentă
              </Link>
            )}
            <Link
              href={`/flota/fiscal?luna=${mutaLuna(luna, 1)}`}
              className={buton({ varianta: "secundar" })}
            >
              {numeLuna(mutaLuna(luna, 1))}
            </Link>
          </nav>
        </div>

        {faraFoi.length === 0 ? null : (
          <Callout
            fel="atentie"
            titlu={
              faraFoi.length === 1
                ? "Un vehicul cu deducere integrală și nicio foaie în lună"
                : `${String(faraFoi.length)} vehicule cu deducere integrală și nicio foaie în lună`
            }
          >
            <p>
              {faraFoi.map(({ rand }) => rand.nr_inmatriculare).join(", ")}. Deducerea integrală se
              justifică prin foaia de parcurs: fără ea, cheltuielile lunii riscă să nu fie
              deductibile integral.
            </p>
          </Callout>
        )}

        <Tabel
          caption={`Vehiculele parcului în ${numeLuna(luna)}, cu regimul fiscal, norma și foile lunii.`}
          coloane={coloane}
          randuri={cuVerdict}
          cheieRand={({ rand }) => rand.vehicle_id}
          gol={
            <p className="text-muted-foreground text-corp">
              Niciun vehicul în parc în luna aceasta.
            </p>
          }
        />
        <p className="text-muted-foreground text-nota">
          Zilele se numără după regimul în vigoare în fiecare zi, dar foile se numără pe luna
          întreagă: „Fără foi” înseamnă nicio foaie în lună, nu o zi fără foaie. Ciornele și foile
          trimise apar ca neaprobate, iar cele respinse nu se numără.
        </p>
      </section>
    </div>
  );
}
