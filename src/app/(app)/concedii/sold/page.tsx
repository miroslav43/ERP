// src/app/(app)/concedii/sold/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { History, PiggyBank } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { Nivel } from "@/components/ui/nivel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatAmount } from "@/lib/format/money";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import {
  grupeazaSoldDupaAngajat,
  imperecheazaSold,
  istoricSold,
  soldAnual,
  type EvenimentIstoricSold,
  type RandSold,
  type SoldTip,
  type TipConcediu,
} from "@/lib/queries/leave";

import { NavConcedii } from "../nav-concedii";
import { anDinUrl } from "@/lib/rute/parametri";

export const metadata: Metadata = { title: "Soldul de concediu" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface AngajatMinim {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
}

const ETICHETE_EVENIMENT: Readonly<Record<string, string>> = {
  drept_initial: "Drept anual inițial",
  acumulare_lunara: "Acumulare lunară",
  reportare: "Reportare din anul precedent",
  expirare_reportate: "Expirarea zilelor reportate",
  consum: "Consum",
  restituire: "Restituire",
  ajustare_manuala: "Ajustare manuală",
  corectie_incadrare: "Corecție de încadrare",
};

const COLOANE_SOLD: readonly Coloana<RandSold>[] = [
  {
    cheie: "tip",
    antet: "Tip de concediu",
    peTelefon: "titlu",
    celula: ({ tip }) => (
      <>
        <span
          className="mr-2 inline-block size-2.5 rounded-full align-middle"
          style={{ backgroundColor: tip.culoare }}
          aria-hidden="true"
        />
        {tip.denumire}
      </>
    ),
  },
  {
    cheie: "drept_anual",
    antet: "Drept anual",
    numeric: true,
    peTelefon: "meta",
    celula: ({ tip, sold }) => formatAmount(sold?.drept_anual ?? tip.zile_implicite),
  },
  {
    cheie: "reportate",
    antet: "Reportate",
    numeric: true,
    peTelefon: "meta",
    celula: ({ sold }) => formatAmount(sold?.reportate ?? 0),
  },
  {
    cheie: "folosite",
    antet: "Folosite",
    numeric: true,
    peTelefon: "meta",
    celula: ({ sold }) => formatAmount(sold?.folosite ?? 0),
  },
  {
    cheie: "in_asteptare",
    antet: "În așteptare",
    numeric: true,
    peTelefon: "meta",
    celula: ({ sold }) => formatAmount(sold?.in_asteptare ?? 0),
  },
  {
    cheie: "consum",
    antet: "Consum",
    // Ascunsă pe telefon: cifrele sunt oricum în rândul de metadate al cardului,
    // iar o bară de 4px într-o listă separată prin „·" n-ar fi lizibilă.
    peTelefon: "ascuns",
    celula: ({ tip, sold }) => {
      const cuvenite = (sold?.drept_anual ?? tip.zile_implicite) + (sold?.reportate ?? 0);
      const angajate = (sold?.folosite ?? 0) + (sold?.in_asteptare ?? 0);
      if (cuvenite <= 0 && angajate <= 0) return null;
      return (
        <Nivel
          valoare={angajate}
          din={cuvenite}
          marime="subtire"
          eticheta={`Zile angajate din ${tip.denumire}`}
          // `ton="neutru"`, nu „rău": la zile de concediu LUATE, mult nu e rău —
          // e chiar scopul concediului. Doar depășirea se distinge, și o face
          // primitiva prin formă, nu prin culoare.
          ton="neutru"
          text={`${formatAmount(angajate)} zile angajate din ${formatAmount(cuvenite)} cuvenite`}
        />
      );
    },
  },
  {
    cheie: "ramase",
    antet: "Rămase",
    numeric: true,
    peTelefon: "meta",
    celula: ({ sold }) => (
      <span className="font-medium">
        {sold === null || sold === undefined
          ? "fără mișcări în acest an"
          : formatAmount(sold.ramase ?? 0)}
      </span>
    ),
  },
];

function TabelTipuri({
  randuri,
  caption,
}: {
  readonly randuri: readonly RandSold[];
  readonly caption: string;
}) {
  return (
    <Tabel
      caption={caption}
      coloane={COLOANE_SOLD}
      randuri={randuri}
      cheieRand={({ tip }) => tip.id}
      densitate="compact"
      gol={null}
    />
  );
}

function SelectorAn({ an }: { readonly an: number }) {
  return (
    <nav aria-label="Anul soldului" className="text-corp flex items-center gap-3">
      <Link href={`/concedii/sold?an=${String(an - 1)}`} className="underline underline-offset-2">
        {an - 1}
      </Link>
      <span className="font-semibold">{an}</span>
      <Link href={`/concedii/sold?an=${String(an + 1)}`} className="underline underline-offset-2">
        {an + 1}
      </Link>
    </nav>
  );
}

export default async function PaginaSoldConcediu({ searchParams }: ProprietatiPagina) {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "leave");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "leave:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta soldul de concediu. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const scope: "own" | "team" | "all" = can(permisiuni, "leave:read", "all")
    ? "all"
    : can(permisiuni, "leave:read", "team")
      ? "team"
      : "own";
  const poateAproba = can(permisiuni, "leave:approve", "team");
  const poateVedeaCalendar = can(permisiuni, "leave:read", "team");

  const parametri = await searchParams;
  const an = anDinUrl(parametri["an"], Number(todayInBucharest().slice(0, 4)));

  const { tipuri, solduri } = await soldAnual(tenant.organizationId, an);

  // Fișa proprie: chiar și cu `employees:read = team`, o fișă se conține pe
  // sine în propriul `manager_path`, deci lectura trece de RLS pentru orice
  // rol care are cel puțin scope „team” pe `employees:read`. Pentru „own”
  // (rolul `employee`, `employees:read = none`) rămâne `null` — și e corect.
  const db = await createServerSupabase();
  const { data: fisaProprie } = await db
    .from("employees")
    .select("id")
    .eq("organization_id", tenant.organizationId)
    .eq("user_id", user.id)
    .eq("is_primary", true)
    .is("deleted_at", null)
    .maybeSingle<{ id: string }>();

  const { randuri: istoric, trunchiat: istoricTrunchiat } = await istoricSold(
    tenant.organizationId,
    an,
  );

  // Numele mișcărilor din istoric. Se citesc DOAR peste scope „own”: pentru cine
  // vede numai propriul sold, toate liniile sunt ale lui și o coloană „Angajat”
  // ar repeta același nume de N ori.
  let hartaAngajatiIstoric = new Map<string, AngajatMinim>();
  if (scope !== "own" && istoric.length > 0) {
    const idAngajatiIstoric = [...new Set(istoric.map((rand) => rand.employee_id))];
    const { data: angajatiIstoric } = await db
      .from("employees")
      .select("id, full_name, marca")
      .eq("organization_id", tenant.organizationId)
      .in("id", idAngajatiIstoric)
      .returns<AngajatMinim[]>();
    hartaAngajatiIstoric = new Map((angajatiIstoric ?? []).map((a) => [a.id, a]));
  }

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Soldul de concediu"
        descriere={
          scope === "own"
            ? "Soldul dumneavoastră de zile de concediu, pe tip."
            : "Soldul de zile de concediu al angajaților vizibili pentru dvs., pe tip."
        }
        actiuni={<SelectorAn an={an} />}
        file={
          <NavConcedii
            poateVedeaEchipa={poateVedeaCalendar}
            poateAproba={poateAproba}
            poateVedeaCalendar={poateVedeaCalendar}
          />
        }
      />

      {tipuri.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={PiggyBank}
          titlu="Niciun tip de concediu configurat"
          descriere="Organizația nu are încă niciun tip de concediu activ. Contactați administratorul."
        />
      ) : scope === "own" ? (
        <TabelTipuri
          randuri={imperecheazaSold(tipuri, solduri)}
          caption="Soldul de zile de concediu, pe tip."
        />
      ) : (
        <SectiuniPeAngajat
          organizationId={tenant.organizationId}
          tipuri={tipuri}
          solduri={solduri}
        />
      )}

      <section aria-labelledby="titlu-istoric" className="border-border rounded-panou border p-4">
        <h2 id="titlu-istoric" className="text-sectiune mb-4 font-medium">
          Istoricul soldului {String(an)}
        </h2>
        {istoric.length === 0 ? (
          <StareGoala
            compact
            // Aceeași listă goală, două cauze diferite: ori nu s-a mișcat nimic,
            // ori nu aveți dreptul să vedeți mișcările.
            fel={scope === "all" || fisaProprie !== null ? "initiala" : "restrictionata"}
            pictograma={History}
            titlu={
              scope === "all" || fisaProprie !== null
                ? "Niciun rând de istoric"
                : "Istoric indisponibil"
            }
            descriere={
              scope === "all" || fisaProprie !== null
                ? "Fără mișcări de sold înregistrate în acest an."
                : "Istoricul detaliat este vizibil doar pentru soldul propriu sau pentru rolurile cu citire extinsă asupra concediilor."
            }
          />
        ) : (
          <IstoricTabel
            randuri={istoric}
            tipuri={tipuri}
            an={an}
            trunchiat={istoricTrunchiat}
            angajati={scope === "own" ? null : hartaAngajatiIstoric}
          />
        )}
      </section>
    </div>
  );
}

async function SectiuniPeAngajat({
  organizationId,
  tipuri,
  solduri,
}: {
  readonly organizationId: string;
  readonly tipuri: readonly TipConcediu[];
  readonly solduri: readonly SoldTip[];
}) {
  const grupuri = grupeazaSoldDupaAngajat(solduri);
  if (grupuri.size === 0) {
    return (
      <StareGoala
        compact
        fel="initiala"
        pictograma={PiggyBank}
        titlu="Niciun sold pentru anul acesta"
        descriere="Nu există încă niciun rând de sold pentru anul acesta, pentru angajații vizibili dumneavoastră."
      />
    );
  }

  const idAngajati = [...grupuri.keys()];
  const db = await createServerSupabase();
  const { data } = await db
    .from("employees")
    .select("id, full_name, marca")
    .eq("organization_id", organizationId)
    .in("id", idAngajati)
    .returns<AngajatMinim[]>();
  const hartaAngajati = new Map((data ?? []).map((a) => [a.id, a]));

  return (
    <div className="space-y-6">
      {idAngajati.map((employeeId) => {
        const angajat = hartaAngajati.get(employeeId);
        const randuri = imperecheazaSold(tipuri, grupuri.get(employeeId) ?? []);
        return (
          <div key={employeeId}>
            <h3 className="text-corp mb-2 font-semibold">
              {angajat === undefined ? "Angajat" : `${angajat.full_name} (${angajat.marca})`}
            </h3>
            <TabelTipuri
              randuri={randuri}
              caption={`Soldul de zile de concediu al angajatului ${
                angajat === undefined ? "necunoscut" : angajat.full_name
              }, pe tip.`}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Rândurile append-only nu au `id` în select (plan de interogare), iar `Tabel`
 * cere o cheie stabilă — se atașează indexul, stabil pentru o listă needitabilă.
 */
type RandIstoric = EvenimentIstoricSold & { readonly cheie: string };

function IstoricTabel({
  randuri,
  tipuri,
  an,
  trunchiat,
  angajati,
}: {
  readonly randuri: readonly EvenimentIstoricSold[];
  readonly tipuri: readonly TipConcediu[];
  readonly an: number;
  readonly trunchiat: boolean;
  /** `null` pentru scope „own”: coloana „Angajat” n-are ce distinge acolo. */
  readonly angajati: ReadonlyMap<string, AngajatMinim> | null;
}) {
  const hartaTipuri = new Map(tipuri.map((t) => [t.id, t]));
  const randuriIndexate: readonly RandIstoric[] = randuri.map((rand, index) => ({
    ...rand,
    cheie: String(index),
  }));

  // Prima coloană, nu ultima: peste scope „own” e singura care spune a cui e
  // linia, iar pe telefon devine titlul cardului.
  const coloanaAngajat: readonly Coloana<RandIstoric>[] =
    angajati === null
      ? []
      : [
          {
            cheie: "angajat",
            antet: "Angajat",
            peTelefon: "titlu",
            celula: (rand) => {
              const angajat = angajati.get(rand.employee_id);
              return angajat === undefined ? "—" : `${angajat.full_name} (${angajat.marca})`;
            },
          },
        ];

  const coloane: readonly Coloana<RandIstoric>[] = [
    ...coloanaAngajat,
    {
      cheie: "eveniment",
      antet: "Eveniment",
      peTelefon: angajati === null ? "titlu" : "meta",
      celula: (rand) => ETICHETE_EVENIMENT[rand.eveniment] ?? rand.eveniment,
    },
    {
      cheie: "data",
      antet: "Data",
      peTelefon: "meta",
      celula: (rand) => formatDate(rand.data_eveniment),
    },
    {
      cheie: "tip",
      antet: "Tip",
      peTelefon: "meta",
      celula: (rand) => hartaTipuri.get(rand.leave_type_id)?.denumire ?? "—",
    },
    {
      cheie: "delta",
      antet: "Variație",
      numeric: true,
      peTelefon: "meta",
      celula: (rand) => (
        <span className={rand.delta < 0 ? "text-danger" : ""}>
          {rand.delta > 0 ? "+" : ""}
          {formatAmount(rand.delta)}
        </span>
      ),
    },
    {
      cheie: "sold_dupa",
      antet: "Sold după",
      numeric: true,
      peTelefon: "meta",
      celula: (rand) => (rand.sold_dupa === null ? "—" : formatAmount(rand.sold_dupa)),
    },
    {
      cheie: "motiv",
      antet: "Motiv",
      peTelefon: "meta",
      celula: (rand) => rand.motiv,
    },
  ];

  return (
    <Tabel
      caption={`Istoricul mișcărilor de sold din anul ${String(an)}.`}
      coloane={coloane}
      randuri={randuriIndexate}
      cheieRand={(rand) => rand.cheie}
      densitate="compact"
      trunchiat={trunchiat}
      gol={null}
    />
  );
}
