// src/app/(app)/concedii/setari/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { anDinUrl } from "@/lib/rute/parametri";
import { formatAmount } from "@/lib/format/money";
import { todayInBucharest } from "@/lib/format/date";
import { configurareConcedii, previzualizeazaDrepturi } from "@/lib/queries/leave";

import { NavConcedii } from "../nav-concedii";
import { FormularZileBaza } from "./formular-zile-baza";
import { TabelTipuriReglementate } from "./tabel-tipuri-reglementate";
import { CardTipAdaptabil } from "./card-tip-adaptabil";
import { TabelReguli } from "./tabel-reguli";
import { FormularRegulaNoua } from "./formular-regula-noua";
import { ButonAplicaDrepturi } from "./buton-aplica-drepturi";

export const metadata: Metadata = { title: "Setări concedii" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface AngajatMinim {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
}

/** Ancorat pe `#aplicare`, ca schimbarea anului să nu sară pagina la vârf. */
function SelectorAnAplicare({ an }: { readonly an: number }) {
  return (
    <nav aria-label="Anul de aplicat" className="flex items-center gap-3 text-sm">
      <Link
        href={`/concedii/setari?an=${String(an - 1)}#aplicare`}
        className="underline underline-offset-2"
      >
        {an - 1}
      </Link>
      <span className="font-semibold">{an}</span>
      <Link
        href={`/concedii/setari?an=${String(an + 1)}#aplicare`}
        className="underline underline-offset-2"
      >
        {an + 1}
      </Link>
    </nav>
  );
}

export default async function PaginaSetariConcedii({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "leave");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "leave:update", "all")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a configura concediile. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const poateAproba = can(permisiuni, "leave:approve", "team");
  const poateVedeaCalendar = can(permisiuni, "leave:read", "team");

  const parametri = await searchParams;
  const an = anDinUrl(parametri["an"], Number(todayInBucharest().slice(0, 4)));

  const [{ tipuri, reguli, departamente, functii }, previzualizare] = await Promise.all([
    configurareConcedii(tenant.organizationId),
    previzualizeazaDrepturi(tenant.organizationId, an),
  ]);

  const db = await createServerSupabase();
  const { data: randOrganizatie } = await db
    .from("organizations")
    .select("zile_concediu_anual_implicit")
    .eq("id", tenant.organizationId)
    .maybeSingle<{ zile_concediu_anual_implicit: number }>();
  const zileBaza = randOrganizatie?.zile_concediu_anual_implicit ?? 20;

  const idAngajatiPreview = [...new Set(previzualizare.map((r) => r.employee_id))];
  const { data: dateAngajati } =
    idAngajatiPreview.length === 0
      ? { data: [] as AngajatMinim[] }
      : await db
          .from("employees")
          .select("id, full_name, marca")
          .eq("organization_id", tenant.organizationId)
          .in("id", idAngajatiPreview)
          .returns<AngajatMinim[]>();
  const hartaAngajati = new Map((dateAngajati ?? []).map((a) => [a.id, a]));
  const hartaTipuri = new Map(tipuri.map((t) => [t.id, t.denumire]));

  const tipuriReglementate = tipuri.filter((t) => t.reglementat);
  const tipuriAdaptabile = tipuri.filter((t) => !t.reglementat);

  return (
    <main className="space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Setări concedii</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Regulile de mai jos se aplică AUTOMAT tuturor angajaților organizației. Tipurile
          reglementate legal (medical, maternitate, creștere copil, paternal, îngrijitor, donator de
          sânge) nu pot fi modificate din aplicație — durata lor vine direct din lege.
        </p>
      </header>

      <NavConcedii
        poateAproba={poateAproba}
        poateVedeaCalendar={poateVedeaCalendar}
        poateConfigura={true}
      />

      <section
        aria-labelledby="titlu-zile-baza"
        className="border-border space-y-3 rounded-lg border p-4"
      >
        <h2 id="titlu-zile-baza" className="text-lg font-medium">
          Zile de bază — concediu de odihnă
        </h2>
        <p className="text-muted-foreground text-sm">
          Minimul legal e de 20 de zile lucrătoare/an (Codul Muncii, art. 145 — de verificat de
          jurist). Valoarea se propagă automat spre tipul „Concediu de odihnă” de mai jos.
        </p>
        <FormularZileBaza zileCurente={zileBaza} />
      </section>

      <section aria-labelledby="titlu-tipuri" className="space-y-4">
        <h2 id="titlu-tipuri" className="text-lg font-medium">
          Tipuri de concediu
        </h2>

        <div className="space-y-2">
          <h3 className="text-muted-foreground text-sm font-semibold">
            Reglementate legal — doar activare/dezactivare
          </h3>
          <TabelTipuriReglementate tipuri={tipuriReglementate} />
        </div>

        <div className="space-y-3">
          <h3 className="text-muted-foreground text-sm font-semibold">
            Stabilite de companie — editabile
          </h3>
          {tipuriAdaptabile.length === 0 ? (
            <p className="text-muted-foreground text-sm">Niciun tip adaptabil configurat.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {tipuriAdaptabile.map((tip) => (
                <CardTipAdaptabil key={tip.id} tip={tip} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="titlu-grile" className="space-y-4">
        <h2 id="titlu-grile" className="text-lg font-medium">
          Grile de zile suplimentare
        </h2>
        <p className="text-muted-foreground text-sm">
          Zilele se ADUNĂ la baza tipului de concediu — un angajat poate întruni mai multe grile
          simultan (ex. vechime + condiții deosebite). Nu se pot adăuga grile pe tipurile
          reglementate legal.
        </p>
        <TabelReguli
          reguli={reguli}
          tipuri={tipuri}
          departamente={departamente}
          functii={functii}
        />
        <FormularRegulaNoua
          tipuri={tipuriAdaptabile}
          departamente={departamente}
          functii={functii}
        />
      </section>

      <section
        id="aplicare"
        aria-labelledby="titlu-aplicare"
        className="border-border space-y-4 rounded-lg border p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="titlu-aplicare" className="text-lg font-medium">
              Aplicarea drepturilor pe angajați
            </h2>
            <p className="text-muted-foreground max-w-2xl text-sm">
              Salvarea unei reguli de mai sus NU schimbă automat soldurile angajaților existenți.
              Alegeți anul, verificați diferențele, apoi aplicați.
            </p>
          </div>
          <SelectorAnAplicare an={an} />
        </div>

        {previzualizare.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nicio diferență pentru anul {String(an)} — soldurile existente sunt deja aliniate cu
            regulile curente.
          </p>
        ) : (
          <>
            <div className="border-border overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Angajat
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Tip de concediu
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Drept vechi
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Drept nou
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Rămase după
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {previzualizare.map((rand) => {
                    const angajat = hartaAngajati.get(rand.employee_id);
                    return (
                      <tr key={`${rand.employee_id}-${rand.leave_type_id}`}>
                        <td className="px-4 py-2">
                          {angajat === undefined
                            ? "Angajat"
                            : `${angajat.full_name} (${angajat.marca})`}
                        </td>
                        <td className="px-4 py-2">{hartaTipuri.get(rand.leave_type_id) ?? "—"}</td>
                        <td className="px-4 py-2 tabular-nums">{formatAmount(rand.drept_vechi)}</td>
                        <td className="px-4 py-2 font-medium tabular-nums">
                          {formatAmount(rand.drept_nou)}
                        </td>
                        <td
                          className={`px-4 py-2 tabular-nums ${
                            rand.ramase_dupa < 0 ? "text-danger" : ""
                          }`}
                        >
                          {formatAmount(rand.ramase_dupa)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ButonAplicaDrepturi an={an} nrModificari={previzualizare.length} />
          </>
        )}
      </section>
    </main>
  );
}
