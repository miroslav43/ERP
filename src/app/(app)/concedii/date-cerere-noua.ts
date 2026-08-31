// src/app/(app)/concedii/date-cerere-noua.ts
import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import { todayInBucharest } from "@/lib/format/date";
import {
  coduriIndemnizatieMedicala,
  soldAnual,
  varianteConcediu,
  zileNelucratoare,
} from "@/lib/queries/leave";

import type { DateCerereNoua } from "./dialog-cerere-noua";

/**
 * Tot ce are nevoie caseta „Cerere nouă", strâns într-un singur val de
 * interogări paralele.
 *
 * ── DE CE E UN MODUL, NU CORPUL PAGINII ────────────────────────────────────
 * Era corpul paginii `/concedii/noua`, care a dispărut: formularul se deschide
 * acum dintr-o casetă, deci datele lui trebuie să fie deja pe ecranul de unde
 * se deschide. Puse direct în `page.tsx`, ar fi îngropat lista sub optzeci de
 * linii de citiri care n-o privesc.
 *
 * ── DE CE UN SINGUR `Promise.all` ──────────────────────────────────────────
 * Pagina veche făcea DOUĂ valuri în serie (tipuri + sărbători, apoi coduri +
 * variante, apoi angajați SAU sold): trei drumuri dus-întors unul după altul,
 * pentru date care nu depind una de alta. Aici nu depinde nimic de nimic în
 * afară de `poateAlegeAngajat`, care se știe dinainte — deci totul pleacă
 * odată, iar costul e al celei mai lente interogări, nu suma lor.
 *
 * `zileNelucratoare` și `soldAnual` sunt memoizate pe cerere cu `cache()`:
 * pagina le cheamă și pe cont propriu (rezumatul de sold din capul listei), și
 * al doilea apel nu mai atinge baza.
 */
export async function dateCerereNoua(
  organizationId: string,
  optiuni: Readonly<{
    /** `leave:create = all` — poate depune cererea în numele altcuiva. */
    poateAlegeAngajat: boolean;
    /** `leave:approve = all` — cererea lui se aprobă pe loc, fără lanț. */
    poateAprobaPeLoc: boolean;
  }>,
): Promise<DateCerereNoua> {
  const anCurent = Number(todayInBucharest().slice(0, 4));
  const db = await createServerSupabase();

  const [tipuriRes, zile, coduriMedicale, variante, angajatiRes, sold] = await Promise.all([
    db
      .from("leave_types")
      .select("id, key, denumire, culoare, zile_implicite, scade_din_sold, necesita_document")
      .eq("organization_id", organizationId)
      .eq("activ", true)
      .is("deleted_at", null)
      .order("denumire")
      .returns<DateCerereNoua["tipuri"][number][]>(),
    // Anul dinainte și cel de după: o cerere depusă în decembrie se poate
    // întinde peste Anul Nou, iar sărbătorile din ianuarie schimbă numărătoarea.
    zileNelucratoare(organizationId, anCurent - 1, anCurent + 1),
    // Nomenclatorul de coduri de indemnizație, valabil azi. Fără el, o cerere
    // de concediu medical n-ar avea de unde lua procentul (75/85/100%) și
    // numărul de zile suportate de firmă — iar indemnizația ar rămâne 0 lei.
    coduriIndemnizatieMedicala(todayInBucharest()),
    varianteConcediu(),
    optiuni.poateAlegeAngajat
      ? db
          .from("employees")
          .select("id, full_name, marca")
          .eq("organization_id", organizationId)
          .eq("status", "activ")
          .is("deleted_at", null)
          .order("full_name")
          .returns<{ id: string; full_name: string; marca: string }[]>()
      : Promise.resolve(null),
    // Soldul se arată DOAR când cererea e strict pentru mine însumi (fără
    // selector de angajat): RLS restrânge deja `soldAnual` la rândurile proprii
    // pentru cine are `leave:create = own`. Pentru cine alege un angajat din
    // listă, soldul LUI nu se știe fără încă un drum la server — verificarea
    // exactă se face oricum la trimitere, în acțiune.
    optiuni.poateAlegeAngajat ? Promise.resolve(null) : soldAnual(organizationId, anCurent),
  ]);

  if (tipuriRes.error !== null) throw tipuriRes.error;
  if (angajatiRes !== null && angajatiRes.error !== null) throw angajatiRes.error;

  const soldPropriu =
    sold === null
      ? null
      : Object.fromEntries(
          sold.tipuri.map((tip) => {
            const rand = sold.solduri.find((s) => s.leave_type_id === tip.id);
            return [tip.id, rand?.ramase ?? tip.zile_implicite] as const;
          }),
        );

  return {
    tipuri: tipuriRes.data ?? [],
    coduriMedicale,
    variante,
    sarbatoriRo: zile.nationale.map((z) => z.data),
    liberSuplimentar: zile.organizatie
      .filter((z) => z.tip === "liber_suplimentar")
      .map((z) => z.data),
    zileRecuperare: zile.organizatie.filter((z) => z.tip === "zi_recuperare").map((z) => z.data),
    angajati: angajatiRes?.data ?? null,
    soldPropriu,
    poateAprobaPeLoc: optiuni.poateAprobaPeLoc,
  };
}
