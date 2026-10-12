// src/content/legal/zile-libere.ts
import { sarbatoriAnului } from "@/domain/calendar/sarbatori";
import { todayInBucharest } from "@/lib/format/date";

import type { PaginaLege } from "./tipuri";

/**
 * Zilele libere legale, pe doi ani: cel curent și următorul.
 *
 * ── DE CE E CALCULAT, NU SCRIS ────────────────────────────────────────────
 * „zile libere 2026” e cel mai mare gol al sitului (auditul din 7 oct 2026), iar
 * paginile care răspund la el sunt liste copiate în fiecare an, cu greșeli
 * previzibile la sărbătorile mobile. Aici lista vine din `sarbatoriAnului` —
 * același motor care marchează sărbătorile în foaia de pontaj, în cererea de
 * concediu și în aplicație —, iar zilele lucrătoare se numără din ea.
 *
 * Anul e cel al construirii paginii: pagina e statică, iar fiecare deploy o
 * reface. Textele de lege au fost citite pe 7 oct 2026 în forma consolidată a
 * Codului muncii: art. 139 (lista, cultele), 140–142 (munca în zilele de
 * sărbătoare), 145 alin. (3) (concediul), 260 alin. (1) lit. g) (amenda).
 */

const LUNI = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
] as const;

const ZILE_SAPTAMANA = [
  "duminică",
  "luni",
  "marți",
  "miercuri",
  "joi",
  "vineri",
  "sâmbătă",
] as const;

const numar = new Intl.NumberFormat("ro-RO");

/** „20 de zile”, dar „19 zile”: în română, „de” apare de la 20 în sus. */
export function cuDe(n: number, substantiv: string): string {
  const rest = n % 100;
  return rest >= 1 && rest <= 19
    ? `${numar.format(n)} ${substantiv}`
    : `${numar.format(n)} de ${substantiv}`;
}

export type ZiDeSarbatoare = Readonly<{
  iso: string;
  /** „1 ianuarie 2026”. */
  data: string;
  /** „joi”. */
  ziua: string;
  inWeekend: boolean;
  /** Mai multe denumiri când două sărbători cad în aceeași zi (1 iunie 2026). */
  denumiri: readonly string[];
}>;

export type LunaLucratoare = Readonly<{
  luna: string;
  zileLucratoare: number;
}>;

export type CalendarAn = Readonly<{
  an: number;
  /** Cele 17 sărbători din art. 139, ca zile calendaristice (unele pot coincide). */
  zile: readonly ZiDeSarbatoare[];
  sarbatori: number;
  inTimpulSaptamanii: number;
  luni: readonly LunaLucratoare[];
  zileLucratoare: number;
  paste: string;
}>;

function dataLunga(d: Date): string {
  return `${String(d.getUTCDate())} ${LUNI[d.getUTCMonth()] ?? ""} ${String(d.getUTCFullYear())}`;
}

/** Sărbătorile anului, zilele lucrătoare pe luni și totalul. Funcție pură. */
export function calendarulAnului(an: number): CalendarAn {
  const sarbatori = sarbatoriAnului(an);
  const peZi = new Map<string, { data: Date; denumiri: string[] }>();
  for (const s of sarbatori) {
    const iso = s.data.toISOString().slice(0, 10);
    const zi = peZi.get(iso);
    if (zi === undefined) peZi.set(iso, { data: s.data, denumiri: [s.denumire] });
    else zi.denumiri.push(s.denumire);
  }

  const zile = [...peZi.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, { data, denumiri }]) => {
      const zi = data.getUTCDay();
      return {
        iso,
        data: dataLunga(data),
        ziua: ZILE_SAPTAMANA[zi] ?? "",
        inWeekend: zi === 0 || zi === 6,
        denumiri,
      };
    });

  const libere = new Set(zile.filter((z) => !z.inWeekend).map((z) => z.iso));
  const luni = LUNI.map((luna, index) => {
    let zileLucratoare = 0;
    for (let zi = 1; zi <= new Date(Date.UTC(an, index + 1, 0)).getUTCDate(); zi += 1) {
      const data = new Date(Date.UTC(an, index, zi));
      const ziSaptamana = data.getUTCDay();
      if (ziSaptamana === 0 || ziSaptamana === 6) continue;
      if (libere.has(data.toISOString().slice(0, 10))) continue;
      zileLucratoare += 1;
    }
    return { luna, zileLucratoare };
  });

  const paste = sarbatori.find((s) => s.denumire === "Paștele");
  return {
    an,
    zile,
    sarbatori: sarbatori.length,
    inTimpulSaptamanii: libere.size,
    luni,
    zileLucratoare: luni.reduce((total, l) => total + l.zileLucratoare, 0),
    paste: paste === undefined ? "" : dataLunga(paste.data),
  };
}

/** Anul în care s-a construit pagina, în România. */
export const ANUL_CURENT = Number(todayInBucharest().slice(0, 4));

const ANI = [calendarulAnului(ANUL_CURENT), calendarulAnului(ANUL_CURENT + 1)] as const;
const [ACUM, URMATORUL] = ANI;

/** „19 octombrie 2026” → „19 octombrie”. */
function faraAn(c: CalendarAn, data: string): string {
  return data.replace(` ${String(c.an)}`, "");
}

/** Prima literă mică, restul neatins: „A doua zi de Rusalii” → „a doua zi de Rusalii”. */
function inceputMic(text: string): string {
  return text.charAt(0).toLocaleLowerCase("ro-RO") + text.slice(1);
}

/**
 * Sărbătorile care cad în aceeași zi, spuse pe nume. În 2026, a doua zi de
 * Rusalii cade pe 1 iunie, odată cu Ziua Copilului: 17 sărbători, 16 zile.
 */
function suprapuneri(c: CalendarAn): string {
  const duble = c.zile.filter((z) => z.denumiri.length > 1);
  if (duble.length === 0) return "";
  const care = duble
    .map(
      (z) =>
        `${inceputMic(z.denumiri[1] ?? "")} cade pe ${faraAn(c, z.data)}, odată cu ${z.denumiri[0] ?? ""}`,
    )
    .join("; ");
  return ` Iar ${care}, așa că cele ${String(c.sarbatori)} sărbători ocupă doar ${cuDe(c.zile.length, "zile")}.`;
}

function paragrafLuni(c: CalendarAn): string[] {
  const parti = c.luni.map((l) => `${l.luna} ${String(l.zileLucratoare)}`);
  return [
    `Pe luni: ${parti.slice(0, 6).join(", ")}; ${parti.slice(6).join(", ")}.`,
    `În total, ${cuDe(c.zileLucratoare, "zile lucrătoare")}, adică ${cuDe(c.zileLucratoare * 8, "ore")} la normă întreagă de 8 ore pe zi. Norma unei luni se socotește la fel: zilele lucrătoare ale lunii înmulțite cu 8.`,
  ];
}

function propozitieAn(c: CalendarAn): string {
  return `În ${String(c.an)}, ${cuDe(c.inTimpulSaptamanii, "zile de sărbătoare")} cad de luni până vineri, iar anul are ${cuDe(c.zileLucratoare, "zile lucrătoare")}.`;
}

export const ZILE_LIBERE: PaginaLege = {
  cale: "/ghid/zile-libere",
  antet: {
    supratitlu: "Calendar",
    titlu: `Zilele libere legale în ${String(ACUM.an)} și ${String(URMATORUL.an)}`,
    lead: "Toate sărbătorile legale din Codul muncii, cu ziua săptămânii în care cad, plus zilele lucrătoare din fiecare lună. Calculate, nu copiate: sărbătorile mobile vin din data Paștelui ortodox.",
  },

  raspunsScurt: [
    `Codul muncii dă 17 zile de sărbătoare legală pe an, în care nu se lucrează — art. 139. ${propozitieAn(ACUM)}${suprapuneri(ACUM)}`,
    `${propozitieAn(URMATORUL)}${suprapuneri(URMATORUL)} Paștele ortodox cade pe ${faraAn(ACUM, ACUM.paste)} în ${String(ACUM.an)} și pe ${faraAn(URMATORUL, URMATORUL.paste)} în ${String(URMATORUL.an)}.`,
    "Când o sărbătoare cade sâmbăta sau duminica, legea nu dă o altă zi liberă în schimb. Unde activitatea nu se poate opri, cine lucrează de sărbători primește timp liber în următoarele 30 de zile sau, dacă nu se poate, un spor de cel puțin 100% din salariul de bază — art. 142.",
  ],

  titluReguli: "Care sunt zilele libere prin lege?",
  reguli: [
    {
      situatie: "Sărbătorile cu dată fixă",
      cerinta:
        "1 și 2 ianuarie, 6 ianuarie (Boboteaza), 7 ianuarie (Sfântul Ioan Botezătorul), 24 ianuarie (Unirea Principatelor), 1 mai, 1 iunie, 15 august (Adormirea Maicii Domnului), 30 noiembrie (Sfântul Andrei), 1 decembrie, 25 și 26 decembrie.",
      temei: "art. 139 alin. (1) Codul muncii",
    },
    {
      situatie: "Sărbătorile mobile",
      cerinta: `Vinerea Mare, prima și a doua zi de Paști, prima și a doua zi de Rusalii, după calendarul ortodox. Rusaliile cad la șapte săptămâni după Paști.`,
      temei: "art. 139 alin. (1) Codul muncii",
    },
    {
      situatie: "Salariații de alt cult creștin",
      cerinta:
        "Vinerea Mare, Paștele și Rusaliile se dau după data la care le sărbătorește cultul lor, nu după calendarul ortodox.",
      temei: "art. 139 alin. (2¹) Codul muncii",
    },
    {
      situatie: "Salariații de un cult necreștin",
      cerinta:
        "Câte două zile libere pentru fiecare dintre cele trei sărbători religioase anuale ale cultului lor, date în alte zile decât sărbătorile legale și concediul de odihnă.",
      temei: "art. 139 alin. (1) și (3) Codul muncii",
    },
    {
      situatie: "Sărbătoarea cade în weekend",
      cerinta:
        "Nu se dă o altă zi liberă în schimb: Codul muncii nu prevede compensare pentru sărbătorile care cad sâmbăta sau duminica.",
      temei: "art. 139 Codul muncii",
    },
    {
      situatie: "Munca în zi de sărbătoare",
      cerinta:
        "Se lucrează doar unde activitatea nu se poate întrerupe și în unitățile sanitare și de alimentație publică. Ziua se compensează cu timp liber în următoarele 30 de zile; dacă nu se poate, cu un spor de cel puțin 100% din salariul de bază.",
      temei: "art. 140–142 Codul muncii",
    },
    {
      situatie: "Sărbătoarea cade în concediul de odihnă",
      cerinta:
        "Nu consumă o zi de concediu: zilele de sărbătoare legală în care nu se lucrează nu intră în durata concediului.",
      temei: "art. 145 alin. (3) Codul muncii",
    },
  ],

  titluAmenzi: "Ce riscă firma dacă nu respectă zilele libere?",
  amenzi: [
    {
      fapta:
        "Nerespectarea zilelor de sărbătoare legală sau a compensării datorate celor care au lucrat în aceste zile",
      suma: "5.000 – 10.000 lei",
      temei: "art. 260 alin. (1) lit. g) Codul muncii",
    },
  ],

  sectiuni: [
    {
      titlu: `Zilele lucrătoare din ${String(ACUM.an)}, pe luni`,
      ancora: "zile-lucratoare-an-curent",
      paragrafe: paragrafLuni(ACUM),
    },
    {
      titlu: `Zilele lucrătoare din ${String(URMATORUL.an)}, pe luni`,
      ancora: "zile-lucratoare-anul-urmator",
      paragrafe: paragrafLuni(URMATORUL),
    },
    {
      titlu: "Cum se numără zilele lucrătoare",
      ancora: "cum-se-numara",
      paragrafe: [
        "Din zilele lunii se scad sâmbetele, duminicile și sărbătorile legale care cad de luni până vineri. O sărbătoare care cade în weekend nu mai scade nimic: ziua era oricum liberă.",
        "Zilele libere date în plus de firmă — o punte, o zi liberă de Crăciun peste cele legale — nu sunt în calculul de mai sus. Ele țin de regulile fiecărei firme; în aplicație se trec ca zile libere ale firmei, iar cererile de concediu nu le mai numără.",
      ],
    },
    {
      titlu: "Punțile nu sunt zile libere legale",
      ancora: "punti",
      paragrafe: [
        "Zilele „punte” dintre o sărbătoare și weekend nu apar în Codul muncii. Pentru instituțiile publice le stabilește Guvernul, de la caz la caz; într-o firmă privată, decizia e a angajatorului.",
      ],
    },
  ],

  tabel: {
    titlu: "Sărbătorile legale, zi cu zi",
    ancora: "calendar",
    coloane: ["Data", "Ziua", "Sărbătoarea"],
    randuri: ANI.flatMap((c) =>
      c.zile.map((z) => [
        z.data,
        z.inWeekend ? `${z.ziua} (weekend)` : z.ziua,
        z.denumiri.join(" și "),
      ]),
    ),
    nota: "Lista vine din același calcul care marchează sărbătorile în foaia de pontaj și în cererea de concediu de pe site. Zilele „(weekend)” nu scad din zilele lucrătoare.",
  },

  nesigur: [
    {
      intrebare: "Vor fi punți în anul care vine?",
      raspuns:
        "Nu știm dinainte. Guvernul le stabilește de obicei cu puțin timp înainte, prin hotărâre, și doar pentru instituțiile publice; nu le trecem aici până nu apar în Monitorul Oficial.",
    },
    {
      intrebare: "Care sunt zilele libere pentru cultele necreștine?",
      raspuns:
        "Legea dă două zile pentru fiecare dintre cele trei sărbători anuale ale cultului, dar datele le declară fiecare cult și se schimbă de la un an la altul. Nu le calculăm; se stabilesc cu salariatul.",
    },
  ],

  surse: [
    {
      eticheta: "Codul muncii (Legea nr. 53/2003), forma consolidată — art. 139–142, 145 și 260",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/128647",
    },
  ],

  legaturaSecundara: {
    eticheta: "Foaia de pontaj cu sărbătorile deja marcate",
    href: "/unelte/foaie-de-pontaj",
  },
  legaturiConexe: [
    {
      eticheta: "Câte zile de concediu ai pe an și pe lună",
      href: "/ghid/concediu-de-odihna#zile-pe-an",
    },
    {
      eticheta: "Cerere de concediu cu zilele lucrătoare calculate",
      href: "/unelte/cerere-concediu-de-odihna",
    },
    {
      eticheta: "Calculator: zile lucrătoare între două date",
      href: "/unelte/calculator-zile-lucratoare",
    },
    { eticheta: "Ore suplimentare: limita și plata", href: "/ghid/ore-suplimentare" },
    { eticheta: "Program de pontaj cu sărbătorile marcate singur", href: "/module/pontaj" },
  ],

  actualizat: "octombrie 2026",
  actualizatIso: "2026-10-07",
  publicatIso: "2026-10-07",
};
