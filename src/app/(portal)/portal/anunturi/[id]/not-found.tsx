// src/app/(portal)/portal/anunturi/[id]/not-found.tsx
import Link from "next/link";
import { Megaphone } from "lucide-react";

import { StareGoala } from "@/components/ui/stare-goala";

/**
 * Anunțul expirat sau retras, deschis dintr-o notificare veche. Politica de
 * citire îl ascunde angajatului de îndată ce a expirat, deci `citesteAnunt`
 * întoarce `null`; fără pagina asta, angajatul cădea în 404-ul portalului,
 * care nu spune CE s-a întâmplat cu anunțul.
 */
export default function AnuntNegasitPortal() {
  return (
    <div className="mx-auto max-w-2xl p-4">
      <StareGoala
        fel="restrictionata"
        pictograma={Megaphone}
        titlu="Anunțul nu mai e pe avizier"
        descriere="A expirat sau a fost retras de administrator. Anunțurile active sunt în listă."
        actiune={{ eticheta: "Deschide avizierul", href: "/portal/anunturi" }}
      />
      <p className="text-muted-foreground text-nota mt-4">
        <Link href="/portal/notificarile-mele" className="underline-offset-2 hover:underline">
          Înapoi la notificări
        </Link>
      </p>
    </div>
  );
}
