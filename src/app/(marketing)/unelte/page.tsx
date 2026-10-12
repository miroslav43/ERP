// src/app/(marketing)/unelte/page.tsx
import type { Metadata } from "next";

import Link from "next/link";

import { GRUPURI_HUB } from "@/content/landing/hub-unelte";
import { RO } from "@/content/landing/ro";

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
      <Banda inaltime="scurta" supratitlu="Toate uneltele" titlu="Gata de folosit">
        {/* Cuprinsul categoriilor: pe telefon, a patra categorie e la trei
            ecrane distanță. Ancorele sunt `id`-urile benzilor de mai jos. */}
        <nav aria-label="Categoriile de unelte" className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
          {GRUPURI_HUB.map((g) => (
            <a
              key={g.id}
              href={`#${g.id}`}
              className="text-[0.9375rem] underline underline-offset-4"
            >
              {g.supratitlu}
            </a>
          ))}
          <Link
            href="/unelte/foaie-de-pontaj"
            className="text-[0.9375rem] underline underline-offset-4"
          >
            Foaia de pontaj a lunii curente
          </Link>
        </nav>
      </Banda>

      {GRUPURI_HUB.map((g) => (
        <Banda
          key={g.id}
          id={g.id}
          inaltime="scurta"
          supratitlu={g.supratitlu}
          titlu={g.titlu}
          lead={g.lead}
        >
          <ListaHub pagini={g.pagini} />
        </Banda>
      ))}

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
