// src/app/(marketing)/comparatie/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";
import { ANTET_COMPARATIE } from "@/content/legal/comparatie-excel";

import { AntetSecundar } from "../_componente/antet-secundar";
import { Banda } from "../_componente/banda";
import { Cadru } from "../_componente/cadru";
import { ListaHub } from "../_componente/lista-hub";

/**
 * Comparațiile, ca hub.
 *
 * `/comparatie` dădea 404 până la 17 sept 2026, deși `/comparatie/excel` exista.
 */
export const metadata: Metadata = {
  title: "Comparații: pontaj în Excel sau într-o aplicație",
  description:
    "Unde se rupe foaia de calcul la pontaj și unde nu se rupe deloc, inclusiv situațiile în care e mai bine să rămâi la Excel.",
  alternates: { canonical: "/comparatie" },
};

const PAGINI = [
  { href: "/comparatie/excel", titlu: ANTET_COMPARATIE.titlu, lead: ANTET_COMPARATIE.lead },
];

export default function PaginaComparatie() {
  return (
    <Cadru text={RO}>
      <AntetSecundar
        text={RO.pagini.comparatie}
        firimituri={[
          { eticheta: "Acasă", href: "/" },
          { eticheta: "Comparații", href: "/comparatie" },
        ]}
      />
      <Banda inaltime="medie" supratitlu="Toate comparațiile" titlu="Față în față">
        <ListaHub pagini={PAGINI} />
      </Banda>

      <Banda
        inaltime="medie"
        supratitlu="Când merită citită"
        titlu="Cui i se adresează comparația"
        lead="O comparație e utilă doar dacă spune și când răspunsul e „rămâi unde ești”."
      >
        <div className="mt-6 max-w-[68ch] space-y-4">
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
            Foaia de calcul nu e o unealtă proastă. E o unealtă bună, folosită de multe ori dincolo
            de punctul în care mai poate face față: când pontajul vine de pe trei puncte de lucru,
            când două persoane editează același fișier în aceeași zi, sau când cineva întreabă cine
            a schimbat o oră acum trei luni și nimeni nu poate răspunde. Comparația de mai sus ia
            exact momentele astea, unul câte unul.
          </p>
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
            Nu ia problema invers, ca o listă de motive să cumperi. Are și o secțiune despre
            situațiile în care e în regulă să rămâi la Excel — o firmă de cinci oameni, cu un singur
            punct de lucru și fără ore suplimentare, n-are ce câștiga dintr-o mutare acum. Dacă te
            regăsești acolo, ai citit pagina degeaba, iar asta e un rezultat bun.
          </p>
        </div>
      </Banda>
    </Cadru>
  );
}
