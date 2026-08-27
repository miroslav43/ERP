// src/app/api/materiale/[versiuneId]/route.ts
// Livrarea conținutului de curs: proxy peste Supabase Storage, cu suport de
// `Range`.
//
// ── DE CE PROXY, ȘI NU UN URL SEMNAT DIRECT ÎN `<video src>` ──────────────
// Un URL semnat e un BEARER TOKEN. Odată emis, oricine îl are îl poate folosi,
// fără sesiune, până expiră. Pentru un modul al cărui unic produs e dovada că
// ANUME persoana asta a parcurs conținutul, un link partajabil golește dovada
// de sens. Aici fiecare octet e legat de cookie-ul de sesiune.
//
// Două câștiguri în plus:
//   1. `Content-Type` e FORȚAT din lista noastră, nu luat de la obiect. MIME-ul
//      stocat vine din ce a declarat browserul la încărcare; un HTML servit ca
//      `text/html` de pe originea noastră ar fi XSS pe sesiunea utilizatorului.
//   2. Dispare complet problema ceasului: un film de 20 de minute nu mai are
//      niciun URL care expiră la mijlocul redării.
//
// ── TREI GREȘELI CARE STRICĂ DERULAREA, EVITATE EXPLICIT ─────────────────
//   · `arrayBuffer()` în loc de flux — ar încărca 200 MB în memoria serverului;
//   · `status: 200` în loc de propagarea lui `206` — browserul crede că a primit
//     tot fișierul și nu mai poate derula;
//   · lipsa lui `Accept-Ranges: bytes` — derularea se dezactivează cu totul.

import { createServerSupabase } from "@/lib/supabase/server";
import { BUCKET_CURSURI } from "@/lib/media/cale";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tipurile pe care le servim, cu valoarea trimisă mai departe. Orice altceva
 * pleacă drept `application/octet-stream`, cu `attachment` — nu se randează.
 */
const TIP_FORTAT: Readonly<Record<string, string>> = {
  "application/pdf": "application/pdf",
  "video/mp4": "video/mp4",
  "video/webm": "video/webm",
  "text/vtt": "text/vtt; charset=utf-8",
};

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

interface ProprietatiRuta {
  readonly params: Promise<{ readonly versiuneId: string }>;
}

export async function GET(cerere: Request, { params }: ProprietatiRuta): Promise<Response> {
  const { versiuneId } = await params;
  const url = new URL(cerere.url);
  const vreaSubtitrarea = url.searchParams.get("subtitrare") === "1";

  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat")
    return raspunsText("Trebuie să vă autentificați.", 401);
  if (rezolvare.status !== "ok") return raspunsText("Alegeți mai întâi o organizație.", 403);

  // Citirea trece prin RLS. Dacă rândul nu vine — pentru că nu e al firmei sau
  // pentru că materialul nu-i este atribuit — răspundem 404, NU 403: un 403 ar
  // confirma că versiunea există.
  const db = await createServerSupabase();
  const { data: versiune, error } = await db
    .from("course_material_versions")
    .select("id, fisier_path, fisier_nume, fisier_mime, subtitrare_path")
    .eq("id", versiuneId)
    .eq("organization_id", rezolvare.tenant.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) return raspunsText("Materialul nu a putut fi citit.", 500);
  if (versiune === null) return raspunsText("Materialul nu a fost găsit.", 404);

  const cale = vreaSubtitrarea ? versiune.subtitrare_path : versiune.fisier_path;
  if (cale === null) return raspunsText("Materialul nu are un fișier încărcat.", 404);

  const mime = vreaSubtitrarea ? "text/vtt" : (versiune.fisier_mime ?? "");
  const tip = TIP_FORTAT[mime] ?? "application/octet-stream";
  const inline = tip !== "application/octet-stream";

  // URL semnat scurt, creat pe server și NICIODATĂ trimis clientului. Un minut
  // acoperă o singură cerere `Range`; browserul face zeci, fiecare autorizată
  // din nou prin cookie-ul de sesiune.
  const { data: semnat, error: eroareSemnare } = await db.storage
    .from(BUCKET_CURSURI)
    .createSignedUrl(cale, 60);
  if (eroareSemnare !== null || semnat === null) {
    return raspunsText("Materialul nu a putut fi pregătit.", 500);
  }

  const range = cerere.headers.get("range");
  const amonte = await fetch(semnat.signedUrl, {
    headers: range === null ? {} : { Range: range },
    // `cache: "no-store"`: obiectul e privat, nu are ce căuta într-un cache
    // partajat al runtime-ului.
    cache: "no-store",
  });
  if (!amonte.ok && amonte.status !== 206) {
    return raspunsText("Materialul nu a putut fi descărcat.", 502);
  }

  const antete = new Headers({
    // Forțat din enumerarea noastră, nu preluat din amonte.
    "content-type": tip,
    "accept-ranges": "bytes",
    "content-disposition": inline
      ? "inline"
      : `attachment; filename="${(versiune.fisier_nume ?? "material").replace(/["\\]/gu, "")}"`,
    // Fereastra de revocare devine o oră; în schimb, o reluare în aceeași oră
    // nu mai costă nicio cerere către Supabase.
    "cache-control": "private, max-age=3600",
    "x-content-type-options": "nosniff",
    // Singura atingere de nginx, la nivel de RĂSPUNS: fișierul de configurare
    // e partajat cu toate site-urile de pe VM, iar un `nginx -t` picat ar da jos
    // reload-ul tuturor.
    "x-accel-buffering": "no",
  });
  for (const antet of ["content-length", "content-range", "etag", "last-modified"]) {
    const valoare = amonte.headers.get(antet);
    if (valoare !== null) antete.set(antet, valoare);
  }

  // Fluxul se transmite mai departe ca atare, iar `206` se propagă ca `206`.
  return new Response(amonte.body, { status: amonte.status, headers: antete });
}
