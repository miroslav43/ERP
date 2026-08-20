// src/app/(app)/concedii/sold/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { PiggyBank } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
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

function TabelTipuri({ randuri }: { readonly randuri: readonly RandSold[] }) {
  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface text-foreground">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              Tip de concediu
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Drept anual
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Reportate
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Folosite
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              În așteptare
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Rămase
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {randuri.map(({ tip, sold }) => (
            <tr key={tip.id}>
              <td className="px-4 py-2">
                <span
                  className="mr-2 inline-block size-2.5 rounded-full align-middle"
                  style={{ backgroundColor: tip.culoare }}
                  aria-hidden="true"
                />
                {tip.denumire}
              </td>
              <td className="px-4 py-2 tabular-nums">
                {formatAmount(sold?.drept_anual ?? tip.zile_implicite)}
              </td>
              <td className="px-4 py-2 tabular-nums">{formatAmount(sold?.reportate ?? 0)}</td>
              <td className="px-4 py-2 tabular-nums">{formatAmount(sold?.folosite ?? 0)}</td>
              <td className="px-4 py-2 tabular-nums">{formatAmount(sold?.in_asteptare ?? 0)}</td>
              <td className="px-4 py-2 font-medium tabular-nums">
                {sold === null || sold === undefined
                  ? "fără mișcări în acest an"
                  : formatAmount(sold.ramase ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SelectorAn({ an }: { readonly an: number }) {
  return (
    <nav aria-label="Anul soldului" className="flex items-center gap-3 text-sm">
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
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

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
  const poateConfigura = can(permisiuni, "leave:update", "all");

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

  const istoric = await istoricSold(tenant.organizationId, an);

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Soldul de concediu</h1>
          <p className="text-muted-foreground text-sm">
            {scope === "own"
              ? "Soldul dumneavoastră de zile de concediu, pe tip."
              : "Soldul de zile de concediu al angajaților vizibili pentru dvs., pe tip."}
          </p>
        </div>
        <SelectorAn an={an} />
      </header>

      <NavConcedii
        poateAproba={poateAproba}
        poateVedeaCalendar={poateVedeaCalendar}
        poateConfigura={poateConfigura}
      />

      {tipuri.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Niciun tip de concediu configurat"
          description="Organizația nu are încă niciun tip de concediu activ. Contactați administratorul."
        />
      ) : scope === "own" ? (
        <TabelTipuri randuri={imperecheazaSold(tipuri, solduri)} />
      ) : (
        <SectiuniPeAngajat
          organizationId={tenant.organizationId}
          tipuri={tipuri}
          solduri={solduri}
        />
      )}

      <section aria-labelledby="titlu-istoric" className="border-border rounded-lg border p-4">
        <h2 id="titlu-istoric" className="mb-4 text-lg font-medium">
          Istoricul soldului {String(an)}
        </h2>
        {istoric.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {scope === "all" || fisaProprie !== null
              ? "Fără mișcări de sold înregistrate în acest an."
              : "Istoricul detaliat este vizibil doar pentru soldul propriu sau pentru rolurile cu citire extinsă asupra concediilor."}
          </p>
        ) : (
          <IstoricTabel randuri={istoric} tipuri={tipuri} />
        )}
      </section>
    </main>
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
      <p className="text-muted-foreground text-sm">
        Nu există încă niciun rând de sold pentru anul acesta, pentru angajații vizibili
        dumneavoastră.
      </p>
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
            <h3 className="mb-2 text-sm font-semibold">
              {angajat === undefined ? "Angajat" : `${angajat.full_name} (${angajat.marca})`}
            </h3>
            <TabelTipuri randuri={randuri} />
          </div>
        );
      })}
    </div>
  );
}

function IstoricTabel({
  randuri,
  tipuri,
}: {
  readonly randuri: readonly EvenimentIstoricSold[];
  readonly tipuri: readonly TipConcediu[];
}) {
  const hartaTipuri = new Map(tipuri.map((t) => [t.id, t]));
  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface text-foreground">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              Data
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Tip
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Eveniment
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Variație
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Sold după
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Motiv
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {randuri.map((rand, index) => (
            // Rândurile append-only nu au `id` în select (plan de interogare) — indexul e stabil pentru o listă needitabilă.
            <tr key={index}>
              <td className="px-4 py-2">{formatDate(rand.data_eveniment)}</td>
              <td className="px-4 py-2">{hartaTipuri.get(rand.leave_type_id)?.denumire ?? "—"}</td>
              <td className="px-4 py-2">{ETICHETE_EVENIMENT[rand.eveniment] ?? rand.eveniment}</td>
              <td className={`px-4 py-2 tabular-nums ${rand.delta < 0 ? "text-danger" : ""}`}>
                {rand.delta > 0 ? "+" : ""}
                {formatAmount(rand.delta)}
              </td>
              <td className="px-4 py-2 tabular-nums">
                {rand.sold_dupa === null ? "—" : formatAmount(rand.sold_dupa)}
              </td>
              <td className="px-4 py-2">{rand.motiv}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
