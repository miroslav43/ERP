// src/components/feedback/pagina-negasita.tsx
import Link from "next/link";
import { Compass } from "lucide-react";

import { buton } from "@/components/ui/buton";

/**
 * Corpul 404 pentru cine are sesiune (UX-043): în cadrul aplicației, cu drumul
 * înapoi ca buton primar, nu ca link gri.
 *
 * Folosit de `src/app/(app)/not-found.tsx` (modul dezactivat, fișă străină sau
 * inexistentă) și de `src/app/not-found.tsx` (adresă fără nicio rută), ca
 * ambele să arate la fel.
 *
 * Markup propriu, NU `StareGoala`: aceea pune titlul într-un `<p>`, iar
 * `e2e/module.spec.ts` caută pentru modulele dezactivate un `heading` de NIVEL 1
 * cu textul exact „Pagina nu există”.
 */
export function PaginaNegasita({
  inapoi,
}: Readonly<{ inapoi: Readonly<{ href: string; eticheta: string }> }>) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="border-border bg-surface rounded-panou border p-8 text-center">
        <Compass aria-hidden="true" className="text-muted-foreground mx-auto size-6" />
        <p className="text-muted-foreground text-nota mt-3 font-medium">Eroare 404</p>
        <h1 className="text-foreground text-sectiune mt-1 font-semibold">Pagina nu există</h1>
        <p className="text-muted-foreground text-corp mt-2">
          Fie adresa e greșită, fie secțiunea nu e activată pentru firma dumneavoastră.
        </p>
        <p className="mt-6">
          <Link href={inapoi.href} className={buton({ varianta: "primar" })}>
            {inapoi.eticheta}
          </Link>
        </p>
      </div>
    </div>
  );
}
