// src/config/cheie-supabase.ts
import "server-only";

/**
 * Cheia publicabilă („anon") a proiectului Supabase — ținută DELIBERAT în afara
 * bundle-ului de browser.
 *
 * ── DE CE UN FIȘIER SEPARAT ────────────────────────────────────────────────
 * Cheia stătea în `clientEnv` (`src/config/env.ts`), iar `env.ts` e importat de
 * paisprezece module care ajung în bundle-ul de client (de exemplu
 * `setari/membri/membri-client.tsx` pentru `NEXT_PUBLIC_APP_URL` și
 * `lib/avatar/cale.ts` pentru `NEXT_PUBLIC_SUPABASE_URL`). Next înlocuiește
 * literalul `process.env.NEXT_PUBLIC_*` cu valoarea la build oriunde apare,
 * deci cheia ajungea în JavaScript-ul livrat browserului chiar și după ce
 * clientul de browser Supabase a dispărut din proiect. Aici, într-un fișier
 * `server-only`, literalul nu poate ajunge într-un bundle de client: build-ul
 * cade dacă cineva îl importă de acolo.
 *
 * ── CE APĂRĂ, DE FAPT ──────────────────────────────────────────────────────
 * Cheia e publică prin design la Supabase: protecția reală e RLS, nu secretul
 * ei. Dar cheia PLUS jetonul de sesiune înseamnă un client PostgREST complet în
 * browser, iar de acolo orice regulă care trăiește doar în stratul de aplicație
 * (Zod, tranziții de status, `minScope`, poarta de modul, auditul) se ocolește
 * cu o linie în consolă. Scoaterea ei din bundle nu înlocuiește apărarea din
 * bază — o dublează: fără `apikey`, gateway-ul Supabase refuză cererea înainte
 * să ajungă la vreo politică.
 *
 * ── DE CE NU S-A REDENUMIT VARIABILA ───────────────────────────────────────
 * Numele rămâne `NEXT_PUBLIC_SUPABASE_ANON_KEY` fiindcă prefixul decide DOAR
 * unde poate Next să înlocuiască literalul, nu unde ajunge valoarea: referită
 * exclusiv din module de server, valoarea se coace doar în bundle-urile de
 * server. O redenumire ar fi cerut schimbări sincronizate în `Dockerfile`
 * (build arg), în `ci.yml` și pe fiecare mediu de rulare — adică exact tipul de
 * schimbare care oprește producția dacă un singur loc rămâne pe urmă.
 */
const cheie = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (cheie === undefined || cheie === "") {
  throw new Error(
    "Configurație invalidă (server):\nNEXT_PUBLIC_SUPABASE_ANON_KEY lipsește\n\n" +
      "Verifică `.env.local` față de `.env.example`.",
  );
}

export const CHEIE_SUPABASE_PUBLICABILA: string = cheie;
