import { cuDe } from "@/content/legal/zile-libere";
import type { CalendarPaste } from "@/domain/calendar/sarbatori-cult";
import { formatDate } from "@/lib/format/date";
import { EroareIntrare, LINIE_GOALA } from "@/lib/unelte/document-tabelar";
import type { RubricaAngajator, Scrisoare } from "@/lib/unelte/scrisoare";

import {
  aziIso,
  citesteData,
  construiesteCerere,
  intervalImplicit,
  normalizeazaText,
  plusZile,
  type Cerere,
} from "./cerere";
import { weekendText, zileCalendaristiceText, zileLucratoareText, zileText } from "./text-zile";
import {
  esteEveniment,
  esteTipCerere,
  EVENIMENTE,
  SAPTAMANI_PATERNAL,
  VARIANTE,
  ZILE_AVANS_CERERE_ODIHNA,
  ZILE_FORMARE_PLATITA,
  ZILE_FRACTIUNE_NEINTRERUPTA,
  ZILE_INGRIJITOR,
  ZILE_PATERNAL,
  ZILE_PATERNAL_PUERICULTURA,
  type Eveniment,
  type TipCerere,
} from "./variante";

/**
 * Cererea, de la parametrii din adresă la scrisoarea de semnat.
 *
 * ── UN SINGUR CITITOR PENTRU PAGINĂ ȘI PENTRU FIȘIER ──────────────────────
 * Pagina și ruta de descărcare citesc aceiași parametri prin `citesteCererea`.
 * Ce refuză una refuză și cealaltă, cu același mesaj; ce arată pagina e exact
 * ce se descarcă.
 *
 * ── PROBLEME ȘI AVERTISMENTE ──────────────────────────────────────────────
 * O PROBLEMĂ oprește documentul: o dată care nu există, un interval inversat,
 * o perioadă fără nicio zi lucrătoare. Un AVERTISMENT nu oprește nimic: legea
 * dă un drept sau un termen, iar omul poate avea motive să ceară altfel (o
 * regularizare datată după începutul concediului, o cerere depusă cu mai puțin
 * de 60 de zile înainte). Avertismentele se arată pe pagină și NU intră în
 * documentul de semnat.
 *
 * ── PARAMETRII ────────────────────────────────────────────────────────────
 * Comuni: `tip`, `cult`, `angajator`, `departament`, `salariat`, `functie`,
 * `localitate`, `data`, `de_la`, `pana_la`. Pe variantă: `an`, `de_la_2`,
 * `pana_la_2`, `de_la_3`, `pana_la_3` (odihnă); `prog_de_la`, `prog_pana_la`
 * (reprogramare, întrerupere); `eveniment`, `zile_ccm` (eveniment); `motiv`;
 * `nastere`, `puericultura` (paternal); `persoana` (îngrijitor); `plata`,
 * `domeniu`, `institutie` (formare). Parametrii care nu țin de varianta aleasă
 * se ignoră — rămân în adresă când omul trece de la o variantă la alta.
 */

export const PAGINA_CERERE = "/unelte/cerere-concediu-de-odihna";
const MAX_FRACTIUNI = 3;

export type Perioada = Readonly<{ deLa: string; panaLa: string }>;

export type OptiuniCerere = Readonly<{
  tip: TipCerere;
  calendar: CalendarPaste;
  angajator: string;
  departament: string;
  salariat: string;
  functie: string;
  localitate: string;
  dataCererii: string;
  /** Anul pentru care se acordă concediul de odihnă — art. 146. */
  anAferent: number;
  /** Prima e perioada cererii; următoarele, fracțiunile (doar la odihnă). */
  perioade: readonly [Perioada, ...Perioada[]];
  /** Concediul programat (reprogramare) sau cel în curs (întrerupere). */
  programat: Perioada | null;
  eveniment: Eveniment;
  zileCcm: number | null;
  motiv: string;
  dataNasterii: string | null;
  puericultura: boolean;
  persoana: string;
  cuPlata: boolean;
  domeniu: string;
  institutie: string;
}>;

export type CerereCitita = Readonly<{
  optiuni: OptiuniCerere;
  /** Câte un calcul pe fiecare perioadă cerută; gol la întrerupere. */
  calcule: readonly Cerere[];
  /** Concediul programat (reprogramare) sau zilele rămase (întrerupere). */
  calculProgramat: Cerere | null;
  /** Nevid ⇒ nu se generează niciun document. */
  probleme: readonly string[];
  /** Se arată pe pagină; nu intră în document. */
  avertismente: readonly string[];
}>;

const anul = (iso: string) => Number(iso.slice(0, 4));

const zileIntre = (de: string, pana: string) =>
  Math.round((Date.parse(`${pana}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

/** Aceeași zi, cu o lună calendaristică înainte (31 martie → 28 februarie). */
function cuOLunaInainte(iso: string): string {
  const an = anul(iso);
  const luna = Number(iso.slice(5, 7));
  const zi = Number(iso.slice(8, 10));
  const ultimaZi = new Date(Date.UTC(an, luna - 1, 0)).getUTCDate();
  return new Date(Date.UTC(an, luna - 2, Math.min(zi, ultimaZi))).toISOString().slice(0, 10);
}

export function citesteCererea(q: URLSearchParams, azi: string = aziIso()): CerereCitita {
  const probleme: string[] = [];
  const avertismente: string[] = [];
  const brut = (cheie: string) => (q.get(cheie) ?? "").trim();
  const text = (cheie: string, maxim = 120) => normalizeazaText(q.get(cheie) ?? undefined, maxim);
  const data = (cheie: string, eticheta: string): string | null => {
    const citita = citesteData(q.get(cheie) ?? undefined, eticheta);
    if (citita.problema !== null) probleme.push(citita.problema);
    return citita.data;
  };

  const tipBrut = brut("tip");
  let tip: TipCerere = "odihna";
  if (esteTipCerere(tipBrut)) tip = tipBrut;
  else if (tipBrut !== "") probleme.push(`Tipul cererii „${tipBrut.slice(0, 30)}” nu există.`);

  let calendar: CalendarPaste = "ortodox";
  if (brut("cult") === "gregorian") calendar = "gregorian";
  else if (brut("cult") !== "" && brut("cult") !== "ortodox") {
    probleme.push(`Calendarul „${brut("cult").slice(0, 30)}” nu există: ortodox sau gregorian.`);
  }

  // Perioada principală. Fără nicio dată: intervalul implicit. Doar cu data de
  // început: o singură zi. La întrerupere, `de_la` e ziua de la care se întrerupe.
  const implicit = intervalImplicit(azi);
  const deLa = data("de_la", "Data de început") ?? implicit.deLa;
  const panaLaCitit = tip === "intrerupere" ? null : data("pana_la", "Data de sfârșit");
  const panaLa =
    tip === "intrerupere" ? deLa : (panaLaCitit ?? (brut("de_la") === "" ? implicit.panaLa : deLa));
  const perioade: [Perioada, ...Perioada[]] = [{ deLa, panaLa }];

  if (tip === "odihna") {
    for (let k = 2; k <= MAX_FRACTIUNI; k += 1) {
      const cheieDe = `de_la_${String(k)}`;
      const cheiePana = `pana_la_${String(k)}`;
      if (brut(cheieDe) === "" && brut(cheiePana) === "") continue;
      if (brut(cheieDe) === "" || brut(cheiePana) === "") {
        probleme.push(`Fracțiunea ${String(k)} are doar una dintre date.`);
        continue;
      }
      const de = data(cheieDe, `Fracțiunea ${String(k)}, data de început`);
      const pana = data(cheiePana, `Fracțiunea ${String(k)}, data de sfârșit`);
      if (de !== null && pana !== null) perioade.push({ deLa: de, panaLa: pana });
    }
  }

  let programat: Perioada | null = null;
  if (tip === "reprogramare" || tip === "intrerupere") {
    if (brut("prog_de_la") === "" || brut("prog_pana_la") === "") {
      probleme.push(
        "Completați perioada concediului programat: data de început și data de sfârșit.",
      );
    } else {
      const de = data("prog_de_la", "Concediul programat, data de început");
      const pana = data("prog_pana_la", "Concediul programat, data de sfârșit");
      if (de !== null && pana !== null) programat = { deLa: de, panaLa: pana };
    }
  }

  const dataCererii = data("data", "Data cererii") ?? azi;

  let anAferent = anul(deLa);
  if (brut("an") !== "") {
    const n = Number(brut("an"));
    const maxim = anul(deLa);
    if (!Number.isInteger(n) || n < maxim - 2 || n > maxim) {
      probleme.push(
        `Anul concediului poate fi ${String(maxim - 2)}, ${String(maxim - 1)} sau ${String(maxim)}: zilele neefectuate se reportează cel mult 18 luni — art. 146 alin. (2) din Codul muncii.`,
      );
    } else {
      anAferent = n;
    }
  }

  const evenimentBrut = brut("eveniment");
  let eveniment: Eveniment = "alt";
  if (esteEveniment(evenimentBrut)) eveniment = evenimentBrut;
  else if (evenimentBrut !== "") {
    probleme.push(`Evenimentul „${evenimentBrut.slice(0, 30)}” nu e în listă.`);
  }

  let zileCcm: number | null = null;
  if (tip === "eveniment" && brut("zile_ccm") !== "") {
    const n = Number(brut("zile_ccm"));
    if (!Number.isInteger(n) || n < 1 || n > 30) {
      probleme.push("Numărul de zile din contractul colectiv trebuie să fie între 1 și 30.");
    } else {
      zileCcm = n;
    }
  }

  const dataNasterii = tip === "paternal" ? data("nastere", "Data nașterii copilului") : null;

  const optiuni: OptiuniCerere = {
    tip,
    calendar,
    angajator: text("angajator"),
    departament: text("departament", 80),
    salariat: text("salariat"),
    functie: text("functie", 80),
    localitate: text("localitate", 60),
    dataCererii,
    anAferent,
    perioade,
    programat,
    eveniment,
    zileCcm,
    motiv: text("motiv", 160),
    dataNasterii,
    puericultura: brut("puericultura") === "da",
    persoana: text("persoana", 120),
    cuPlata: brut("plata") === "da",
    domeniu: text("domeniu", 80),
    institutie: text("institutie", 120),
  };

  // Cu o intrare greșită nu se mai calculează nimic: un interval construit din
  // implicitul pus în locul unei date greșite ar adăuga o a doua problemă, falsă
  // („sfârșitul e înaintea începutului”), peste cea adevărată.
  if (probleme.length > 0) {
    return { optiuni, calcule: [], calculProgramat: null, probleme, avertismente };
  }

  const calcule =
    tip === "intrerupere"
      ? []
      : perioade.map((p) => construiesteCerere(p.deLa, p.panaLa, calendar));
  calcule.forEach((c, i) => {
    if (c.problema !== null) {
      probleme.push(
        perioade.length > 1 ? `Fracțiunea ${String(i + 1)}: ${c.problema}` : c.problema,
      );
    }
  });

  const ordonate = [...perioade].sort((a, b) => a.deLa.localeCompare(b.deLa));
  for (let i = 1; i < ordonate.length; i += 1) {
    const inainte = ordonate[i - 1];
    const acum = ordonate[i];
    if (inainte !== undefined && acum !== undefined && acum.deLa <= inainte.panaLa) {
      probleme.push("Fracțiunile se suprapun: fiecare zi se cere o singură dată.");
      break;
    }
  }

  let calculProgramat: Cerere | null = null;
  if (programat !== null && tip === "reprogramare") {
    calculProgramat = construiesteCerere(programat.deLa, programat.panaLa, calendar);
    if (calculProgramat.problema !== null) {
      probleme.push(`Concediul programat: ${calculProgramat.problema}`);
    }
  }
  if (programat !== null && tip === "intrerupere") {
    if (deLa <= programat.deLa || deLa > programat.panaLa) {
      probleme.push(
        `Data întreruperii trebuie să cadă după prima zi a concediului (${formatDate(programat.deLa)}) și cel târziu în ultima (${formatDate(programat.panaLa)}).`,
      );
    } else {
      calculProgramat = construiesteCerere(deLa, programat.panaLa, calendar);
      if (calculProgramat.problema !== null) {
        probleme.push(`Zilele rămase: ${calculProgramat.problema}`);
      }
    }
  }

  if (tip === "paternal" && dataNasterii !== null && deLa < dataNasterii) {
    probleme.push("Concediul paternal nu poate începe înainte de nașterea copilului.");
  }

  if (probleme.length === 0) {
    const total = calcule.reduce((suma, c) => suma + c.zileLucratoare, 0);

    if (tip !== "intrerupere" && dataCererii > deLa) {
      avertismente.push(
        `Cererea e datată ${formatDate(dataCererii)}, după începutul perioadei (${formatDate(deLa)}). Se întâmplă la o regularizare; verificați că e intenționat.`,
      );
    }
    if (tip === "odihna" && dataCererii <= deLa) {
      const avans = zileIntre(dataCererii, deLa);
      if (avans < ZILE_AVANS_CERERE_ODIHNA) {
        avertismente.push(
          `Cererea se depune cu ${zileText(avans)} înainte. Art. 148 alin. (4) vă dă dreptul să cereți concediul cu cel puțin 60 de zile înainte, în perioada programată; cu mai puțin, data rămâne la acordul angajatorului.`,
        );
      }
    }
    if (
      tip === "odihna" &&
      perioade.length > 1 &&
      calcule.every((c) => c.zileLucratoare < ZILE_FRACTIUNE_NEINTRERUPTA)
    ) {
      avertismente.push(
        "Niciuna dintre fracțiuni nu are 10 zile lucrătoare. Art. 148 alin. (5) cere ca, la programarea fracționată, fiecare salariat să efectueze într-un an cel puțin 10 zile lucrătoare de concediu neîntrerupt; verificați că le aveți în altă perioadă a anului.",
      );
    }
    if (tip === "odihna" && anAferent === anul(deLa) - 2 && deLa > `${String(anul(deLa))}-06-30`) {
      avertismente.push(
        `Termenul de report de 18 luni pentru anul ${String(anAferent)} s-a încheiat la 30.06.${String(anul(deLa))} — art. 146 alin. (2). Potrivit Deciziei ÎCCJ HP nr. 40/2026, compensarea lor în bani, la încetarea contractului (art. 146 alin. (3)), rămâne posibilă doar dacă angajatorul nu v-a oferit efectiv posibilitatea să le efectuați.`,
      );
    }
    if (tip === "paternal") {
      const cuvenite = ZILE_PATERNAL + (optiuni.puericultura ? ZILE_PATERNAL_PUERICULTURA : 0);
      if (total > cuvenite) {
        avertismente.push(
          `Cererea are ${zileLucratoareText(total)}; Legea nr. 210/1999 dă ${zileLucratoareText(cuvenite)}${optiuni.puericultura ? ", cu atestatul de puericultură" : ""}.`,
        );
      }
      if (dataNasterii !== null && panaLa > plusZile(dataNasterii, SAPTAMANI_PATERNAL * 7 - 1)) {
        avertismente.push(
          `Perioada depășește primele 8 săptămâni de la naștere (până la ${formatDate(plusZile(dataNasterii, SAPTAMANI_PATERNAL * 7 - 1))}), în care art. 2 alin. (2) din Legea nr. 210/1999 acordă concediul.`,
        );
      }
    }
    if (tip === "ingrijitor" && total > ZILE_INGRIJITOR) {
      avertismente.push(
        `Cererea are ${zileLucratoareText(total)}; art. 152¹ alin. (1) garantează ${zileLucratoareText(ZILE_INGRIJITOR)} pe an. Mai mult se poate doar prin lege specială sau prin contractul colectiv aplicabil — alin. (2).`,
      );
    }
    if (tip === "formare" && optiuni.cuPlata && total > ZILE_FORMARE_PLATITA) {
      avertismente.push(
        `Concediul plătit pentru formare profesională e de până la 10 zile lucrătoare sau 80 de ore — art. 157 alin. (1); cererea are ${zileLucratoareText(total)}.`,
      );
    }
    if (tip === "formare" && dataCererii > cuOLunaInainte(deLa)) {
      avertismente.push(
        "Art. 156 alin. (1) cere ca cererea de concediu pentru formare profesională să fie înaintată cu cel puțin o lună înainte de începere.",
      );
    }
  }

  return { optiuni, calcule, calculProgramat, probleme, avertismente };
}

/** Paragraful cu zilele scoase din numărătoare, pentru una sau mai multe perioade. */
function paragrafExcluse(calcule: readonly Cerere[], calendar: CalendarPaste): string {
  const weekend = calcule.reduce((suma, c) => suma + c.zileWeekend, 0);
  const excluse = calcule.flatMap((c) => c.excluse);
  const sarbatori =
    excluse.length > 0
      ? ` și nici sărbătorile legale: ${excluse.map((z) => `${formatDate(z.data)} (${z.motiv})`).join(", ")}`
      : "";
  const cult =
    calendar === "gregorian"
      ? " Vinerea Mare, Paștele și Rusaliile sunt socotite după data la care le celebrează cultul meu creștin — art. 139 alin. (2¹) din Codul muncii."
      : "";
  const unde = calcule.length > 1 ? "perioadele solicitate" : "intervalul solicitat";
  return `Menționez că în ${unde} nu se numără ${weekendText(weekend)}${sarbatori}.${cult}`;
}

/** Scrisoarea de semnat. Apelantul garantează că `c.probleme` e gol. */
export function scrisoareaCererii(c: CerereCitita): Scrisoare {
  const o = c.optiuni;
  const v = VARIANTE[o.tip];
  const [prima] = o.perioade;
  const sau = (t: string) => (t === "" ? LINIE_GOALA : t);
  const perioada = (p: Perioada) => `${formatDate(p.deLa)} – ${formatDate(p.panaLa)} inclusiv`;
  const cine = `Subsemnatul/Subsemnata ${sau(o.salariat)}, angajat(ă) în funcția de ${sau(o.functie)}${o.departament === "" ? "" : `, departamentul ${o.departament}`}`;
  const total = c.calcule.reduce((suma, x) => suma + x.zileLucratoare, 0);
  const calendaristice = c.calcule[0]?.zileCalendaristice ?? 0;
  const reportat =
    o.anAferent < anul(prima.deLa)
      ? ", neefectuat și reportat potrivit art. 146 alin. (2) din Codul muncii"
      : "";
  const paragrafe: string[] = [];

  switch (o.tip) {
    case "odihna": {
      if (o.perioade.length === 1) {
        paragrafe.push(
          `${cine}, vă rog să binevoiți a-mi aproba efectuarea concediului de odihnă aferent anului ${String(o.anAferent)}${reportat}, în perioada ${perioada(prima)}, reprezentând ${zileLucratoareText(total)}.`,
        );
      } else {
        const lista = o.perioade
          .map(
            (p, i) =>
              `${String(i + 1)}) ${perioada(p)} — ${zileLucratoareText(c.calcule[i]?.zileLucratoare ?? 0)}`,
          )
          .join("; ");
        paragrafe.push(
          `${cine}, vă rog să binevoiți a-mi aproba efectuarea concediului de odihnă aferent anului ${String(o.anAferent)}${reportat}, fracționat, în următoarele perioade: ${lista}; în total, ${zileLucratoareText(total)}.`,
        );
      }
      paragrafe.push(paragrafExcluse(c.calcule, o.calendar));
      break;
    }
    case "fara-plata": {
      paragrafe.push(
        `${cine}, vă rog să binevoiți a-mi aproba un concediu fără plată pentru rezolvarea unor situații personale${o.motiv === "" ? "" : ` (${o.motiv})`}, în perioada ${perioada(prima)}, adică ${zileCalendaristiceText(calendaristice)}.`,
      );
      break;
    }
    case "eveniment": {
      const ev = EVENIMENTE[o.eveniment];
      const ce =
        o.eveniment === "alt"
          ? sau(o.motiv)
          : `${ev.inCerere}${o.motiv === "" ? "" : ` (${o.motiv})`}`;
      const cate =
        o.zileCcm === null
          ? ""
          : `, adică ${o.zileCcm === 1 ? "1 zi liberă plătită" : cuDe(o.zileCcm, "zile libere plătite")}`;
      paragrafe.push(
        `${cine}, vă rog să binevoiți a-mi aproba acordarea zilelor libere plătite cuvenite pentru ${ce}, în perioada ${perioada(prima)}${cate}, potrivit contractului colectiv de muncă aplicabil sau regulamentului intern.`,
      );
      if (ev.act !== null) paragrafe.push(`Anexez, în copie, ${ev.act}.`);
      break;
    }
    case "paternal": {
      paragrafe.push(
        `${cine}, vă rog să binevoiți a-mi aproba concediul paternal în perioada ${perioada(prima)}, reprezentând ${zileLucratoareText(total)}, pentru copilul meu născut la data de ${o.dataNasterii === null ? LINIE_GOALA : formatDate(o.dataNasterii)}, potrivit Legii nr. 210/1999.`,
      );
      paragrafe.push(
        `Anexez copia certificatului de naștere al copilului, din care rezultă calitatea mea de tată${o.puericultura ? ", precum și atestatul de absolvire a cursului de puericultură" : ""}.`,
      );
      break;
    }
    case "ingrijitor": {
      paragrafe.push(
        `${cine}, vă rog să binevoiți a-mi aproba concediul de îngrijitor în perioada ${perioada(prima)}, reprezentând ${zileLucratoareText(total)}, pentru a oferi îngrijire sau sprijin personal ${sau(o.persoana)}, care are nevoie de îngrijire sau sprijin ca urmare a unei probleme medicale grave.`,
      );
      paragrafe.push(
        "Anexez documentele care atestă situația, potrivit ordinului prevăzut la art. 152¹ alin. (5) din Codul muncii.",
      );
      break;
    }
    case "formare": {
      const stagiu = `stagiul de formare profesională din domeniul ${sau(o.domeniu)}, organizat de ${sau(o.institutie)}, care începe la data de ${formatDate(prima.deLa)} și durează ${zileCalendaristiceText(calendaristice)}`;
      paragrafe.push(
        o.cuPlata
          ? `${cine}, vă rog să binevoiți a-mi aproba un concediu plătit pentru formare profesională, potrivit art. 157 din Codul muncii, în perioada ${perioada(prima)}, reprezentând ${zileLucratoareText(total)}, pentru ${stagiu}.`
          : `${cine}, vă rog să binevoiți a-mi aproba un concediu fără plată pentru formare profesională, potrivit art. 155 din Codul muncii, în perioada ${perioada(prima)}, pentru ${stagiu}.`,
      );
      break;
    }
    case "reprogramare": {
      paragrafe.push(
        `${cine}, vă rog să binevoiți a-mi aproba reprogramarea concediului de odihnă aferent anului ${String(o.anAferent)}, programat în perioada ${perioada(o.programat ?? prima)}, în perioada ${perioada(prima)}, reprezentând ${zileLucratoareText(total)}, din următoarele motive obiective: ${sau(o.motiv)}.`,
      );
      paragrafe.push(paragrafExcluse(c.calcule, o.calendar));
      break;
    }
    case "intrerupere": {
      const ramase = c.calculProgramat?.zileLucratoare ?? 0;
      paragrafe.push(
        `${cine}, vă rog să binevoiți a-mi aproba întreruperea concediului de odihnă programat în perioada ${perioada(o.programat ?? prima)}, începând cu data de ${formatDate(prima.deLa)}, din următoarele motive obiective: ${sau(o.motiv)}.`,
      );
      paragrafe.push(
        ramase === 1
          ? "Solicit reprogramarea zilei lucrătoare rămase neefectuate."
          : `Solicit reprogramarea celor ${zileLucratoareText(ramase)} rămase neefectuate.`,
      );
      break;
    }
  }

  const randuri = ["☐ Se aprobă / ☐ Nu se aprobă"];
  if (v.cuSold) {
    randuri.push(
      `Zile de concediu de odihnă cuvenite pentru anul ${String(o.anAferent)}: ________`,
      "Zile rămase din anul anterior: ________",
      "Zile efectuate până la data cererii: ________",
      "Zile rămase după această cerere: ________",
    );
  }
  const rubrica: RubricaAngajator = {
    titlu: "Se completează de angajator",
    randuri,
    semnaturi: ["Șef ierarhic", "Resurse umane", "Conducătorul unității"],
  };

  return {
    titluDocument: v.titlu,
    inregistrare: "Nr. înregistrare ________ din ____________",
    catre: `Către: ${sau(o.angajator)}`,
    titlu: "CERERE",
    subtitlu: v.subtitlu,
    paragrafe,
    locSiData: `${o.localitate === "" ? "____________" : o.localitate}, ${formatDate(o.dataCererii)}`,
    semnatura: "Semnătura salariatului",
    rubrica,
    note: [v.temei],
    numeFisier: `cerere-${o.tip}-${prima.deLa}`,
    sursa: PAGINA_CERERE,
  };
}

/**
 * Pentru ruta de descărcare: scrisoarea, sau `EroareIntrare` cu toate
 * problemele — ruta răspunde 400 (client de API) sau întoarce omul pe pagină.
 */
export function cerereDinParametri(q: URLSearchParams, azi: string = aziIso()): Scrisoare {
  const citita = citesteCererea(q, azi);
  if (citita.probleme.length > 0) throw new EroareIntrare(citita.probleme.join(" "));
  return scrisoareaCererii(citita);
}

/** Câmpurile care se păstrează când omul trece de la o variantă la alta. */
const PARAMETRI_COMUNI = [
  "angajator",
  "departament",
  "salariat",
  "functie",
  "localitate",
  "data",
  "cult",
  "de_la",
  "pana_la",
] as const;

/** Legătura din bara de variante: aceiași oameni și aceeași perioadă, alt tip de cerere. */
export function adresaVariantei(q: URLSearchParams, tip: TipCerere): string {
  const noi = new URLSearchParams();
  for (const cheie of PARAMETRI_COMUNI) {
    const valoare = q.get(cheie);
    if (valoare !== null && valoare !== "") noi.set(cheie, valoare);
  }
  if (tip !== "odihna") noi.set("tip", tip);
  const sir = noi.toString();
  return `${PAGINA_CERERE}${sir === "" ? "" : `?${sir}`}#documentul`;
}
