// src/lib/documents/act-aditional.ts
// Documentul actului adițional de modificare a salariului.
//
// Actul în sine e rândul din `employment_contracts` (`este_act_aditional =
// true`), creat de acțiunea „Modifică salariul". Aici se emite DOCUMENTUL lui —
// textul de semnat, cu număr pe seria AAS, amprentă și rând în registru — prin
// același motor ca restul (`genereazaDocument`).
//
// Fără CNP: șablonul de platformă identifică salariatul prin nume și prin
// contractul la care se încheie actul, deci nu e nevoie de o decriptare
// auditată pentru fiecare mărire de salariu.
import { notFound } from "@/lib/actions/errors";
import type { ServerSupabase } from "@/lib/supabase/server";

import { genereazaDocument, type DocumentGenerat } from "./generator";
import { organizatiaPentruDocumente } from "./inrolare";
import { valoriActAditionalSalariu } from "./valori-inrolare";

export type ParametriActAditionalSalariu = Readonly<{
  organizationId: string;
  employeeId: string;
  /** Rândul actului adițional din `employment_contracts`. */
  actId: string;
  emisDe: string;
  contractNumar: string;
  contractData: string;
  numarAct: string;
  dataAct: string;
  salariuVechi: number;
  salariuNou: number;
  dataAplicarii: string;
}>;

export async function genereazaActAditionalSalariu(
  supabase: ServerSupabase,
  p: ParametriActAditionalSalariu,
): Promise<DocumentGenerat> {
  const { data: angajat } = await supabase
    .from("employees")
    .select("full_name, functie")
    .eq("id", p.employeeId)
    .eq("organization_id", p.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (angajat === null) throw notFound("Fișa de angajat nu există sau nu îți este accesibilă.");

  return genereazaDocument(supabase, {
    organizationId: p.organizationId,
    employeeId: p.employeeId,
    codSablon: "act_aditional_salariu",
    emisDe: p.emisDe,
    contractId: p.actId,
    valori: valoriActAditionalSalariu({
      organizatie: await organizatiaPentruDocumente(supabase, p.organizationId),
      angajatNume: angajat.full_name ?? "",
      functie: angajat.functie,
      contractNumar: p.contractNumar,
      contractData: p.contractData,
      numarAct: p.numarAct,
      dataAct: p.dataAct,
      salariuVechi: p.salariuVechi,
      salariuNou: p.salariuNou,
      dataAplicarii: p.dataAplicarii,
    }),
  });
}
