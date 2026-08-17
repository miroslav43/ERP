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

export default async function SetariOrganizatiePage() {
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
  const permisiuni = await getPermissionMap(rezolvare.tenant.organizationId, rezolvare.tenant.role);
  if (scopeFor(permisiuni, "organizations:update") !== "all") {
    return (
      <AccesRestrictionat mesaj="Datele firmei pot fi consultate doar de administratorii organizației. Cere-i administratorului tău dreptul necesar dacă ai nevoie de el." />
    );
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "id, name, legal_name, forma_juridica, cui, platitor_tva, reg_com, adresa, judet, oras, cod_postal, tara, email_contact, telefon_contact, website, reprezentant_legal, plan, seats_limit, subscription_status, status, trial_ends_at",
    )
    .eq("id", rezolvare.tenant.organizationId)
    .maybeSingle();

  if (error !== null) {
    throw new Error("Datele firmei nu au putut fi încărcate.");
  }
  if (data === null) {
    return (
      <main className="p-6">
        <h1 className="text-foreground text-xl font-semibold">Datele firmei</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Organizația nu mai este disponibilă. Comutați pe altă organizație din bara de sus.
        </p>
      </main>
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
  };

  const contract: readonly Readonly<{ eticheta: string; valoare: string }>[] = [
    { eticheta: "Plan", valoare: ETICHETE_PLAN[data.plan] ?? data.plan },
    { eticheta: "Locuri contractate", valoare: String(data.seats_limit) },
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
    <main className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-foreground text-xl font-semibold">Datele firmei</h1>
        <p className="text-muted-foreground text-sm">
          Informațiile de identificare folosite în documente, facturi și rapoarte.
        </p>
      </header>

      <section
        aria-labelledby="titlu-contract"
        className="border-border bg-surface rounded-lg border p-4"
      >
        <h2
          id="titlu-contract"
          className="text-foreground flex items-center gap-2 text-sm font-medium"
        >
          <Lock aria-hidden="true" className="text-muted-foreground h-4 w-4" />
          Date de contract (nu se modifică din aplicație)
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          {contract.map((linie) => (
            <div key={linie.eticheta}>
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                {linie.eticheta}
              </dt>
              <dd className="text-foreground text-sm font-medium">{linie.valoare}</dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground mt-3 text-sm">
          Planul, numărul de locuri și starea abonamentului se schimbă prin contract. Scrieți-ne
          dacă aveți nevoie de mai multe locuri sau de alt plan.
        </p>
      </section>

      <FormularOrganizatie initiale={initiale} />
    </main>
  );
}
