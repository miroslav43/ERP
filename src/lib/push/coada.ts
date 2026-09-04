// src/lib/push/coada.ts
import type { AdminSupabase } from "@/lib/supabase/admin";
import { CONTEXT_GOL, contexteDestinatar } from "@/app/(portal)/portal/notificarile-mele/context";
import type { ContextDestinatar } from "@/app/(portal)/portal/notificarile-mele/legaturi";

import { trimiteLot } from "./expo";
import { construiesteMesaj } from "./mesaj";

/**
 * Golirea cozii de push.
 *
 * Trăiește aici, nu în `route.ts`, ca să se poată testa cu un client fals.
 * Ruta rămâne doar poarta: secretul, metoda, codul de răspuns.
 *
 * INVARIANTA RAPORTULUI
 * `trimise + esuate + abandonate` poate fi STRICT mai mic decât `luate`: o
 * scriere de stare care eșuează (rețea, termenul din `fetchCuTermen()`) nu se
 * numără la niciun contor — rândul rămâne `in_lucru` și e recuperat peste 10
 * minute de `push_ia_din_coada`. Diferența dintre `luate` și suma celorlalte
 * patru e deci numărul de scrieri eșuate în această rulare, vizibil în
 * `journalctl` prin mesajele `console.error` de mai jos, nu ascuns într-un
 * contor fals.
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

/**
 * Contextul de proprietate al fiecărui DISPOZITIV din lot.
 *
 * Un lot amestecă destinatari — mai multe telefoane, mai multe firme — iar
 * `push_ia_din_coada` întoarce doar `dispozitiv_id`, nu și cui aparține. Deci
 * un drum în plus la `dispozitive_push`, pe chei primare, o dată pe lot.
 *
 * DE CE NU O MIGRARE care să adauge `user_id` în tipul întors: schimbarea
 * tipului de retur al unei funcții cere `drop` + `create`, iar `0122` are DOUĂ
 * semnături (`app.` și învelișul `public.`) — exact configurația care a produs
 * deja o dată `42725, function is not unique`. Două citiri indexate pe lot, la
 * volumele reale (câteva notificări pe zi), costă mai puțin decât riscul ăla.
 *
 * O citire picată NU oprește livrarea: contextul iese gol, legăturile
 * `/concedii/<uuid>` rămân netraduse, iar notificarea aterizează în cutia
 * poștală. Omul primește mesajul; pierde doar un tap.
 */
async function contextePeDispozitiv(
  db: AdminSupabase,
  randuri: readonly RandCoada[],
): Promise<ReadonlyMap<string, ContextDestinatar>> {
  const goale = new Map<string, ContextDestinatar>();
  const dispozitiveIds = [...new Set(randuri.map((r) => r.dispozitiv_id))];

  // ⚠ service_role: OCOLEȘTE RLS, ca tot restul funcției `golesteCoada`.
  // Filtrul e `in (id-urile din lotul propriu)` — id-uri venite din coada
  // însăși, nu dintr-o intrare de utilizator, deci lotul nu poate atinge alt
  // dispozitiv decât cele pe care tocmai le-a preluat.
  const { data, error } = await db
    .from("dispozitive_push")
    .select("id, user_id, organization_id")
    .in("id", dispozitiveIds);
  if (error !== null) {
    logEsecScriere("citirea dispozitivelor pentru contextul legăturilor a eșuat", error);
    return goale;
  }

  const dispozitive = data ?? [];
  if (dispozitive.length === 0) return goale;

  const contexte = await contexteDestinatar(
    db,
    [...new Set(dispozitive.map((d) => d.organization_id))],
    randuri.map((r) => r.link),
  );

  return new Map(dispozitive.map((d) => [d.id, contexte.get(d.user_id) ?? CONTEXT_GOL] as const));
}

function logEsecScriere(context: string, eroare: { message: string }): void {
  // `console.error`, nu aruncare: o singură scriere picată nu trebuie să
  // oprească prelucrarea restului lotului. Rândul ei rămâne recuperabil.
  console.error(`[push-coada] ${context}: ${eroare.message}.`);
}

export async function golesteCoada(
  db: AdminSupabase,
  plafon: number = PLAFON_IMPLICIT,
): Promise<RaportLivrare> {
  // ⚠ service_role: OCOLEȘTE RLS. E necesar aici fiindcă livrarea nu are
  // utilizator — rulează pentru toți destinatarii deodată, dintr-un timer.
  // `push_livrari` n-are oricum nicio politică: e închisă și pentru
  // `authenticated`. Filtrarea o face funcția SQL, nu o clauză din TypeScript.
  const { data, error } = await db.rpc("push_ia_din_coada", {
    p_plafon: plafon,
    p_max_incercari: MAX_INCERCARI,
  });
  if (error !== null) throw new Error(`Preluarea din coadă a eșuat: ${error.message}.`);

  // `data` poate fi `null` (RPC fără rânduri întoarce uneori `null`, nu array
  // gol) — la fel ca orice citire din bază, forma se verifică, nu se
  // presupune.
  const randuri = (data ?? []) as readonly RandCoada[];
  if (randuri.length === 0) {
    return { luate: 0, trimise: 0, esuate: 0, abandonate: 0, jetoaneRetrase: 0 };
  }

  const contexte = await contextePeDispozitiv(db, randuri);

  const rezultate = await trimiteLot(
    randuri.map((r) =>
      construiesteMesaj({
        jeton: r.jeton,
        titlu: r.titlu,
        corp: r.corp,
        link: r.link,
        context: contexte.get(r.dispozitiv_id) ?? CONTEXT_GOL,
      }),
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
      // `rand.incercari` e DEJA incrementat de `push_ia_din_coada` la
      // preluare (0122, secțiunea 5b) — NU se mai scrie înapoi aici, și cu
      // atât mai puțin cu un `+ 1` suplimentar. Motivul: SQL-ul a scris deja
      // exact această valoare; o rescriere de-aici ar fi azi un no-op, dar la
      // o suprapunere de recuperare (rândul reluat de altă preluare între
      // citirea asta și scrierea de mai jos) ar rescrie o valoare STAGNANTĂ
      // peste incrementul unei preluări mai noi. Decizia `renunta` tot
      // folosește `rand.incercari` — corectă pentru RUNDA curentă; dacă
      // scrierea de mai jos eșuează constant, `push_ia_din_coada` are acum
      // propriul ei plasă de siguranță (Pasul 1, secțiunea 5b): abandonă
      // direct rândurile cu `incercari` la prag, indiferent ce scrie
      // TypeScript.
      const renunta = rand.incercari >= MAX_INCERCARI;
      const { error: eroareScriere } = await db
        .from("push_livrari")
        .update({
          stare: renunta ? "abandonat" : "in_asteptare",
          eroare: rezultat?.fel === "eroare" ? rezultat.mesaj : "Fără bilet de la Expo.",
        })
        .eq("id", rand.id);
      // `postgrest-js` NU aruncă la un `fetch` picat (timeout din
      // `fetchCuTermen()`, rețea căzută) — rezolvă cu `{ error }`. Netratat,
      // rândul ar rămâne `in_lucru` (recuperat peste 10 minute — retrimis a
      // doua oară, dacă biletul era deja „ok" altundeva), iar raportul ar
      // număra o scriere care n-a avut loc.
      if (eroareScriere !== null) {
        logEsecScriere(
          `scrierea reîncercării/abandonării a picat pentru rândul ${rand.id}`,
          eroareScriere,
        );
        continue;
      }
      if (renunta) abandonate += 1;
      else esuate += 1;
      continue;
    }

    if (rezultat.fel === "jeton-mort") {
      // Retragerea e `deleted_at`, nu DELETE: jurnalul trebuie să poată spune
      // de ce a încetat omul să primească notificări. `is("deleted_at", null)`
      // face tranziția idempotentă: dacă alt rând din același lot (același
      // dispozitiv, două notificări) sau ruta `/api/dispozitive` a retras deja
      // dispozitivul, `retras` iese `null`, fără eroare — cursă benignă.
      const { data: retras, error: eroareRetragere } = await db
        .from("dispozitive_push")
        .update({ deleted_at: acum })
        .eq("id", rand.dispozitiv_id)
        .is("deleted_at", null)
        .select("organization_id, user_id")
        .maybeSingle();

      if (eroareRetragere !== null) {
        logEsecScriere(`retragerea dispozitivului ${rand.dispozitiv_id} a eșuat`, eroareRetragere);
      } else if (retras !== null) {
        jetoaneRetrase += 1;
        // Auditul manual e OBLIGATORIU (contractul din
        // `src/lib/supabase/admin.ts`): triggerul generic ar scrie
        // `actor_id = auth.uid()`, adică NULL sub `service_role` — la fel ca
        // fără rândul ăsta. Diferența față de `retrageDispozitivPrinAdmin` din
        // `api/dispozitive/route.ts`: acolo un OM preia telefonul (actorId
        // real); aici Expo confirmă un telefon mort — nu există niciun actor
        // uman de înregistrat, deci `actor_id` rămâne explicit `null`.
        const { error: eroareAudit } = await db.from("audit_logs").insert({
          organization_id: retras.organization_id,
          actor_id: null,
          action: "delete",
          status: "success",
          entity_type: "dispozitive_push",
          entity_id: rand.dispozitiv_id,
          before: { user_id: retras.user_id, deleted_at: null },
          after: {
            user_id: retras.user_id,
            deleted_at: acum,
            motiv: "Jeton neînregistrat (Expo: DeviceNotRegistered).",
          },
        });
        if (eroareAudit !== null) {
          logEsecScriere(
            `auditul retragerii dispozitivului ${rand.dispozitiv_id} a eșuat`,
            eroareAudit,
          );
        }
      }

      const { error: eroareScriere } = await db
        .from("push_livrari")
        .update({ stare: "abandonat", eroare: "Jeton neînregistrat." })
        .eq("id", rand.id);
      if (eroareScriere !== null) {
        logEsecScriere(`scrierea abandonării a picat pentru rândul ${rand.id}`, eroareScriere);
        continue;
      }
      abandonate += 1;
      // NU se abandonează aici, explicit, și celelalte livrări încă
      // `in_asteptare` ale ACELUIAȘI dispozitiv (alte notificări puse în
      // coadă înainte de retragere) — nu mai e nevoie. Pasul 1 din
      // `push_ia_din_coada` (0122, secțiunea 5b) le curăță el, la preluările
      // următoare: orice rând orfan, indiferent pe ce cale a ajuns orfan, e
      // scos din `push_livrari_de_trimis_idx`.
      //
      // „PRELUĂRILE URMĂTOARE", nu „următoarea": Pasul 1 e plafonat la
      // `p_plafon`, deci un sediment de N rânduri se scurge în cel mult
      // ceil(N / plafon) rulări, nu într-una singură. Între timp, rândurile
      // necurățate rămân candidate pentru CTE-ul Pasului 2 — care le
      // filtrează el, prin `d.deleted_at is null`. Nu ajung deci NICIODATĂ
      // la Expo; doar dispar din index mai încet.
      continue;
    }

    const { error: eroareScriere } = await db
      .from("push_livrari")
      .update({ stare: "trimis", trimis_la: acum })
      .eq("id", rand.id);
    if (eroareScriere !== null) {
      logEsecScriere(`scrierea confirmării a picat pentru rândul ${rand.id}`, eroareScriere);
      continue;
    }
    trimise += 1;
  }

  return { luate: randuri.length, trimise, esuate, abandonate, jetoaneRetrase };
}
