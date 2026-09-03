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
 * Cele două împart totuși dispatcherul global. undici 7/8 folosește intern
 * `Symbol(undici.globalDispatcher.2)` pentru API-ul lui nou, dar la
 * `setGlobalDispatcher` populează ȘI `Symbol(undici.globalDispatcher.1)` —
 * legacy, punte deliberată de compatibilitate (`Dispatcher1Wrapper`), care
 * deleagă direct la agentul dat de noi. `.1` e simbolul citit de fetch-ul
 * încorporat al lui Node. Verificat empiric, nu doar din citit sursa: server
 * HTTP local + `agent.dispatch` instrumentat cu un contor + apel `fetch()`
 * nativ → un singur apel, prin agentul nostru, atât pe node:22-alpine
 * (v22.23.2, imaginea din `Dockerfile:86`) cât și pe Node 20.20.2 local. Dacă
 * o versiune viitoare de undici renunță la puntea `.1`, legătura se rupe
 * TĂCUT — liniile de mai jos ar rula fără eroare și fără efect. De-aia
 * gărzile de mai jos (versiune fixată pe rândul minor + try/catch) există
 * amândouă.
 *
 * DE CE ^7 ȘI NU ^8
 * undici 8.x declară `engines: { node: ">=22.19.0" }` și crapă la
 * `require()` pe orice Node mai vechi, cu
 * `TypeError: webidl.util.markAsUncloneable is not a function`. Dezvoltarea
 * locală rulează Node 20.x — `pnpm dev` ar muri la pornire. undici 7.x cere
 * doar `>=20.18.1` și duce la aceeași punte `.1`→agent pe ambele Node-uri: 30
 * s de keep-alive fără să ceri Node 22 pe mașina fiecărui dezvoltator. La
 * următorul `pnpm update` care ar urca înapoi la 8.x, reverifică poarta
 * empirică din planul de latență înainte de a accepta bump-ul — altfel
 * cauza va fi de negăsit, pentru că build-ul containerizat (Node 22) tot ar
 * trece.
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

  try {
    const { Agent, setGlobalDispatcher } = await import("undici");
    setGlobalDispatcher(new Agent({ keepAliveTimeout: 30_000 }));
  } catch (eroare) {
    // Optimizare, nu cerință: dacă undici nu se poate încărca — versiune
    // incompatibilă cu Node-ul gazdă, modul netrasat în `.next/standalone` —
    // aplicația trebuie să pornească oricum, doar cu socketuri de 4 secunde.
    console.warn("[instrumentare] keep-alive-ul spre Supabase nu a putut fi aplicat:", eroare);
  }
}
