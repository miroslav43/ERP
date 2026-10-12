// src/app/(marketing)/unelte/cerere-demisie/model.ts
import {
  aNaZiLucratoareDupa,
  AN_MAX_INTERVAL,
  AN_MIN_INTERVAL,
  dataLunga,
  sarbatoriSarite,
  ziValida,
  type SarbatoareInInterval,
  type ZiIso,
} from "@/domain/calendar/interval-lucrator";
import { todayInBucharest } from "@/lib/format/date";
import { EroareIntrare, LINIE_GOALA, type DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { zileLucratoareText } from "../cerere-concediu-de-odihna/text-zile";

/**
 * Cererea de demisie, cu ultima zi de preaviz calculată.
 *
 * ── TEMEIURILE (Codul muncii, consolidat la 27.04.2026) ──────────────────
 * Art. 81: demisia e notificarea scrisă a salariatului (alin. (1)), pe care
 * angajatorul e obligat s-o înregistreze (alin. (2)); nu se motivează
 * (alin. (3)); preavizul e cel din contract, dar cel mult 20 de zile
 * lucrătoare pentru funcțiile de execuție și 45 pentru cele de conducere
 * (alin. (4)); contractul încetează la expirarea preavizului sau când
 * angajatorul renunță la el (alin. (7)); fără preaviz, dacă angajatorul nu-și
 * îndeplinește obligațiile din contract (alin. (8)). Art. 31 alin. (3):
 * în perioada de probă, notificare scrisă, fără preaviz. Art. 55 lit. b):
 * acordul părților, la data convenită.
 *
 * ── NUMĂRĂTOAREA ──────────────────────────────────────────────────────────
 * Din ziua următoare înregistrării, până la ultima zi lucrătoare a termenului:
 * regula RIL nr. 8/2024 pentru preavizul la concediere (art. 75), aplicată
 * prin analogie. Analogia e confirmată de jurist (9 oct 2026, NOTES.md).
 */

export type TipDemisie = "preaviz" | "fara-preaviz" | "proba" | "acord";
export type Categorie = "executie" | "conducere";

export const TIPURI_DEMISIE: readonly Readonly<{ cheie: TipDemisie; eticheta: string }>[] = [
  { cheie: "preaviz", eticheta: "Demisie cu preaviz (art. 81)" },
  {
    cheie: "fara-preaviz",
    eticheta: "Demisie fără preaviz: angajatorul nu își respectă obligațiile (art. 81 alin. (8))",
  },
  { cheie: "proba", eticheta: "În perioada de probă, fără preaviz (art. 31 alin. (3))" },
  { cheie: "acord", eticheta: "Încetare prin acordul părților (art. 55 lit. b))" },
];

/** Art. 81 alin. (4): plafoanele preavizului la demisie, în zile lucrătoare. */
export const PLAFON_PREAVIZ: Readonly<Record<Categorie, number>> = { executie: 20, conducere: 45 };

export type ParametriDemisie = Readonly<{
  tip: TipDemisie;
  categorie: Categorie;
  nume: string;
  functie: string;
  angajator: string;
  /** „nr. 12 din 03.02.2025”, cum îl scrie omul. */
  contract: string;
  depunere: ZiIso;
  zilePreaviz: number;
  dataAcord: ZiIso;
}>;

export type Preaviz = Readonly<{
  zile: number;
  ultimaZi: ZiIso;
  sarbatoriSarite: readonly SarbatoareInInterval[];
}>;

const text = (v: string | null, maxim = 120): string =>
  (v ?? "")
    .replace(/[\r\n\t]+/gu, " ")
    .trim()
    .slice(0, maxim);

const ETICHETA_CATEGORIE: Readonly<Record<Categorie, string>> = {
  executie: "execuție",
  conducere: "conducere",
};

export function citesteDemisie(
  q: URLSearchParams,
  azi: ZiIso,
): Readonly<{ parametri: ParametriDemisie; avertismente: readonly string[] }> {
  const avertismente: string[] = [];
  const tipBrut = q.get("tip");
  const tip = TIPURI_DEMISIE.find((t) => t.cheie === tipBrut)?.cheie ?? "preaviz";
  const categorie: Categorie = q.get("categorie") === "conducere" ? "conducere" : "executie";

  const data = (cheie: string, eticheta: string): ZiIso => {
    const brut = (q.get(cheie) ?? "").trim();
    if (brut === "") return azi;
    const valida = ziValida(brut);
    if (valida !== null) return valida;
    avertismente.push(
      `${eticheta}: „${brut.slice(0, 20)}” nu e o zi reală între ${String(AN_MIN_INTERVAL)} și ${String(AN_MAX_INTERVAL)}; am folosit ziua de azi.`,
    );
    return azi;
  };
  const depunere = data("depunere", "Data depunerii");
  const dataAcord = data("data_acord", "Data încetării");

  const plafon = PLAFON_PREAVIZ[categorie];
  let zilePreaviz = plafon;
  const brutPreaviz = (q.get("preaviz") ?? "").trim();
  if (brutPreaviz !== "") {
    const n = Number(brutPreaviz);
    if (!Number.isInteger(n) || n < 1) {
      avertismente.push(
        `Preavizul „${brutPreaviz.slice(0, 10)}” nu e un număr întreg de zile; am folosit plafonul legal, ${String(plafon)}.`,
      );
    } else if (n > plafon) {
      avertismente.push(
        `Preavizul nu poate depăși ${zileLucratoareText(plafon)} pentru o funcție de ${ETICHETA_CATEGORIE[categorie]} (art. 81 alin. (4)); am folosit ${String(plafon)}.`,
      );
    } else {
      zilePreaviz = n;
    }
  }

  return {
    parametri: {
      tip,
      categorie,
      nume: text(q.get("nume")),
      functie: text(q.get("functie")),
      angajator: text(q.get("angajator")),
      contract: text(q.get("contract"), 60),
      depunere,
      zilePreaviz,
      dataAcord,
    },
    avertismente,
  };
}

/** Ultima zi de preaviz: a N-a zi lucrătoare după înregistrare. */
export function calculeazaPreaviz(depunere: ZiIso, zile: number): Preaviz {
  try {
    const ultimaZi = aNaZiLucratoareDupa(depunere, zile);
    return { zile, ultimaZi, sarbatoriSarite: sarbatoriSarite(depunere, ultimaZi) };
  } catch (eroare) {
    if (eroare instanceof RangeError) throw new EroareIntrare(eroare.message);
    throw eroare;
  }
}

const sauLinie = (v: string): string => (v === "" ? LINIE_GOALA : v);

export function construiesteDemisie(p: ParametriDemisie): DocumentTabelar {
  const contract = p.contract === "" ? "nr. ______ din ____________" : p.contract;
  const identitate = `Subsemnatul(a) ${sauLinie(p.nume)}, angajat(ă) în funcția de ${sauLinie(p.functie)} la ${sauLinie(p.angajator)}, în baza contractului individual de muncă ${contract},`;
  const inregistrare =
    "Angajatorul e obligat să înregistreze demisia; dacă refuză, salariatul o poate dovedi prin orice mijloc de probă — art. 81 alin. (2) din Codul muncii.";
  const faraMotiv = "Salariatul are dreptul să nu își motiveze demisia — art. 81 alin. (3).";

  const comun = {
    subtitlu: null,
    campuri: [
      { eticheta: "Către", valoare: p.angajator },
      { eticheta: "Înregistrată la nr. / data", valoare: "" },
    ],
    coloane: [],
    randuri: [],
    umbrite: [],
    orientare: "portret",
    numeFisier: `cerere-demisie-${p.nume === "" ? "necompletata" : p.nume}`,
  } as const;

  if (p.tip === "preaviz") {
    const pv = calculeazaPreaviz(p.depunere, p.zilePreaviz);
    const sarite =
      pv.sarbatoriSarite.length === 0
        ? []
        : [
            `Sărbători legale sărite în preaviz: ${pv.sarbatoriSarite.map((s) => `${dataLunga(s.data)} (${s.denumire})`).join("; ")}.`,
          ];
    return {
      ...comun,
      titlu: "Cerere de demisie",
      paragrafe: [
        `${identitate} vă notific prin prezenta demisia mea, în temeiul art. 81 din Codul muncii.`,
        `Voi respecta termenul de preaviz de ${zileLucratoareText(pv.zile)}, care curge din ziua următoare înregistrării prezentei cereri. Pentru o cerere înregistrată ${dataLunga(p.depunere)}, ultima zi de preaviz este ${dataLunga(pv.ultimaZi)}, iar contractul încetează la această dată, dacă nu renunțați total sau parțial la preaviz (art. 81 alin. (7)).`,
      ],
      note: [
        inregistrare,
        faraMotiv,
        "Preavizul se numără în zile lucrătoare: fără sâmbete, duminici și sărbători legale (art. 139). Zilele libere din contractul colectiv sau din regulamentul intern nu sunt scăzute.",
        "Dacă în timpul preavizului contractul se suspendă (de exemplu, pentru concediu medical), preavizul se suspendă și el — art. 81 alin. (6).",
        ...sarite,
      ],
      semnaturi: ["Data și semnătura salariatului"],
    };
  }

  if (p.tip === "fara-preaviz") {
    return {
      ...comun,
      titlu: "Cerere de demisie fără preaviz",
      paragrafe: [
        `${identitate} vă notific prin prezenta demisia mea fără preaviz, în temeiul art. 81 alin. (8) din Codul muncii, întrucât angajatorul nu își îndeplinește obligațiile asumate prin contractul individual de muncă, și anume: ${LINIE_GOALA}.`,
        "Solicit încetarea contractului la data înregistrării prezentei cereri.",
      ],
      note: [
        inregistrare,
        "Temeiul cere ca angajatorul să nu își fi îndeplinit obligațiile din contract; păstrați dovezile obligației neîndeplinite.",
      ],
      semnaturi: ["Data și semnătura salariatului"],
    };
  }

  if (p.tip === "proba") {
    return {
      ...comun,
      titlu: "Notificare de încetare în perioada de probă",
      paragrafe: [
        `${identitate} vă notific încetarea contractului individual de muncă în perioada de probă, fără preaviz, în temeiul art. 31 alin. (3) din Codul muncii, începând cu ${dataLunga(p.depunere)}.`,
      ],
      note: [
        "Pe durata sau la sfârșitul perioadei de probă, contractul poate înceta printr-o notificare scrisă, fără preaviz și fără motivare, la inițiativa oricăreia dintre părți — art. 31 alin. (3).",
      ],
      semnaturi: ["Data și semnătura salariatului"],
    };
  }

  return {
    ...comun,
    titlu: "Cerere de încetare a contractului prin acordul părților",
    paragrafe: [
      `${identitate} vă propun încetarea contractului individual de muncă prin acordul părților, în temeiul art. 55 lit. b) din Codul muncii, la data de ${dataLunga(p.dataAcord)}.`,
    ],
    note: [
      "Acordul părților nu e demisie: contractul încetează la data convenită de părți, iar cererea produce efecte doar dacă angajatorul semnează de acord — art. 55 lit. b).",
    ],
    semnaturi: ["Salariat", "De acord — angajator"],
  };
}

export function demisieDinParametri(q: URLSearchParams): DocumentTabelar {
  return construiesteDemisie(citesteDemisie(q, todayInBucharest()).parametri);
}
