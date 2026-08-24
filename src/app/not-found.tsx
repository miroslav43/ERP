// src/app/not-found.tsx
import Link from "next/link";

/**
 * 404-ul rădăcină: prinde tot ce nu e acoperit de un `not-found.tsx` mai
 * apropiat (portalul are al lui). Randează în layout-ul rădăcină, deci fără
 * antet și fără meniu — singurul drum înapoi trebuie scris aici.
 */
export default function Negasit() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <p className="text-muted-foreground text-sm font-medium">Eroare 404</p>
      <h1 className="text-foreground mt-2 text-xl font-semibold">Pagina nu există</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Fie adresa e greșită, fie pagina a fost mutată ori ștearsă.
      </p>
      <p className="mt-6">
        <Link href="/panou" className="text-primary text-sm underline-offset-2 hover:underline">
          Înapoi la panou
        </Link>
      </p>
    </div>
  );
}
