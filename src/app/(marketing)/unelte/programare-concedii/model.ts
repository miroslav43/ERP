// src/app/(marketing)/unelte/programare-concedii/model.ts
import { calendarulAnului } from "@/content/legal/zile-libere";
import {
  AN_MAX_INTERVAL,
  AN_MIN_INTERVAL,
  anulProgramarii,
} from "@/domain/calendar/interval-lucrator";
import { todayInBucharest } from "@/lib/format/date";
import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { citesteAngajati } from "../foaie-de-pontaj/foaie";

/**
 * Programarea anuală a concediilor de odihnă.
 *
 * ── TEMEIURILE (Codul muncii, consolidat la 27.04.2026) ──────────────────
 * Art. 148 alin. (1): programare colectivă sau individuală, stabilită de
 * angajator cu consultarea sindicatului sau a reprezentanților salariaților
 * (colectivă) ori a salariatului (individuală), „până la sfârșitul anului
 * calendaristic pentru anul următor”. Alin. (5): la fracționare, cel puțin 10
 * zile lucrătoare neîntrerupte pe an. Art. 145 alin. (1): minimum 20 de zile
 * lucrătoare pe an. Codul nu dă un formular; tabelul de aici e forma uzuală,
 * un rând pe om și o coloană pe lună.
 *
 * ── CE ADUCE PESTE UN EXCEL GOL ───────────────────────────────────────────
 * Zilele lucrătoare ale fiecărei luni, în antet, și sărbătorile anului în
 * zile de lucru — din `calendarulAnului`, același calcul ca `/ghid/zile-libere`.
 */

export const ZILE_MINIME = 20;
export const ZILE_MAXIME = 60;
const RANDURI_GOALE = 10;
const LUNI_SCURTE = [
  "Ian",
  "Feb",
  "Mar",
  "Apr",
  "Mai",
  "Iun",
  "Iul",
  "Aug",
  "Sep",
  "Oct",
  "Noi",
  "Dec",
] as const;

export type ParametriProgramare = Readonly<{
  an: number;
  firma: string;
  compartiment: string;
  angajati: readonly string[];
  zileCuvenite: number;
}>;

const text = (v: string | null): string =>
  (v ?? "")
    .replace(/[\r\n\t]+/gu, " ")
    .trim()
    .slice(0, 120);

export function citesteProgramare(
  q: URLSearchParams,
  azi: string,
): Readonly<{ parametri: ParametriProgramare; avertismente: readonly string[] }> {
  const avertismente: string[] = [];
  const implicit = anulProgramarii(azi);

  let an = implicit;
  const brutAn = (q.get("an") ?? "").trim();
  if (brutAn !== "") {
    const n = Number(brutAn);
    if (Number.isInteger(n) && n >= AN_MIN_INTERVAL && n <= AN_MAX_INTERVAL) an = n;
    else
      avertismente.push(
        `Anul „${brutAn.slice(0, 10)}” e în afara intervalului ${String(AN_MIN_INTERVAL)}–${String(AN_MAX_INTERVAL)}; am folosit ${String(implicit)}.`,
      );
  }

  let zileCuvenite = ZILE_MINIME;
  const brutZile = (q.get("zile") ?? "").trim();
  if (brutZile !== "") {
    const n = Number(brutZile);
    if (Number.isInteger(n) && n >= ZILE_MINIME && n <= ZILE_MAXIME) zileCuvenite = n;
    else
      avertismente.push(
        `Zile cuvenite: „${brutZile.slice(0, 10)}” nu e un număr între ${String(ZILE_MINIME)} și ${String(ZILE_MAXIME)} (minimul legal e de 20 de zile lucrătoare, art. 145 alin. (1)); am folosit ${String(ZILE_MINIME)}.`,
      );
  }

  const lista = citesteAngajati(q.get("angajati") ?? undefined);
  if (lista.omisi > 0) {
    avertismente.push(
      `Am păstrat primii ${String(lista.total - lista.omisi)} din ${String(lista.total)} de oameni; pentru restul, un al doilea tabel.`,
    );
  }

  return {
    parametri: {
      an,
      firma: text(q.get("firma")),
      compartiment: text(q.get("compartiment")),
      angajati: lista.nume.filter((n) => n !== ""),
      zileCuvenite,
    },
    avertismente,
  };
}

export function construiesteProgramare(p: ParametriProgramare): DocumentTabelar {
  const calendar = calendarulAnului(p.an);
  const oameni =
    p.angajati.length > 0 ? p.angajati : Array.from({ length: RANDURI_GOALE }, () => "");
  const sarbatoriLucratoare = calendar.zile
    .filter((z) => !z.inWeekend)
    .map((z) => `${z.data.replace(/ \d{4}$/u, "")} (${z.denumiri.join(", ")})`)
    .join("; ");

  return {
    titlu: `Programarea concediilor de odihnă pe anul ${String(p.an)}`,
    subtitlu: p.firma === "" ? null : p.firma,
    campuri: [{ eticheta: "Compartimentul", valoare: p.compartiment }],
    paragrafe: [],
    coloane: [
      { eticheta: "Nr.", latime: 0.6 },
      { eticheta: "Numele și prenumele", latime: 3.4 },
      { eticheta: "Zile\ncuvenite", latime: 1 },
      ...calendar.luni.map((l, i) => ({
        eticheta: `${LUNI_SCURTE[i] ?? ""}\n${String(l.zileLucratoare)} z.l.`,
        latime: 1,
      })),
      { eticheta: "Total\nzile", latime: 0.9 },
      { eticheta: "Semnătura\nsalariatului", latime: 1.8 },
    ],
    randuri: oameni.map((nume, i) => [
      String(i + 1),
      nume,
      nume === "" ? "" : String(p.zileCuvenite),
      ...Array.from({ length: 14 }, () => ""),
    ]),
    umbrite: [],
    note: [
      "În fiecare lună se trec intervalele programate (de exemplu „10–21”), iar la „Total” zilele lucrătoare de concediu. Sub fiecare lună e numărul ei de zile lucrătoare, fără weekend și sărbători legale.",
      `Sărbătorile legale din ${String(p.an)} care cad în zile lucrătoare: ${sarbatoriLucratoare}.`,
      "Programarea se face până la sfârșitul anului pentru anul următor, cu consultarea sindicatului sau a reprezentanților salariaților — art. 148 alin. (1) din Codul muncii.",
      "Dacă un concediu se împarte, fiecare salariat trebuie să aibă în an cel puțin 10 zile lucrătoare de concediu neîntrerupt — art. 148 alin. (5).",
    ],
    semnaturi: ["Întocmit", "Consultat — reprezentanții salariaților", "Aprobat — angajator"],
    orientare: "peisaj",
    numeFisier: `programare-concedii-${String(p.an)}`,
  };
}

export function programareDinParametri(q: URLSearchParams): DocumentTabelar {
  return construiesteProgramare(citesteProgramare(q, todayInBucharest()).parametri);
}
