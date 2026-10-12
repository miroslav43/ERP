// src/app/(app)/mentenanta/interventii/[id]/page.tsx
//
// Fișa intervenției (M6). Până aici intervenția era un rând neclicabil într-o
// listă: nu se putea corecta, anula, nu avea piese, documente sau proces-verbal.
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { IstoricModificari } from "@/components/audit/istoric-modificari";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { LinkEntitate } from "@/components/ui/link-entitate";
import { ListaDefinitii, type Definitie } from "@/components/ui/lista-definitii";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { hrefFisaDinHarta } from "@/lib/navigare/fisa";
import { idDinRuta } from "@/lib/rute/parametri";
import {
  angajatiDupaId,
  atasamente,
  citesteInterventie,
  citestePlan,
  citesteSesizare,
  echipamenteDupaId,
  optiuniAngajati,
  piesePeInterventie,
  urlSemnate,
  type PiesaInterventie,
  type RandInterventie,
} from "@/lib/queries/maintenance";
import { TIPURI_ATASAMENT_INTERVENTIE } from "@/schemas/maintenance";

import { DocumenteEchipament } from "../../echipamente/[id]/documente-echipament";
import { IncarcareDocument } from "../../echipamente/[id]/incarcare-document";
import {
  ETICHETE_REZULTAT_INTERVENTIE,
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_TIP_MENTENANTA,
  TONURI_REZULTAT_INTERVENTIE,
  formatCifraContor,
} from "../../etichete";
import { formatDurataMinute } from "../../durata";
import { ActiuniInterventie } from "./actiuni-interventie";
import { ButonStergePiesa, DialogPiesaNoua } from "./piese-interventie";

export const metadata: Metadata = { title: "Intervenție de mentenanță" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

/** Valorile intervenției ca text, în forma din `FormData` — sămânța casetei de corectare. */
function valoriExistente(i: RandInterventie): Readonly<Record<string, string>> {
  const t = (v: string | number | null): string => (v === null ? "" : String(v));
  return {
    tip: i.tip,
    data: i.data,
    ora_start: t(i.ora_start === null ? null : i.ora_start.slice(0, 5)),
    durata_ore: t(i.durata_ore),
    executant_employee_id: t(i.executant_employee_id),
    executant_extern: t(i.executant_extern),
    descriere: i.descriere,
    piese: t(i.piese),
    cost_piese: String(i.cost_piese),
    cost_manopera: String(i.cost_manopera),
    rezultat: i.rezultat,
    oprire_minute: t(i.oprire_minute),
    citire_contor: t(i.citire_contor),
    observatii: t(i.observatii),
    numar_document_furnizor: t(i.numar_document_furnizor),
    garantie_lucrare_pana: t(i.garantie_lucrare_pana),
    acoperit_de_garantie: i.acoperit_de_garantie ? "on" : "",
  };
}

export default async function PaginaInterventie({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);
  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "maintenance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta intervențiile de mentenanță. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const interventie = await citesteInterventie(tenant.organizationId, id);
  if (interventie === null) notFound();

  const poateScrie = can(permisiuni, "maintenance:update", "team");
  const azi = todayInBucharest();

  const [echipamente, plan, sesizare, executanti, piese, documente, angajati] = await Promise.all([
    echipamenteDupaId(tenant.organizationId, [interventie.equipment_id]),
    interventie.plan_id === null
      ? Promise.resolve(null)
      : citestePlan(tenant.organizationId, interventie.plan_id),
    interventie.fault_report_id === null
      ? Promise.resolve(null)
      : citesteSesizare(tenant.organizationId, interventie.fault_report_id),
    angajatiDupaId(
      tenant.organizationId,
      interventie.executant_employee_id === null ? [] : [interventie.executant_employee_id],
    ),
    piesePeInterventie(tenant.organizationId, interventie.id),
    atasamente(tenant.organizationId, "intervention", interventie.id),
    poateScrie ? optiuniAngajati(tenant.organizationId) : Promise.resolve([]),
  ]);
  const urluri = await urlSemnate(documente);

  const echipament = echipamente.get(interventie.equipment_id);
  const dinLinii = piese.length > 0;
  const garantieInCurs =
    interventie.garantie_lucrare_pana !== null && interventie.garantie_lucrare_pana >= azi;
  const legala = interventie.tip === "verificare_legala" || plan?.tip === "verificare_legala";
  const arePv = documente.some((d) => d.tip === "pv" || d.tip === "buletin");

  const date: Definitie[] = [
    {
      eticheta: "Echipament",
      valoare:
        echipament === undefined ? null : (
          <Link
            href={`/mentenanta/echipamente/${interventie.equipment_id}`}
            className="underline-offset-2 hover:underline"
          >
            {echipament.cod} — {echipament.denumire}
          </Link>
        ),
    },
    { eticheta: "Tip", valoare: ETICHETE_TIP_MENTENANTA[interventie.tip] },
    {
      eticheta: "Data",
      valoare: `${formatDate(interventie.data)}${interventie.ora_start === null ? "" : `, ora ${interventie.ora_start.slice(0, 5)}`}`,
    },
    {
      eticheta: "Durata",
      valoare:
        interventie.durata_ore === null
          ? null
          : formatDurataMinute(Math.round(interventie.durata_ore * 60)),
    },
    {
      eticheta: "Executant",
      valoare:
        interventie.executant_extern ??
        (interventie.executant_employee_id === null ? null : (
          <LinkEntitate
            href={hrefFisaDinHarta(interventie.executant_employee_id, executanti, permisiuni)}
          >
            {executanti.get(interventie.executant_employee_id)?.full_name ?? "—"}
          </LinkEntitate>
        )),
    },
    {
      eticheta: "Rezultat",
      valoare: (
        <Badge ton={TONURI_REZULTAT_INTERVENTIE[interventie.rezultat]}>
          {ETICHETE_REZULTAT_INTERVENTIE[interventie.rezultat]}
        </Badge>
      ),
    },
    {
      eticheta: "Din planul",
      valoare:
        interventie.plan_id === null ? (
          "Intervenție de sine stătătoare"
        ) : plan === null ? (
          "plan șters"
        ) : (
          <Link
            href={`/mentenanta/planuri/${plan.id}`}
            className="underline-offset-2 hover:underline"
          >
            {plan.denumire}
          </Link>
        ),
    },
    {
      eticheta: "Sesizarea",
      valoare:
        interventie.fault_report_id === null ? null : sesizare === null ? (
          "sesizare indisponibilă"
        ) : (
          <Link
            href={`/mentenanta/sesizari/${sesizare.id}`}
            className="underline-offset-2 hover:underline"
          >
            {sesizare.numar} · {ETICHETE_STATUS_SESIZARE[sesizare.status]}
          </Link>
        ),
    },
    {
      eticheta: "Citire contor",
      valoare:
        interventie.citire_contor === null ? null : formatCifraContor(interventie.citire_contor),
    },
    {
      eticheta: "Oprire",
      valoare:
        interventie.oprire_minute === null || interventie.oprire_minute === 0
          ? null
          : formatDurataMinute(interventie.oprire_minute),
    },
    { eticheta: "Nr. document furnizor", valoare: interventie.numar_document_furnizor },
    {
      eticheta: "Garanția lucrării",
      valoare:
        interventie.garantie_lucrare_pana === null
          ? null
          : `până la ${formatDate(interventie.garantie_lucrare_pana)}${garantieInCurs ? " (în curs)" : " (expirată)"}`,
    },
    { eticheta: "Ce s-a făcut", valoare: interventie.descriere, lat: true },
    { eticheta: "Piese (text liber)", valoare: interventie.piese, lat: true },
    { eticheta: "Observații", valoare: interventie.observatii, lat: true },
  ];

  const costuri: Definitie[] = [
    {
      eticheta: dinLinii ? "Piese (calculat din piese)" : "Piese",
      valoare: formatLei(interventie.cost_piese),
    },
    { eticheta: "Manoperă", valoare: formatLei(interventie.cost_manopera) },
    {
      eticheta: "Total",
      valoare: formatLei(
        interventie.cost_total ?? interventie.cost_piese + interventie.cost_manopera,
      ),
    },
    {
      eticheta: "Acoperit de garanție",
      valoare: interventie.acoperit_de_garantie ? "Da — se raportează separat" : "Nu",
    },
  ];

  const coloanePiese: readonly Coloana<PiesaInterventie>[] = [
    { cheie: "denumire", antet: "Piesă", peTelefon: "titlu", celula: (p) => p.denumire },
    { cheie: "cod", antet: "Cod", peTelefon: "meta", celula: (p) => p.cod ?? "—" },
    {
      cheie: "cantitate",
      antet: "Cantitate",
      numeric: true,
      peTelefon: "meta",
      celula: (p) => `${formatCifraContor(p.cantitate)} ${p.unitate}`,
    },
    {
      cheie: "pret",
      antet: "Preț unitar",
      numeric: true,
      peTelefon: "meta",
      celula: (p) => formatLei(p.pret_unitar),
    },
    {
      cheie: "valoare",
      antet: "Valoare",
      numeric: true,
      peTelefon: "insigna",
      celula: (p) => formatLei(p.valoare ?? 0),
    },
    ...(poateScrie
      ? [
          {
            cheie: "actiuni",
            antet: "Acțiuni",
            antetAscuns: true,
            latime: "ingusta" as const,
            peTelefon: "actiuni" as const,
            celula: (p: PiesaInterventie) => (
              <ButonStergePiesa id={p.id} denumire={p.denumire} ultima={piese.length === 1} />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-8">
      <AntetPagina
        firimituri={[
          { eticheta: "Intervenții", href: "/mentenanta/interventii" },
          { eticheta: interventie.numar },
        ]}
        titlu={`Intervenția ${interventie.numar}`}
        descriere={`${ETICHETE_TIP_MENTENANTA[interventie.tip]} din ${formatDate(interventie.data)}${echipament === undefined ? "" : ` · ${echipament.cod} — ${echipament.denumire}`}`}
        actiuni={
          <Link
            href={`/mentenanta/interventii/${interventie.id}/proces-verbal`}
            className={buton({ varianta: "secundar" })}
          >
            <FileText aria-hidden="true" className="size-4" />
            Proces-verbal
          </Link>
        }
      />

      {/* Corectarea și anularea stau sub antet: antetul ține cel mult două acțiuni. */}
      {poateScrie ? (
        <ActiuniInterventie
          id={interventie.id}
          numar={interventie.numar}
          denumirePlan={plan?.denumire ?? null}
          existenta={valoriExistente(interventie)}
          costPieseDinLinii={dinLinii}
          angajati={angajati}
        />
      ) : null}

      {legala && !arePv ? (
        <Callout fel="atentie" titlu="Verificare legală fără proces-verbal">
          O verificare legală se dovedește la control prin procesul-verbal sau buletinul ei.
          {poateScrie
            ? " Atașați-l mai jos."
            : " Cereți-i responsabilului de mentenanță să-l atașeze."}
        </Callout>
      ) : null}

      <section aria-labelledby="interventie-date" className="space-y-3">
        <h2 id="interventie-date" className="text-sectiune font-semibold">
          Date
        </h2>
        <ListaDefinitii definitii={date} textNecompletat="—" coloane={3} />
      </section>

      <section aria-labelledby="interventie-costuri" className="space-y-3">
        <h2 id="interventie-costuri" className="text-sectiune font-semibold">
          Costuri
        </h2>
        <ListaDefinitii definitii={costuri} textNecompletat="—" coloane={4} />
      </section>

      <section aria-labelledby="interventie-piese" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="interventie-piese" className="text-sectiune font-semibold">
            Piese folosite
          </h2>
          {poateScrie ? <DialogPiesaNoua interventionId={interventie.id} /> : null}
        </div>
        <Tabel
          caption="Liniile de piese ale intervenției."
          coloane={coloanePiese}
          randuri={piese}
          cheieRand={(p) => p.id}
          gol={
            <p className="text-muted-foreground text-corp">
              Nicio linie de piese. Costul pieselor e cel scris pe intervenție
              {interventie.piese === null ? "." : ", iar piesele sunt descrise în text."}
            </p>
          }
        />
      </section>

      <section aria-labelledby="interventie-documente" className="space-y-3">
        <h2 id="interventie-documente" className="text-sectiune font-semibold">
          Documente
        </h2>
        <DocumenteEchipament
          atasamente={documente}
          urluri={urluri}
          poateSterge={poateScrie}
          textGol="Niciun document. Procesul-verbal semnat, buletinul de verificare sau factura furnizorului se păstrează aici."
        />
        {poateScrie ? (
          <IncarcareDocument
            entityType="intervention"
            entityId={interventie.id}
            tipuri={TIPURI_ATASAMENT_INTERVENTIE}
            tipImplicit="pv"
          />
        ) : null}
      </section>

      <IstoricModificari tenant={tenant} entityId={interventie.id} />
    </div>
  );
}
