// src/app/(marketing)/unelte/page.tsx
import type { Metadata } from "next";

import Link from "next/link";

import { RO } from "@/content/landing/ro";
import { ANTET_FOAIE_PONTAJ } from "@/content/landing/unelte";

import { AntetSecundar } from "../_componente/antet-secundar";
import { Banda } from "../_componente/banda";
import { Cadru } from "../_componente/cadru";
import { ListaHub } from "../_componente/lista-hub";
import { AN_MAX, AN_MIN, MAX_ANGAJATI } from "./foaie-de-pontaj/foaie";

/**
 * Uneltele gratuite, ca hub.
 *
 * `/unelte` dădea 404 până la 17 sept 2026, deși `/unelte/foaie-de-pontaj` exista.
 * O singură unealtă azi; lista se scrie ca listă ca a doua să nu ceară o pagină
 * nouă.
 */
export const metadata: Metadata = {
  title: "Unelte gratuite pentru HR: foaie de pontaj lunar",
  description:
    "Unelte care se folosesc fără cont: foaia de pontaj lunar cu sărbătorile legale calculate, de tipărit sau descărcat în Excel.",
  alternates: { canonical: "/unelte" },
};

const PAGINI = [
  {
    href: "/unelte/foaie-de-pontaj",
    titlu: ANTET_FOAIE_PONTAJ.titlu,
    lead: ANTET_FOAIE_PONTAJ.lead,
    nota: `${AN_MIN}–${AN_MAX} · până la ${MAX_ANGAJATI} de angajați · fără cont`,
  },
];

/**
 * Scurtături către luni concrete. Unealta e un formular GET, deci starea ei stă
 * în adresă — legăturile astea nu cer cod nou, doar parametrii pe care pagina îi
 * citește oricum.
 */
const ACUM = new Date();
const LUNA_CURENTA = ACUM.getMonth() + 1;
const AN_CURENT = ACUM.getFullYear();
const SCURTATURI = [
  { eticheta: "Luna curentă", an: AN_CURENT, luna: LUNA_CURENTA },
  {
    eticheta: "Luna trecută",
    an: LUNA_CURENTA === 1 ? AN_CURENT - 1 : AN_CURENT,
    luna: LUNA_CURENTA === 1 ? 12 : LUNA_CURENTA - 1,
  },
  {
    eticheta: "Luna viitoare",
    an: LUNA_CURENTA === 12 ? AN_CURENT + 1 : AN_CURENT,
    luna: LUNA_CURENTA === 12 ? 1 : LUNA_CURENTA + 1,
  },
];

export default function PaginaUnelte() {
  return (
    <Cadru text={RO}>
      <AntetSecundar
        text={RO.pagini.unelte}
        firimituri={[
          { eticheta: "Acasă", href: "/" },
          { eticheta: "Unelte", href: "/unelte" },
        ]}
      />
      <Banda inaltime="medie" supratitlu="Toate uneltele" titlu="Gata de folosit">
        <ListaHub pagini={PAGINI} />
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <p className="font-mk-date text-mk-text-slab text-[0.6875rem] tracking-[0.14em] uppercase">
            Sari direct la
          </p>
          {SCURTATURI.map((s) => (
            <Link
              key={s.eticheta}
              href={`/unelte/foaie-de-pontaj?an=${s.an}&luna=${s.luna}`}
              className="text-[0.9375rem] underline underline-offset-4"
            >
              {s.eticheta}
            </Link>
          ))}
        </div>
      </Banda>

      <Banda
        inaltime="medie"
        supratitlu="Ce face, concret"
        titlu="Foaia de pontaj, fără cont și fără abonament"
        lead="E aceeași funcție care alimentează foaia din aplicație, scoasă separat pentru cine are nevoie o singură dată."
      >
        <div className="mt-6 max-w-[68ch] space-y-4">
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
            Alegi luna și anul, între {AN_MIN} și {AN_MAX}, scrii numele oamenilor — până la{" "}
            {MAX_ANGAJATI} — și primești foaia lunii, cu weekendurile și sărbătorile legale deja
            marcate. Sărbătorile nu sunt o listă copiată: cele mobile se derivă din data Paștelui
            ortodox, deci anii viitori ies corect fără să-i actualizeze cineva.
          </p>
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
            Foaia se tipărește direct sau se descarcă în format de foaie de calcul, ca s-o
            completezi pe calculator. Nu cere cont, nu cere adresă de e-mail și nu reține nimic:
            alegerile tale stau în adresa paginii, iar dacă o pui la favorite, revii la aceeași
            configurație. Ce nu face: nu ține minte lunile trecute și nu calculează ore suplimentare
            — pentru asta e nevoie de evidența din aplicație, unde ziua are oră de început și de
            sfârșit.
          </p>
        </div>
      </Banda>
    </Cadru>
  );
}
