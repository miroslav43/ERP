// src/app/(app)/mentenanta/interventii/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Wrench } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap, type PermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { scrieSortare } from "@/lib/queries/cursor";
import {
  citestePlan,
  echipamenteDupaId,
  interventii,
  angajatiDupaId,
  optiuniAngajati,
  optiuniEchipamente,
  optiuniPlanuriActive,
  planuriDupaId,
  PLAFON_TOTAL_INTERVENTII,
  totalInterventii,
} from "@/lib/queries/maintenance";
import { todayInBucharest } from "@/lib/format/date";
import { filtreInterventiiSchema } from "@/schemas/maintenance";

import {
  ETICHETE_REZULTAT_INTERVENTIE,
  ETICHETE_TIP_MENTENANTA,
  TONURI_REZULTAT_INTERVENTIE,
  textNumarat,
} from "../etichete";
import { DialogInterventieNoua } from "./dialog-interventie-noua";
import { FiltreInterventiiForm } from "./filtre-interventii";
import { FileModul } from "@/components/ui/file-modul";
import { FILE_MENTENANTA } from "@/config/file-module";
import { LinkEntitate } from "@/components/ui/link-entitate";
import { hrefFisaDinHarta } from "@/lib/navigare/fisa";

export const metadata: Metadata = { title: "Intervenții de mentenanță" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelInterventii({
  organizationId,
  parametri,
  permisiuni,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
  readonly permisiuni: PermissionMap;
}) {
  const filtre = filtreDinUrl(filtreInterventiiSchema, parametri);
  // Pagina și totalul din subsol, pe ACELEAȘI filtre (`filtreazaInterventii`).
  const [{ randuri, urmatorulCursor, total, sortare }, totaluri] = await Promise.all([
    interventii(organizationId, filtre),
    totalInterventii(organizationId, filtre),
  ]);
  // Planul executat și executantul: rândul avea `plan_id` și `executant_employee_id`
  // citite, dar nicio coloană nu le arăta și nu le lega.
  const [planuri, executanti] = await Promise.all([
    planuriDupaId(
      organizationId,
      randuri.map((r) => r.plan_id),
    ),
    angajatiDupaId(
      organizationId,
      randuri.map((r) => r.executant_employee_id).filter((id): id is string => id !== null),
    ),
  ]);

  /** Adresele pornesc din parametrii EXISTENȚI: o sortare nu trebuie să șteargă filtrele. */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/mentenanta/interventii" : `/mentenanta/interventii?${p.toString()}`;
  }

  if (randuri.length === 0) {
    const areFiltre =
      filtre.tip !== null ||
      filtre.rezultat !== null ||
      filtre.echipament !== null ||
      filtre.plan !== null ||
      filtre.executant !== null ||
      filtre.de_la !== null ||
      filtre.pana_la !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={Wrench}
        titlu={
          areFiltre ? "Niciun rezultat pentru filtrele alese" : "Nicio intervenție înregistrată"
        }
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate intervențiile."
            : "Intervențiile se adaugă de aici, din fișa fiecărui echipament sau la rezolvarea unei sesizări."
        }
        {...(areFiltre
          ? {
              actiune: {
                eticheta: "Șterge filtrele",
                // Nu `/mentenanta/interventii` gol: butonul ăsta șterge FILTRELE,
                // nu ordinea aleasă din antet și nici mărimea de pagină. `echipament`
                // intră și el, fiindcă textul promite „toate intervențiile”.
                href: adresa((p) => {
                  p.delete("tip");
                  p.delete("rezultat");
                  p.delete("echipament");
                  p.delete("plan");
                  p.delete("executant");
                  p.delete("de_la");
                  p.delete("pana_la");
                  p.delete("cursor");
                }),
              },
            }
          : {})}
      />
    );
  }

  const echipamente = await echipamenteDupaId(
    organizationId,
    randuri.map((r) => r.equipment_id),
  );

  // Rândul e apăsabil (M6): ținta lui e fișa INTERVENȚIEI, care există mereu
  // pentru cine vede lista (aceeași poartă). Titlul e numărul PV-ului; linkul
  // spre echipament rămâne în celula lui, deasupra linkului rândului.
  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "numar",
      antet: "Număr",
      latime: "ingusta",
      peTelefon: "titlu",
      celula: (i) => i.numar,
    },
    {
      cheie: "data",
      antet: "Data",
      sortabil: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (i) => formatDate(i.data),
    },
    {
      cheie: "echipament",
      antet: "Echipament",
      peTelefon: "meta",
      celula: (i) => {
        const echipament = echipamente.get(i.equipment_id);
        return echipament === undefined ? (
          "—"
        ) : (
          <Link
            href={`/mentenanta/echipamente/${i.equipment_id}`}
            className="relative underline-offset-2 hover:underline"
          >
            {echipament.cod} — {echipament.denumire}
          </Link>
        );
      },
    },
    {
      cheie: "tip",
      antet: "Tip",
      sortabil: true,
      peTelefon: "meta",
      celula: (i) => ETICHETE_TIP_MENTENANTA[i.tip],
    },
    {
      cheie: "descriere",
      antet: "Descriere",
      peTelefon: "meta",
      celula: (i) => i.descriere,
    },
    {
      cheie: "plan",
      antet: "Plan",
      peTelefon: "meta",
      celula: (i) => {
        if (i.plan_id === null) return "—";
        const plan = planuri.get(i.plan_id);
        return plan === undefined ? (
          "plan șters"
        ) : (
          <Link
            href={`/mentenanta/planuri/${i.plan_id}`}
            className="relative underline-offset-2 hover:underline"
          >
            {plan.denumire}
          </Link>
        );
      },
    },
    {
      cheie: "executant",
      antet: "Executant",
      peTelefon: "meta",
      celula: (i) =>
        i.executant_extern ?? (
          <LinkEntitate href={hrefFisaDinHarta(i.executant_employee_id, executanti, permisiuni)}>
            {i.executant_employee_id === null
              ? "—"
              : (executanti.get(i.executant_employee_id)?.full_name ?? "—")}
          </LinkEntitate>
        ),
    },
    {
      cheie: "cost",
      antet: "Cost total",
      sortabil: true,
      numeric: true,
      peTelefon: "meta",
      celula: (i) =>
        `${formatLei(i.cost_total ?? i.cost_piese + i.cost_manopera)}${i.acoperit_de_garantie ? " (garanție)" : ""}`,
    },
    {
      cheie: "rezultat",
      antet: "Rezultat",
      sortabil: true,
      peTelefon: "insigna",
      celula: (i) => (
        <Badge ton={TONURI_REZULTAT_INTERVENTIE[i.rezultat]}>
          {ETICHETE_REZULTAT_INTERVENTIE[i.rezultat]}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption="Intervențiile de mentenanță ale organizației."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(i) => i.id}
        href={(i) => `/mentenanta/interventii/${i.id}`}
        trunchiat={totaluri.trunchiat}
        sortare={sortare}
        hrefSortare={(s) =>
          adresa((p) => {
            p.set("sort", scrieSortare(s));
            // Cursorul nu supraviețuiește unei schimbări de sortare: ar continua
            // de la un rând care, în noua ordine, nu mai e acolo unde era.
            p.delete("cursor");
          })
        }
        gol={null}
      />
      {/* Subsolul: totalul pe TOATE rândurile filtrate, nu doar pe pagina afișată. */}
      <p className="text-corp" aria-live="polite">
        Total pe filtrele alese: {textNumarat(totaluri.numar, "intervenție", "intervenții")} ·{" "}
        <strong>{formatLei(totaluri.costTotal)}</strong>
        {totaluri.costInGarantie > 0
          ? `, din care ${formatLei(totaluri.costInGarantie)} acoperiți de garanție`
          : ""}
        {totaluri.trunchiat
          ? ` — doar primele ${String(PLAFON_TOTAL_INTERVENTII)} rânduri; restrângeți perioada pentru cifra completă.`
          : "."}
      </p>
      <Paginare
        afisate={randuri.length}
        total={total}
        cursorUrmator={urmatorulCursor}
        limita={filtre.limita}
        construiesteHref={({ cursor, limita }) =>
          adresa((p) => {
            p.set("limita", String(limita));
            if (cursor === null) p.delete("cursor");
            else p.set("cursor", cursor);
          })
        }
      />
    </div>
  );
}

export default async function PaginaInterventii({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "maintenance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta intervențiile de mentenanță. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  // Aceeași validare ca a tabelului, refăcută aici fiindcă e pură: bara de
  // filtre are nevoie de valorile CURENTE ca să-și scrie pastilele, iar din
  // parametrii bruți ar putea scrie o pastilă cu o valoare inventată din URL.
  const filtre = filtreDinUrl(filtreInterventiiSchema, parametri);

  /*
   * Denumirea echipamentului filtrat, DOAR ca să existe o pastilă cu ieșire.
   * `echipament` e cheia pusă de codul QR de pe utilaj: lista deschisă de pe
   * telefonul cuiva din hală e filtrată la o singură mașină, iar până acum
   * filtrul era invizibil ȘI de neșters — singura ieșire era linkul din starea
   * goală, care apare numai când lista chiar e goală.
   */
  const poateAdauga = can(permisiuni, "maintenance:update", "team");
  // Adresa casetei (`?interventie=noua`), ca la `?echipament=nou` din parc.
  const deschideCaseta = parametri["interventie"] === "noua";

  const [etichetaEchipament, etichetaPlan, executanti, echipamente, planuriActive] =
    await Promise.all([
      filtre.echipament === null
        ? Promise.resolve(null)
        : echipamenteDupaId(tenant.organizationId, [filtre.echipament]).then(
            (m) => m.get(filtre.echipament ?? "")?.cod ?? null,
          ),
      // Același motiv ca mai sus: linkul „Vezi toate intervențiile planului” de pe
      // fișa planului pune `plan=` în adresă, iar fără pastilă filtrul ar fi invizibil.
      filtre.plan === null
        ? Promise.resolve(null)
        : citestePlan(tenant.organizationId, filtre.plan).then((p) => p?.denumire ?? null),
      optiuniAngajati(tenant.organizationId),
      poateAdauga ? optiuniEchipamente(tenant.organizationId) : Promise.resolve([]),
      poateAdauga ? optiuniPlanuriActive(tenant.organizationId) : Promise.resolve([]),
    ]);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Intervenții de mentenanță"
        descriere="Istoricul intervențiilor, cu numărul procesului-verbal, piesele și costurile lor."
        file={<FileModul eticheta="Navigare mentenanță" file={FILE_MENTENANTA} tenant={tenant} />}
        {...(poateAdauga
          ? {
              actiuni: (
                // `key` legat de parametru: o navigare spre `?interventie=noua`
                // rămâne pe aceeași rută, iar `deschisInitial` se citește la montare.
                <DialogInterventieNoua
                  key={deschideCaseta ? "interventie-noua" : "lista"}
                  deschisInitial={deschideCaseta}
                  echipamente={echipamente}
                  planuri={planuriActive}
                  angajati={executanti}
                  azi={todayInBucharest()}
                />
              ),
            }
          : {})}
      />

      <FiltreInterventiiForm
        filtre={filtre}
        executanti={executanti}
        {...(etichetaEchipament === null ? {} : { etichetaEchipament })}
        {...(etichetaPlan === null ? {} : { etichetaPlan })}
      />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={6} />}>
        <TabelInterventii
          organizationId={tenant.organizationId}
          parametri={parametri}
          permisiuni={permisiuni}
        />
      </Suspense>
    </div>
  );
}
