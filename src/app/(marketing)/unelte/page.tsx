// src/app/(marketing)/unelte/page.tsx
import type { Metadata } from "next";

import Link from "next/link";

import { RO } from "@/content/landing/ro";
import {
  ANTET_CALCULATOR,
  ANTET_CALCULATOR_CONCEDIU,
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
import {
  AN_MAX as AN_MAX_CERERE,
  AN_MIN as AN_MIN_CERERE,
} from "./cerere-concediu-de-odihna/cerere";
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
    nota: `${AN_MIN}–${AN_MAX} · colectivă sau individuală · normă pe angajat · Excel cu formule · până la ${MAX_ANGAJATI} de angajați`,
  },
  {
    href: "/unelte/condica-de-prezenta",
    titlu: ANTET_CONDICA.titlu,
    lead: ANTET_CONDICA.lead,
    nota: "toate zilele, inclusiv ture · ore lucrate calculate în Excel · Word, PDF, Excel",
  },
  {
    href: "/unelte/cerere-concediu-de-odihna",
    titlu: ANTET_CERERE_CONCEDIU.titlu,
    lead: ANTET_CERERE_CONCEDIU.lead,
    nota: `${AN_MIN_CERERE}–${AN_MAX_CERERE} · odihnă, fără plată, paternal, îngrijitor · Word, PDF`,
  },
  {
    href: "/unelte/calculator-zile-concediu",
    titlu: ANTET_CALCULATOR_CONCEDIU.titlu,
    lead: ANTET_CALCULATOR_CONCEDIU.lead,
    nota: "minimul legal, zile suplimentare, an lucrat parțial · fără cont",
  },
  {
    href: "/unelte/foaie-de-parcurs",
    titlu: ANTET_FOAIE_PARCURS.titlu,
    lead: ANTET_FOAIE_PARCURS.lead,
    nota: "cele 4 elemente din normele fiscale · până la 4 curse pe zi · Excel cu formule",
  },
  {
    href: "/unelte/fisa-instruire-ssm",
    titlu: ANTET_FISA_SSM.titlu,
    lead: ANTET_FISA_SSM.lead,
    nota: "toate rubricile anexei 11 la HG 1425/2006 · Word, PDF",
  },
  {
    href: "/unelte/fisa-evaluare",
    titlu: ANTET_FISA_EVALUARE.titlu,
    lead: ANTET_FISA_EVALUARE.lead,
    nota: "nota finală calculată · Excel cu formule, Word, PDF",
  },
  {
    href: "/unelte/calculator-salariu",
    titlu: ANTET_CALCULATOR.titlu,
    lead: ANTET_CALCULATOR.lead,
    nota: "net și brut · tichete, deduceri, timp parțial · ambele perioade din 2026",
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
        titlu="Fără cont, fără plată, fără să păstrăm ce scrii"
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
          {/* Până la 8 oct 2026 banda promitea că uneltele nu păstrează nimic din
              ce completezi, iar numele din formular plecau la Google Analytics,
              la Umami și în jurnalele serverului. Fraza de acum descrie ce face
              codul după reparație. Vechea formulare NU se citează aici:
              `confidentialitate.test.ts` caută textul ei în fișier. */}
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
            Documentele se tipăresc direct sau se descarcă în Word, PDF sau Excel, după unealtă.
            Niciuna nu cere cont sau adresă de e-mail. Ce completezi nu se salvează la noi:
            documentul se face pe loc și nu intră în nicio bază de date, iar statisticile de
            vizitare și jurnalul serverului înregistrează doar ce unealtă ai deschis, fără valorile
            din câmpuri. Valorile stau în adresa paginii, ca s-o poți pune la favorite și să revii
            la aceeași configurație. Asta înseamnă că rămân în istoricul browserului tău și pleacă
            odată cu linkul, dacă îl trimiți cuiva.{" "}
            <Link
              href="/legal/confidentialitate#sectiunea-2"
              className="underline underline-offset-4"
            >
              Detaliile, în politica de confidențialitate
            </Link>
            .
          </p>
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
            Ce nu fac: nu țin minte lunile trecute și nu leagă documentele între ele — pentru asta e
            nevoie de evidența din aplicație, unde ziua are oră de început și de sfârșit.
          </p>
        </div>
      </Banda>
    </Cadru>
  );
}
