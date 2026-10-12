// src/app/(app)/pontaj/anunta-aprobarea.ts
//
// Vestea că zilele de pontaj au fost aprobate, dusă la angajat.
//
// ── DE CE A LIPSIT ──────────────────────────────────────────────────────────
// Oglinda lui `anunta-respingerea.ts`. Respingerea a primit sender pe 10 sept
// 2026; aprobarea nu — nimic nu cere o corecție de la om, deci părea de prisos.
// Campania QA din 8 oct 2026 (FLX-005) a numărat-o totuși printre lipsuri:
// angajatul vedea în portal zile „în așteptare" care se transformau tăcut în
// aprobate, fără să afle vreodată că cineva s-a uitat peste ele, iar
// fluturașul de la sfârșitul lunii venea ca prima confirmare.
//
// Două forme, fiindcă aprobarea are două intrări:
//   · pe ZI (`decideZiPontaj`), o notificare per zi, exact ca respingerea;
//   · în BLOC (`aprobaPontajBloc`), o notificare per angajat pe lună — un
//     manager care aprobă 22 de zile dintr-o apăsare nu trimite 22 de rânduri.
//
// ── DE CE E BEST-EFFORT ȘI DE CE PRIMEȘTE CLIENTUL ──────────────────────────
// Aceleași motive ca la respingere: decizia e deja scrisă când ajungem aici și
// o notificare picată n-are voie s-o dea înapoi; iar `notifications` se scrie
// pentru ALT utilizator, deci cere clientul de serviciu, pe care ESLint îl
// permite doar în `actions.ts`. Ocolirea RLS rămâne mărginită de filtrul
// explicit pe `organization_id` din fiecare citire.
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { formatDate, formatMonthYear } from "@/lib/format/date";

/**
 * Anunță angajatul că ziua lui a fost aprobată. Nu aruncă niciodată.
 *
 * Întoarce `true` doar când notificarea chiar a fost scrisă; `false` și când
 * fișa n-are cont — cazul obișnuit în firmele care abia încep.
 */
export async function anuntaAprobareaZilei(
  admin: SupabaseClient<Database>,
  organizationId: string,
  entryId: string,
): Promise<boolean> {
  try {
    const { data: intrare, error: eroareIntrare } = await admin
      .from("attendance_entries")
      .select("data, employee_id")
      .eq("id", entryId)
      .eq("organization_id", organizationId)
      .maybeSingle<{ data: string; employee_id: string }>();
    if (eroareIntrare !== null) throw eroareIntrare;
    if (intrare === null) return false;

    const { data: angajat, error: eroareAngajat } = await admin
      .from("employees")
      .select("user_id")
      .eq("id", intrare.employee_id)
      .eq("organization_id", organizationId)
      .maybeSingle<{ user_id: string | null }>();
    if (eroareAngajat !== null) throw eroareAngajat;

    const userAngajat = angajat?.user_id ?? null;
    if (userAngajat === null) return false;

    const { error: eroareNotificare } = await admin.from("notifications").insert({
      organization_id: organizationId,
      user_id: userAngajat,
      kind: "success" as const,
      title: "Ziua de pontaj a fost aprobată",
      body: `Ziua de ${formatDate(intrare.data)} a fost aprobată.`,
      // Pe ZI, ca la respingere: ruta zilei există în portal și e cea pe care
      // o folosesc mementourile din 0103.
      link: `/portal/pontajul-meu/zi/${intrare.data}`,
      entity_type: "attendance_entry",
      entity_id: entryId,
    });
    if (eroareNotificare !== null) throw eroareNotificare;

    return true;
  } catch (eroare) {
    console.error("[pontaj] notificarea de zi aprobată a eșuat", { entryId, eroare });
    return false;
  }
}

/**
 * Anunță fiecare angajat ale cărui zile au intrat în lotul de aprobare — un
 * singur rând per om, cu numărul lui de zile și luna. Nu aruncă niciodată.
 *
 * Întoarce câți angajați au fost anunțați: cei fără cont nu primesc nimic și
 * nu se numără, ca aprobatorul să vadă în rezultat cât din veste a plecat.
 *
 * Linkul e luna din portal; pentru un destinatar din aplicația mare,
 * `TIPAR_LUNA_PORTAL` din `notificari/legaturi.ts` îl traduce la randare.
 */
export async function anuntaAprobareaZilelor(
  admin: SupabaseClient<Database>,
  organizationId: string,
  batchId: string,
  linii: readonly Readonly<{ id: string; employee_id: string }>[],
  an: number,
  luna: number,
): Promise<number> {
  try {
    const zilePeAngajat = new Map<string, number>();
    for (const linie of linii) {
      zilePeAngajat.set(linie.employee_id, (zilePeAngajat.get(linie.employee_id) ?? 0) + 1);
    }
    if (zilePeAngajat.size === 0) return 0;

    const { data: fise, error: eroareFise } = await admin
      .from("employees")
      .select("id, user_id")
      .eq("organization_id", organizationId)
      .in("id", [...zilePeAngajat.keys()]);
    if (eroareFise !== null) throw eroareFise;

    const lunaText = formatMonthYear(an, luna);
    const randuri = (fise ?? []).flatMap((fisa) => {
      const zile = zilePeAngajat.get(fisa.id) ?? 0;
      if (fisa.user_id === null || zile === 0) return [];
      return [
        {
          organization_id: organizationId,
          user_id: fisa.user_id,
          kind: "success" as const,
          title: "Zilele de pontaj au fost aprobate",
          body:
            zile === 1
              ? `O zi din ${lunaText} a fost aprobată.`
              : `${String(zile)} zile din ${lunaText} au fost aprobate.`,
          link: `/portal/pontajul-meu?an=${String(an)}&luna=${String(luna)}`,
          entity_type: "attendance_approval_batch",
          entity_id: batchId,
        },
      ];
    });
    if (randuri.length === 0) return 0;

    const { error: eroareNotificare } = await admin.from("notifications").insert(randuri);
    if (eroareNotificare !== null) throw eroareNotificare;

    return randuri.length;
  } catch (eroare) {
    console.error("[pontaj] notificarea de zile aprobate a eșuat", { batchId, eroare });
    return 0;
  }
}
