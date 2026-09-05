// src/app/api/dispozitive/route.ts
//
// Înregistrarea și retragerea jetonului de push al aplicației mobile.
//
// DE CE NU E NEVOIE DE COD DE AUTENTIFICARE NATIV
// Partea nativă (WebView) obține jetonul de la Expo și îl injectează în
// pagină. Pagina face de acolo un `fetch` obișnuit, care poartă cookie-urile
// sesiunii web. Ruta știe deci cine e omul fără ca aplicația nativă să vadă
// vreodată un token de sesiune — asta e toată ideea de proiectare a
// autentificării mobile, și motivul pentru care ruta nu face nimic special:
// citește sesiunea exact cum ar citi-o orice altă rută API.
//
// DE CE `resolveTenant()` ȘI NU O CITIRE MANUALĂ DE `organization_members`
// `resolveTenant()` (src/lib/tenant/resolve-tenant.ts) e SINGURUL loc din
// proiect care decide organizația activă — citește hint-ul de tenant semnat
// din cookie, filtrează pe apartenențe active și neșterse, și alege aceeași
// organizație pe care utilizatorul o vede deja în WebView. O interogare
// proprie pe `organization_members` ar fi o a doua sursă de adevăr, ar ignora
// hint-ul și ar putea alege altă firmă la un utilizator cu mai multe
// apartenențe. Nu se folosește `requireTenant()`: acela face `redirect()`
// (gândit pentru Server Components), ceea ce față de un `fetch()` s-ar
// întoarce ca un 307 pe care apelantul l-ar urma tăcut spre pagina de login,
// nu ca un JSON de eroare.
import { createAdminSupabase, type AdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { decidePasInregistrareJeton, jetonSchema, type StareRandJeton } from "@/lib/push/jeton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (corp: unknown, status: number): Response =>
  new Response(JSON.stringify(corp), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// Cheia răspunsului de eroare e `mesaj`, nu `error` — precedentul citat drept
// model, `src/app/api/anaf/firma/route.ts`, folosește `{ ok: false, mesaj }`.
const eroare = (mesaj: string, status: number): Response => json({ ok: false, mesaj }, status);

/**
 * Retragerea completă a unui rând ALTUIA — sau al utilizatorului curent, dar
 * inaccesibil prin RLS — prin clientul admin: `deleted_at`, abandonarea
 * livrărilor încă neterminate din coadă, și o intrare explicită în
 * `audit_logs` cu autorul real.
 *
 * DE CE PRIN ADMIN, PE TOATE TREI SCRIERI
 * Nu există — și n-ar trebui să existe — nicio politică RLS prin care
 * utilizatorul curent să atingă rândul (sau coada) altcuiva. `service_role`
 * are grant explicit de UPDATE pe `dispozitive_push` ȘI pe `push_livrari`
 * (0122), dar NU și INSERT pe `dispozitive_push` — de-asta rândul nou se
 * inserează mai departe, în POST/DELETE mai jos, prin clientul de server, sub
 * RLS, niciodată de aici.
 *
 * DE CE ABANDONAREA COMENZILOR DIN COADĂ
 * `deleted_at` pe dispozitiv NU oprește livrările deja puse în coadă înainte
 * de retragere (`push_livrari`, populată de trigger-ul de pe `notifications`,
 * 0122 secțiunea 5). Fără pasul ăsta, ele fie ajung pe telefonul noului
 * proprietar — o SCURGERE de conținut între utilizatori, posibil între firme
 * — fie rămân blocate pe `in_asteptare`/`in_lucru` la nesfârșit, fiindcă
 * nimic nu le mai abandonează. Nu e curățenie: e prevenirea livrării către
 * alt om.
 *
 * DE CE INTRAREA MANUALĂ ÎN audit_logs
 * Triggerul generic (`internal.audit_trigger()`, 0002) pune
 * `actor_id = auth.uid()` — sub `service_role`, asta e NULL. Fără rândul de
 * mai jos, retragerea ar apărea în auditul firmei-victimă drept „dispozitiv
 * retras, de nimeni", iar cine a preluat telefonul ar fi nerecuperabil din
 * jurnal — exact contractul obligatoriu din `src/lib/supabase/admin.ts`.
 *
 * Întoarce `null` la succes; un mesaj de eroare la un eșec real de scriere.
 * Zero rânduri retrase (altă cerere a ajuns prima) NU e o eroare — e o cursă
 * benignă sub `service_role`: funcția nu mai face nimic, fiindcă scopul
 * (jetonul eliberat) e deja atins.
 */
async function retrageDispozitivPrinAdmin(
  admin: AdminSupabase,
  jeton: string,
  actorId: string,
  motiv: string,
): Promise<string | null> {
  const acum = new Date().toISOString();

  const { data: retras, error: eroareRetragere } = await admin
    .from("dispozitive_push")
    .update({ deleted_at: acum })
    .eq("jeton", jeton)
    .is("deleted_at", null)
    .select("id, organization_id, user_id")
    .maybeSingle();
  if (eroareRetragere !== null) {
    return "Retragerea rândului a eșuat.";
  }
  if (retras === null) {
    return null;
  }

  // DOAR `in_asteptare`, NU și `in_lucru` (corectat 2026-09-04).
  //
  // `in_lucru` înseamnă că `golesteCoada` a preluat deja rândul, sub
  // `for update skip locked`, și e în zbor spre `exp.host`. Marcându-l
  // `abandonat` de aici intram într-o cursă scriere-scriere cu el: ruta de
  // livrare îl suprascrie apoi cu `trimis`, iar notificarea CHIAR a plecat —
  // deci „abandonat" ar fi fost, oricum, o minciună în jurnal.
  //
  // Lăsat în pace, rândul își primește starea reală de la cel care l-a
  // trimis. Nu scapă nimic: dispozitivul e deja retras, iar dacă livrarea
  // eșuează și rândul revine pe `in_asteptare`, Pasul 1 din
  // `push_ia_din_coada` îl abandonează la următoarea preluare, ca pe orice
  // rând orfan. Un rând rămas agățat pe `in_lucru` e recuperat după 10 minute
  // și trece pe același drum.
  const { error: eroareCoada } = await admin
    .from("push_livrari")
    .update({ stare: "abandonat", eroare: motiv })
    .eq("dispozitiv_id", retras.id)
    .eq("stare", "in_asteptare")
    .is("deleted_at", null);
  if (eroareCoada !== null) {
    return "Abandonarea livrărilor din coadă a eșuat.";
  }

  // DOUĂ rânduri de audit pentru aceeași retragere, deliberat neunificate:
  // ăsta, cu autorul REAL (omul care a preluat telefonul), plus cel scris de
  // triggerul generic de audit, care sub `service_role` are `actor_id` NULL.
  // Suprimarea celui generic ar cere o excepție în trigger — adică o gaură în
  // singura garanție care spune „orice scriere lasă urmă", pentru un dublet
  // care e, la citire, evident (același `entity_id`, aceeași secundă, unul cu
  // actor și unul fără). Costul dubletului e mai mic decât al excepției.
  const { error: eroareAudit } = await admin.from("audit_logs").insert({
    organization_id: retras.organization_id,
    actor_id: actorId,
    action: "delete",
    status: "success",
    entity_type: "dispozitive_push",
    entity_id: retras.id,
    before: { user_id: retras.user_id, deleted_at: null },
    after: { user_id: retras.user_id, deleted_at: acum, preluat_de: actorId, motiv },
  });
  if (eroareAudit !== null) {
    return "Înregistrarea în audit a eșuat.";
  }

  return null;
}

export async function POST(cerere: Request): Promise<Response> {
  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") {
    return eroare("Trebuie să fiți autentificat pentru a înregistra dispozitivul.", 401);
  }
  if (rezolvare.status === "fara_organizatie") {
    return eroare("Contul dumneavoastră nu are nicio organizație activă.", 409);
  }
  if (rezolvare.status === "alegere_necesara") {
    return eroare(
      "Aveți mai multe organizații active — alegeți una din portal înainte de a înregistra dispozitivul.",
      409,
    );
  }
  const { user, tenant } = rezolvare;

  const parsat = jetonSchema.safeParse(await cerere.json().catch(() => null));
  if (!parsat.success) {
    return eroare("Jeton de push nevalid.", 400);
  }
  const { jeton, platforma } = parsat.data;
  const acum = new Date().toISOString();

  const admin = createAdminSupabase();
  const db = await createServerSupabase();

  // 1. Clasificarea rândului activ pentru acest jeton — prin admin, singurul
  // care poate vedea rândul ALTCUIVA (politica `_select` a utilizatorului
  // curent arată doar rândurile lui).
  const { data: randActiv, error: eroareCitire } = await admin
    .from("dispozitive_push")
    .select("id, user_id")
    .eq("jeton", jeton)
    .is("deleted_at", null)
    .maybeSingle();
  if (eroareCitire !== null) {
    return eroare("Verificarea dispozitivului a eșuat.", 500);
  }

  let stare: StareRandJeton;
  if (randActiv === null) {
    stare = "inexistent";
  } else if (randActiv.user_id !== user.id) {
    stare = "altcuiva";
  } else {
    // Rândul e al utilizatorului curent — dar e chiar scriibil prin RLS?
    // Singurul mod corect de-a ști e să încercăm scrierea reală, prin
    // clientul de server: politica `dispozitive_push_update` cere ȘI
    // `user_id = auth.uid()` (adevărat aici), ȘI
    // `organization_id = any(current_org_ids())`. Un UPDATE respins de
    // politică afectează ZERO rânduri, fără eroare.
    const { data, error } = await db
      .from("dispozitive_push")
      .update({ platforma, vazut_la: acum })
      .eq("jeton", jeton)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) {
      return eroare("Înregistrarea a eșuat.", 500);
    }
    stare = data === null ? "propriu_neaccesibil" : "propriu_scriibil";
  }

  const pas = decidePasInregistrareJeton(stare);
  if (pas === "gata") {
    return json({ ok: true }, 200);
  }

  if (pas === "retrage_apoi_insereaza") {
    const motiv =
      stare === "altcuiva"
        ? "Dispozitivul a fost retras la predarea telefonului."
        : "Dispozitivul a fost retras: utilizatorul nu mai are acces la organizația rândului.";
    const eroareRetragere = await retrageDispozitivPrinAdmin(admin, jeton, user.id, motiv);
    if (eroareRetragere !== null) {
      // Mesajul specific în JURNAL, cel generic în răspuns. Până la
      // 2026-09-04 era calculat cu grijă și apoi ARUNCAT: tipul de retur al
      // funcției era, practic, un boolean, iar la incident nu se putea ști
      // care din cele trei scrieri a picat.
      //
      // Contează fiindcă secvența NU e o tranzacție și eșecul ei parțial lasă
      // stări diferite, cu remedii diferite:
      //   „Retragerea rândului a eșuat"      → nimic nu s-a schimbat; reîncercarea e curată.
      //   „Abandonarea livrărilor a eșuat"   → dispozitivul E retras, dar livrările lui au
      //                                        rămas în coadă. Se curăță singure: Pasul 1 din
      //                                        `push_ia_din_coada` scoate orice rând al unui
      //                                        dispozitiv retras.
      //   „Înregistrarea în audit a eșuat"   → retragerea E făcută și coada E curată, dar
      //                                        jurnalul NU are rândul cu autor real. Rămâne
      //                                        cel scris de trigger, cu `actor_id` NULL sub
      //                                        service_role — deci se știe CĂ s-a întâmplat,
      //                                        nu și CINE a preluat telefonul.
      console.error(`[api-dispozitive] predare eșuată: ${eroareRetragere}`);
      return eroare("Predarea dispozitivului nu a putut fi procesată.", 500);
    }
  }

  // INSERT — fie „inexistent" direct, fie după o retragere de mai sus.
  // Politica de INSERT verifică organizația și proprietarul.
  const { data, error } = await db
    .from("dispozitive_push")
    .insert({
      organization_id: tenant.organizationId,
      user_id: user.id,
      jeton,
      platforma,
      vazut_la: acum,
    })
    .select("id")
    .maybeSingle();

  if (error !== null) {
    // 23505: altă cerere — același telefon reîncărcat, sau o altă predare —
    // a câștigat cursa SELECT→INSERT și a inserat prima; indexul unic parțial
    // a făcut exact ce trebuia. Nu e un refuz de autorizare: rândul dorit
    // există deja, activ — răspunsul onest e 200, fiindcă scopul cererii
    // (jetonul, înregistrat) e deja atins.
    if (error.code === "23505") {
      return json({ ok: true }, 200);
    }
    return eroare("Înregistrarea a fost refuzată.", 403);
  }
  // Un INSERT respins de politică (fără să lovească indexul unic) afectează
  // ZERO rânduri, fără eroare — rezultatul gol e deci un refuz, nu un succes
  // tăcut.
  if (data === null) {
    return eroare("Înregistrarea a fost refuzată.", 403);
  }
  return json({ ok: true }, 200);
}

export async function DELETE(cerere: Request): Promise<Response> {
  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") {
    return eroare("Trebuie să fiți autentificat pentru a retrage dispozitivul.", 401);
  }
  if (rezolvare.status === "fara_organizatie") {
    return eroare("Contul dumneavoastră nu are nicio organizație activă.", 409);
  }
  if (rezolvare.status === "alegere_necesara") {
    return eroare(
      "Aveți mai multe organizații active — alegeți una din portal înainte de a retrage dispozitivul.",
      409,
    );
  }
  const { user } = rezolvare;

  const parsat = jetonSchema.pick({ jeton: true }).safeParse(await cerere.json().catch(() => null));
  if (!parsat.success) {
    return eroare("Jeton de push nevalid.", 400);
  }

  const db = await createServerSupabase();

  // Retragerea e `deleted_at`, nu DELETE — nu există politică DELETE, prin
  // proiectare, iar jurnalul de audit trebuie să păstreze de ce s-a oprit
  // livrarea. Filtrul pe `user_id` e explicit, deși RLS îl impune oricum:
  // aici, ca peste tot în proiect, filtrul din cod nu se bazează exclusiv pe
  // politică.
  const { data, error } = await db
    .from("dispozitive_push")
    .update({ deleted_at: new Date().toISOString() })
    .eq("jeton", parsat.data.jeton)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id");

  // O eroare reală (permisiune, rețea, timeout din `fetchCuTermen`) NU e
  // „zero rânduri retrase" — amestecarea lor ar transforma orice eșec într-un
  // 200 tăcut, exact ramura pe care proiectul o numește cea mai scumpă clasă
  // de defect.
  if (error !== null) {
    return eroare("Retragerea a eșuat.", 500);
  }
  return json({ ok: true, retrase: data?.length ?? 0 }, 200);
}
