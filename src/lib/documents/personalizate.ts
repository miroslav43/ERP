// src/lib/documents/personalizate.ts
// Emiterea unui document creat de firmă (`doc_…`), pentru un angajat.
//
// ── CE ARE ÎN PLUS FAȚĂ DE ÎNROLARE ─────────────────────────────────────────
// Un șablon al firmei poate folosi ORICE variabilă (`VARIABILE_TOATE`), deci se
// completează toate hărțile din `valori-inrolare.ts`. Două lucruri se fac însă
// DOAR pentru variabilele folosite efectiv în text:
//
//   • CNP-ul se decriptează numai dacă textul conține `{{cnp_complet}}`.
//     Decriptarea trece prin `hr_read_sensitive`, care scrie un rând de audit;
//     o cerere de concediu fără CNP n-are de ce să lase în jurnal o consultare
//     de date sensibile.
//   • `date_document` (copia valorilor din rândul emis) primește doar cheile
//     folosite. Altfel fiecare document al firmei ar purta în bază CNP-ul,
//     salariul și adresa angajatului, chiar dacă pe hârtie nu apare niciuna.
import { businessRule, notFound } from "@/lib/actions/errors";
import type { ServerSupabase } from "@/lib/supabase/server";

import type { ContextInrolare } from "./context-angajat";
import { variabileFolosite } from "./curata-html";
import { genereazaDocument } from "./generator";
import {
  DURATA_CONFIDENTIALITATE,
  cnpComplet,
  organizatiaPentruDocumente,
  type DocumentEmis,
} from "./inrolare";
import { valoriToate } from "./valori-inrolare";
import { esteCodPersonalizat } from "./variabile";

export type ParametriDocumentPersonalizat = Readonly<{
  context: ContextInrolare;
  cod: string;
  emisDe: string;
}>;

/** Fișa postului goală: variabilele ei cad pe textul de rezervă, nu pe gol. */
const FARA_FISA = { subordonare: null, atributii: [], competente: [] } as const;

export async function genereazaDocumentPersonalizat(
  supabase: ServerSupabase,
  parametri: ParametriDocumentPersonalizat,
): Promise<DocumentEmis> {
  const { context, cod } = parametri;
  if (!esteCodPersonalizat(cod)) {
    throw businessRule("Se pot emite de aici doar documentele create de firmă.");
  }

  // Doar varianta FIRMEI: un document `doc_…` nu are seed de platformă.
  const { data: sablon } = await supabase
    .from("hr_document_templates")
    .select("denumire, continut_html")
    .eq("cod", cod)
    .eq("organization_id", context.organizationId)
    .eq("activ", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (sablon === null) throw notFound("Șablonul documentului nu mai există.");

  const folosite = variabileFolosite(sablon.continut_html);

  const toate = valoriToate(
    {
      organizatie: await organizatiaPentruDocumente(supabase, context.organizationId),
      angajat: {
        ...context.angajat,
        cnpComplet: folosite.includes("cnp_complet")
          ? await cnpComplet(supabase, context.employeeId)
          : "",
      },
      contract: context.contract,
      azi: context.azi,
    },
    context.fisaPostului ?? FARA_FISA,
    DURATA_CONFIDENTIALITATE,
  );

  const valori = new Map([...toate].filter(([cheie]) => folosite.includes(cheie)));

  const emis = await genereazaDocument(supabase, {
    organizationId: context.organizationId,
    employeeId: context.employeeId,
    codSablon: cod,
    emisDe: parametri.emisDe,
    valori,
  });

  return { cod, denumire: sablon.denumire, id: emis.id, numarAfisat: emis.numarAfisat };
}
