// src/app/(app)/setari/organizatie/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";

import { FormularOrganizatie, type ValoriOrganizatie } from "./organizatie-form";
import { createServerSupabase } from "@/lib/supabase/server";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { RUTA_ALEGE_ORGANIZATIA, RUTA_AUTENTIFICARE } from "@/config/routes";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { FileModul } from "@/components/ui/file-modul";
import { FILE_SETARI } from "@/config/file-module";
import Link from "next/link";
import { poateDeschide } from "@/config/porti-ruta";
import { getEnabledFeatures } from "@/lib/auth/features";
import { FEATURES, type FeatureKey } from "@/config/features";
export const metadata: Metadata = { title: "Datele firmei" };

const ETICHETE_PLAN: Readonly<Record<string, string>> = {
  trial: "Perioadă de probă",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

const ETICHETE_ABONAMENT: Readonly<Record<string, string>> = {
  trialing: "În perioadă de probă",
  active: "Activ",
  past_due: "Plată restantă",
  canceled: "Anulat",
  expired: "Expirat",
};

const ETICHETE_STATUS: Readonly<Record<string, string>> = {
  pending: "În așteptare",
  active: "Activă",
  suspended: "Suspendată",
  archived: "Arhivată",
};

function text(valoare: string | null): string {
  return valoare ?? "";
}

export default async function SetariOrganizatiePage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Validat STRICT: doar antetul documentelor poate cere întoarcerea.
  const inapoi =
    (await searchParams)["inapoi"] === "sabloane-documente" ? "/angajati/sabloane-documente" : null;
  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") {
    redirect(RUTA_AUTENTIFICARE);
  }
  if (rezolvare.status !== "ok") {
    redirect(RUTA_ALEGE_ORGANIZATIA);
  }

  // Pagina citea datele firmei fără nicio verificare de permisiune: orice
  // membru autentificat le vedea, inclusiv planul și plafonul de locuri.
  // Acțiunile refuzau corect (prin `createAction`), deci nu se putea MODIFICA
  // nimic — dar divulgarea rămâne divulgare, iar S2 cere verificarea și la
  // afișare, nu doar la scriere.
  const permisiuni = await getPermissionMap(
    rezolvare.tenant.organizationId,
    rezolvare.tenant.role,
    rezolvare.tenant.memberId,
  );
  if (scopeFor(permisiuni, "organizations:update") !== "all") {
    return (
      <AccesRestrictionat mesaj="Datele firmei pot fi consultate doar de administratorii organizației. Cere-i administratorului tău dreptul necesar dacă ai nevoie de el." />
    );
  }

  const supabase = await createServerSupabase();
  const [module, { count: membriActivi }] = await Promise.all([
    getEnabledFeatures(rezolvare.tenant.organizationId),
    supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", rezolvare.tenant.organizationId)
      .eq("status", "active")
      .is("deleted_at", null),
  ]);
  const contextPorti = { features: module, permissions: permisiuni };
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "id, name, legal_name, forma_juridica, cui, platitor_tva, reg_com, adresa, judet, oras, cod_postal, tara, email_contact, telefon_contact, website, reprezentant_legal, capital_social, capital_social_varsat, sistem_dualist, cod_caen, cod_caen_secundare, sector, functie_reprezentant_legal, ssm_furnizor_extern, ssm_persoana_responsabila, zile_concediu_anual_implicit, plan, seats_limit, subscription_status, status, trial_ends_at",
    )
    .eq("id", rezolvare.tenant.organizationId)
    .maybeSingle();

  if (error !== null) {
    throw new Error("Datele firmei nu au putut fi încărcate.");
  }
  if (data === null) {
    return (
      <div>
        <h1 className="text-foreground text-titlu font-semibold">Datele firmei</h1>
        <p className="text-muted-foreground text-corp mt-2">
          Organizația nu mai este disponibilă. Comutați pe altă organizație din bara de sus.
        </p>
      </div>
    );
  }

  const initiale: ValoriOrganizatie = {
    name: data.name,
    legal_name: text(data.legal_name),
    forma_juridica: text(data.forma_juridica),
    cui: text(data.cui),
    platitor_tva: data.platitor_tva === true,
    reg_com: text(data.reg_com),
    adresa: text(data.adresa),
    judet: text(data.judet),
    oras: text(data.oras),
    cod_postal: text(data.cod_postal),
    tara: text(data.tara),
    email_contact: text(data.email_contact),
    telefon_contact: text(data.telefon_contact),
    website: text(data.website),
    reprezentant_legal: text(data.reprezentant_legal),
    capital_social: data.capital_social === null ? "" : String(data.capital_social),
    capital_social_varsat:
      data.capital_social_varsat === null ? "" : String(data.capital_social_varsat),
    sistem_dualist: data.sistem_dualist === true,
    cod_caen: text(data.cod_caen),
    cod_caen_secundare: data.cod_caen_secundare ?? [],
    sector: text(data.sector),
    functie_reprezentant_legal: text(data.functie_reprezentant_legal),
    ssm_furnizor_extern: text(data.ssm_furnizor_extern),
    ssm_persoana_responsabila: text(data.ssm_persoana_responsabila),
    zile_concediu_anual_implicit: String(data.zile_concediu_anual_implicit),
  };

  const contract: readonly Readonly<{ eticheta: string; valoare: string }>[] = [
    { eticheta: "Plan", valoare: ETICHETE_PLAN[data.plan] ?? data.plan },
    {
      eticheta: "Locuri contractate",
      valoare: `${String(data.seats_limit)}${membriActivi === null ? "" : ` · ${String(membriActivi)} folosite`}`,
    },
    {
      eticheta: "Stare abonament",
      valoare: ETICHETE_ABONAMENT[data.subscription_status] ?? data.subscription_status,
    },
    { eticheta: "Stare organizație", valoare: ETICHETE_STATUS[data.status] ?? data.status },
    {
      eticheta: "Perioada de probă se încheie",
      valoare: data.trial_ends_at !== null ? formatDate(data.trial_ends_at) : "—",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <AntetPagina
        titlu="Datele firmei"
        descriere="Informațiile de identificare folosite în documente, facturi și rapoarte."
        file={<FileModul eticheta="Navigare setări" file={FILE_SETARI} tenant={rezolvare.tenant} />}
      />

      <section
        aria-labelledby="titlu-contract"
        className="border-border bg-surface rounded-panou border p-4"
      >
        <h2
          id="titlu-contract"
          className="text-foreground text-corp flex items-center gap-2 font-medium"
        >
          <Lock aria-hidden="true" className="text-muted-foreground h-4 w-4" />
          Date de contract (nu se modifică din aplicație)
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          {contract.map((linie) => (
            <div key={linie.eticheta}>
              <dt className="text-muted-foreground text-nota tracking-wide uppercase">
                {linie.eticheta}
              </dt>
              <dd className="text-foreground text-corp font-medium">{linie.valoare}</dd>
            </div>
          ))}
        </dl>
        {/* Cifra locurilor e izolată fără cine le consumă: membrii, prin poarta paginii lor. */}
        {scopeFor(permisiuni, "users:update") === "all" ? (
          <p className="text-nota mt-2">
            <Link href="/setari/membri" className="underline-offset-2 hover:underline">
              Vezi membrii care ocupă locurile
            </Link>
          </p>
        ) : null}
        <p className="text-muted-foreground text-corp mt-3">
          Planul, numărul de locuri și starea abonamentului se schimbă prin contract. Scrieți-ne
          dacă aveți nevoie de mai multe locuri sau de alt plan.
        </p>
      </section>

      {/*
        Pasul „Porniți modulele" de pe panou trimitea aici, dar pagina n-avea
        nicio secțiune de module: utilizatorul ajungea într-o fundătură.
        Pornirea și oprirea rămân în consola de platformă; aici se VEDE.
      */}
      <section
        id="module"
        aria-labelledby="titlu-module"
        className="border-border bg-surface rounded-panou scroll-mt-24 border p-4"
      >
        <h2 id="titlu-module" className="text-foreground text-corp font-medium">
          Module pornite
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(FEATURES)
            .sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
            .map(([cheie, meta]) => {
              const pornit = module.has(cheie as FeatureKey);
              return (
                <li key={cheie} className="text-corp flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`inline-block size-2.5 rounded-full ${pornit ? "bg-success" : "bg-border"}`}
                  />
                  <span className={pornit ? "" : "text-muted-foreground"}>{meta.denumire}</span>
                  {meta.isCore ? (
                    <span className="text-muted-foreground text-nota">· nucleu</span>
                  ) : null}
                  <span className="sr-only">{pornit ? ", pornit" : ", oprit"}</span>
                </li>
              );
            })}
        </ul>
        <p className="text-muted-foreground text-corp mt-3">
          {module.size} din {Object.keys(FEATURES).length} pornite. Modulele se pornesc și se opresc
          prin contract; scrieți-ne pentru o schimbare.
        </p>
      </section>

      {/* Legăturile de context: unde se folosesc datele de aici și unde stau valorile înrudite. */}
      <ul className="text-nota flex flex-wrap gap-x-4 gap-y-1">
        {poateDeschide("/angajati/sabloane-documente", contextPorti) ? (
          <li>
            <Link
              href="/angajati/sabloane-documente"
              className="underline-offset-2 hover:underline"
            >
              Antetul documentelor, cu datele de mai jos
            </Link>
          </li>
        ) : null}
        {poateDeschide("/concedii/setari", contextPorti) ? (
          <li>
            <Link href="/concedii/setari" className="underline-offset-2 hover:underline">
              Regulile de concediu (zilele implicite se propagă pe tipuri)
            </Link>
          </li>
        ) : null}
        {poateDeschide("/puncte-lucru", contextPorti) ? (
          <li>
            <Link href="/puncte-lucru" className="underline-offset-2 hover:underline">
              Punctele de lucru (sediile secundare)
            </Link>
          </li>
        ) : null}
      </ul>

      <FormularOrganizatie initiale={initiale} inapoi={inapoi} />
    </div>
  );
}
