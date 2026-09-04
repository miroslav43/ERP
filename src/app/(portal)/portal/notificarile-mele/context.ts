// src/app/(portal)/portal/notificarile-mele/context.ts

/**
 * Cine deține entitatea din spatele unei legături de notificare.
 *
 * `caleaDePortal` e pură și rămâne pură: ea decide DUPĂ ce arată linkul, plus
 * un `ContextDestinatar` pe care i-l dă apelantul. Drumul la bază — singurul
 * lucru pe care o funcție pură nu-l poate face — trăiește aici.
 *
 * DE CE E NEVOIE DE EL. Două legături din lista albă duc, în portal, la un
 * ecran „al meu" păzit de o gardă de proprietate care cheamă `notFound()`:
 *
 *   `/concedii/<uuid>`  → `concediile-mele/[id]/page.tsx:60`
 *   `/ticketing/<uuid>` → `tichetele-mele/[id]/page.tsx:63`
 *
 * Iar aceeași legătură e trimisă de triggere și altcuiva decât solicitantului:
 * HR (`0056:95`), aprobatorii de concediu (`0079:338`), managerul direct la o
 * cerere IT nouă (`0046:106`). Pe ERP-ul de birou linkul e corect pentru toți —
 * ei chiar au dreptul să deschidă acel rând. În portal, unde singurul ecran e
 * „al meu", traducerea oarbă îi duce într-o pagină goală.
 *
 * TREI CITIRI PE LOT, NU PE RÂND. Legăturile vin în pachet — o pagină de cutie
 * poștală, un lot de cel mult 100 de livrări push — și se rezolvă cu trei
 * `in (...)` indexate, indiferent câte rânduri are lotul.
 *
 * SE INTERoghează EXPLICIT PE `organization_id`, chiar dacă `id`-urile sunt
 * chei primare: apelantul din `src/lib/push/coada.ts` folosește clientul
 * `service_role`, care OCOLEȘTE RLS (contractul din `src/lib/supabase/admin.ts`
 * cere filtru explicit). Pentru apelantul din portal, care merge prin RLS,
 * filtrul e redundant și inofensiv.
 */

import type { AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";

import { idCerereDeConcediu, idTichet, type ContextDestinatar } from "./legaturi";

/** Contextul gol — nimic nu-i aparține destinatarului, deci nimic nu se traduce. */
export const CONTEXT_GOL: ContextDestinatar = {
  concediiProprii: new Set<string>(),
  ticheteProprii: new Set<string>(),
};

type Client = ServerSupabase | AdminSupabase;

/** `employee_id` → `user_id`, pentru fișele atinse de lot. */
async function utilizatoriiFiselor(
  db: Client,
  organizationIds: readonly string[],
  fiseIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const harta = new Map<string, string>();
  if (fiseIds.length === 0) return harta;

  const { data, error } = await db
    .from("employees")
    .select("id, user_id")
    .in("organization_id", organizationIds)
    .in("id", fiseIds)
    .is("deleted_at", null);

  // Nu se aruncă: o citire picată aici nu trebuie să oprească randarea cutiei
  // poștale, nici golirea cozii. Consecința e contextul mai sărac — adică o
  // legătură netradusă, adică cutia poștală. Degradare, nu 404.
  if (error !== null) {
    console.error(`[context-notificari] citirea fișelor a eșuat: ${error.message}.`);
    return harta;
  }
  for (const rand of data ?? []) {
    if (rand.user_id !== null) harta.set(rand.id, rand.user_id);
  }
  return harta;
}

/**
 * Pentru fiecare destinatar atins de `linkuri`, ce îi aparține dintre entitățile
 * la care duc ele.
 *
 * Cheia e `user_id`. Un lot de push amestecă destinatari (mai multe telefoane,
 * mai multe firme) — de aceea rezultatul e o hartă, nu un singur context.
 * Destinatarul care nu apare în hartă primește `CONTEXT_GOL`.
 */
export async function contexteDestinatar(
  db: Client,
  organizationIds: readonly string[],
  linkuri: readonly (string | null)[],
): Promise<ReadonlyMap<string, ContextDestinatar>> {
  const goale = new Map<string, ContextDestinatar>();
  if (organizationIds.length === 0) return goale;

  const cerereIds = [...new Set(linkuri.map(idCerereDeConcediu).filter((x) => x !== null))];
  const tichetIds = [...new Set(linkuri.map(idTichet).filter((x) => x !== null))];
  if (cerereIds.length === 0 && tichetIds.length === 0) return goale;

  const [cereri, tichete] = await Promise.all([
    cerereIds.length === 0
      ? null
      : db
          .from("leave_requests")
          .select("id, employee_id")
          .in("organization_id", organizationIds)
          .in("id", cerereIds)
          .is("deleted_at", null),
    tichetIds.length === 0
      ? null
      : db
          .from("tickets")
          .select("id, solicitant_employee_id")
          .in("organization_id", organizationIds)
          .in("id", tichetIds)
          .is("deleted_at", null),
  ]);

  if (cereri?.error != null) {
    console.error(`[context-notificari] citirea cererilor a eșuat: ${cereri.error.message}.`);
  }
  if (tichete?.error != null) {
    console.error(`[context-notificari] citirea tichetelor a eșuat: ${tichete.error.message}.`);
  }

  const perechiCereri = (cereri?.data ?? []).map((r) => [r.id, r.employee_id] as const);
  const perechiTichete = (tichete?.data ?? [])
    .filter((r) => r.solicitant_employee_id !== null)
    .map((r) => [r.id, r.solicitant_employee_id as string] as const);

  const fise = [...new Set([...perechiCereri, ...perechiTichete].map(([, fisa]) => fisa))];
  const utilizatori = await utilizatoriiFiselor(db, organizationIds, fise);

  const rezultat = new Map<string, { concedii: Set<string>; tichete: Set<string> }>();
  const adauga = (fisaId: string, entitateId: string, fel: "concedii" | "tichete"): void => {
    const userId = utilizatori.get(fisaId);
    if (userId === undefined) return;
    let intrare = rezultat.get(userId);
    if (intrare === undefined) {
      intrare = { concedii: new Set<string>(), tichete: new Set<string>() };
      rezultat.set(userId, intrare);
    }
    intrare[fel].add(entitateId);
  };

  for (const [cerereId, fisaId] of perechiCereri) adauga(fisaId, cerereId, "concedii");
  for (const [tichetId, fisaId] of perechiTichete) adauga(fisaId, tichetId, "tichete");

  return new Map(
    [...rezultat].map(([userId, seturi]) => [
      userId,
      { concediiProprii: seturi.concedii, ticheteProprii: seturi.tichete },
    ]),
  );
}
