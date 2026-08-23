// src/app/(app)/angajati/[id]/documente/page.tsx
import { FileText } from "lucide-react";
import { requireFeature } from "@/lib/auth/features";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format/date";
import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { cn } from "@/lib/ui/cn";
import { ButonStergeDocument, FormularDocument, ListaDescarcare } from "./formular-document";

export default async function PaginaDocumenteAngajat({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
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
      // Nu e o eroare care se poate reîncerca — e un refuz. Un buton
      // „Reîncearcă" pe un rând pe care RLS îl ascunde ar promite ceva ce nu
      // se poate întâmpla; înainte era chiar un `() => {}` gol.
      <StareGoala
        fel="restrictionata"
        titlu="Fișa nu e accesibilă"
        descriere="Fișa de angajat nu există sau nu vă este accesibilă. Dacă ar trebui să o vedeți, cereți acces administratorului organizației."
        actiune={{ eticheta: "Înapoi la angajați", href: "/angajati" }}
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

  // Se ARUNCĂ, nu se randează un panou de eroare în pagină. Pagina e Server
  // Component, deci nu poate primi o funcție de reîncercare — vechiul cod
  // trimitea un `() => {}` gol, adică un buton „Reîncearcă" care nu făcea
  // nimic. Aruncat, eroarea ajunge la `angajati/error.tsx`, unde butonul chiar
  // reîmprospătează datele de pe server.
  if (documente.error !== null || tipuri.error !== null) {
    throw new Error("Nu am putut încărca dosarul de documente al angajatului.");
  }

  return (
    <div className={cn(LATIMI.detaliu, "flex flex-col gap-6")}>
      <AntetPagina
        titlu={`Documente — ${angajat.full_name ?? ""}`}
        descriere={`Marca ${angajat.marca}`}
      />

      {poateIncarca ? (
        <FormularDocument employeeId={angajat.id} tipuri={tipuri.data} />
      ) : (
        <p className="text-muted-foreground text-corp">Ai doar drept de consultare a dosarului.</p>
      )}

      {documente.data.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={FileText}
          titlu="Dosarul este gol"
          descriere="Încarcă primul document: contractul individual de muncă sau actul de identitate."
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
                    <span className="bg-warning/12 text-foreground text-nota ml-2 rounded px-2 py-0.5">
                      confidențial
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground text-corp">
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
    </div>
  );
}
