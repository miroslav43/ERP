// src/app/(app)/concedii/page.tsx
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { CalendarPlus, CalendarRange } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { RandTabel } from "@/components/data/rand-tabel";
import { Badge } from "@/components/ui/badge";
import { Schelet } from "@/components/ui/schelet";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatAmount } from "@/lib/format/money";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { listeazaCereri, soldAnual, type RandCerere } from "@/lib/queries/leave";
import { filtreCereriSchema } from "@/schemas/leave";
import { fisaProprie } from "@/lib/queries/portal";

import { ETICHETE_STATUS_CERERE, TONURI_STATUS_CERERE } from "./etichete";
import { FiltreCereri } from "./filtre-cereri";
import { NavConcedii } from "./nav-concedii";
import { filtreDinUrl } from "@/lib/rute/parametri";

export const metadata: Metadata = { title: "Concedii" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface OptiuneTip {
  readonly id: string;
  readonly denumire: string;
  readonly culoare: string;
}

interface OptiuneAngajat {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

interface ProprietatiTabel {
  readonly organizationId: string;
  readonly aratăAngajat: boolean;
  readonly tipuri: readonly OptiuneTip[];
  readonly parametri: Record<string, string | string[] | undefined>;
  readonly scope: "own" | "team" | "all";
  readonly fisaMea: string | null;
}

async function TabelCereri({
  organizationId,
  aratăAngajat,
  fisaMea,
  tipuri,
  parametri,
  scope,
}: ProprietatiTabel) {
  const filtre = filtreDinUrl(filtreCereriSchema, parametri);
  const { randuri, urmatorulCursor } = await listeazaCereri(organizationId, scope, filtre, fisaMea);

  if (randuri.length === 0) {
    const areFiltre =
      filtre.vizualizare !== "toate" ||
      filtre.status !== null ||
      filtre.leave_type_id !== null ||
      filtre.employee_id !== null ||
      filtre.de_la !== null ||
      filtre.pana_la !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={CalendarRange}
        titlu="Nicio cerere de concediu"
        descriere="Nu există cereri care să corespundă filtrelor alese. Ștergeți filtrele sau depuneți o cerere nouă."
        actiune={
          areFiltre
            ? { eticheta: "Șterge filtrele", href: "/concedii" }
            : { eticheta: "Cerere nouă", href: "/concedii/noua" }
        }
      />
    );
  }

  const hartaTipuri = new Map(tipuri.map((t) => [t.id, t]));
  let hartaAngajati = new Map<string, OptiuneAngajat>();
  if (aratăAngajat) {
    const idAngajati = [...new Set(randuri.map((r) => r.employee_id))];
    const db = await createServerSupabase();
    const { data } = await db.from("employees").select("id, full_name, marca").in("id", idAngajati);
    hartaAngajati = new Map((data ?? []).map((a) => [a.id, a]));
  }

  const cautare = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && cheie !== "cursor") cautare.set(cheie, valoare);
  }
  if (urmatorulCursor !== null) cautare.set("cursor", urmatorulCursor);

  function randCa(cerere: RandCerere): ReactNode {
    const tip = hartaTipuri.get(cerere.leave_type_id);
    const angajat = hartaAngajati.get(cerere.employee_id);
    return (
      <RandTabel key={cerere.id} href={`/concedii/${cerere.id}`}>
        {aratăAngajat ? (
          <td className="px-4 py-3">
            {angajat === undefined ? "—" : `${angajat.full_name ?? "—"} (${angajat.marca})`}
          </td>
        ) : null}
        <td className="px-4 py-3">
          <span
            className="mr-2 inline-block size-2.5 rounded-full align-middle"
            style={{ backgroundColor: tip?.culoare ?? "#94a3b8" }}
            aria-hidden="true"
          />
          {tip?.denumire ?? "—"}
        </td>
        <td className="px-4 py-3">
          {formatDate(cerere.data_inceput)} – {formatDate(cerere.data_sfarsit)}
        </td>
        <td className="px-4 py-3 tabular-nums">{formatAmount(cerere.zile_lucratoare)} zile</td>
        <td className="px-4 py-3">
          <Badge ton={TONURI_STATUS_CERERE[cerere.status]}>
            {ETICHETE_STATUS_CERERE[cerere.status]}
          </Badge>
        </td>
        <td className="px-4 py-3">
          <Link
            href={`/concedii/${cerere.id}`}
            className="text-primary font-medium underline-offset-2 hover:underline"
          >
            Detalii
          </Link>
        </td>
      </RandTabel>
    );
  }

  return (
    <>
      <div className="border-border rounded-panou overflow-x-auto border">
        <table className="text-corp w-full text-left">
          <caption className="sr-only">Lista cererilor de concediu</caption>
          <thead className="bg-surface text-foreground">
            <tr>
              {aratăAngajat ? (
                <th scope="col" className="px-4 py-3 font-medium">
                  Angajat
                </th>
              ) : null}
              <th scope="col" className="px-4 py-3 font-medium">
                Tip
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Perioadă
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Zile lucrătoare
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stare
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                <span className="sr-only">Acțiuni</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">{randuri.map(randCa)}</tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="mt-4 flex justify-end">
        {urmatorulCursor === null ? (
          <p className="text-muted-foreground text-corp">Aceasta este ultima pagină.</p>
        ) : (
          <Link
            href={`/concedii?${cautare.toString()}`}
            className={buton({ varianta: "secundar" })}
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

async function RezumatSoldPropriu({ organizationId }: { readonly organizationId: string }) {
  const an = Number(todayInBucharest().slice(0, 4));
  const { tipuri, solduri } = await soldAnual(organizationId, an);
  const tipOdihna = tipuri.find((t) => t.key === "odihna") ?? tipuri.find((t) => t.scade_din_sold);
  if (tipOdihna === undefined) return null;
  const sold = solduri.find((s) => s.leave_type_id === tipOdihna.id);
  const ramase = sold?.ramase ?? tipOdihna.zile_implicite;

  return (
    <p className="border-border bg-surface text-foreground rounded-panou text-corp border px-4 py-2">
      Aveți <strong>{formatAmount(ramase)}</strong> zile rămase din „{tipOdihna.denumire}” pentru
      anul {String(an)}.{" "}
      <Link href="/concedii/sold" className="underline underline-offset-2">
        Vezi soldul complet
      </Link>
      .
    </p>
  );
}

export default async function PaginaConcedii({ searchParams }: ProprietatiPagina) {
  await requireUser();
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "leave");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "leave:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta cererile de concediu. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  // Fișa proprie, ca să putem separa „ale mele” de „ale echipei”. Poate lipsi:
  // un administrator invitat e membru fără să fie angajat.
  const fisaMea = await fisaProprie(tenant.organizationId, user.id);

  const scope: "own" | "team" | "all" = can(permisiuni, "leave:read", "all")
    ? "all"
    : can(permisiuni, "leave:read", "team")
      ? "team"
      : "own";
  const poateCrea = can(permisiuni, "leave:create", "own");
  const poateAproba = can(permisiuni, "leave:approve", "team");
  const poateVedeaCalendar = can(permisiuni, "leave:read", "team");
  const poateConfigura = can(permisiuni, "leave:update", "all");

  const parametri = await searchParams;
  const db = await createServerSupabase();
  const { data: tipuri } = await db
    .from("leave_types")
    .select("id, denumire, culoare")
    .eq("organization_id", tenant.organizationId)
    .eq("activ", true)
    .is("deleted_at", null)
    .order("denumire")
    .returns<OptiuneTip[]>();

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Concedii"
        descriere={
          scope === "own"
            ? "Cererile dumneavoastră de concediu."
            : scope === "team"
              ? "Cererile de concediu ale echipei dumneavoastră."
              : "Toate cererile de concediu din organizație."
        }
        {...(poateCrea
          ? {
              actiuni: (
                <Link href="/concedii/noua" className={buton({ varianta: "primar" })}>
                  <CalendarPlus aria-hidden="true" className="size-4" />
                  Cerere nouă
                </Link>
              ),
            }
          : {})}
        file={
          <NavConcedii
            poateAproba={poateAproba}
            poateVedeaCalendar={poateVedeaCalendar}
            poateConfigura={poateConfigura}
          />
        }
      />

      {scope === "own" ? <RezumatSoldPropriu organizationId={tenant.organizationId} /> : null}

      {/* Comutatorul apare doar cui chiar are două feluri de cereri: un
          angajat cu scope „own” vede numai ale lui, iar un al doilea filtru
          i-ar sugera că există și altceva. */}
      <FiltreCereri tipuri={tipuri ?? []} aratăVizualizarea={scope !== "own" && fisaMea !== null} />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={6} />}>
        <TabelCereri
          organizationId={tenant.organizationId}
          aratăAngajat={scope !== "own"}
          tipuri={tipuri ?? []}
          parametri={parametri}
          scope={scope}
          fisaMea={fisaMea?.id ?? null}
        />
      </Suspense>
    </div>
  );
}
