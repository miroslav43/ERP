// src/app/(app)/angajati/[id]/documente/page.tsx
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { requireFeature } from "@/lib/auth/features";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format/date";
import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { StareGoala } from "@/components/ui/stare-goala";
import { cn } from "@/lib/ui/cn";
import { ButonStergeDocument, FormularDocument, ListaDescarcare } from "./formular-document";
import { ButonEmiteLipsa } from "./buton-emite-lipsa";

export default async function PaginaDocumenteAngajat({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "nucleu"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);
  const scopCitire = scopeFor(permisiuni, "employees:read");
  if (scopCitire === null || scopCitire === "none") {
    return <AccesRestrictionat mesaj="Nu ai dreptul de a vedea dosarele de personal." />;
  }
  const scopActualizare = scopeFor(permisiuni, "employees:update");
  const poateIncarca = scopActualizare !== null && scopActualizare !== "none";
  const scopStergere = scopeFor(permisiuni, "employees:delete");
  const poateSterge = scopStergere !== null && scopStergere !== "none";
  // Emiterea unui document oficial cere același prag ca înrolarea: e actul care
  // consumă un număr din registrul seriei, nu o încărcare de fișier.
  const poateInrola = scopeFor(permisiuni, "employees:create") === "all";

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

  const [documente, tipuri, emise] = await Promise.all([
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
    /*
     * Documentele GENERATE — contractul, fișa postului, NDA, anexa de
     * proprietate intelectuală, actul adițional de telemuncă.
     *
     * Stau în altă tabelă decât fișierele încărcate (`hr_issued_documents` vs
     * `employee_documents`), au numerotare proprie pe serie și o amprentă
     * SHA-256. Până acum nu erau vizibile NICĂIERI în aplicație: HR-ul le vedea
     * o dată, în ecranul de confirmare al înrolării, și nu le mai găsea
     * niciodată. Portalul angajatului le arăta; ecranul administratorului, nu.
     */
    supabase
      .from("hr_issued_documents")
      .select("id, titlu, numar_afisat, emis_la, anulat_la")
      .eq("employee_id", id)
      .eq("organization_id", tenant.organizationId)
      .is("deleted_at", null)
      .order("emis_la", { ascending: false }),
  ]);

  // Se ARUNCĂ, nu se randează un panou de eroare în pagină. Pagina e Server
  // Component, deci nu poate primi o funcție de reîncercare — vechiul cod
  // trimitea un `() => {}` gol, adică un buton „Reîncearcă" care nu făcea
  // nimic. Aruncat, eroarea ajunge la `angajati/error.tsx`, unde butonul chiar
  // reîmprospătează datele de pe server.
  // `emise` intră și el în verificare: acum lista lui e conținut, nu un extra
  // pentru administratori, iar un `?? []` peste o eroare ar arăta identic cu un
  // angajat fără niciun document emis.
  if (documente.error !== null || tipuri.error !== null || emise.error !== null) {
    throw new Error("Nu am putut încărca dosarul de documente al angajatului.");
  }

  return (
    <div className={cn(LATIMI.detaliu, "flex flex-col gap-6")}>
      <div>
        <Link
          href={`/angajati/${angajat.id}`}
          className="text-muted-foreground hover:text-foreground text-corp inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Înapoi la fișa angajatului
        </Link>
        <AntetPagina
          className="mt-1"
          titlu={`Documente — ${angajat.full_name ?? ""}`}
          descriere={`Marca ${angajat.marca} · ${String(documente.data.length)} document(e) în dosar`}
        />
      </div>

      {/*
       * Lista se arată oricui poate CITI fișa, nu doar celui care poate EMITE.
       *
       * Poarta era `poateInrola` (`employees:create = all`) pe toată secțiunea,
       * inclusiv pe listă. Efectul: documentele generate la înrolare — contract,
       * fișă a postului, NDA, anexă PI, act de telemuncă — erau invizibile
       * pentru cine avea drept de citire, deși `hr_issued_select` (RLS) i le
       * dădea. Permisiunea de emitere păzește acum doar butonul de emitere,
       * fiindcă EA e cea care consumă un număr din registrul seriei.
       */}
      {poateInrola || (emise.data ?? []).length > 0 ? (
        <section className="border-border rounded-panou border p-4">
          <h2 className="text-foreground text-sectiune font-semibold">Documente generate</h2>
          <p className="text-muted-foreground text-corp mt-1">
            {(emise.data ?? []).length === 0
              ? "Niciun document emis încă. Butonul de mai jos generează contractul, fișa postului, acordul de confidențialitate, anexa de proprietate intelectuală și — la telemuncă — actul adițional."
              : "Emise de aplicație, cu număr propriu și amprentă. Se deschid în PDF."}
          </p>
          {poateInrola ? (
            <div className="mt-3">
              <ButonEmiteLipsa employeeId={angajat.id} />
            </div>
          ) : null}
          <ul className="divide-border mt-3 divide-y">
            {(emise.data ?? []).map((document) => (
              <li key={document.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
                <Link
                  href={`/documente/${document.id}?format=pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-corp underline decoration-1 underline-offset-4 hover:decoration-2"
                >
                  {document.titlu}
                </Link>
                <span className="text-muted-foreground text-nota">{document.numar_afisat}</span>
                <span className="text-muted-foreground text-nota">
                  {formatDate(document.emis_la)}
                </span>
                {document.anulat_la === null ? null : <Badge ton="neutru">Anulat</Badge>}
                <Link
                  href={`/documente/${document.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground text-nota ml-auto underline-offset-2 hover:underline"
                >
                  Vezi în pagină
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {poateIncarca ? <FormularDocument employeeId={angajat.id} tipuri={tipuri.data} /> : null}

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
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {document.titlu}
                  {document.confidential && <Badge ton="atentie">Confidențial</Badge>}
                </p>
                {/*
                 * Tipul documentului se citea din bază („Contract", „Act de
                 * identitate", „Medicina muncii") și nu se afișa NICĂIERI:
                 * `employee_document_types(denumire)` intra în `select` și
                 * ieșea din randare. Într-un dosar cu douăzeci de rânduri,
                 * titlul singur nu spune dacă lipsește fișa de aptitudine.
                 */}
                <p className="text-muted-foreground text-corp">
                  {document.employee_document_types?.denumire ?? "Tip nedefinit"}
                  {" · "}
                  {document.numar_document === null
                    ? "fără număr"
                    : `nr. ${document.numar_document}`}
                  {" · "}
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
