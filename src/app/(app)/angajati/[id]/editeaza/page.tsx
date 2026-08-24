// src/app/(app)/angajati/[id]/editeaza/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { citesteAngajatPentruEditare, colegiPentruManager } from "@/lib/queries/employees";

import { FormularAngajat } from "../../formular-angajat";

export const metadata: Metadata = { title: "Editează fișa angajatului" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaEditeazaAngajat({ params }: ProprietatiPagina) {
  const { id } = await params;
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (scopeFor(permisiuni, "employees:update") !== "all") {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a edita fișele de personal. Această operațiune este rezervată personalului de resurse umane." />
    );
  }

  // `citesteAngajatPentruEditare`, nu `citesteAngajat`: cea din urmă selectează
  // coloanele pe care le AFIȘEAZĂ fișa (24), nu pe cele pe care schema le
  // acceptă la scriere (33). Diferența nu ajungea în formular, deci formularul
  // nu o retrimitea, deci `UPDATE`-ul o ștergea.
  const angajat = await citesteAngajatPentruEditare(tenant.organizationId, id);
  if (angajat === null) notFound();

  const db = await createServerSupabase();
  const [departamente, functii, colegi] = await Promise.all([
    db
      .from("departments")
      .select("id, denumire")
      .eq("organization_id", tenant.organizationId)
      .eq("activ", true)
      .is("deleted_at", null)
      .order("denumire"),
    db
      .from("job_positions")
      .select("id, denumire")
      .eq("organization_id", tenant.organizationId)
      .eq("activ", true)
      .is("deleted_at", null)
      .order("denumire"),
    colegiPentruManager(tenant.organizationId, angajat.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        {/* Calea de întoarcere, ca la ecranul de permisiuni: fără ea, singurul
            drum înapoi la fișă era butonul browserului. */}
        <Link
          href={`/angajati/${angajat.id}`}
          className="text-muted-foreground hover:text-foreground text-corp inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          {angajat.full_name} · marca {angajat.marca}
        </Link>
        <AntetPagina
          className="mt-1"
          titlu={`Editează fișa — ${angajat.full_name}`}
          descriere="Toate câmpurile afișate pe fișă se completează aici. CNP-ul și IBAN-ul rămân neschimbate dacă lăsați câmpurile goale."
        />
      </div>
      <FormularAngajat
        departamente={departamente.data ?? []}
        functii={functii.data ?? []}
        colegi={colegi}
        angajat={angajat}
      />
    </div>
  );
}
