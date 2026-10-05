import { DIURNA_EXTERNA_TARI, plafonNeimpozabil } from "./diurna-externa-tari";
import type { PaginaLege } from "./tipuri";

/**
 * Conținutul paginii `/ghid/diurna-externa`.
 *
 * Keyword Planner, 2 oct 2026: „diurna externă 2026” are 100–1.000 de căutări pe
 * lună, cu țara în coada căutării („germania”, „bulgaria”, „ungaria”). Pagina
 * dă întâi regula, apoi tabelul complet, cu o ancoră pe fiecare țară.
 *
 * ── DE UNDE VIN CIFRELE ───────────────────────────────────────────────────
 * HG 518/1995, forma consolidată (doc. 7037, ultima modificare 14-10-2024):
 * anexa (coloana „diurna, categoria I”), art. 7^1 (fracțiunile de zi), art. 17
 * (firmele private). Codul fiscal art. 76 alin. (2) lit. k) pct. (ii), forma
 * consolidată (doc. 171282). Ambele citite cu `curl` pe 2 oct 2026.
 *
 * Plafonul de 2,5 × e o ÎNMULȚIRE făcută de noi, nu o cifră din vreun act — ca
 * la `/ghid/diurna`. Dacă hotărârea schimbă un cuantum, tabelul se regenerează
 * din anexă, iar plafonul se mută singur.
 */

const fmt = (n: number) => n.toFixed(2).replace(".", ",");

export const DIURNA_EXTERNA: PaginaLege = {
  cale: "/ghid/diurna-externa",
  antet: {
    supratitlu: "Obligație legală",
    titlu: "Diurna externă în 2026: cuantumul pe fiecare țară",
    lead: "Cuantumul vine din anexa HG 518/1995, iar plafonul neimpozabil pentru o firmă privată e de 2,5 ori acel cuantum — calculat mai jos pentru toate cele 166 de țări din anexă.",
  },

  raspunsScurt: [
    "Diurna în străinătate are un cuantum pe zi pentru fiecare țară, stabilit în anexa HG 518/1995: de exemplu 35 de euro pentru Germania, Franța sau Ungaria și 32 de euro pentru Bulgaria. Pentru firmele private hotărârea e doar o recomandare — art. 17 alin. (1).",
    "Ce contează pentru o firmă privată e plafonul neimpozabil: 2,5 ori cuantumul din anexă, în limita a 3 salarii de bază pe lună — art. 76 alin. (2) lit. k) pct. (ii) din Codul fiscal. Pentru Germania, 87,50 de euro pe zi. Ce trece de plafon e venit din salarii, cu impozit și contribuții.",
    "Zilele se numără de la trecerea frontierei (decolare sau aterizare, pentru avion). Fracțiunea de zi sub 12 ore primește 50% din diurnă, peste 12 ore 100% — art. 7^1 din hotărâre.",
  ],

  titluReguli: "Cum se acordă diurna externă și cât e neimpozabil?",
  titluAmenzi: "Ce riscă firma dacă diurna externă e sub cuantumul din anexă?",

  reguli: [
    {
      situatie: "Cuantumul pe țară",
      cerinta:
        "Diurna zilnică în valută pentru fiecare țară, în două categorii: categoria I pentru personalul obișnuit, categoria a II-a pentru demnitari și funcțiile asimilate lor.",
      temei: "anexa la HG 518/1995",
    },
    {
      situatie: "Firmele private",
      cerinta:
        "Hotărârea li se recomandă, nu li se impune: firma poate plăti altă sumă. Cuantumul din anexă rămâne însă baza de calcul a plafonului fiscal.",
      temei: "art. 17 alin. (1) HG 518/1995",
    },
    {
      situatie: "Plafonul neimpozabil",
      cerinta:
        "2,5 ori nivelul legal al diurnei pentru personalul trimis în străinătate, în limita a 3 salarii de bază corespunzătoare locului de muncă ocupat.",
      temei: "art. 76 alin. (2) lit. k) pct. (ii) Codul fiscal",
    },
    {
      situatie: "Al doilea plafon, lunar",
      cerinta:
        "Cele 3 salarii de bază se raportează la zilele lucrătoare ale fiecărei luni și se înmulțesc cu zilele de deplasare din luna aceea — calculat distinct pe fiecare lună, la fel ca în țară.",
      temei: "art. 76 alin. (2) lit. k) Codul fiscal",
    },
    {
      situatie: "De când se numără",
      cerinta:
        "De la momentul decolării la plecare și al aterizării la întoarcere, pe aeroporturile de frontieră; cu trenul sau mașina, de la trecerea punctului de frontieră, la ieșire și la intrare.",
      temei: "art. 7^1 alin. (1) HG 518/1995",
    },
    {
      situatie: "Fracțiunile de zi",
      cerinta: "Sub 12 ore: 50% din diurnă. Peste 12 ore: diurna întreagă.",
      temei: "art. 7^1 alin. (2) HG 518/1995",
    },
  ],

  amenzi: [
    {
      fapta: "Diurna externă mai mică decât cuantumul din anexă, la o firmă privată",
      suma: "nicio contravenție",
      aplicare:
        "Pentru firmele private hotărârea e o recomandare (art. 17), iar art. 260 din Codul muncii nu conține nicio faptă legată de diurnă. Suma se stabilește prin contract, regulament sau decizia de delegare.",
      temei: "art. 17 alin. (1) HG 518/1995; art. 260 Codul muncii",
    },
    {
      fapta: "Tratarea ca neimpozabilă a părții peste plafon",
      suma: "reîncadrare fiscală",
      aplicare:
        "Diferența devine venit din salarii, cu impozit și contribuții, plus accesoriile din Codul de procedură fiscală. E o chestiune de declarații rectificative, nu de proces-verbal de contravenție.",
      temei: "art. 76 alin. (2) lit. k) și art. 139 Codul fiscal",
    },
  ],

  sectiuni: [
    {
      titlu: "Un exemplu: cinci zile în Germania",
      paragrafe: [
        `Plecare cu avionul luni la 7:00, întoarcere vineri la 21:00. Prima zi și ultima se numără după art. 7^1, iar fiecare zi de 24 de ore primește diurna întreagă. Cuantumul din anexă e de 35 de euro, deci plafonul neimpozabil e de ${fmt(plafonNeimpozabil(35))} de euro pe zi. Dacă firma plătește 60 de euro pe zi, totul e neimpozabil; dacă plătește 100, diferența de ${fmt(100 - plafonNeimpozabil(35))} de euro pe zi intră în venitul salarial — cu condiția ca nici plafonul lunar de 3 salarii de bază să nu fie depășit.`,
      ],
    },
  ],

  tabel: {
    titlu: "Cuantumul pe țări și plafonul neimpozabil",
    coloane: ["Țara", "Moneda", "Diurna pe zi (HG 518/1995)", "Plafon neimpozabil (2,5 ×)"],
    randuri: DIURNA_EXTERNA_TARI.map((t) => [
      t.tara,
      t.moneda,
      fmt(t.cuantum),
      fmt(plafonNeimpozabil(t.cuantum)),
    ]),
    nota: "Coloana „diurna, categoria I” din anexa la HG 518/1995. Plafonul e limita până la care diurna nu se impozitează; firma poate plăti mai mult, iar diferența intră în venitul salarial.",
  },

  nesigur: [
    {
      intrebare: "Ce curs de schimb se folosește la conversia în lei?",
      raspuns:
        "Textele citite nu fixează explicit ziua cursului pentru plafonul fiscal. În practică se folosește cursul BNR din ziua plății sau din ziua deplasării, după politica contabilă a firmei; pagina nu alege una.",
    },
    {
      intrebare: "Și dacă firma plătește mai mult decât cuantumul din anexă?",
      raspuns:
        "Art. 17 alin. (2) din hotărâre limitează, pentru calculul profitului impozabil, cheltuielile peste nivelul din anexă. Cum se combină azi cu regulile de deductibilitate din Codul fiscal e o întrebare pentru contabil, nu pentru o pagină publică.",
    },
  ],

  legaturaSecundara: { eticheta: "Diurna în țară: cele două plafoane", href: "/ghid/diurna" },

  legaturiConexe: [
    { eticheta: "Program de diurne și deplasări", href: "/module/diurna" },
    { eticheta: "Diurna în țară: cele două plafoane", href: "/ghid/diurna" },
    { eticheta: "Foaie de parcurs: model gratuit", href: "/unelte/foaie-de-parcurs" },
  ],

  surse: [
    {
      eticheta: "HG 518/1995, forma consolidată (Portalul Legislativ)",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/7037",
    },
    {
      eticheta: "Codul fiscal, forma consolidată (Portalul Legislativ)",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/171282",
    },
  ],

  actualizat: "octombrie 2026",
  actualizatIso: "2026-10-02",
  publicatIso: "2026-10-02",
};
