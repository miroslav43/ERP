// src/lib/documents/fisa-postului.ts
// Generarea fișei postului la înrolare, pe motorul comun din `generator.ts`.
import type { ServerSupabase } from "@/lib/supabase/server";
import { genereazaDocument, type DocumentGenerat } from "./generator";

export type ParametriFisaPostului = {
  readonly organizationId: string;
  readonly employeeId: string;
  readonly emisDe: string;
  readonly angajatNume: string;
  readonly functie: string | null;
  readonly departament: string | null;
  readonly subordonare: string | null;
  readonly atributii: readonly string[];
  readonly competente: readonly string[];
};

/**
 * Text simplu, NU markup `<ul><li>`: `randeaza()` din `generator.ts` trece
 * fiecare valoare prin `escapeHtml` (deliberat — altfel un nume de angajat
 * ar putea injecta HTML în document), deci orice tag inserat aici ar ieși pe
 * pagină ca text literal (`&lt;ul&gt;`), nu ca listă randată.
 */
function listaText(puncte: readonly string[]): string {
  return puncte.length === 0 ? "nespecificate" : puncte.join("; ");
}

export async function genereazaFisaPostului(
  supabase: ServerSupabase,
  parametri: ParametriFisaPostului,
): Promise<DocumentGenerat> {
  const valori = new Map<string, string>([
    ["angajat_nume", parametri.angajatNume],
    ["functie", parametri.functie ?? "nespecificată"],
    ["departament", parametri.departament ?? "nespecificat"],
    ["subordonare", parametri.subordonare ?? "nespecificată"],
    ["atributii", listaText(parametri.atributii)],
    ["competente", listaText(parametri.competente)],
  ]);

  return genereazaDocument(supabase, {
    organizationId: parametri.organizationId,
    employeeId: parametri.employeeId,
    codSablon: "fisa_postului",
    emisDe: parametri.emisDe,
    valori,
  });
}
