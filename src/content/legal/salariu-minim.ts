import { calculeazaDinBrut, dinBrut, OPTIUNI_IMPLICITE } from "@/lib/unelte/salariu";

import {
  FACILITATE_SALARIU_MINIM,
  SALARIU_MINIM_BRUT_2026_IANUARIE,
  SALARIU_MINIM_BRUT_2026_IULIE,
} from "./salarizare-publica";
import type { PaginaLege } from "./tipuri";

/**
 * Conținutul paginii `/ghid/salariu-minim-pe-economie`.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * Keyword Planner, oct 2026: „salariu minim pe economie 2026” are 10.000–100.000
 * de căutări pe lună (+9.900% față de anul trecut), cât „calcul salariu net”, și
 * era singurul termen mare fără pagină a lui. Adresa NU poartă anul: cererea se
 * mută pe „2027”, iar o adresă cu an ar trebui abandonată în ianuarie.
 *
 * ── DE UNDE VIN CIFRELE ───────────────────────────────────────────────────
 * Citite pe 6 oct 2026 în Portalul Legislativ (`curl`, forme consolidate):
 *  - HG 146/2026 (MO 196 din 13 martie 2026): 4.325 lei din 1 iulie 2026,
 *    166,667 ore, 25,949 lei/oră; art. 2 abrogă HG 1506/2024 la aceeași dată;
 *  - HG 1506/2024 (MO 1185 din 28 noiembrie 2024): 4.050 lei din 1 ianuarie
 *    2025, 165,334 ore, 24,496 lei/oră;
 *  - Codul muncii, art. 164 alin. (6) și (8), art. 260 alin. (1) lit. a) — amenda
 *    a fost ridicată la 3.000–5.000 lei pe persoană de Legea 283/2024;
 *  - OUG 156/2024 art. LXIX: minimul din construcții, 4.582 lei din 2025.
 * Suma scutită (OUG 89/2025 art. III) și cotele vin din `salarizare-publica.ts`,
 * verificate pe 3 oct 2026.
 *
 * Netul, contribuțiile și costul NU sunt scrise de mână: le calculează la build
 * același motor ca în `/unelte/calculator-salariu` (`src/lib/unelte/salariu.ts`),
 * deci pagina și calculatorul nu se pot contrazice.
 */

const lei = (n: number) =>
  `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 3 }).format(n)} lei`;

const MINIM = SALARIU_MINIM_BRUT_2026_IULIE;
const LA_MINIM = dinBrut(MINIM, 0, true);
const UN_LEU_PESTE = dinBrut(MINIM + 1, 0, true);
/** Ianuarie–iunie 2026: 4.050 lei, cu 300 de lei scutiți (OUG 89/2025 art. III alin. (1)). */
const LA_MINIM_IANUARIE = calculeazaDinBrut(SALARIU_MINIM_BRUT_2026_IANUARIE, {
  ...OPTIUNI_IMPLICITE,
  perioada: "2026-1",
});

/**
 * Primul brut întreg peste minim la care netul ajunge din nou cel puțin la netul
 * de la minim. Între minim și el, o mărire mică a salariului de bază scade netul,
 * fiindcă suma scutită se pierde (art. III cere un salariu de bază EGAL cu minimul).
 */
function brutulCareRecupereaza(): number {
  for (let brut = MINIM + 1; brut <= MINIM + 1000; brut += 1) {
    if (dinBrut(brut, 0, true).net >= LA_MINIM.net) return brut;
  }
  return MINIM + 1000;
}
const RECUPERARE = brutulCareRecupereaza();
const BAZA_CONTRIBUTII = MINIM - LA_MINIM.sumaNeimpozabila;

/** Valorile folosite și de metadatele paginii — titlul și descrierea spun cifrele. */
export const CIFRE_SALARIU_MINIM = {
  brut: MINIM,
  net: LA_MINIM.net,
  costTotal: LA_MINIM.costTotal,
  lei,
} as const;

export const SALARIU_MINIM: PaginaLege = {
  cale: "/ghid/salariu-minim-pe-economie",
  antet: {
    supratitlu: "Salarizare · valori oficiale",
    titlu: `Salariul minim pe economie în 2026: ${lei(MINIM)} brut, ${lei(LA_MINIM.net)} net`,
    lead: `Din 1 iulie 2026, salariul de bază minim brut pe țară e ${lei(MINIM)} pe lună, adică 25,949 lei pe oră. Până la 30 iunie 2026 a fost 4.050 lei. Mai jos: netul, costul pentru firmă, suma de ${lei(FACILITATE_SALARIU_MINIM.suma)} scutită și capcana de 1 leu.`,
  },

  raspunsScurt: [
    `Salariul de bază minim brut pe țară este ${lei(MINIM)} pe lună din 1 iulie 2026, pentru un program normal de 166,667 ore pe lună, adică 25,949 lei pe oră — HG 146/2026, publicată în Monitorul Oficial nr. 196 din 13 martie 2026. Între 1 ianuarie 2025 și 30 iunie 2026 a fost 4.050 lei, adică 24,496 lei pe oră — HG 1506/2024.`,
    `La normă întreagă, în funcția de bază și fără persoane în întreținere, ${lei(MINIM)} brut înseamnă ${lei(LA_MINIM.net)} net. Costul total pentru firmă e ${lei(LA_MINIM.costTotal)}: brutul plus contribuția asiguratorie pentru muncă de 2,25%.`,
    `Între 1 iulie și 31 decembrie 2026, ${lei(FACILITATE_SALARIU_MINIM.suma)} din salariul minim nu se impozitează și nu intră în baza contribuțiilor — OUG 89/2025 art. III. Facilitatea cere un salariu de bază egal cu minimul, normă întreagă, funcția de bază și un venit brut de cel mult ${lei(FACILITATE_SALARIU_MINIM.plafonVenitBrut)}.`,
  ],

  titluReguli: "Ce reguli are salariul minim pe economie în 2026?",
  titluAmenzi: "Ce amendă riscă angajatorul care plătește sub salariul minim?",

  reguli: [
    {
      situatie: "Valoarea, din 1 iulie 2026",
      cerinta: `${lei(MINIM)} pe lună, fără sporuri și adaosuri, pentru un program normal de 166,667 ore pe lună în medie, adică 25,949 lei pe oră.`,
      temei: "HG 146/2026, art. 1",
    },
    {
      situatie: "Valoarea, până la 30 iunie 2026",
      cerinta:
        "4.050 lei pe lună, pentru 165,334 ore în medie, adică 24,496 lei pe oră. Hotărârea a fost abrogată la 1 iulie 2026.",
      temei: "HG 1506/2024, art. 1; HG 146/2026, art. 2",
    },
    {
      situatie: "Suma scutită",
      cerinta: `Pentru veniturile din iulie–decembrie 2026, ${lei(FACILITATE_SALARIU_MINIM.suma)} pe lună nu se impozitează și nu intră în baza contribuțiilor, dacă salariul de bază e egal cu minimul, la normă întreagă și în funcția de bază, iar venitul brut nu trece de ${lei(FACILITATE_SALARIU_MINIM.plafonVenitBrut)}.`,
      temei: "OUG 89/2025, art. III",
    },
    {
      situatie: "Contractul nu poate coborî sub minim",
      cerinta:
        "Salariul de bază brut negociat prin contractul individual sau colectiv nu poate fi sub salariul de bază minim brut orar.",
      temei: "art. 164 alin. (6) Codul muncii",
    },
    {
      situatie: "Cel mult 24 de luni la minim",
      cerinta:
        "Salariul minim se poate acorda unui salariat cel mult 24 de luni de la încheierea contractului individual de muncă. După aceea, salariul de bază trebuie să fie mai mare decât minimul.",
      temei: "art. 164 alin. (8) Codul muncii",
    },
    {
      situatie: "Construcții",
      cerinta:
        "Minim propriu, prin derogare: 4.582 lei pe lună din 1 ianuarie 2025, pentru 165,334 ore în medie, adică 27,714 lei pe oră. Plata sub el se amendează ca la art. 260 alin. (1) lit. a) din Codul muncii. Facilitățile fiscale ale sectorului au fost abrogate de la 1 ianuarie 2025, chiar prin OUG 156/2024.",
      temei: "OUG 156/2024, art. LXIX",
    },
    {
      situatie: "REGES-ONLINE, la schimbarea salariului",
      cerinta:
        "Modificarea salariului de bază se transmite în REGES-ONLINE în cel mult 20 de zile lucrătoare de la producerea ei.",
      temei: "HG 295/2025, art. 5 alin. (4)",
    },
  ],

  amenzi: [
    {
      fapta:
        "Nerespectarea garantării în plată a salariului de bază minim brut stabilit prin act normativ sau a nivelului salarial minim din contractul colectiv aplicabil",
      suma: "3.000 – 5.000 lei",
      aplicare:
        "Pentru fiecare persoană pentru care s-a constatat încălcarea, fără a depăși 200.000 de lei cumulat.",
      temei: "art. 260 alin. (1) lit. a) Codul muncii",
    },
  ],

  sectiuni: [
    {
      titlu: "Cât rămâne în mână și cât plătește firma",
      paragrafe: [
        `Pentru ${lei(MINIM)} brut, la normă întreagă, în funcția de bază și fără persoane în întreținere: ${lei(LA_MINIM.sumaNeimpozabila)} sunt scutiți, iar contribuțiile se calculează pe restul de ${lei(BAZA_CONTRIBUTII)} — CAS ${lei(LA_MINIM.cas)}, CASS ${lei(LA_MINIM.cass)}. Deducerea personală e ${lei(LA_MINIM.deducerePersonala)}, impozitul ${lei(LA_MINIM.impozit)}. Netul e ${lei(LA_MINIM.net)}.`,
        `Firma mai plătește contribuția asiguratorie pentru muncă, 2,25% din aceeași bază: ${lei(LA_MINIM.cam)}. Costul total pe lună e ${lei(LA_MINIM.costTotal)}.`,
        "Cifrele sunt calculate exact ca în calculatorul de salariu de pe site. Sunt informative: suma de pe statul de plată o confirmă contabilul.",
      ],
    },
    {
      titlu: "Capcana de 1 leu peste minim",
      paragrafe: [
        `Suma scutită se acordă doar când salariul de bază e egal cu minimul. La ${lei(MINIM + 1)} brut facilitatea dispare, iar netul scade la ${lei(UN_LEU_PESTE.net)} — cu ${lei(LA_MINIM.net - UN_LEU_PESTE.net)} mai puțin decât la ${lei(MINIM)}.`,
        `Netul de la minim se recuperează abia de la ${lei(RECUPERARE)} brut. Între cele două valori, o mărire a salariului de bază lasă omul cu mai puțini bani în mână și costă firma mai mult.`,
      ],
    },
    {
      titlu: "Ce se schimbă în firmă la 1 iulie 2026",
      paragrafe: [
        `Salariații plătiți cu minimul trec la ${lei(MINIM)} de la 1 iulie 2026. Pentru fiecare, modificarea salariului de bază se transmite în REGES-ONLINE în cel mult 20 de zile lucrătoare.`,
        "Contractele încheiate cu salariul minim de mai mult de 24 de luni cer un salariu de bază peste minim — art. 164 alin. (8) din Codul muncii.",
      ],
    },
  ],

  tabel: {
    titlu: "Salariul minim în 2026, pe scurt",
    coloane: ["", "Ianuarie–iunie 2026", "Din 1 iulie 2026"],
    randuri: [
      ["Brut pe lună", "4.050 lei", lei(MINIM)],
      ["Ore pe lună, în medie", "165,334", "166,667"],
      ["Brut pe oră", "24,496 lei", "25,949 lei"],
      ["Actul normativ", "HG 1506/2024", "HG 146/2026"],
      [
        "Net, normă întreagă, fără persoane în întreținere",
        lei(LA_MINIM_IANUARIE.net),
        lei(LA_MINIM.net),
      ],
      ["Cost total pentru firmă", lei(LA_MINIM_IANUARIE.costTotal), lei(LA_MINIM.costTotal)],
    ],
    nota: `Netul și costul sunt calculate de același motor ca în calculatorul de salariu, cu suma scutită a fiecărei perioade: ${String(LA_MINIM_IANUARIE.sumaNeimpozabila)} de lei în ianuarie–iunie, ${String(LA_MINIM.sumaNeimpozabila)} de lei din iulie (OUG 89/2025 art. III).`,
  },

  nesigur: [
    {
      intrebare: "Cât va fi salariul minim în 2027?",
      raspuns:
        "Pagina se actualizează când apare hotărârea de guvern. Suma scutită de la salariul minim e prevăzută doar pentru veniturile de până la 31 decembrie 2026.",
    },
    {
      intrebare: "Minimul din construcții s-a schimbat în 2026?",
      raspuns:
        "În forma consolidată a Codului muncii, citită pe 6 octombrie 2026, valoarea pentru construcții rămâne cea din OUG 156/2024 — 4.582 lei. Facilitățile fiscale din construcții nu se mai aplică veniturilor de după 1 ianuarie 2025, deci salariul de acolo se impozitează ca oricare altul.",
    },
    {
      intrebare: "Cât se plătește la jumătate de normă?",
      raspuns:
        "Salariul de bază se raportează la minimul orar de 25,949 lei. Contribuțiile la timp parțial au reguli proprii în Codul fiscal, pe care pagina nu le acoperă.",
    },
  ],

  legaturaSecundara: {
    eticheta: "Calculator salariu net și brut",
    href: "/unelte/calculator-salariu",
  },
  legaturiConexe: [
    { eticheta: "Calculator salariu net și brut", href: "/unelte/calculator-salariu" },
    { eticheta: "Program de salarizare", href: "/module/salarizare" },
    { eticheta: "REGES-ONLINE: termenele de transmitere", href: "/reges-online" },
    { eticheta: "Ore suplimentare: limita și plata", href: "/ghid/ore-suplimentare" },
  ],
  surse: [
    {
      eticheta: "HG 146/2026 — salariul minim din 1 iulie 2026",
      href: "https://legislatie.just.ro/Public/DetaliiDocumentAfis/308231",
    },
    {
      eticheta: "HG 1506/2024 — salariul minim din 1 ianuarie 2025",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/291450",
    },
    {
      eticheta: "Codul muncii, forma consolidată (art. 164, art. 260)",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/128647",
    },
    {
      eticheta: "OUG 89/2025, art. III — suma scutită",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/305817",
    },
    {
      eticheta: "HG 295/2025 (REGES-ONLINE), forma consolidată",
      href: "https://legislatie.just.ro/Public/DetaliiDocumentAfis/302099",
    },
  ],
  actualizat: "octombrie 2026",
  actualizatIso: "2026-10-07",
  publicatIso: "2026-10-06",
};
