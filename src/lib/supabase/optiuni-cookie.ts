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
 * ── DE CE `httpOnly` RĂMÂNE `false` ─────────────────────────────────────────
 * Pare corectură de securitate să-l pui pe `true`. NU este: ar rupe cinci
 * ecrane. Clientul de browser Supabase (`getBrowserSupabase`) citește sesiunea
 * prin `document.cookie`, iar el e folosit de încărcările directe în Storage —
 * material de curs, import de angajați, document de angajat, dovadă de
 * integrare, avatar. Cu `httpOnly: true`, cookie-ul devine invizibil pentru ele
 * și toate cinci încep să încarce ca utilizator anonim, deci sunt respinse de
 * politicile de Storage. O corecție de securitate care sparge funcționalitate e
 * o regresie.
 *
 * `secure`, în schimb, lipsea fără niciun motiv, iar pe HTTPS nu costă nimic.
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
  // Vezi mai sus: NU se pune `true`.
  httpOnly: false,
  maxAge: 400 * ZILE,
};
