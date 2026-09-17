// src/app/(marketing)/ghid/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";
import { CONTROL_ITM } from "@/content/legal/control-itm";
import { EVIDENTA_ORELOR } from "@/content/legal/evidenta-orelor";
import { REGES } from "@/content/legal/reges";

import { AntetSecundar } from "../_componente/antet-secundar";
import { Banda } from "../_componente/banda";
import { Cadru } from "../_componente/cadru";
import { ListaHub } from "../_componente/lista-hub";

/**
 * Ghidurile, ca hub.
 *
 * Până la 17 sept 2026 `/ghid` dădea 404, deși `/ghid/control-itm` exista și
 * adresa era publică în proxy — un părinte lipsă pe care orice cititor îl
 * încearcă tăind din adresă. Hub-ul adună și cele două pagini-lege de la
 * rădăcină: pentru cine caută „ce cere legea”, sunt același fel de pagină.
 */
export const metadata: Metadata = {
  title: "Ghiduri pentru angajatori: pontaj, REGES, ITM",
  description:
    "Ce cer Codul muncii și HG 295/2025 de la o firmă mică: evidența orelor, REGES-ONLINE, controlul ITM. Cu articolul lângă fiecare afirmație și ce nu se poate afirma sigur.",
  alternates: { canonical: "/ghid" },
};

const PAGINI = [EVIDENTA_ORELOR, REGES, CONTROL_ITM].map((p) => ({
  href: p.cale,
  titlu: p.antet.titlu,
  lead: p.antet.lead,
}));

export default function PaginaGhid() {
  return (
    <Cadru text={RO}>
      <AntetSecundar
        text={RO.pagini.ghid}
        firimituri={[
          { eticheta: "Acasă", href: "/" },
          { eticheta: "Ghiduri", href: "/ghid" },
        ]}
      />
      <Banda inaltime="medie" supratitlu="Toate ghidurile" titlu="Obligațiile, pe rând">
        <ListaHub pagini={PAGINI} />
      </Banda>
    </Cadru>
  );
}
