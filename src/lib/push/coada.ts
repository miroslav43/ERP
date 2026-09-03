// src/lib/push/coada.ts
import type { AdminSupabase } from "@/lib/supabase/admin";

import { trimiteLot } from "./expo";
import { construiesteMesaj } from "./mesaj";

/**
 * Golirea cozii de push.
 *
 * Trăiește aici, nu în `route.ts`, ca să se poată testa cu un client fals.
 * Ruta rămâne doar poarta: secretul, metoda, codul de răspuns.
 */

/** După atâtea încercări, rândul se abandonează. */
export const MAX_INCERCARI = 5;

const PLAFON_IMPLICIT = 100;

export type RaportLivrare = {
  readonly luate: number;
  readonly trimise: number;
  readonly esuate: number;
  readonly abandonate: number;
  readonly jetoaneRetrase: number;
};

type RandCoada = {
  readonly id: string;
  readonly incercari: number;
  readonly jeton: string;
  readonly dispozitiv_id: string;
  readonly titlu: string;
  readonly corp: string | null;
  readonly link: string | null;
};

export async function golesteCoada(
  db: AdminSupabase,
  plafon: number = PLAFON_IMPLICIT,
): Promise<RaportLivrare> {
  // ⚠ service_role: OCOLEȘTE RLS. E necesar aici fiindcă livrarea nu are
  // utilizator — rulează pentru toți destinatarii deodată, dintr-un timer.
  // `push_livrari` n-are oricum nicio politică: e închisă și pentru
  // `authenticated`. Filtrarea o face funcția SQL, nu o clauză din TypeScript.
  const { data, error } = await db.rpc("push_ia_din_coada", { p_plafon: plafon });
  if (error !== null) throw new Error(`Preluarea din coadă a eșuat: ${error.message}.`);

  // `data` poate fi `null` (RPC fără rânduri întoarce uneori `null`, nu array
  // gol) — la fel ca orice citire din bază, forma se verifică, nu se
  // presupune.
  const randuri = (data ?? []) as readonly RandCoada[];
  if (randuri.length === 0) {
    return { luate: 0, trimise: 0, esuate: 0, abandonate: 0, jetoaneRetrase: 0 };
  }

  const rezultate = await trimiteLot(
    randuri.map((r) =>
      construiesteMesaj({ jeton: r.jeton, titlu: r.titlu, corp: r.corp, link: r.link }),
    ),
  );

  let trimise = 0;
  let esuate = 0;
  let abandonate = 0;
  let jetoaneRetrase = 0;

  for (const [i, rand] of randuri.entries()) {
    const rezultat = rezultate[i];
    const acum = new Date().toISOString();

    // `rezultat === undefined`: `trimiteLot` garantează un rezultat per mesaj,
    // dar rândul e mai gros decât ce controlează chiar acest fișier — un lot
    // mai scurt decât cozile trimise nu trebuie să blocheze rândul în
    // `in_lucru` la nesfârșit, tratăm absența ca eroare reîncercabilă.
    if (rezultat === undefined || rezultat.fel === "eroare") {
      const incercari = rand.incercari + 1;
      const renunta = incercari >= MAX_INCERCARI;
      if (renunta) abandonate += 1;
      else esuate += 1;
      await db
        .from("push_livrari")
        .update({
          stare: renunta ? "abandonat" : "in_asteptare",
          incercari,
          eroare: rezultat?.fel === "eroare" ? rezultat.mesaj : "Fără bilet de la Expo.",
        })
        .eq("id", rand.id);
      continue;
    }

    if (rezultat.fel === "jeton-mort") {
      jetoaneRetrase += 1;
      abandonate += 1;
      // Retragerea e `deleted_at`, nu DELETE: jurnalul trebuie să poată spune de
      // ce a încetat omul să primească notificări.
      await db.from("dispozitive_push").update({ deleted_at: acum }).eq("id", rand.dispozitiv_id);
      await db
        .from("push_livrari")
        .update({ stare: "abandonat", eroare: "Jeton neînregistrat." })
        .eq("id", rand.id);
      continue;
    }

    trimise += 1;
    await db.from("push_livrari").update({ stare: "trimis", trimis_la: acum }).eq("id", rand.id);
  }

  return { luate: randuri.length, trimise, esuate, abandonate, jetoaneRetrase };
}
