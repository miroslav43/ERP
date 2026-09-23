// src/lib/storage/urca-semnat.ts

/**
 * Urcarea octeților în Storage, din browser, pe un URL semnat de server.
 *
 * ── DE CE NU SDK-UL ────────────────────────────────────────────────────────
 * Până aici, cele șapte ecrane cu fișiere chemau
 * `getBrowserSupabase().storage.from(...).uploadToSignedUrl(...)`. Apelul
 * funcționa, dar prețul lui era un CLIENT SUPABASE COMPLET în browser: cheia
 * publicabilă inlinată în bundle și sesiunea citită din `document.cookie`,
 * adică exact cele două lucruri de care are nevoie orice bucată de JavaScript
 * ca să vorbească direct cu PostgREST, ca utilizatorul logat, ocolind toate
 * cele opt straturi din `createAction`. Un client Supabase adus pentru
 * încărcarea unui PDF ținea deschisă ușa spre întreaga bază.
 *
 * Încărcarea nu are nevoie de el. Tokenul din URL-ul semnat ESTE autorizația:
 * `createSignedUploadUrl` verifică permisiunile pe server, sub sesiunea
 * apelantului, iar ruta `object/upload/sign/...` din `storage-api` validează
 * doar semnătura tokenului — nu trece prin autentificarea JWT și nu se uită la
 * antetul `apikey`. Un `fetch` obișnuit face deci aceeași treabă, fără să
 * înarmeze browserul.
 *
 * ── DE CE `PUT` CU CORP BINAR ──────────────────────────────────────────────
 * `uploadToSignedUrl` trimitea un `FormData` cu `cacheControl` și fișierul.
 * Forma binară e echivalentă pentru server (`storage-api` acceptă ambele) și e
 * cea care păstrează tipul MIME exact: mimetype-ul obiectului devine antetul
 * `content-type` de mai jos. Valoarea lui rămâne CEA DECLARATĂ de browser — la
 * fel ca înainte —, motiv pentru care pasul de salvare de după încărcare
 * verifică primii octeți ai fișierului, nu ce scrie aici.
 */
export async function urcaPeUrlSemnat(urlSemnat: string, fisier: File): Promise<boolean> {
  try {
    const raspuns = await fetch(urlSemnat, {
      method: "PUT",
      headers: {
        // Un fișier fără extensie cunoscută ajunge cu `type` gol din `<input>`.
        "content-type": fisier.type === "" ? "application/octet-stream" : fisier.type,
        // Același implicit ca al SDK-ului (`DEFAULT_FILE_OPTIONS.cacheControl`),
        // ca obiectele urcate după schimbarea asta să se stocheze la fel ca
        // cele urcate înainte de ea.
        "cache-control": "max-age=3600",
      },
      body: fisier,
    });
    return raspuns.ok;
  } catch {
    // Rețea căzută, filă închisă în timpul urcării, CORS refuzat: pentru ecran
    // toate înseamnă același lucru — fișierul nu a ajuns.
    return false;
  }
}
