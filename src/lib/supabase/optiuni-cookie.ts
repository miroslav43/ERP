// src/lib/supabase/optiuni-cookie.ts
import type { CookieOptions } from "@supabase/ssr";

/**
 * Opțiunile cookie-urilor de sesiune, scrise o dată și explicit.
 *
 * ── DE CE EXISTĂ FIȘIERUL ───────────────────────────────────────────────────
 * Până acum nu se trimitea niciun `cookieOptions` nicăieri, deci sesiunea
 * moștenea tăcut `DEFAULT_COOKIE_OPTIONS` din `@supabase/ssr`
 * (`utils/constants.js`): `path: "/"`, `sameSite: "lax"`, `httpOnly: false`,
 * `maxAge` 400 de zile — și, mai ales, **fără `secure`**. Nimeni nu alesese
 * valorile alea; erau pur și simplu ce venea din bibliotecă. Odată ce aplicația
 * ajunge pe telefonul fiecărui angajat, durata și transportul sesiunii nu mai
 * pot fi un implicit nescris.
 *
 * ── DE CE NU E IMPORTAT `@/config/env` ──────────────────────────────────────
 * `src/lib/supabase/middleware.ts` folosește fișierul ăsta, iar acolo importul
 * lui `@/config/env` e interzis deliberat (validează la import și secretele de
 * server, care n-au ce căuta în bundle-ul de middleware — o cheie lipsă ar
 * transforma fiecare cerere într-un 500). `NEXT_PUBLIC_APP_URL` e o valoare
 * publică, pe care Next o înlocuiește literal la build, deci se poate citi
 * direct.
 *
 * ── DE CE `httpOnly` E `true` (și de ce a fost `false`) ────────────────────
 * Aici a scris, până la 21 sept 2026, exact contrariul: `httpOnly` trebuia să
 * rămână `false` fiindcă `true` „ar rupe cinci ecrane" — clientul de browser
 * Supabase citea sesiunea din `document.cookie` și fără ea încărcările directe
 * în Storage ar fi plecat ca anonim.
 *
 * Premisa era falsă. Încărcarea pe URL semnat nu se uită niciodată la sesiune:
 * ruta `object/upload/sign/...` din `storage-api` validează DOAR semnătura
 * tokenului din URL (autorizarea s-a făcut deja pe server, la semnare). Cele
 * șapte ecrane — nu cinci — urcă azi cu un `fetch` simplu
 * (`src/lib/storage/urca-semnat.ts`), fără niciun client Supabase în browser.
 *
 * Ce cumpără `true`: cookie-ul conține access_token ȘI refresh_token, adică
 * sesiunea întreagă, 400 de zile. Cât era lizibil din JavaScript, orice XSS
 * sau script terț de pe aceeași origine îl putea citi și, cu el, vorbi direct
 * cu PostgREST ca utilizatorul — ocolind toate cele opt straturi din
 * `createAction`. Reîmprospătarea sesiunii nu suferă: o face `updateSession()`
 * din `src/proxy.ts`, pe server, pentru fiecare cerere de pagină.
 *
 * `secure` lipsea fără niciun motiv, iar pe HTTPS nu costă nimic.
 *
 * ── `maxAge` ────────────────────────────────────────────────────────────────
 * 400 de zile e plafonul pe care browserele îl impun oricum cookie-urilor
 * persistente. Valoarea rămâne aceeași, dar acum e o DECIZIE: aplicația de pe
 * ecranul de start nu trebuie să ceară parola periodic, altfel nu e folosită.
 * Durata REALĂ a sesiunii nu se decide însă aici — o taie „Time-box user
 * sessions" și „Inactivity timeout" din tabloul de bord Supabase, care azi nu
 * sunt sub control de versiune. Vezi nota din NOTES.md.
 */
const ZILE = 24 * 60 * 60;

/**
 * `true` când aplicația e servită pe HTTPS. Pe `http://localhost`, un cookie cu
 * `Secure` nu e trimis înapoi de browser — dezvoltarea locală s-ar deconecta la
 * fiecare cerere.
 */
const PE_HTTPS = (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");

export const OPTIUNI_COOKIE: CookieOptions = {
  path: "/",
  sameSite: "lax",
  secure: PE_HTTPS,
  // Vezi mai sus: JavaScript-ul paginii nu are ce căuta în sesiune.
  httpOnly: true,
  maxAge: 400 * ZILE,
};
