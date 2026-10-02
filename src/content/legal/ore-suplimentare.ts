import type { PaginaLege } from "./tipuri";

/**
 * Conținutul paginii `/ghid/ore-suplimentare`.
 *
 * ── CE FACE PAGINA ASTA DIFERIT ───────────────────────────────────────────
 * Întrebarea cea mai sugerată — „câte ore suplimentare ai voie pe lună” — nu are
 * răspuns în lună: Codul muncii pune limita pe SĂPTĂMÂNĂ (48 de ore, cu tot cu
 * suplimentarele), cu media pe 4 luni. Pagina o spune pe față, în loc să
 * inventeze o cifră lunară.
 *
 * Al doilea lucru greșit des în afară: termenul de compensare. Multe pagini scriu
 * încă „60 de zile”; din OUG 117/2021 art. 122 alin. (1) spune 90 de zile
 * calendaristice. Planul de implementare pornise și el de la 60 — s-a corectat la
 * citirea textului.
 *
 * ── DE UNDE VIN CIFRELE ───────────────────────────────────────────────────
 * Codul muncii, forma consolidată din Portalul Legislativ (doc. 128647, cu
 * modificări până în aprilie 2026), descărcată cu `curl` pe 2 oct 2026:
 * art. 105, 112, 114, 120–124, 137, 142, 260 alin. (1) lit. g) și i).
 */
export const ORE_SUPLIMENTARE: PaginaLege = {
  cale: "/ghid/ore-suplimentare",
  antet: {
    supratitlu: "Obligație legală",
    titlu: "Ore suplimentare: ce spune Codul muncii în 2026",
    lead: "Limita e pe săptămână, nu pe lună; orele se compensează întâi cu timp liber, în 90 de zile, și abia apoi cu bani; iar fără acordul salariatului nu se pot cere decât în situații de urgență.",
  },

  raspunsScurt: [
    "Munca suplimentară e munca peste durata normală de 40 de ore pe săptămână — art. 120. Durata maximă, cu tot cu suplimentarele, e de 48 de ore pe săptămână; o săptămână poate trece de 48 doar dacă media pe 4 luni calendaristice rămâne sub 48 — art. 114. Codul muncii nu fixează o limită lunară.",
    "Orele suplimentare se compensează întâi cu ore libere plătite, în următoarele 90 de zile calendaristice — art. 122. Dacă nu se poate, se plătesc cu un spor de cel puțin 75% din salariul de bază — art. 123.",
    "Nu se pot cere fără acordul salariatului, în afara forței majore și a lucrărilor urgente — art. 120 alin. (2). Tinerii sub 18 ani nu pot face ore suplimentare — art. 124. Încălcarea regulilor se amendează cu 1.500–3.000 de lei pentru fiecare persoană — art. 260 alin. (1) lit. i).",
  ],

  titluReguli: "Regulile, cu articolul lângă fiecare",

  reguli: [
    {
      situatie: "Ce e munca suplimentară",
      cerinta:
        "Munca prestată în afara duratei normale a timpului de muncă săptămânal — 40 de ore pentru norma întreagă.",
      temei: "art. 120 alin. (1) și art. 112 alin. (1) Codul muncii",
    },
    {
      situatie: "Acordul salariatului",
      cerinta:
        "Obligatoriu, cu excepția forței majore și a lucrărilor urgente destinate prevenirii accidentelor sau înlăturării consecințelor lor.",
      temei: "art. 120 alin. (2) Codul muncii",
    },
    {
      situatie: "Limita",
      cerinta:
        "48 de ore pe săptămână, inclusiv suplimentarele. Peste 48 se poate merge doar dacă media pe 4 luni calendaristice nu trece de 48; prin contract colectiv, perioada de referință poate ajunge la 6 luni.",
      temei: "art. 114 Codul muncii",
    },
    {
      situatie: "Peste limită",
      cerinta:
        "Interzis, cu excepția forței majore sau a lucrărilor urgente pentru prevenirea ori înlăturarea consecințelor unui accident.",
      temei: "art. 121 alin. (2) Codul muncii",
    },
    {
      situatie: "Compensarea",
      cerinta:
        "Cu ore libere plătite, în următoarele 90 de zile calendaristice după efectuarea orelor, cu salariul corespunzător orelor prestate.",
      temei: "art. 122 alin. (1)–(2) Codul muncii",
    },
    {
      situatie: "Plata, dacă nu se compensează",
      cerinta:
        "Un spor la salariu, negociat prin contractul colectiv sau individual, de cel puțin 75% din salariul de bază.",
      temei: "art. 123 Codul muncii",
    },
    {
      situatie: "Timpul parțial",
      cerinta:
        "Contractul cu timp parțial cuprinde interdicția de a efectua ore suplimentare, cu excepția forței majore și a lucrărilor urgente.",
      temei: "art. 105 alin. (1) lit. c) Codul muncii",
    },
    {
      situatie: "Tinerii sub 18 ani",
      cerinta: "Nu pot presta muncă suplimentară.",
      temei: "art. 124 Codul muncii",
    },
  ],

  amenzi: [
    {
      fapta: "Nerespectarea dispozițiilor privind munca suplimentară",
      suma: "1.500 – 3.000 lei",
      aplicare: "Pentru fiecare persoană identificată ca prestând muncă suplimentară.",
      temei: "art. 260 alin. (1) lit. i) Codul muncii",
    },
    {
      fapta: "Munca în zilele de sărbătoare legală fără compensare sau spor",
      suma: "5.000 – 10.000 lei",
      aplicare:
        "Pentru încălcarea art. 139 și 142 — o faptă distinctă de cea a orelor suplimentare.",
      temei: "art. 260 alin. (1) lit. g) Codul muncii",
      nuConfunda:
        "Nu e aceeași contravenție cu cea pentru orele suplimentare: o oră lucrată de Crăciun poate cădea sub ambele reguli, cu temeiuri și amenzi diferite.",
    },
  ],

  sectiuni: [
    {
      titlu: "Câte ore suplimentare ai voie pe lună",
      paragrafe: [
        "Niciun articol nu dă o cifră lunară. Limita e de 48 de ore pe săptămână cu tot cu suplimentarele, deci, într-o săptămână obișnuită de 40 de ore, cel mult 8 ore suplimentare. Peste asta se poate merge în unele săptămâni, cu condiția ca media pe 4 luni calendaristice să rămână sub 48 de ore — art. 114 alin. (2).",
        "Socotit pe o lună cu patru săptămâni și jumătate, asta înseamnă în medie în jur de 35 de ore suplimentare. E o consecință aritmetică a limitei săptămânale, nu o regulă scrisă — iar o lună cu mai mult poate fi legală, dacă lunile din jur o echilibrează.",
      ],
    },
    {
      titlu: "În weekend și în zilele de sărbătoare legală",
      paragrafe: [
        "Munca în zilele de repaus și de sărbătoare are regulile ei. Când repausul săptămânal se acordă în alte zile decât sâmbăta și duminica, salariații primesc un spor stabilit prin contract — art. 137 alin. (3). Pentru sărbătorile legale se dă timp liber în următoarele 30 de zile, iar dacă nu se poate, un spor de cel puțin 100% din salariul de bază — art. 142.",
        "Pe aceeași oră nu se adună automat sporul de ore suplimentare cu cel de sărbătoare: ce se cumulează depinde de contractul colectiv sau individual.",
      ],
    },
  ],

  nesigur: [
    {
      intrebare: "Se cumulează sporul de ore suplimentare cu sporul de sărbătoare?",
      raspuns:
        "Codul muncii nu spune explicit. Practica și contractele colective diferă; pagina nu alege o variantă.",
    },
    {
      intrebare: "Ce înseamnă „în luna următoare” din art. 123?",
      raspuns:
        "Art. 123 alin. (1) leagă plata de imposibilitatea compensării în termenul de 90 de zile „în luna următoare” — formularea e ambiguă, iar momentul exact al plății se lămurește cel mai bine prin contract.",
    },
  ],

  legaturaSecundara: {
    eticheta: "Sporul de noapte: 25% și cele 3 ore",
    href: "/ghid/spor-de-noapte",
  },

  legaturiConexe: [
    { eticheta: "Evidența orelor de muncă: art. 119", href: "/evidenta-orelor-de-munca" },
    { eticheta: "Program de pontaj cu ora de început și de sfârșit", href: "/module/pontaj" },
    { eticheta: "Foaie de pontaj lunar, gratuită", href: "/unelte/foaie-de-pontaj" },
  ],

  surse: [
    {
      eticheta: "Codul muncii, forma consolidată (Portalul Legislativ)",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/128647",
    },
  ],

  actualizat: "octombrie 2026",
  actualizatIso: "2026-10-02",
  publicatIso: "2026-10-02",
};
