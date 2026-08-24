// src/app/(app)/concedii/page.tsx
// „Cererile mele”. Cererile echipei stau pe `/concedii/echipa` — vezi
// comentariul lui `NavConcedii` pentru de ce separarea e rută, nu filtru.
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { CalendarPlus } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { Schelet } from "@/components/ui/schelet";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatAmount } from "@/lib/format/money";
import { todayInBucharest } from "@/lib/format/date";
import { numarDeAprobat, soldAnual } from "@/lib/queries/leave";
import { filtreCereriSchema } from "@/schemas/leave";
import { fisaProprie } from "@/lib/queries/portal";
import { filtreDinUrl } from "@/lib/rute/parametri";

import { FiltreCereri } from "./filtre-cereri";
import { NavConcedii } from "./nav-concedii";
import { TabelCereri } from "./tabel-cereri";

export const metadata: Metadata = { title: "Concedii" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface OptiuneTip {
  readonly id: string;
  readonly denumire: string;
  readonly culoare: string;
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

  // Fișa proprie: fără ea, „ale mele” n-are subiect. Poate lipsi — un
  // administrator invitat e membru fără să fie angajat.
  const fisaMea = await fisaProprie(tenant.organizationId, user.id);

  const scope: "own" | "team" | "all" = can(permisiuni, "leave:read", "all")
    ? "all"
    : can(permisiuni, "leave:read", "team")
      ? "team"
      : "own";
  const poateCrea = can(permisiuni, "leave:create", "own");
  const poateVedeaEchipa = can(permisiuni, "leave:read", "team");
  const poateAproba = can(permisiuni, "leave:approve", "team");
  const poateConfigura = can(permisiuni, "leave:update", "all");

  const parametri = await searchParams;
  // Aceleași filtre pe care le folosește lista — vezi nota din `FiltreCereri`.
  const filtre = filtreDinUrl(filtreCereriSchema, parametri);
  const db = await createServerSupabase();
  const [{ data: tipuri }, deAprobat] = await Promise.all([
    db
      .from("leave_types")
      .select("id, denumire, culoare")
      .eq("organization_id", tenant.organizationId)
      .eq("activ", true)
      .is("deleted_at", null)
      .order("denumire")
      .returns<OptiuneTip[]>(),
    poateAproba ? numarDeAprobat(tenant.organizationId, user.id) : Promise.resolve(0),
  ]);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Concedii"
        descriere="Cererile dumneavoastră de concediu."
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
            poateVedeaEchipa={poateVedeaEchipa}
            poateAproba={poateAproba}
            poateVedeaCalendar={poateVedeaEchipa}
            poateConfigura={poateConfigura}
            deAprobat={deAprobat}
          />
        }
      />

      {/* Soldul apare pentru ORICINE are fișă, nu doar pentru scope „own”:
          până acum managerul, care vede și echipa, nu-și vedea zilele rămase
          exact pe ecranul de unde depune cererea. */}
      {fisaMea !== null ? <RezumatSoldPropriu organizationId={tenant.organizationId} /> : null}

      {/* Fără filtru după angajat: lista are un singur angajat — chiar el. */}
      <FiltreCereri tipuri={tipuri ?? []} angajati={[]} filtre={filtre} />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={4} />}>
        <TabelCereri
          organizationId={tenant.organizationId}
          vizualizare="mele"
          tipuri={tipuri ?? []}
          parametri={parametri}
          scope={scope}
          fisaMea={fisaMea?.id ?? null}
          caleBaza="/concedii"
          gol={
            fisaMea === null
              ? {
                  titlu: "Contul dumneavoastră nu are fișă de angajat",
                  descriere:
                    "Nu puteți avea cereri proprii de concediu fără o fișă de angajat în această organizație. Cererile pe care le administrați se află în fila „Echipa”.",
                }
              : {
                  titlu: "Nicio cerere de concediu",
                  descriere:
                    "Nu ați depus încă nicio cerere de concediu. Depuneți una și veți vedea aici starea ei.",
                }
          }
          {...(poateCrea && fisaMea !== null
            ? { actiuneGol: { eticheta: "Cerere nouă", href: "/concedii/noua" } }
            : poateVedeaEchipa && fisaMea === null
              ? { actiuneGol: { eticheta: "Vezi cererile echipei", href: "/concedii/echipa" } }
              : {})}
        />
      </Suspense>
    </div>
  );
}
