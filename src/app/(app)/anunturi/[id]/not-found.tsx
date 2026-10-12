// src/app/(app)/anunturi/[id]/not-found.tsx
import Link from "next/link";
import { Megaphone } from "lucide-react";

import { StareGoala } from "@/components/ui/stare-goala";

/**
 * Fundătura de după o notificare veche.
 *
 * „Anunț nou" păstrează pentru totdeauna linkul `/anunturi/<id>`. După
 * expirare sau retragere, RLS ascunde anunțul tuturor celor fără
 * `announcements:update = all`, iar `citesteAnunt` întoarce `null` — adică
 * `notFound()`. Fără pagina asta, clicul pe o notificare din urmă cu o lună
 * ducea în 404-ul rădăcină, fără bară și fără drum înapoi. Lista
 * notificărilor NU mai leagă anunțurile invizibile (`caleaInAplicatie`), dar
 * legătura poate veni și din e-mail sau dintr-un marcaj.
 */
export default function AnuntNegasit() {
  return (
    <div className="mx-auto max-w-2xl">
      <StareGoala
        fel="restrictionata"
        pictograma={Megaphone}
        titlu="Anunțul nu mai e pe avizier"
        descriere="A expirat, a fost retras sau adresa e greșită. Anunțurile active sunt în listă."
        actiune={{ eticheta: "Deschide avizierul", href: "/anunturi" }}
      />
      <p className="text-muted-foreground text-nota mt-4">
        <Link href="/notificari" className="underline-offset-2 hover:underline">
          Înapoi la notificări
        </Link>
      </p>
    </div>
  );
}
