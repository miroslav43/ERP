// src/app/(app)/evaluari/anunta-evaluarea.ts
//
// Vestea că evaluarea unui angajat a fost finalizată, dusă la el.
//
// ── DE CE ───────────────────────────────────────────────────────────────────
// Finalizarea scria `status = 'finalizat'` și atât. Angajatul nu afla nimic,
// iar portalul nu avea niciun ecran de evaluări — un om evaluat pe 6 oct 2026
// nu putea nici afla, nici vedea evaluarea. Politica SELECT din 0119 îi lăsa
// deja evaluările FINALIZATE (ciornele rămân ascunse), deci lipsea doar drumul
// până la ele: notificarea de aici și `/portal/evaluarile-mele`.
//
// ── DE CE E BEST-EFFORT ─────────────────────────────────────────────────────
// Ca la `anuntaRespingereaZilei` din pontaj: când ajungem aici, evaluarea e
// deja finalizată. O notificare picată NU are voie s-o dea înapoi; eșecul se
// loghează, iar acțiunea întoarce totuși reușita.
//
// ── DE CE PRIMEȘTE CLIENTUL DE SERVICIU ─────────────────────────────────────
// `notifications` se scrie pentru ALT utilizator decât cel autentificat, iar
// `employees.user_id` al altcuiva nu e garantat vizibil unui manager cu
// `employees:read = team`. Clientul vine din `actions.ts` (singurul loc în care
// ESLint îl permite), iar ocolirea RLS e mărginită de filtrul explicit pe
// `organization_id`; evaluarea a trecut deja prin RLS-ul celui care a
// finalizat-o.
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeazaCriterii } from "@/domain/evaluations/criterii";
import { calculeazaScor, type RaspunsCriteriu } from "@/domain/evaluations/scor";
import { formatDate } from "@/lib/format/date";
import type { Database } from "@/types/database";

/**
 * Unde duce notificarea: ancora evaluării, în portal pentru rolul `employee`
 * (singurul care intră acolo) și în `/evaluari/ale-mele` pentru ceilalți — un
 * manager evaluat de șeful lui ar fi fost trimis la o adresă care îl
 * redirecționează în altă parte.
 */
export const legaturaEvaluare = (evaluareId: string, rol: string | null): string =>
  rol === "employee"
    ? `/portal/evaluarile-mele#evaluare-${evaluareId}`
    : `/evaluari/ale-mele#evaluare-${evaluareId}`;

/**
 * Anunță angajatul că evaluarea lui a fost finalizată. Nu aruncă niciodată.
 * `true` doar când notificarea chiar a fost scrisă.
 */
export async function anuntaEvaluareaFinalizata(
  admin: SupabaseClient<Database>,
  organizationId: string,
  evaluareId: string,
): Promise<boolean> {
  try {
    const { data: evaluare, error: eroareEvaluare } = await admin
      .from("employee_evaluations")
      .select(
        "id, employee_id, data_evaluarii, criterii_sablon, raspunsuri, template:evaluation_templates!template_id(denumire)",
      )
      .eq("id", evaluareId)
      .eq("organization_id", organizationId)
      .eq("status", "finalizat")
      .is("deleted_at", null)
      .maybeSingle<{
        id: string;
        employee_id: string;
        data_evaluarii: string;
        criterii_sablon: unknown;
        raspunsuri: unknown;
        template: { denumire: string } | null;
      }>();
    if (eroareEvaluare !== null) throw eroareEvaluare;
    if (evaluare === null) return false;

    const { data: angajat, error: eroareAngajat } = await admin
      .from("employees")
      .select("user_id")
      .eq("id", evaluare.employee_id)
      .eq("organization_id", organizationId)
      .maybeSingle<{ user_id: string | null }>();
    if (eroareAngajat !== null) throw eroareAngajat;

    // Fișă fără cont: angajatul n-a fost încă invitat, deci n-are unde primi
    // vestea. Evaluarea îl așteaptă în portal din clipa în care intră.
    const userAngajat = angajat?.user_id ?? null;
    if (userAngajat === null) return false;

    const { data: membru, error: eroareMembru } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", userAngajat)
      .is("deleted_at", null)
      .maybeSingle<{ role: string }>();
    if (eroareMembru !== null) throw eroareMembru;

    const criterii = normalizeazaCriterii(evaluare.criterii_sablon);
    const raspunsuri = (
      Array.isArray(evaluare.raspunsuri) ? evaluare.raspunsuri : []
    ) as readonly RaspunsCriteriu[];
    const { procent } = calculeazaScor(criterii, raspunsuri);
    const sablon = evaluare.template?.denumire ?? "evaluarea";

    const { error: eroareNotificare } = await admin.from("notifications").insert({
      organization_id: organizationId,
      user_id: userAngajat,
      kind: "info" as const,
      title: "Evaluarea dumneavoastră a fost finalizată",
      body: `${sablon}, din ${formatDate(evaluare.data_evaluarii)}${
        procent === null ? "" : `: ${String(procent)} %`
      }. Notele, comentariile și concluzia sunt în „Evaluările mele”.`,
      link: legaturaEvaluare(evaluare.id, membru?.role ?? null),
      entity_type: "employee_evaluation",
      entity_id: evaluare.id,
    });
    if (eroareNotificare !== null) throw eroareNotificare;
    return true;
  } catch (eroare) {
    console.error("[evaluari] notificarea de evaluare finalizată a eșuat", { evaluareId, eroare });
    return false;
  }
}
