// src/app/(marketing)/unelte/page.tsx
import type { Metadata } from "next";

import Link from "next/link";

import { RO } from "@/content/landing/ro";
import {
  ANTET_CALCULATOR,
  ANTET_CERERE_CONCEDIU,
  ANTET_CONDICA,
  ANTET_FISA_EVALUARE,
  ANTET_FISA_SSM,
  ANTET_FOAIE_PARCURS,
  ANTET_FOAIE_PONTAJ,
} from "@/content/landing/unelte";

import { AntetSecundar } from "../_componente/antet-secundar";
import { Banda } from "../_componente/banda";
import { Cadru } from "../_componente/cadru";
import { ListaHub } from "../_componente/lista-hub";
import { metadatePagina } from "../_componente/metadate";
import { AN_MAX, AN_MIN, MAX_ANGAJATI } from "./foaie-de-pontaj/foaie";

/**
 * Uneltele gratuite, ca hub.
 *
 * `/unelte` dădea 404 până la 17 sept 2026, deși `/unelte/foaie-de-pontaj` exista.
 * Lista a fost scrisă ca listă tocmai ca a doua unealtă să nu ceară o pagină
 * nouă — pe 18 sept 2026 a venit, cererea de concediu de odihnă.
 */
export const metadata: Metadata = metadatePagina({
  // Nu „calculator salariu” în titlu: hub-ul concura cu propria pagină de
  // calculator pe același termen (auditul din 7 oct 2026). Calculatorul rămâne
  // în descriere și primul în listă.
  titlu: "Unelte HR gratuite: modele Word, PDF și Excel",
  descriere:
    "Calculator de salariu net și brut, foaie de pontaj, condică de prezență, cerere de concediu, foaie de parcurs, fișe SSM și de evaluare. Gratuit, fără cont.",
  cale: "/unelte",
});

const PAGINI = [
  {
    href: "/unelte/foaie-de-pontaj",
    titlu: ANTET_FOAIE_PONTAJ.titlu,
    lead: ANTET_FOAIE_PONTAJ.lead,
    nota: `${AN_MIN}–${AN_MAX} · până la ${MAX_ANGAJATI} de angajați · fără cont`,
  },
  {
    href: "/unelte/condica-de-prezenta",
    titlu: ANTET_CONDICA.titlu,
    lead: ANTET_CONDICA.lead,
    nota: "ora sosirii și a plecării, pe fiecare zi lucrătoare · Word, PDF, Excel",
  },
  {
    href: "/unelte/cerere-concediu-de-odihna",
    titlu: ANTET_CERERE_CONCEDIU.titlu,
    lead: ANTET_CERERE_CONCEDIU.lead,
    nota: `${AN_MIN}–${AN_MAX} · zilele lucrătoare calculate · fără cont`,
  },
  {
    href: "/unelte/foaie-de-parcurs",
    titlu: ANTET_FOAIE_PARCURS.titlu,
    lead: ANTET_FOAIE_PARCURS.lead,
    nota: "fiecare zi a lunii, traseu și kilometri · Word, PDF, Excel",
  },
  {
    href: "/unelte/fisa-instruire-ssm",
    titlu: ANTET_FISA_SSM.titlu,
    lead: ANTET_FISA_SSM.lead,
    nota: "după anexa 11 la HG 1425/2006 · Word, PDF",
  },
  {
    href: "/unelte/fisa-evaluare",
    titlu: ANTET_FISA_EVALUARE.titlu,
    lead: ANTET_FISA_EVALUARE.lead,
    nota: "criteriile firmei, pondere și notă · Word, PDF, Excel",
  },
  {
    href: "/unelte/calculator-salariu",
    titlu: ANTET_CALCULATOR.titlu,
    lead: ANTET_CALCULATOR.lead,
    nota: "net din brut și brut din net · valorile din iulie 2026",
  },
];

/*
 * Scurtătura spre luna curentă NU poartă parametri. Pagina asta e prerandată
 * static, iar un `new Date()` la nivel de modul îngheța luna la data build-ului:
 * din 1 noiembrie, „Luna curentă" ar fi deschis octombrie (auditul din 7 oct
 * 2026). Fără parametri, unealta își alege singură luna la fiecare cerere.
 * „Luna trecută" și „Luna viitoare" au căzut din același motiv: le alegi din
 * formularul uneltei, la un clic distanță.
 */

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
          <Link
            href="/unelte/foaie-de-pontaj"
            className="text-[0.9375rem] underline underline-offset-4"
          >
            Foaia de pontaj a lunii curente
          </Link>
        </div>
      </Banda>

      <Banda
        inaltime="medie"
        supratitlu="Ce au în comun"
        titlu="Fără cont, fără abonament, fără să rețină ceva"
        lead="Sunt aceleași funcții care lucrează în aplicație, scoase separat pentru cine are nevoie de un document o singură dată."
      >
        {/* Până la 7 oct 2026 banda descria doar foaia de pontaj, de când era
            singura unealtă; între timp au devenit șapte. */}
        <div className="mt-6 max-w-[68ch] space-y-4">
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
            Uneltele cu calendar — foaia de pontaj, condica de prezență și cererea de concediu — își
            calculează singure weekendurile și sărbătorile legale, pentru orice an între {AN_MIN} și{" "}
            {AN_MAX}. Sărbătorile nu sunt o listă copiată: cele mobile se derivă din data Paștelui
            ortodox, deci anii viitori ies corect fără să-i actualizeze cineva. Foaia de pontaj ia
            până la {MAX_ANGAJATI} de oameni pe o pagină.
          </p>
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
            Documentele se tipăresc direct sau se descarcă în Word, PDF sau Excel, după unealtă.
            Niciuna nu cere cont sau adresă de e-mail și niciuna nu reține ce scrii: alegerile stau
            în adresa paginii, iar dacă o pui la favorite, revii la aceeași configurație. Ce nu fac:
            nu țin minte lunile trecute și nu leagă documentele între ele — pentru asta e nevoie de
            evidența din aplicație, unde ziua are oră de început și de sfârșit.
          </p>
        </div>
      </Banda>
    </Cadru>
  );
}
