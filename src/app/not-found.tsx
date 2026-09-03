// src/app/not-found.tsx
import Link from "next/link";

/**
 * 404-ul rădăcină: prinde tot ce nu e acoperit de un `not-found.tsx` mai
 * apropiat (portalul are al lui). Randează în layout-ul rădăcină, deci fără
 * antet și fără meniu — singurul drum înapoi trebuie scris aici.
 *
 * ── DE CE DOUĂ LINKURI, ȘI DE CE ÎN ORDINEA ASTA ──────────────────────────
 * Drumul înapoi era un singur link, către `/panou`. Dar 404-ul ăsta prinde și
 * rutele PUBLICE: un vizitator nelogat care greșește adresa sau urmează un link
 * mort din indexul de căutare ajunge aici. `/panou` cere sesiune, deci
 * `src/proxy.ts` îl trimite la `/autentificare` — omul care căuta o pagină de
 * prezentare primește un ecran de login și pleacă.
 *
 * Pagina de start funcționează pentru amândoi: nelogatul aterizează unde voia,
 * iar cine are sesiune are `/panou` la un rând distanță.
 */
export default function Negasit() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <p className="text-muted-foreground text-sm font-medium">Eroare 404</p>
      <h1 className="text-foreground mt-2 text-xl font-semibold">Pagina nu există</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Fie adresa e greșită, fie pagina a fost mutată ori ștearsă.
      </p>
      <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/" className="text-primary text-sm underline-offset-2 hover:underline">
          Înapoi la pagina de start
        </Link>
        <Link
          href="/panou"
          className="text-muted-foreground text-sm underline-offset-2 hover:underline"
        >
          Panoul firmei
        </Link>
      </p>
    </div>
  );
}
