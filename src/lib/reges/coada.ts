// src/lib/reges/coada.ts
import "server-only";

/**
 * Pune în coadă mesajele cerute de un eveniment din registru.
 *
 * NU TRIMITE NIMIC. Scrie rânduri în `reges_mesaje` cu starea `de_transmis` și
 * cu lanțul de dependențe calculat de `domain/reges/plan.ts`. Trimiterea e o
 * decizie separată, luată de om, din ecranul de coadă — asta a fost cerința:
 * o greșeală de tastare care ajunge instant în registrul oficial cere o corecție
 * transmisă tot prin API, iar corecțiile se văd în istoricul de la ITM.
 *
 * PAYLOAD-UL NU SE PERSISTĂ. Rândul păstrează doar ce trebuie ca să se poată
 * reconstrui mesajul la trimitere: pe cine și ce contract atinge. Corpul —
 * inclusiv CNP-ul — se compune în clipa apăsării butonului și se uită.
 */

import { planificaMesaje, type TipEveniment } from "@/domain/reges/plan";
import type { createServerSupabase } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

export type CerereCoada = Readonly<{
  organizationId: string;
  evenimentId: string;
  employeeId: string;
  contractId: string | null;
  tipEveniment: TipEveniment;
  regesSalariatId: string | null;
  regesContractId: string | null;
}>;

export type RezultatCoada =
  | Readonly<{ ok: true; mesajeCreate: number; deja: boolean }>
  | Readonly<{ ok: false; motiv: string }>;

/**
 * Idempotentă prin construcție: dacă evenimentul are deja mesaje neanulate, nu
 * mai adaugă. Fără verificarea asta, două apăsări pe „Pregătește" ar produce
 * două `InregistrareSalariat` pentru același om, iar al doilea ar fi respins
 * asincron ca duplicat de CNP — adică un refuz de la ITM cauzat de noi.
 */
export async function pregatesteMesaje(
  db: ServerSupabase,
  cerere: CerereCoada,
): Promise<RezultatCoada> {
  const { data: existente, error: eroareCitire } = await db
    .from("reges_mesaje")
    .select("id")
    .eq("organization_id", cerere.organizationId)
    .eq("eveniment_id", cerere.evenimentId)
    .neq("stare", "anulat")
    .is("deleted_at", null)
    .limit(1);
  if (eroareCitire !== null) throw eroareCitire;
  if (existente !== null && existente.length > 0) {
    return { ok: true, mesajeCreate: 0, deja: true };
  }

  const plan = planificaMesaje({
    tipEveniment: cerere.tipEveniment,
    regesSalariatId: cerere.regesSalariatId,
    regesContractId: cerere.regesContractId,
  });
  if (!plan.ok) return { ok: false, motiv: plan.motiv };

  // Un `string[]` declarat, nu un `let` reatribuit. Cu `let`, analiza de flux a
  // lui TypeScript îngustează variabila la tipul ultimei atribuiri — `data.id` —
  // iar `data` depinde de payload-ul care conține chiar variabila: TS7022, buclă
  // de inferență. Citirea dintr-un array cu tip DECLARAT rupe lanțul.
  const idCreate: string[] = [];

  for (const pas of plan.valoare) {
    const depindeDe: string | null = pas.depindeDePrecedentul
      ? (idCreate[idCreate.length - 1] ?? null)
      : null;

    const { data, error } = await db
      .from("reges_mesaje")
      .insert({
        organization_id: cerere.organizationId,
        eveniment_id: cerere.evenimentId,
        employee_id: cerere.employeeId,
        // Mesajul de salariat nu ține de contract: legarea lui ar face ca
        // ștergerea contractului să-l ia cu ea, deși persoana rămâne la ITM.
        contract_id: pas.tip === "salariat" ? null : cerere.contractId,
        tip: pas.tip,
        operatie: pas.operatie,
        ordine: pas.ordine,
        depinde_de: depindeDe,
        cerere_rezumat: { explicatie: pas.explicatie },
      })
      // `.select()` după `.insert()` cere ca politica de SELECT să lase rândul
      // vizibil (capcana 28). Cine are `reges:create` are și `reges:read`.
      .select("id")
      .single();
    if (error !== null) throw error;

    idCreate.push(data.id);
  }

  return { ok: true, mesajeCreate: idCreate.length, deja: false };
}

/**
 * Un mesaj e transmisibil dacă n-are dependență sau dacă dependența lui a primit
 * deja identificatorul REGES.
 *
 * Regula trăiește aici, într-un singur loc, pentru că e ușor de scris greșit:
 * „dependența a reușit" NU e destul — un mesaj poate fi `reusit` fără
 * `referinta_id` dacă serverul a întors SUCCES fără `Result.Ref`, iar contractul
 * construit atunci ar avea `referintaSalariat.id` gol.
 */
export function esteTransmisibil(mesaj: {
  readonly depinde_de: string | null;
  readonly dependenta?: { readonly stare: string; readonly referinta_id: string | null } | null;
}): boolean {
  if (mesaj.depinde_de === null) return true;
  const d = mesaj.dependenta;
  return d !== null && d !== undefined && d.stare === "reusit" && d.referinta_id !== null;
}
