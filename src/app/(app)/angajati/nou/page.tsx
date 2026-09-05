// src/app/(app)/angajati/nou/page.tsx
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { cn } from "@/lib/ui/cn";

import { AsistentAngajatNou } from "./_components/asistent-angajat-nou";

export const metadata: Metadata = { title: "Angajat nou" };

const ZILE_CONCEDIU_IMPLICIT_FALLBACK = 20;

export default async function PaginaAngajatNou() {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "nucleu"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (scopeFor(permisiuni, "employees:create") !== "all") {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a adăuga angajați. Această operațiune este rezervată personalului de resurse umane." />
    );
  }

  const db = await createServerSupabase();
  const [
    departamente,
    angajati,
    organizatie,
    obiecteInventar,
    puncteLucru,
    contor,
    sabloaneSalariale,
  ] = await Promise.all([
      db
        .from("departments")
        .select("id, denumire")
        .eq("organization_id", tenant.organizationId)
        .eq("activ", true)
        .is("deleted_at", null)
        .order("denumire"),
      db
        .from("employees")
        .select("id, full_name")
        .eq("organization_id", tenant.organizationId)
        .eq("status", "activ")
        .is("deleted_at", null)
        .order("full_name"),
      db
        .from("organizations")
        .select("zile_concediu_anual_implicit")
        .eq("id", tenant.organizationId)
        .maybeSingle(),
      // Golul dacă modulul Inventar nu e activat: RLS filtrează tăcut, nu aruncă.
      db
        .from("inventory_items")
        .select("id, denumire, numar_inventar")
        .eq("organization_id", tenant.organizationId)
        .eq("status", "in_stoc")
        .order("denumire"),
      db
        .from("puncte_lucru")
        .select("id, denumire")
        .eq("organization_id", tenant.organizationId)
        .eq("activ", true)
        .is("deleted_at", null)
        .order("denumire"),
      /*
       * Următorul număr de contract, CITIT — nu consumat.
       *
       * `public.aloca_numar_contract` avansează contorul, deci nu poate fi
       * chemată ca să afișeze o previzualizare: fiecare deschidere de formular ar
       * arde un număr. Aici se citește starea contorului; alocarea reală, atomică,
       * se face la salvare. Numărul afișat poate fi depășit de o înrolare
       * simultană — de aceea e text de ajutor, nu valoare precompletată.
       */
      db
        .from("document_sequences")
        .select("next_number")
        .eq("organization_id", tenant.organizationId)
        .eq("document_type", "contract_munca")
        .eq("year", new Date().getFullYear())
        .maybeSingle(),
      /*
       * Șabloanele de componentă salarială — sporuri, prime recurente, tichete,
       * cadouri. `organization_id is null` sunt cele de PLATFORMĂ, comune
       * tuturor firmelor; RLS le lasă vizibile, deci filtrul nu le exclude.
       */
      db
        .from("salary_component_types")
        .select("id, denumire, kind")
        .eq("activ", true)
        .is("deleted_at", null)
        .order("ordine")
        .order("denumire"),
    ]);

  /*
   * Forma din 0130: numărul poartă DATA alocării, nu doar anul. Textul de
   * ajutor trebuie să arate ce se va aloca — altfel previzualizarea minte, iar
   * omul caută în registru un „7/2026" care nu există.
   */
  const numarUrmator = `${String(contor.data?.next_number ?? 1)}/${new Intl.DateTimeFormat(
    "ro-RO",
    { day: "2-digit", month: "2-digit", year: "numeric" },
  ).format(new Date())}`;

  return (
    <div className={cn(LATIMI.formular, "space-y-6")}>
      <AntetPagina
        titlu="Înrolare angajat"
        descriere="Un singur formular pentru fișa de personal, contractul de muncă și fișa postului — marca se atribuie automat, iar contractul și documentele se generează la trimitere."
      />
      <AsistentAngajatNou
        departamente={departamente.data ?? []}
        angajati={(angajati.data ?? []).map((a) => ({
          id: a.id,
          full_name: a.full_name ?? "",
        }))}
        puncteLucru={puncteLucru.data ?? []}
        zileConcediuImplicit={
          organizatie.data?.zile_concediu_anual_implicit ?? ZILE_CONCEDIU_IMPLICIT_FALLBACK
        }
        obiecteDisponibile={obiecteInventar.data ?? []}
        sabloaneSalariale={sabloaneSalariale.data ?? []}
        numarUrmator={numarUrmator}
      />
    </div>
  );
}
