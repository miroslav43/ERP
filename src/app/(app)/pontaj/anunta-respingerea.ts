// src/app/(app)/pontaj/anunta-respingerea.ts
//
// Vestea că o zi de pontaj a fost respinsă, dusă la angajat.
//
// ── DE CE A LIPSIT, ȘI DE CE CONTEAZĂ ───────────────────────────────────────
// `public.decide_zi_pontaj` (0067) scrie `respins_la`, `respins_de` și
// `motiv_respingere`, apoi șterge aprobarea. Atât. Nimic nu pleca mai departe:
// pontajul emitea notificări doar din cele două joburi `pg_cron` din
// `0103_pontaj_mementouri.sql`, iar o zi respinsă nu producea niciuna.
//
// Consecința, reclamată de utilizator pe 10 sept 2026: managerul respinge o zi,
// angajatul nu află NIMIC. Nici notificare în aplicație, nici push, nici măcar
// un semn pe ecranul lui — ziua respinsă arăta acolo exact ca una normală.
// Respingerea cere o corecție de la om; fără o veste, cererea nu ajunge la el,
// iar luna se blochează cu ziua tot greșită.
//
// ── DE CE E BEST-EFFORT ─────────────────────────────────────────────────────
// Decizia e deja luată în bază când ajungem aici. O notificare picată NU are
// voie s-o dea înapoi — ar însemna că managerul apasă „Respinge", primește
// eroare, apasă din nou și scrie a doua oară peste ceva deja scris. Eșecul se
// loghează și atât, exact ca la sincronizarea concediului din `decideCerere`.
//
// ── DE CE PRIMEȘTE CLIENTUL, NU ȘI-L FACE ───────────────────────────────────
// Scrierea are nevoie de clientul de serviciu: `notifications` se scrie pentru
// ALT utilizator decât cel autentificat, iar `employees.user_id` al altcuiva nu
// e garantat vizibil unui manager cu `employees:read = team`. Dar
// `createAdminSupabase` e permis de ESLint doar în `actions.ts` și în route
// handlere, deci clientul vine de sus — exact tiparul lui
// `sincronizeazaZileleDeConcediu` din `sincronizare-concediu.ts`.
//
// Ocolirea RLS rămâne mărginită de filtrul explicit pe `organization_id` de mai
// jos, iar mulțimea a fost deja restrânsă de `decide_zi_pontaj`, care verifică
// singură dreptul aprobatorului asupra fișei.
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { formatDate } from "@/lib/format/date";

/**
 * Anunță angajatul că ziua lui a fost respinsă. Nu aruncă niciodată.
 *
 * Întoarce `true` doar când notificarea chiar a fost scrisă — folosit de acțiune
 * ca să spună aprobatorului dacă vestea a plecat sau nu. Un „am respins" care
 * tace despre faptul că angajatul n-a fost anunțat e jumătate de adevăr.
 */
export async function anuntaRespingereaZilei(
  admin: SupabaseClient<Database>,
  organizationId: string,
  entryId: string,
  motiv: string,
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

    // Fișă fără cont: angajatul n-a fost încă invitat, deci n-are unde primi
    // notificarea. Nu e o eroare — e cazul majoritar în firmele care abia
    // încep. Aprobatorul află din rezultatul acțiunii că vestea n-a plecat.
    const userAngajat = angajat?.user_id ?? null;
    if (userAngajat === null) return false;

    const an = Number(intrare.data.slice(0, 4));
    const luna = Number(intrare.data.slice(5, 7));

    const { error: eroareNotificare } = await admin.from("notifications").insert({
      organization_id: organizationId,
      user_id: userAngajat,
      kind: "warning" as const,
      title: "O zi de pontaj a fost respinsă",
      body: `Ziua de ${formatDate(intrare.data)} a fost respinsă: ${motiv} Corectați-o din pontajul dumneavoastră.`,
      // Direct pe luna zilei, nu pe pagina de start a pontajului: o notificare
      // care cere o corecție trebuie să ducă la locul corecției.
      link: `/portal/pontajul-meu?an=${String(an)}&luna=${String(luna)}`,
      entity_type: "attendance_entry",
      entity_id: entryId,
    });
    if (eroareNotificare !== null) throw eroareNotificare;

    return true;
  } catch (eroare) {
    console.error("[pontaj] notificarea de zi respinsă a eșuat", { entryId, eroare });
    return false;
  }
}
