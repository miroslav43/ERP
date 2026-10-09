import { formatDate, parseDateRo } from "@/lib/format/date";
import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import {
  calculeazaGrila,
  citesteNota,
  citestePondere,
  citestePraguri,
  formateazaSutimi,
  MAX_CRITERII,
  MAX_CRITERIU,
  SCALA_NOTE,
  type Praguri,
  type RezultatGrila,
} from "./calcul";
import { setDupaCheie, type CheieSet } from "./seturi";

/**
 * Fișa de evaluare a performanțelor profesionale.
 *
 * Codul muncii nu dă un model; dă doar dreptul angajatorului de a stabili
 * obiectivele și criteriile de evaluare (art. 40 alin. (1) lit. f)), obligația
 * de a le comunica salariatului și de a le trece în contract (art. 17 alin.
 * (3) lit. e) și alin. (4)) și locul procedurii: regulamentul intern (art. 242
 * lit. i)). Verificate pe forma consolidată la 27.04.2026 (legislatie.just.ro,
 * DetaliiDocument/309240), descărcată pe 8 oct 2026.
 *
 * ── ADRESA ────────────────────────────────────────────────────────────────
 * `criteriu`, `pondere`, `nota` se repetă, câte unul pe rând, în ordinea
 * rândurilor: un formular GET le trimite exact așa, și un câmp text gol tot
 * pleacă, deci pozițiile rămân aliniate. `criterii` (un criteriu pe rând, fără
 * ponderi) e forma veche, din linkurile de dinainte de 8 oct 2026; se citește
 * doar când lipsesc rândurile noi. `incarca=set` cere setul ales, peste ce era
 * scris (butonul „Încarcă setul”, care merge și fără JavaScript).
 */

export const MAX_RUBRICA = 500;

/** Un rând al grilei, citit și mărginit. `null` = necompletat (sau de neînțeles). */
export type RandGrila = Readonly<{ criteriu: string; pondere: number | null; nota: number | null }>;

export type ParametriFisaEvaluare = Readonly<{
  nume: string;
  functie: string;
  perioada: string;
  evaluator: string;
  firma: string;
  /** Ziua evaluării, ISO (`2026-12-15`), sau gol. */
  data: string;
  set: CheieSet;
  grila: readonly RandGrila[];
  praguri: Praguri;
  /** Pragurile din adresă nu erau valide și s-au folosit implicitele. */
  praguriCorectate: boolean;
  puncteForte: string;
  deImbunatatit: string;
  obiective: string;
  dezvoltare: string;
}>;

/** Lista implicită, păstrată pentru textul de exemplu și linkurile vechi. */
export const CRITERII_IMPLICITE: readonly string[] = setDupaCheie(null).criterii.map(
  (c) => c.criteriu,
);

/** Un câmp de o linie: fără rânduri noi, fără spații la capete, plafonat. */
const text = (v: string | null) => (v ?? "").replace(/\s+/gu, " ").trim().slice(0, MAX_CRITERIU);

/** O rubrică de text liber: rândurile se păstrează, cele goale se strâng. */
const rubrica = (v: string | null) =>
  (v ?? "")
    .split(/\r\n?|\n/u)
    .map((r) => r.replace(/\s+/gu, " ").trim())
    .filter((r) => r !== "")
    .join("\n")
    .slice(0, MAX_RUBRICA);

/** ISO sau „15.12.2026”, an între 2000 și 2100; altfel gol. */
function dataEvaluarii(brut: string | null): string {
  const v = (brut ?? "").trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/u.test(v) ? v : (parseDateRo(v) ?? "");
  if (iso === "") return "";
  try {
    formatDate(iso); // aruncă pentru 2026-02-31
  } catch {
    return "";
  }
  const an = Number(iso.slice(0, 4));
  return an >= 2000 && an <= 2100 ? iso : "";
}

function grilaDinAdresa(q: URLSearchParams, set: CheieSet): readonly RandGrila[] {
  const dinSet = () =>
    setDupaCheie(set).criterii.map((c) => ({
      criteriu: c.criteriu,
      pondere: c.pondere,
      nota: null,
    }));
  if (q.get("incarca") === "set") return dinSet();

  const ponderi = q.getAll("pondere");
  const note = q.getAll("nota");
  const randuri = q
    .getAll("criteriu")
    .map((c, i) => ({
      criteriu: text(c),
      pondere: citestePondere(ponderi[i] ?? ""),
      nota: citesteNota(note[i] ?? ""),
    }))
    .filter((r) => r.criteriu !== "")
    .slice(0, MAX_CRITERII);
  if (randuri.length > 0) return randuri;

  const vechi = (q.get("criterii") ?? "")
    .split(/\n/u)
    .map((c) => text(c))
    .filter((c) => c !== "")
    .slice(0, MAX_CRITERII)
    .map((criteriu) => ({ criteriu, pondere: null, nota: null }));
  return vechi.length > 0 ? vechi : dinSet();
}

export function parametriFisaEvaluare(q: URLSearchParams): ParametriFisaEvaluare {
  const set = setDupaCheie(q.get("set")).cheie;
  const { praguri, corectate } = citestePraguri(q.get("prag_fb"), q.get("prag_b"), q.get("prag_s"));
  return {
    nume: text(q.get("nume")),
    functie: text(q.get("functie")),
    perioada: text(q.get("perioada")),
    evaluator: text(q.get("evaluator")),
    firma: text(q.get("firma")),
    data: dataEvaluarii(q.get("data")),
    set,
    grila: grilaDinAdresa(q, set),
    praguri,
    praguriCorectate: corectate,
    puncteForte: rubrica(q.get("puncte_forte")),
    deImbunatatit: rubrica(q.get("de_imbunatatit")),
    obiective: rubrica(q.get("obiective")),
    dezvoltare: rubrica(q.get("dezvoltare")),
  };
}

export function rezultatFisa(o: ParametriFisaEvaluare): RezultatGrila {
  return calculeazaGrila(o.grila, o.praguri);
}

/** Textul scalei, același în PDF, Word, Excel și pe pagină. */
export const TEXT_SCALA = `Scala notelor: ${SCALA_NOTE.map((s) => `${String(s.nota)} — ${s.descriere}`).join("; ")}.`;

export const TEXT_FORMULA =
  "Punctaj = pondere × notă / 100. Nota finală = totalul punctajelor, când ponderile însumează 100%.";

export function textPraguri(p: Praguri): string {
  return `Calificativ: Foarte bine de la ${formateazaSutimi(p.foarteBine)}; Bine de la ${formateazaSutimi(p.bine)}; Satisfăcător de la ${formateazaSutimi(p.satisfacator)}; Nesatisfăcător sub ${formateazaSutimi(p.satisfacator)}.`;
}

export const NOTA_LEGALA =
  "Criteriile de evaluare se comunică salariatului și se trec în contractul individual de muncă; schimbarea lor cere act adițional, încheiat înainte — art. 17 alin. (3) lit. e), (4) și (5) din Codul muncii.";

export const SEMNATURI_FISA: readonly string[] = [
  "Evaluator",
  "Contrasemnat (opțional)",
  "Angajat — am luat la cunoștință",
];

export function construiesteFisaEvaluare(o: ParametriFisaEvaluare): DocumentTabelar {
  const r = rezultatFisa(o);
  const completa = r.faraPondere === 0;
  return {
    titlu: "Fișa de evaluare a performanțelor profesionale",
    subtitlu: o.firma === "" ? null : o.firma,
    campuri: [
      { eticheta: "Angajat", valoare: o.nume },
      { eticheta: "Funcția", valoare: o.functie },
      { eticheta: "Perioada evaluată", valoare: o.perioada },
      { eticheta: "Evaluator", valoare: o.evaluator },
      { eticheta: "Data evaluării", valoare: o.data === "" ? "" : formatDate(o.data) },
    ],
    paragrafe: [],
    coloane: [
      { eticheta: "Criteriu", latime: 6.5, rupe: true },
      { eticheta: "Pondere\n(%)", latime: 1.5 },
      { eticheta: "Nota\n(1–5)", latime: 1.5 },
      { eticheta: "Punctaj", latime: 1.5 },
      { eticheta: "Observații", latime: 4.5, rupe: true },
    ],
    randuri: [
      ...o.grila.map((rand, i) => {
        const punctaj = r.punctaje[i] ?? null;
        return [
          rand.criteriu,
          rand.pondere === null ? "" : String(rand.pondere),
          rand.nota === null ? "" : String(rand.nota),
          punctaj === null ? "" : formateazaSutimi(punctaj),
          "",
        ];
      }),
      // Suma doar când toate ponderile sunt scrise: o sumă parțială ar arăta ca un total.
      // Totalul coloanei Punctaj ESTE nota finală; calificativul are rândul lui, cu
      // celula largă (Observații) liberă pentru scris de mână.
      [
        "Total (nota finală)",
        completa ? String(r.sumaPonderi) : "",
        "",
        r.notaFinala === null ? "" : formateazaSutimi(r.notaFinala),
        "",
      ],
      ["Calificativ", "", "", "", r.calificativ ?? ""],
    ],
    umbrite: [],
    note: [TEXT_SCALA, TEXT_FORMULA, textPraguri(o.praguri), NOTA_LEGALA],
    rubrici: [
      { titlu: "Puncte forte", text: o.puncteForte, randuriGoale: 3 },
      { titlu: "De îmbunătățit", text: o.deImbunatatit, randuriGoale: 3 },
      { titlu: "Obiective pentru perioada următoare", text: o.obiective, randuriGoale: 4 },
      { titlu: "Plan de dezvoltare (formare, îndrumare)", text: o.dezvoltare, randuriGoale: 3 },
      { titlu: "Comentariile angajatului", text: "", randuriGoale: 4 },
    ],
    semnaturi: SEMNATURI_FISA,
    dataLaSemnaturi: true,
    inaltimeRand: 26,
    orientare: "portret",
    numeFisier: `fisa-evaluare-${o.nume === "" ? "necompletata" : o.nume}`,
  };
}

export function fisaEvaluareDinParametri(q: URLSearchParams): DocumentTabelar {
  return construiesteFisaEvaluare(parametriFisaEvaluare(q));
}
