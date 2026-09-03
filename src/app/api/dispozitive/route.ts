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
// din cookie, filtrează pe apartenențe active și nešterse, și alege aceeași
// organizație pe care utilizatorul o vede deja în WebView. O interogare proprie
// pe `organization_members` ar fi o a doua sursă de adevăr, ar ignora hint-ul
// și ar putea alege altă firmă la un utilizator cu mai multe apartenențe.
// Nu se folosește `requireTenant()`: acela face `redirect()` (gândit pentru
// Server Components), ceea ce față de un `fetch()` s-ar întoarce ca un 307 pe
// care apelantul l-ar urma tăcut spre pagina de login, nu ca un JSON de eroare.
import { jetonSchema } from "@/lib/push/jeton";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (corp: unknown, status: number): Response =>
  new Response(JSON.stringify(corp), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const eroare = (mesaj: string, status: number): Response =>
  json({ ok: false, error: mesaj }, status);

export async function POST(cerere: Request): Promise<Response> {
  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") {
    return eroare("Trebuie să fiți autentificat pentru a înregistra dispozitivul.", 401);
  }
  if (rezolvare.status !== "ok") {
    return eroare("Fără organizație activă.", 409);
  }
  const { user, tenant } = rezolvare;

  const parsat = jetonSchema.safeParse(await cerere.json().catch(() => null));
  if (!parsat.success) {
    return eroare("Jeton de push nevalid.", 400);
  }
  const { jeton, platforma } = parsat.data;
  const acum = new Date().toISOString();

  // PREDAREA TELEFONULUI ÎNTRE DOI ANGAJAȚI
  // Un telefon are UN jeton Expo. Dacă jetonul e deja înregistrat, activ, pe
  // un ALT utilizator (telefonul a trecut de la un angajat la altul), politica
  // `dispozitive_push_update` refuză corect orice încercare a utilizatorului
  // curent de a atinge rândul lui — și n-ar trebui să existe nicio politică
  // prin care un angajat să poată atinge rândul altuia. De-asta verificarea și
  // retragerea rândului în conflict trec prin clientul admin: e singurul care
  // poate vedea și muta rândul ALTCUIVA. `dispozitive_push` are grant de
  // SELECT și UPDATE pentru `service_role` (0122), nu și INSERT — inserarea
  // efectivă a rândului nou rămâne mai jos, prin clientul de server, sub RLS.
  const admin = createAdminSupabase();
  const { data: randActiv, error: eroareCitire } = await admin
    .from("dispozitive_push")
    .select("id, user_id")
    .eq("jeton", jeton)
    .is("deleted_at", null)
    .maybeSingle();
  if (eroareCitire !== null) {
    return eroare("Verificarea dispozitivului a eșuat.", 500);
  }

  const eAlAltcuiva = randActiv !== null && randActiv.user_id !== user.id;
  if (eAlAltcuiva) {
    // Filtru explicit — EXACT rândul cu acest jeton, activ. Niciodată pe
    // `user_id` sau pe organizație: singurul rând care poate fi în conflict cu
    // înregistrarea curentă e cel cu acest jeton anume.
    const { error: eroareRetragere } = await admin
      .from("dispozitive_push")
      .update({ deleted_at: acum })
      .eq("jeton", jeton)
      .is("deleted_at", null);
    if (eroareRetragere !== null) {
      return eroare("Predarea dispozitivului nu a putut fi procesată.", 500);
    }
  }

  const db = await createServerSupabase();

  // Rândul e deja al utilizatorului curent — nicio retragere n-a avut loc mai
  // sus, doar o reîmprospătare, prin RLS (nu prin admin: e propriul rând).
  if (randActiv !== null && !eAlAltcuiva) {
    const { data, error } = await db
      .from("dispozitive_push")
      .update({ platforma, vazut_la: acum })
      .eq("jeton", jeton)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    // Un UPDATE respins de politică afectează ZERO rânduri, fără eroare —
    // rezultatul gol e deci un refuz, nu un succes tăcut.
    if (error !== null || data === null) {
      return eroare("Înregistrarea a fost refuzată.", 403);
    }
    return json({ ok: true }, 200);
  }

  // Niciun rând activ pentru acest jeton (sau tocmai a fost eliberat mai sus,
  // la predarea telefonului): înregistrare nouă, prin RLS — politica de
  // INSERT cere ȘI organizația curentă, ȘI proprietarul.
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
  if (error !== null || data === null) {
    return eroare("Înregistrarea a fost refuzată.", 403);
  }
  return json({ ok: true }, 200);
}

export async function DELETE(cerere: Request): Promise<Response> {
  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") {
    return eroare("Trebuie să fiți autentificat pentru a retrage dispozitivul.", 401);
  }
  if (rezolvare.status !== "ok") {
    return eroare("Fără organizație activă.", 409);
  }
  const { user } = rezolvare;

  const parsat = jetonSchema.pick({ jeton: true }).safeParse(await cerere.json().catch(() => null));
  if (!parsat.success) {
    return eroare("Jeton de push nevalid.", 400);
  }

  const db = await createServerSupabase();

  // Retragerea e `deleted_at`, nu DELETE — nu există politică DELETE, prin
  // proiectare, iar jurnalul de audit trebuie să păstreze de ce s-a oprit
  // livrarea. Filtrul pe `user_id` e explicit, deși RLS îl impune oricum: aici,
  // ca peste tot în proiect, filtrul din cod nu se bazează exclusiv pe politică.
  const { data } = await db
    .from("dispozitive_push")
    .update({ deleted_at: new Date().toISOString() })
    .eq("jeton", parsat.data.jeton)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id");

  return json({ ok: true, retrase: data?.length ?? 0 }, 200);
}
