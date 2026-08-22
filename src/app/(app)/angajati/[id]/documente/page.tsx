// src/app/(app)/angajati/[id]/documente/page.tsx
import { FileText } from "lucide-react";
import { requireFeature } from "@/lib/auth/features";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format/date";
import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { StareEroare } from "@/components/feedback/stare-eroare";
import { ButonStergeDocument, FormularDocument, ListaDescarcare } from "./formular-document";

export default async function PaginaDocumenteAngajat({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);
  const scopCitire = scopeFor(permisiuni, "employees:read");
  if (scopCitire === null || scopCitire === "none") {
    return <AccesRestrictionat mesaj="Nu ai dreptul de a vedea dosarele de personal." />;
  }
  const scopActualizare = scopeFor(permisiuni, "employees:update");
  const poateIncarca = scopActualizare !== null && scopActualizare !== "none";
  const scopStergere = scopeFor(permisiuni, "employees:delete");
  const poateSterge = scopStergere !== null && scopStergere !== "none";

  const supabase = await createServerSupabase();
  const { data: angajat } = await supabase
    .from("employees")
    .select("id, full_name, marca")
    .eq("id", id)
    .eq("organization_id", tenant.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (angajat === null) {
    return (
      <StareEroare
        titlu="Fișa de angajat nu există sau nu îți este accesibilă."
        eroare={new Error("Fișa de angajat nu există sau nu îți este accesibilă.")}
        reincearca={() => {}}
      />
    );
  }

  const [documente, tipuri] = await Promise.all([
    supabase
      .from("employee_documents")
      .select(
        "id, titlu, numar_document, data_document, valabil_pana, confidential, fisier_nume, employee_document_types(denumire)",
      )
      .eq("employee_id", id)
      .is("deleted_at", null)
      .order("data_document", { ascending: false, nullsFirst: false }),
    supabase
      .from("employee_document_types")
      .select(
        "id, denumire, cere_valabilitate, confidential_implicit, vizibil_angajatului_implicit",
      )
      .or(`organization_id.eq.${tenant.organizationId},organization_id.is.null`)
      .eq("activ", true)
      .is("deleted_at", null)
      .order("ordine"),
  ]);

  if (documente.error !== null || tipuri.error !== null) {
    return (
      <StareEroare
        titlu="Nu am putut încărca dosarul. Reîncarcă pagina."
        eroare={new Error("Nu am putut încărca dosarul.")}
        reincearca={() => {}}
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Documente — {angajat.full_name}</h1>
        <p className="text-muted-foreground text-sm">Marca {angajat.marca}</p>
      </header>

      {poateIncarca ? (
        <FormularDocument employeeId={angajat.id} tipuri={tipuri.data} />
      ) : (
        <p className="text-muted-foreground text-sm">Ai doar drept de consultare a dosarului.</p>
      )}

      {documente.data.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Dosarul este gol"
          description="Încarcă primul document: contractul individual de muncă sau actul de identitate."
        />
      ) : (
        <ul className="divide-border divide-y">
          {documente.data.map((document) => (
            <li
              key={document.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="font-medium">
                  {document.titlu}
                  {document.confidential && (
                    <span className="bg-warning/12 text-foreground ml-2 rounded px-2 py-0.5 text-xs">
                      confidențial
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground text-sm">
                  {document.data_document === null
                    ? "fără dată"
                    : formatDate(document.data_document)}
                  {document.valabil_pana !== null &&
                    ` · valabil până la ${formatDate(document.valabil_pana)}`}
                </p>
              </div>
              <span className="flex flex-wrap items-center gap-2">
                <ListaDescarcare documentId={document.id} numeFisier={document.fisier_nume} />
                <ButonStergeDocument documentId={document.id} poateSterge={poateSterge} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
