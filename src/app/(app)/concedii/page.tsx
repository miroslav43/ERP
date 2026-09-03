// src/app/(app)/concedii/page.tsx
// „Cererile mele”. Cererile echipei stau pe `/concedii/echipa` — vezi
// comentariul lui `NavConcedii` pentru de ce separarea e rută, nu filtru.
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
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

import { ButonSetariConcedii } from "./buton-setari";
import { dateCerereNoua } from "./date-cerere-noua";
import { DialogCerereNoua } from "./dialog-cerere-noua";
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
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "leave"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "leave:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta cererile de concediu. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;

  /*
   * PRIMA PAGINĂ A MODULULUI, după cine se uită.
   *
   * Cine vede echipa (org_admin, hr, manager) deschide „Concedii" ca să
   * planifice, nu ca să-și citească propriile cereri: aterizează pe calendar.
   * `employee` n-are `leave:read = team`, deci rămâne pe lista lui, fără nicio
   * ramură scrisă special pentru el.
   *
   * Redirectarea se face DOAR de pe adresa complet goală. Orice parametru —
   * fila „Cererile mele" (`?vedere=cereri`), butonul din panou
   * (`?cerere=noua`), un filtru, o pagină de cursor — înseamnă că omul a cerut
   * ANUME lista, iar întoarcerea lui pe calendar ar fi făcut-o inaccesibilă.
   *
   * Ruta nu se mută: `/concedii` apare în vreo zece locuri (asistent, hărți de
   * notificări, indicii de eroare din salarizare, `revalidate` din acțiuni), iar
   * o mutare ar fi cerut sincronizarea tuturor pentru un efect de navigare.
   */
  if (Object.keys(parametri).length === 0 && can(permisiuni, "leave:read", "team")) {
    redirect("/concedii/calendar");
  }

  const scope: "own" | "team" | "all" = can(permisiuni, "leave:read", "all")
    ? "all"
    : can(permisiuni, "leave:read", "team")
      ? "team"
      : "own";
  const poateCrea = can(permisiuni, "leave:create", "own");
  const poateVedeaEchipa = can(permisiuni, "leave:read", "team");
  const poateAproba = can(permisiuni, "leave:approve", "team");
  const poateConfigura = can(permisiuni, "leave:update", "all");

  // `/concedii?cerere=noua` — adresa care deschide caseta direct, folosită de
  // butonul din panou și de starea goală a listei.
  const deschideCaseta = parametri["cerere"] === "noua";
  // Aceleași filtre pe care le folosește lista — vezi nota din `FiltreCereri`.
  const filtre = filtreDinUrl(filtreCereriSchema, parametri);
  const db = await createServerSupabase();
  // Datele casetei de cerere nouă pleacă ODATĂ cu restul paginii, nu la
  // apăsarea butonului: altfel deschiderea casetei ar fi însemnat exact
  // așteptarea de care am scăpat desființând pagina `/concedii/noua`.
  //
  // Fișa proprie intră tot aici, nu ca `await` separat înainte: fără ea,
  // „ale mele” n-are subiect (poate lipsi — un administrator invitat e
  // membru fără să fie angajat), dar interogarea e independentă de
  // celelalte trei, iar prima ei folosire e mult mai jos, la randare.
  const [{ data: tipuri }, deAprobat, dateCerere, fisaMea] = await Promise.all([
    db
      .from("leave_types")
      .select("id, denumire, culoare")
      .eq("organization_id", tenant.organizationId)
      .eq("activ", true)
      .is("deleted_at", null)
      .order("denumire")
      .returns<OptiuneTip[]>(),
    poateAproba ? numarDeAprobat(tenant.organizationId, user.id) : Promise.resolve(0),
    poateCrea
      ? dateCerereNoua(tenant.organizationId, {
          poateAlegeAngajat: can(permisiuni, "leave:create", "all"),
          // Aceeași condiție ca `poateAprobaPeLoc` din `actions.ts`. Aici e
          // doar text de buton; acțiunea o verifică din nou, singură, iar
          // ecranul nu e niciodată bariera.
          poateAprobaPeLoc: can(permisiuni, "leave:approve", "all"),
        })
      : Promise.resolve(null),
    fisaProprie(tenant.organizationId, user.id),
  ]);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Concedii"
        descriere="Cererile dumneavoastră de concediu."
        // De ce setările stau în dreapta sus și nu ca filă în bandă: vezi
        // `ButonSetariConcedii`. Butonul e aceeași componentă pe toate cele
        // cinci ecrane ale modulului, ca să nu dispară la un pas în lateral.
        //
        // `secundar` înaintea lui `primar`: acțiunea zilnică rămâne „Cerere
        // nouă”, iar setările se ating de câteva ori pe an.
        {...(poateConfigura || poateCrea
          ? {
              actiuni: (
                <>
                  <ButonSetariConcedii poateConfigura={poateConfigura} />
                  {dateCerere === null ? null : (
                    // `key` forțează remontarea când parametrul se schimbă: o
                    // navigare pe ACEEAȘI rută (starea goală a listei trimite
                    // la `/concedii?cerere=noua`) păstrează altfel starea
                    // clientului, iar caseta nu s-ar mai deschide.
                    <DialogCerereNoua
                      key={deschideCaseta ? "cerere-noua" : "listă"}
                      date={dateCerere}
                      deschisInitial={deschideCaseta}
                    />
                  )}
                </>
              ),
            }
          : {})}
        file={
          <NavConcedii
            poateVedeaEchipa={poateVedeaEchipa}
            poateAproba={poateAproba}
            poateVedeaCalendar={poateVedeaEchipa}
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
            ? { actiuneGol: { eticheta: "Cerere nouă", href: "/concedii?cerere=noua" } }
            : poateVedeaEchipa && fisaMea === null
              ? { actiuneGol: { eticheta: "Vezi cererile echipei", href: "/concedii/echipa" } }
              : {})}
        />
      </Suspense>
    </div>
  );
}
