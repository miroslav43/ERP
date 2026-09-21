// src/app/(app)/diurna/politica/page.tsx
import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { formatAmount, formatLei } from "@/lib/format/money";
import { baremLaData } from "@/domain/per-diem/sume";
import {
  baremeleTarilor,
  politiciOrganizatie,
  tari,
  valoriLegaleDiurna,
} from "@/lib/queries/per-diem";

import { ETICHETE_REGULA_TRECERE } from "../etichete";
import { NavDiurna } from "../nav-diurna";
import { BaremuriTari, type RandBaremAfisat } from "./baremuri-tari";
import { FormularPolitica } from "./formular-politica";

export const metadata: Metadata = { title: "Politica de diurnă" };

export default async function PaginaPolitica() {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "per_diem"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "per_diem:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta politica de diurnă. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const poateAproba = can(permisiuni, "per_diem:approve", "team");
  const poateEdita = can(permisiuni, "per_diem:update", "all");

  const [politici, listaTari, valoriLegale] = await Promise.all([
    politiciOrganizatie(tenant.organizationId),
    tari(),
    valoriLegaleDiurna(),
  ]);
  const hartaTari = new Map(listaTari.map((t) => [t.id, t.denumire]));

  // Baremul valabil AZI, categoria II — aceeași pe care o scrie acțiunea în
  // fiecare politică nouă. Țările fără barem nu apar: nu au ce afișa.
  const azi = todayInBucharest();
  const toateBaremurile = await baremeleTarilor(listaTari.map((t) => t.id));
  const baremuri: RandBaremAfisat[] = listaTari.flatMap((t) => {
    const b = baremLaData(toateBaremurile, t.id, "II", azi);
    return b === null
      ? []
      : [{ tara: t.denumire, valoare: b.valoare, moneda: b.moneda, valabilDeLa: b.valabilDeLa }];
  });
  const multiplu =
    [...valoriLegale].sort((a, b) => b.valabil_de_la.localeCompare(a.valabil_de_la))[0]
      ?.multiplu_plafon_neimpozabil ?? null;

  /**
   * Lista se citește ÎNTREAGĂ — `politiciOrganizatie` n-are cursor, fiindcă o
   * firmă are câteva versiuni de politică, nu mii. Fără cursor nu există nici
   * sortare pe antet: un antet care pare sortabil și nu face nimic e mai rău
   * decât unul care nu pare.
   */
  const coloane: readonly Coloana<(typeof politici)[number]>[] = [
    {
      cheie: "denumire",
      antet: "Denumire",
      peTelefon: "titlu",
      celula: (p) => <span className="font-medium">{p.denumire}</span>,
    },
    {
      cheie: "valabila",
      antet: "Valabilă",
      peTelefon: "meta",
      celula: (p) =>
        `${formatDate(p.valabil_de_la)}${
          p.valabil_pana === null ? " – prezent" : ` – ${formatDate(p.valabil_pana)}`
        }`,
    },
    {
      cheie: "tara_interna",
      antet: "Țara internă",
      peTelefon: "meta",
      celula: (p) => hartaTari.get(p.country_id_intern) ?? p.country_id_intern,
    },
    {
      cheie: "diurna_interna",
      antet: "Diurnă internă",
      numeric: true,
      peTelefon: "meta",
      celula: (p) => formatLei(p.diurna_interna_zi),
    },
    {
      cheie: "diurna_externa",
      antet: "Diurnă străinătate",
      numeric: true,
      peTelefon: "meta",
      celula: (p) =>
        p.diurna_externa_zi === null || p.moneda_diurna_externa === null ? (
          <BaremuriTari baremuri={baremuri} multiplu={multiplu}>
            baremul țării
          </BaremuriTari>
        ) : (
          formatAmount(p.diurna_externa_zi, p.moneda_diurna_externa)
        ),
    },
    {
      cheie: "trecere",
      antet: "Trecere frontieră",
      peTelefon: "meta",
      celula: (p) => ETICHETE_REGULA_TRECERE[p.regula_tara_trecere],
    },
  ];

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Politica de diurnă"
        descriere="Politica e versionată: fiecare deplasare se calculează cu versiunea valabilă la data plecării, nu cu cea curentă. Adăugarea unei versiuni noi nu schimbă istoricul."
        file={<NavDiurna poateAproba={poateAproba} />}
      />

      <Tabel
        caption="Versiunile politicii de diurnă, cea mai recentă primă."
        coloane={coloane}
        randuri={politici}
        cheieRand={(p) => p.id}
        gol={
          <StareGoala
            fel="initiala"
            pictograma={Settings}
            titlu="Nicio versiune de politică încă"
            descriere={
              poateEdita
                ? "Fără o politică valabilă la data plecării, nicio deplasare nu poate fi salvată. Configurați prima versiune mai jos."
                : "Organizația nu are încă nicio versiune de politică de diurnă. Cereți administratorului să o configureze."
            }
          />
        }
      />

      {poateEdita ? (
        <FormularPolitica tari={listaTari} valoriLegale={valoriLegale} baremuri={baremuri} />
      ) : (
        <p className="text-muted-foreground text-corp">
          Politica se configurează de administratorii organizației.
        </p>
      )}
    </div>
  );
}
