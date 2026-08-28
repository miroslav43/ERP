// src/lib/reges/genereaza-evenimente.ts
//
// UNDE SE GENEREAZĂ EVENIMENTELE DE RAPORTAT LA REGES — ȘI DE CE AICI
//
// Nu în trigger de bază de date, deși ar fi tentant („prinde orice UPDATE, inclusiv importul").
// Motive, în ordinea greutății:
//
// 1. Termenul depinde de `reges_termene` ALES pe organizație + de calendarul sărbătorilor
//    legale (Paște ortodox, zile mobile). Un trigger PL/pgSQL ar trebui să reimplementeze
//    aritmetica zilelor lucrătoare în SQL, fără teste unitare, fără posibilitatea de a rula
//    „ce s-ar întâmpla dacă" în UI. Aici este o funcție pură, testată, refolosită identic de
//    formular, de import și de ecranul de previzualizare.
// 2. Un eveniment de raportat are consecințe contravenționale. Trebuie să fie VIZIBIL în rezultatul
//    acțiunii: „am creat contractul ȘI ai termen până pe 29 mai". Un trigger tăcut ascunde asta.
// 3. Trigger-ul generic de audit + RLS FORCE fac ca inserările din trigger să ruleze în contextul
//    sesiunii; `created_by` și antetele de cerere nu sunt disponibile în DB. Rândul de audit
//    corect îl scrie acțiunea, cu `readRequestMeta`.
// 4. Regula S9: validările temporale nu au ce căuta în CHECK; calculul de termen cu atât mai puțin.
//
// CE RĂMÂNE ÎN DB: doar invarianții care nu se pot ocoli (trigger-ele din 0004 pentru path,
// coerența organizației, `updated_at`).
//
// IMPORTUL ÎN MASĂ: apelează EXACT această funcție, o singură dată, cu tot lotul de evenimente.
// De aceea semnătura primește o listă, face un singur SELECT de deduplicare și un singur INSERT.
// Deduplicarea pe (angajat, tip, dată) face operația idempotentă: reluarea unui import eșuat la
// jumătate nu dublează evenimentele.

import { randomUUID } from "node:crypto";
import { mapPostgrestError } from "@/lib/actions/errors";
import type { JsonObject } from "@/lib/actions/types";
import type { ServerSupabase } from "@/lib/supabase/server";
import {
  calculeazaTermen,
  construiesteCalendar,
  type CalendarLucrator,
  type ConfigurareTermen,
  type ReperTermen,
  type TipEvenimentReges,
  type ZiIso,
} from "@/domain/reges/evenimente";

export interface EvenimentDeGenerat {
  readonly employeeId: string;
  readonly contractId: string | null;
  readonly tip: TipEvenimentReges;
  readonly dataEvenimentului: ZiIso;
  readonly valabilDeLa: ZiIso | null;
  readonly dataContract: ZiIso | null;
  readonly payload: JsonObject;
}

export interface EvenimentRespins {
  readonly employeeId: string;
  readonly tip: TipEvenimentReges;
  readonly motiv: string;
}

export interface RezultatGenerare {
  readonly create: number;
  readonly sarite: number;
  readonly respinse: readonly EvenimentRespins[];
}

function cheie(employeeId: string, tip: string, data: string): string {
  return `${employeeId}|${tip}|${data}`;
}

export async function incarcaTermeneReges(
  supabase: ServerSupabase,
  organizationId: string,
): Promise<readonly ConfigurareTermen[]> {
  const { data, error } = await supabase
    .from("reges_termene")
    .select(
      "id, organization_id, event_type, termen_zile, reper, zile_lucratoare, descriere, valabil_de_la, valabil_pana",
    )
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .is("deleted_at", null);

  if (error) throw mapPostgrestError(error, randomUUID());

  return (data ?? []).map((rand) => ({
    id: rand.id,
    organizationId: rand.organization_id,
    eventType: rand.event_type as TipEvenimentReges,
    termenZile: rand.termen_zile,
    reper: rand.reper as ReperTermen,
    zileLucratoare: rand.zile_lucratoare,
    descriere: rand.descriere,
    valabilDeLa: rand.valabil_de_la,
    valabilPana: rand.valabil_pana,
  }));
}

export function calendarPentruAnul(referinta: ZiIso): CalendarLucrator {
  const an = Number.parseInt(referinta.slice(0, 4), 10);
  return construiesteCalendar(an - 1, an + 1);
}

/**
 * Creează evenimentele REGES lipsă. Nu aruncă pentru un eveniment invalid: îl raportează
 * în `respinse`, ca un import de 50 de angajați să nu cadă din cauza unui singur rând.
 */
export async function genereazaEvenimenteReges(input: {
  readonly supabase: ServerSupabase;
  readonly organizationId: string;
  readonly userId: string;
  readonly evenimente: readonly EvenimentDeGenerat[];
}): Promise<RezultatGenerare> {
  const { supabase, organizationId, userId, evenimente } = input;
  if (evenimente.length === 0) return { create: 0, sarite: 0, respinse: [] };

  const configurari = await incarcaTermeneReges(supabase, organizationId);
  const idAngajati = [...new Set(evenimente.map((e) => e.employeeId))];

  const { data: existente, error: eroareExistente } = await supabase
    .from("reges_evenimente")
    .select("employee_id, event_type, data_evenimentului")
    .eq("organization_id", organizationId)
    .in("employee_id", idAngajati)
    .neq("status", "anulat")
    .is("deleted_at", null);

  if (eroareExistente) throw mapPostgrestError(eroareExistente, randomUUID());

  const cunoscute = new Set(
    (existente ?? []).map((r) => cheie(r.employee_id, r.event_type, r.data_evenimentului)),
  );

  const respinse: EvenimentRespins[] = [];
  const deInserat: {
    organization_id: string;
    employee_id: string;
    contract_id: string | null;
    event_type: TipEvenimentReges;
    data_evenimentului: string;
    termen_transmitere: string;
    status: "de_pregatit";
    payload: JsonObject;
    created_by: string;
    updated_by: string;
  }[] = [];
  let sarite = 0;

  for (const eveniment of evenimente) {
    const cheieEveniment = cheie(eveniment.employeeId, eveniment.tip, eveniment.dataEvenimentului);
    if (cunoscute.has(cheieEveniment)) {
      sarite += 1;
      continue;
    }
    const calendar = calendarPentruAnul(eveniment.dataEvenimentului);
    const termen = calculeazaTermen(
      {
        eventType: eveniment.tip,
        dataEvenimentului: eveniment.dataEvenimentului,
        valabilDeLa: eveniment.valabilDeLa,
        dataContract: eveniment.dataContract,
      },
      configurari,
      calendar,
    );
    if (!termen.ok) {
      respinse.push({ employeeId: eveniment.employeeId, tip: eveniment.tip, motiv: termen.motiv });
      continue;
    }
    cunoscute.add(cheieEveniment);
    deInserat.push({
      organization_id: organizationId, // S1: vine din tenant, niciodată de la client
      employee_id: eveniment.employeeId,
      contract_id: eveniment.contractId,
      event_type: eveniment.tip,
      data_evenimentului: eveniment.dataEvenimentului,
      termen_transmitere: termen.valoare.termenTransmitere,
      status: "de_pregatit", // S8: starea inițială e fixată de server
      payload: { ...eveniment.payload, explicatie_termen: termen.valoare.explicatie },
      created_by: userId,
      updated_by: userId,
    });
  }

  if (deInserat.length > 0) {
    const { error } = await supabase.from("reges_evenimente").insert(deInserat);
    if (error) throw mapPostgrestError(error, randomUUID());
  }

  return { create: deInserat.length, sarite, respinse };
}
