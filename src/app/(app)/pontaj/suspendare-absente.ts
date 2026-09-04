// src/app/(app)/pontaj/suspendare-absente.ts
// Al doilea drum către o suspendare de contract: absențele nemotivate.
//
// Diferă de cel din concedii (`concedii/suspendare-contract.ts`) prin trei
// lucruri, toate impuse de realitate, nu de arhitectură:
//
//   1. NU pleacă dintr-o cerere. Nimeni nu cere să lipsească nemotivat; faptul
//      se constată din pontaj, după ce s-a întâmplat.
//   2. Termenul e ALTUL — 3 zile lucrătoare DE LA suspendare, nu ziua
//      anterioară, fiindcă nimeni nu știe ieri că omul nu vine azi. De aceea
//      evenimentele poartă tipurile `*_nemotivata` din 0128.
//   3. Nu se știe CÂND se închide. Suspendarea se deschide cu `data_sfarsit`
//      NULL și se închide abia când pontajul primește ore lucrate — momentul în
//      care aplicația află, prima, că omul e înapoi.
//
// ┌ De ce nu se suspendă automat ─────────────────────────────────────────────
// │ O absență de o zi are prea multe explicații nevinovate. O suspendare
// │ transmisă la ITM și apoi retrasă e o corecție de registru pe care o vede
// │ toată lumea. Aplicația semnalează de la a doua zi (`PRAG_ZILE_ALERTA`) și
// │ lasă decizia unui om — care alege și intervalul.
// └───────────────────────────────────────────────────────────────────────────
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { genereazaEvenimenteReges } from "@/lib/reges/genereaza-evenimente";
import type { Database } from "@/types/database";

type AdminSupabase = SupabaseClient<Database>;

const TEMEI_ABSENTE = "Codul Muncii art. 51 alin. (2) — absențe nemotivate (DE VERIFICAT)";

/** Suspendarea activă din absențe care blochează pontarea unei zile lucrate. */
export interface ConflictSuspendare {
  readonly suspendareId: string;
  readonly dataInceput: string;
  readonly mesaj: string;
}

export interface RezultatEmitere {
  readonly ok: boolean;
  readonly suspendareId: string | null;
  readonly termen: string | null;
  readonly motiv: string | null;
}

/** Contractul activ al angajatului, sau `null` dacă fișa n-are unul. */
async function contractActiv(
  admin: AdminSupabase,
  organizationId: string,
  employeeId: string,
): Promise<{ id: string; data_contract: string } | null> {
  const { data, error } = await admin
    .from("employment_contracts")
    .select("id, data_contract")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .eq("status", "activ")
    .is("deleted_at", null)
    .order("valabil_de_la", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error !== null) throw error;
  return data;
}

/**
 * Suspendarea din absențe încă deschisă pentru angajat, dacă există.
 *
 * `data_sfarsit is null` e chiar definiția lui „încă deschisă": o suspendare
 * din absențe nu-și cunoaște sfârșitul în momentul emiterii.
 */
export async function suspendareaDinAbsente(
  admin: AdminSupabase,
  organizationId: string,
  employeeId: string,
): Promise<{ id: string; data_inceput: string; contract_id: string } | null> {
  const { data, error } = await admin
    .from("contract_suspendari")
    .select("id, data_inceput, contract_id")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .eq("sursa", "absenta_nemotivata")
    .eq("stare", "activa")
    .is("data_sfarsit", null)
    .is("deleted_at", null)
    .order("data_inceput", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error !== null) throw error;
  return data;
}

/**
 * Emite decizia de suspendare pentru absențe nemotivate, pe un interval ales de om.
 *
 * `dataSfarsit` e aproape întotdeauna `null`: decizia se ia cât timp omul încă
 * lipsește, iar închiderea vine de la `inchideSuspendareaLaReluare`. Se acceptă
 * totuși un capăt explicit, pentru cazul în care HR înregistrează retroactiv o
 * perioadă deja încheiată.
 */
export async function emiteSuspendarePentruAbsente(
  admin: AdminSupabase,
  organizationId: string,
  employeeId: string,
  dataInceput: string,
  dataSfarsit: string | null,
  userId: string,
  requestId: string,
): Promise<RezultatEmitere> {
  try {
    const contract = await contractActiv(admin, organizationId, employeeId);
    if (contract === null) {
      return {
        ok: false,
        suspendareId: null,
        termen: null,
        motiv:
          "Angajatul nu are niciun contract activ în aplicație, deci nu există ce suspenda. " +
          "Completați contractul, apoi emiteți decizia din nou.",
      };
    }

    const { data: creata, error: eroareInserare } = await admin
      .from("contract_suspendari")
      .insert({
        organization_id: organizationId,
        contract_id: contract.id,
        employee_id: employeeId,
        data_inceput: dataInceput,
        data_sfarsit: dataSfarsit,
        temei_legal: TEMEI_ABSENTE.slice(0, 120),
        explicatie: "Decizie emisă după constatarea absențelor nemotivate din pontaj.",
        stare: "activa",
        sursa: "absenta_nemotivata",
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .maybeSingle();
    if (eroareInserare !== null) {
      if (eroareInserare.code === "23P01") {
        return {
          ok: false,
          suspendareId: null,
          termen: null,
          motiv:
            "Contractul are deja o suspendare activă care se suprapune peste intervalul ales. " +
            "Verificați-o în modulul REGES înainte de a emite alta.",
        };
      }
      throw eroareInserare;
    }
    // `.select()` după `.insert()`: rândul lipsă înseamnă că politica l-a
    // respins tăcut, nu că inserarea a reușit fără să întoarcă nimic.
    if (creata === null) {
      throw new Error("Suspendarea nu a fost creată — inserarea a întors zero rânduri.");
    }

    // Un singur eveniment acum: reluarea nu are dată câtă vreme omul nu s-a
    // întors. Ea se generează la închidere, în `inchideSuspendareaLaReluare`.
    const rezultat = await genereazaEvenimenteReges({
      supabase: admin,
      organizationId,
      userId,
      evenimente: [
        {
          employeeId,
          contractId: contract.id,
          tip: "suspendare_nemotivata",
          dataEvenimentului: dataInceput,
          valabilDeLa: dataInceput,
          dataContract: contract.data_contract,
          payload: { temei_legal: TEMEI_ABSENTE, sursa: "absenta_nemotivata" },
        },
      ],
    });
    if (rezultat.respinse.length > 0) {
      return {
        ok: true,
        suspendareId: creata.id,
        termen: null,
        motiv:
          "Suspendarea a fost înregistrată, dar evenimentul REGES nu a putut fi pregătit: " +
          rezultat.respinse.map((r) => r.motiv).join(" "),
      };
    }

    return { ok: true, suspendareId: creata.id, termen: null, motiv: null };
  } catch (eroare) {
    console.error("[pontaj] emiterea deciziei de suspendare a eșuat", {
      requestId,
      employeeId,
      eroare,
    });
    return {
      ok: false,
      suspendareId: null,
      termen: null,
      motiv:
        "Decizia de suspendare nu a putut fi înregistrată. Încercați din nou sau " +
        "înregistrați-o manual din modulul REGES.",
    };
  }
}

/**
 * Închide suspendarea din absențe și pregătește evenimentul de reluare.
 *
 * Ziua reluării e ZIUA CURENTĂ, nu ziua de după ultima absență: omul s-a
 * prezentat azi, iar asta e data pe care o cere registrul. Termenul lui
 * `reluare_nemotivata` e zero tocmai ca ziua asta să nu apară ca întârziere —
 * legea a uitat să prevadă o excepție pentru reluare, deși regula generală
 * („ziua anterioară") e aici imposibil de respectat. — v. 0128.
 *
 * NU aruncă: ziua de pontaj a fost deja salvată când se ajunge aici.
 */
export async function inchideSuspendareaLaReluare(
  admin: AdminSupabase,
  organizationId: string,
  employeeId: string,
  suspendareId: string,
  ziReluarii: string,
  userId: string,
  requestId: string,
): Promise<string | null> {
  try {
    // Ultima zi de suspendare e cea de DINAINTEA întoarcerii; `data_sfarsit`
    // marchează ultima zi în care omul lipsea, nu prima în care e prezent.
    const { data: inchisa, error: eroareInchidere } = await admin
      .from("contract_suspendari")
      .update({ stare: "incetata", updated_by: userId })
      .eq("id", suspendareId)
      .eq("organization_id", organizationId)
      .eq("stare", "activa")
      .select("id, contract_id")
      .maybeSingle();
    if (eroareInchidere !== null) throw eroareInchidere;
    // Zero rânduri = altcineva a închis-o între timp. Nu e o eroare, dar nici
    // un motiv să generăm un al doilea eveniment de reluare.
    if (inchisa === null) return null;

    const contract = await contractActiv(admin, organizationId, employeeId);
    const rezultat = await genereazaEvenimenteReges({
      supabase: admin,
      organizationId,
      userId,
      evenimente: [
        {
          employeeId,
          contractId: inchisa.contract_id,
          tip: "reluare_nemotivata",
          dataEvenimentului: ziReluarii,
          valabilDeLa: ziReluarii,
          dataContract: contract?.data_contract ?? null,
          payload: { temei_legal: TEMEI_ABSENTE, sursa: "absenta_nemotivata" },
        },
      ],
    });
    if (rezultat.respinse.length > 0) {
      return (
        "Suspendarea a fost închisă, dar evenimentul de reluare nu a putut fi pregătit: " +
        rezultat.respinse.map((r) => r.motiv).join(" ")
      );
    }
    return null;
  } catch (eroare) {
    console.error("[pontaj] închiderea suspendării la reluare a eșuat", {
      requestId,
      employeeId,
      suspendareId,
      eroare,
    });
    return (
      "Ziua a fost salvată, dar suspendarea contractului nu a putut fi închisă. " +
      "Închideți-o manual din modulul REGES — reluarea se transmite în ziua prezentării."
    );
  }
}
