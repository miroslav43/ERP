// src/instrumentation.ts

/**
 * Ține socketurile către Supabase deschise 30 de secunde, în loc de 4.
 *
 * DE CE EXISTĂ FIȘIERUL
 * Supabase nu trimite antet `Keep-Alive`, deci undici aplică implicitul lui:
 * 4 000 ms. Un om nu apasă mai des de-atât, deci practic FIECARE clic începea
 * cu TCP + TLS de la zero. Măsurat de pe VM: pauză 0–3 s → 53–68 ms per apel;
 * pauză 4–10 s → 87–149 ms. Suprataxa e ~125 ms, plătită pe primul apel al
 * fiecărei interacțiuni — adică exact acolo unde se vede.
 *
 * CUM AJUNGE SĂ CONTEZE
 * Node are propria copie de undici pentru `fetch`, diferită de pachetul npm.
 * Cele două împart totuși dispatcherul global, printr-un simbol bine-cunoscut:
 * `Symbol(undici.globalDispatcher.1)`. Verificat pe `node:22-alpine` v22.23.2,
 * aceeași imagine ca `Dockerfile:86`. Dacă o versiune viitoare de undici trece
 * la `.2` înaintea lui Node, legătura se rupe TĂCUT — linia de mai jos ar rula
 * fără eroare și fără efect. De aceea versiunea e fixată, iar poarta empirică
 * din planul de latență o verifică explicit.
 *
 * DE CE 30 s ȘI NU 60
 * Riscul reutilizării unui socket pe care marginea l-a închis între timp e
 * `ECONNRESET`. undici reia automat un `GET`, dar NU un `POST` — iar POST-urile
 * de aici sunt Server Actions, adică scrieri. 30 s stă confortabil sub orice
 * prag rezonabil al marginii Cloudflare; o valoare mai mare cere măsurarea
 * pragului real înainte.
 */
export async function register(): Promise<void> {
  // `register()` e chemat și pentru runtime-ul edge, unde nu există undici și
  // nici sockete de reutilizat.
  if (process.env["NEXT_RUNTIME"] !== "nodejs") return;

  const { Agent, setGlobalDispatcher } = await import("undici");
  setGlobalDispatcher(new Agent({ keepAliveTimeout: 30_000 }));
}
