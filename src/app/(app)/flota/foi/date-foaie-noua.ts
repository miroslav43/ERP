// src/app/(app)/flota/foi/date-foaie-noua.ts
import "server-only";

import { listeazaVehicule } from "@/lib/queries/fleet";
import { createServerSupabase } from "@/lib/supabase/server";

import type { DateFoaieNoua } from "./dialog-foaie-noua";

/**
 * Ce are nevoie caseta „Foaie nouă", citit pe server.
 *
 * Era corpul paginii `/flota/foi/noua`, care a dispărut. Puse direct în
 * `page.tsx`, cele două citiri ar fi îngropat lista sub douăzeci de linii care
 * n-o privesc; puse aici, intră într-un singur `Promise.all` cu ce citește
 * oricum pagina, și se cheamă DOAR pentru cine poate crea o foaie.
 *
 * Tipul se importă din fișierul CASETEI, nu invers: componenta client își declară
 * contractul, iar modulul de server îl onorează. Așa, un câmp adăugat în casetă
 * rupe compilarea aici, unde e reparabil — nu la runtime, într-un `undefined`.
 *
 * ── DE CE `status: "activ"` ȘI NU FILTRUL LISTEI ─────────────────────────────
 * Lista de foi își încarcă vehiculele cu `status: null`, fiindcă filtrul ei
 * trebuie să arate și mașinile ieșite din parc. Caseta are nevoie de exact
 * opusul: `internal.foi_parcurs_inainte` refuză cu P0001 o foaie pe un vehicul
 * vândut sau casat, deci alegerea nici n-ar trebui oferită. Două citiri, nu una
 * filtrată în client — altfel prima pagină de 100 de vehicule ar putea fi
 * formată numai din mașini casate.
 */
export async function dateFoaieNoua(organizationId: string): Promise<DateFoaieNoua> {
  const db = await createServerSupabase();

  const [parcul, angajati] = await Promise.all([
    listeazaVehicule(organizationId, {
      status: "activ",
      categorie: null,
      cauta: null,
      cursor: null,
      limita: 100,
    }),
    db
      .from("employees")
      .select("id, full_name, marca")
      .eq("organization_id", organizationId)
      .eq("status", "activ")
      .is("deleted_at", null)
      .order("full_name")
      .limit(500),
  ]);

  /*
   * `error` se verifică, nu se ocolește cu `?? []`.
   *
   * Interogarea asta e scrisă direct aici, în afara stratului `src/lib/queries`,
   * unde regula e `if (error !== null) throw error`. Fără ea, orice eșec — o
   * politică restrânsă, o coloană redenumită, o indisponibilitate de moment —
   * devenea o listă goală: caseta „Foaie nouă" se deschidea cu selectorul de
   * șofer gol, iar omul citea „firma n-are angajați activi" în loc de o eroare.
   */
  if (angajati.error !== null) throw angajati.error;

  return {
    vehicule: parcul.randuri.map((v) => ({
      id: v.id,
      nr_inmatriculare: v.nr_inmatriculare,
      km_curent: v.km_curent,
    })),
    angajati: angajati.data.map((a) => ({
      id: a.id,
      full_name: a.full_name,
      marca: a.marca,
    })),
  };
}
