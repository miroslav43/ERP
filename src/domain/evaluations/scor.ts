// src/domain/evaluations/scor.ts

/**
 * Punctajul unei evaluări completate.
 *
 * ── DEFECTUL DIN CARE S-A NĂSCUT FIȘIERUL ─────────────────────────────────
 * Formularul vechi ținea scorurile într-un `Record<string, number>` și trimitea
 * `scor ?? 0` pentru TOATE criteriile șablonului. Un criteriu neatins pleca
 * deci ca „0 din 5", indistinct de unul notat cu zero. Pe o scală de la 1 la 5,
 * unde 0 nici măcar nu e o notă validă, asta însemna că o evaluare pe jumătate
 * completată arăta ca o evaluare catastrofală — și, cum nu exista nicio
 * acțiune de UPDATE, nu se mai putea corecta niciodată.
 *
 * Aici `scor` e `null` când nu s-a notat, iar criteriile necompletate ies din
 * numitor și se raportează separat, prin `necompletate`. Un procent calculat pe
 * jumătate din criterii e un procent onest al acelei jumătăți; unul care
 * numără zerourile inventate nu e onest deloc.
 *
 * ── DE CE O SINGURĂ FORMULĂ PENTRU AMBELE MODURI ──────────────────────────
 * Fără ponderi, fiecare criteriu cântărește cât maximul lui: `punctaj` și `din`
 * sunt sume de puncte brute. Cu ponderi, fiecare cântărește `pondere`, iar
 * contribuția lui e `pondere * scor / scala_max`. În ambele cazuri raportul
 * `punctaj / din` e procentul, deci ecranul are un singur mod de citire.
 *
 * `din` se calculează NUMAI peste criteriile completate. Altfel o evaluare
 * salvată ca ciornă la jumătate ar arăta 45 %, iar cifra ar scădea pe măsură ce
 * omul completează — exact inversul a ceea ce se așteaptă.
 *
 * Criteriile de tip `text` nu au punctaj și nu apar în niciun numitor.
 */

import type { CriteriuSablon } from "./criterii";

export interface RaspunsCriteriu {
  readonly criteriu_cod: string;
  /** `null` = necompletat. NU se confundă cu zero. */
  readonly scor: number | null;
  readonly raspuns_text: string | null;
  readonly comentariu: string | null;
}

export interface Punctaj {
  /** 0..100 cu o zecimală, sau `null` când nu există nimic de punctat. */
  readonly procent: number | null;
  readonly punctaj: number;
  readonly din: number;
  readonly completate: number;
  readonly necompletate: number;
  readonly ponderat: boolean;
}

const PUNCTAJ_GOL: Punctaj = {
  procent: null,
  punctaj: 0,
  din: 0,
  completate: 0,
  necompletate: 0,
  ponderat: false,
};

/** O zecimală, fără zgomotul de virgulă mobilă al lui `toFixed` + `Number`. */
function rotunjeste(n: number): number {
  return Math.round(n * 10) / 10;
}

export function calculeazaScor(
  criterii: readonly CriteriuSablon[],
  raspunsuri: readonly RaspunsCriteriu[],
): Punctaj {
  const punctabile = criterii.filter((c) => c.tip !== "text" && c.scala_max > 0);
  if (punctabile.length === 0) return PUNCTAJ_GOL;

  // Ultimul răspuns pe un cod câștigă. Duplicatele nu ar trebui să existe
  // (codurile sunt unice din `atribuieCoduri`), dar jsonb-ul nu le interzice și
  // un rând scris de o versiune veche a aplicației le poate conține.
  const dupaCod = new Map<string, RaspunsCriteriu>();
  for (const r of raspunsuri) dupaCod.set(r.criteriu_cod, r);

  const ponderat = punctabile.some((c) => c.pondere !== null);

  let punctaj = 0;
  let din = 0;
  let completate = 0;
  let necompletate = 0;

  for (const c of punctabile) {
    const r = dupaCod.get(c.cod);
    const scor = r === undefined ? null : r.scor;
    if (scor === null || !Number.isFinite(scor)) {
      necompletate += 1;
      continue;
    }
    completate += 1;
    // Un scor peste maximul scalei ar putea intra prin jsonb editat manual sau
    // printr-un șablon a cărui scală a scăzut între timp. Se plafonează, nu se
    // aruncă: un ecran de citire nu are voie să cadă pe un rând stricat.
    const efectiv = Math.min(Math.max(scor, 0), c.scala_max);
    if (ponderat) {
      const greutate = c.pondere ?? 0;
      punctaj += (greutate * efectiv) / c.scala_max;
      din += greutate;
    } else {
      punctaj += efectiv;
      din += c.scala_max;
    }
  }

  return {
    procent: din === 0 ? null : rotunjeste((punctaj / din) * 100),
    punctaj: rotunjeste(punctaj),
    din: rotunjeste(din),
    completate,
    necompletate,
    ponderat,
  };
}

/**
 * Media pe un set de evaluări, pentru banda de indicatori.
 *
 * Evaluările fără procent (numai criterii text, sau nicio notă dată) nu intră
 * în medie. `null` înseamnă „nu e nimic de mediat", niciodată zero: un panou
 * care afișează „0 %" acolo unde nu există date spune ceva fals despre firmă.
 */
export function mediaProcentelor(procente: readonly (number | null)[]): number | null {
  const valide = procente.filter((p): p is number => p !== null && Number.isFinite(p));
  if (valide.length === 0) return null;
  return rotunjeste(valide.reduce((s, p) => s + p, 0) / valide.length);
}

/**
 * Aliniază răspunsurile la criteriile șablonului, în ordinea lor.
 *
 * ── DE CE NU SE SALVEAZĂ CE A TRIMIS CLIENTUL ─────────────────────────────
 * `raspunsuri` și `criterii_sablon` sunt două coloane jsonb care se citesc
 * ÎMPREUNĂ, prin `criteriu_cod`. Dacă lista de răspunsuri poartă coduri care
 * nu există în șablon, ele nu se pot afișa niciodată: ecranul nu are de unde
 * lua denumirea. Iar dacă lipsesc coduri, evaluarea arată incomplet fără să se
 * știe dacă cineva a omis criteriul sau clientul a uitat să-l trimită.
 *
 * Serverul reconstruiește deci lista din criteriile șablonului: fiecare
 * criteriu apare exact o dată, în ordinea din șablon, cu răspunsul primit sau
 * cu `null`. Codurile necunoscute se ignoră — nu sunt o eroare de utilizator,
 * ci resturi ale unui șablon schimbat între deschiderea formularului și
 * trimiterea lui.
 */
export function aliniazaRaspunsuri(
  criterii: readonly CriteriuSablon[],
  raspunsuri: readonly RaspunsCriteriu[],
): readonly RaspunsCriteriu[] {
  const dupaCod = new Map<string, RaspunsCriteriu>();
  for (const r of raspunsuri) dupaCod.set(r.criteriu_cod, r);
  return criterii.map((c) => {
    const r = dupaCod.get(c.cod);
    if (c.tip === "text") {
      return {
        criteriu_cod: c.cod,
        scor: null,
        raspuns_text: r?.raspuns_text ?? null,
        comentariu: r?.comentariu ?? null,
      };
    }
    const scor = r?.scor ?? null;
    return {
      criteriu_cod: c.cod,
      scor: scor === null || !Number.isFinite(scor) ? null : scor,
      raspuns_text: null,
      comentariu: r?.comentariu ?? null,
    };
  });
}

/**
 * Notele care depășesc scala criteriului lor.
 *
 * Se raportează, nu se plafonează: la SCRIERE, o notă de 8 pe o scală de 5 e
 * un client stricat sau o încercare de a ocoli formularul, iar tăcerea ar
 * salva o valoare pe care nimeni n-a intenționat-o. La CITIRE, invers —
 * `calculeazaScor` plafonează, fiindcă un ecran nu are voie să cadă pe un rând
 * care e deja în bază.
 */
export function noteInAfaraScalei(
  criterii: readonly CriteriuSablon[],
  raspunsuri: readonly RaspunsCriteriu[],
): readonly string[] {
  const dupaCod = new Map<string, CriteriuSablon>();
  for (const c of criterii) dupaCod.set(c.cod, c);
  const gresite: string[] = [];
  for (const r of raspunsuri) {
    const c = dupaCod.get(r.criteriu_cod);
    if (c === undefined || r.scor === null) continue;
    if (r.scor < 0 || r.scor > c.scala_max) gresite.push(c.denumire);
  }
  return gresite;
}
