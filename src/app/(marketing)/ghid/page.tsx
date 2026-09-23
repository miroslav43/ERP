// src/app/(marketing)/ghid/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";
import { CONCEDIU_ODIHNA } from "@/content/legal/concediu-odihna";
import { CONTROL_ITM } from "@/content/legal/control-itm";
import { DIURNA } from "@/content/legal/diurna";
import { EVIDENTA_ORELOR } from "@/content/legal/evidenta-orelor";
import { REGES } from "@/content/legal/reges";

import { AntetSecundar } from "../_componente/antet-secundar";
import { Banda } from "../_componente/banda";
import { Cadru } from "../_componente/cadru";
import { ListaHub } from "../_componente/lista-hub";
import { metadatePagina } from "../_componente/metadate";

/**
 * Ghidurile, ca hub.
 *
 * Până la 17 sept 2026 `/ghid` dădea 404, deși `/ghid/control-itm` exista și
 * adresa era publică în proxy — un părinte lipsă pe care orice cititor îl
 * încearcă tăind din adresă. Hub-ul adună și cele două pagini-lege de la
 * rădăcină: pentru cine caută „ce cere legea”, sunt același fel de pagină.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Ghiduri pentru angajatori: pontaj, REGES, ITM",
  descriere:
    "Ce cer Codul muncii și HG 295/2025 de la o firmă mică: evidența orelor, REGES-ONLINE, concediul de odihnă, controlul ITM. Cu articolul de lege lângă fiecare afirmație.",
  cale: "/ghid",
});

const PAGINI = [EVIDENTA_ORELOR, REGES, CONCEDIU_ODIHNA, DIURNA, CONTROL_ITM].map((p) => ({
  href: p.cale,
  titlu: p.antet.titlu,
  lead: p.antet.lead,
  // Data verificării textelor de lege, per ghid. E singura cifră care spune dacă
  // pagina e întreținută sau abandonată — conținutul juridic de pe internet e
  // plin de articole datate anul curent cu cuantumuri de acum trei ani.
  nota: `Textele verificate în ${p.actualizat}`,
}));

/**
 * De unde începe cineva, în funcție de ce îl doare. Text propriu, nu un rezumat
 * al ghidurilor: regulile și amenzile stau pe paginile lor, iar repetate aici ar
 * fi exact duplicarea pe care o scoatem din paginile de modul.
 */
const DE_UNDE = [
  {
    titlu: "Ai primit o înștiințare de control",
    text: "Începe cu ghidul de control ITM: ce documente se cer, în ce ordine se verifică și ce se poate pregăti în ajun — plus ce nu se mai poate.",
  },
  {
    titlu: "Ai angajat pe cineva săptămâna asta",
    text: "REGES-ONLINE are termene pe zile lucrătoare, diferite pentru angajare, suspendare și încetare. Ghidul le ia pe rând, cu temeiul lângă fiecare.",
  },
  {
    titlu: "Ții pontajul în fișiere de calcul",
    text: "Evidența orelor cere ora de începere și ora de sfârșit, zilnic, la locul de muncă. Ghidul spune ce înseamnă asta în practică și cât costă absența ei.",
  },
  {
    titlu: "Cineva ți-a cerut zilele rămase din anul trecut",
    text: "Ghidul de concediu de odihnă ia termenul de report de 18 luni, decizia ÎCCJ din august 2026 despre zilele rămase după el, și calculul indemnizației pe ultimele trei luni.",
  },
  {
    titlu: "Trimiți oameni în deplasare",
    text: "Diurna are două plafoane neimpozabile, nu unul, iar al doilea se calculează separat pentru fiecare lună. Ghidul le ia pe rând, cu formula scrisă în lege.",
  },
];

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

      <Banda
        inaltime="medie"
        supratitlu="De unde începi"
        titlu="Depinde ce te-a adus aici"
        lead="Ghidurile se citesc și separat, dar ordinea contează când ai un termen pe cap."
      >
        <div className="border-mk-rigla/40 mt-8 border-t">
          {DE_UNDE.map((d) => (
            <div
              key={d.titlu}
              className="border-mk-rigla/40 grid gap-2 border-b py-5 md:grid-cols-12 md:gap-8"
            >
              <h3 className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-4">
                {d.titlu}
              </h3>
              <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6] md:col-span-8">
                {d.text}
              </p>
            </div>
          ))}
        </div>
      </Banda>

      <Banda inaltime="scurta" supratitlu="Cum sunt scrise" titlu="Ce găsești în fiecare">
        <div className="mt-6 max-w-[68ch] space-y-4">
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
            Fiecare ghid începe cu răspunsul scurt, nu cu istoricul legislativ, și pune articolul de
            lege lângă fiecare afirmație. Cuantumurile amenzilor sunt cele în vigoare la data
            verificării, cu temeiul alături, iar textele de lege sunt legate direct spre Portalul
            Legislativ, în forma consolidată.
          </p>
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
            Fiecare are și o secțiune pe care paginile concurente n-o au: ce nu putem afirma cu
            certitudine. Acolo scriu întrebările la care sursele se contrazic sau la care n-am găsit
            un text oficial — cu ce am verificat și unde s-a oprit verificarea. O pagină juridică
            fără margini declarate se citește ca sigură pe tot, iar cine găsește o singură greșeală
            nu mai crede nimic din rest.
          </p>
        </div>
      </Banda>
    </Cadru>
  );
}
