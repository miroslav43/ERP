// src/domain/fleet/amenzi.ts

/**
 * Amenzile primite pe vehicul și incidentele / dauna (0203, flota F11).
 * Funcții pure, fără I/O și fără ceas: apelantul aduce rândurile citite și
 * ziua de azi.
 *
 * ── CE CERE LEGEA (verificat pe legislatie.just.ro, forma consolidată din
 *    01.07.2026) ────────────────────────────────────────────────────────────
 * OUG 195/2002, art. 39 alin. (1): la solicitarea poliției rutiere sau a
 * poliției locale, proprietarul sau deținătorul mandatat al vehiculului este
 * obligat să comunice, „în termenul indicat în cuprinsul solicitării”, datele
 * de identificare ale persoanei căreia i-a încredințat vehiculul. Nu există un
 * termen fix în lege: de aceea `termen_raspuns` îl scrie omul din document, iar
 * aici nu se presupune niciunul. Alin. (2): datele sunt numele, prenumele, CNP,
 * domiciliul sau reședința, seria și numărul actului de identitate (pașaport
 * pentru străini). Necomunicarea este contravenție: art. 105 pct. 10
 * (persoane juridice) și art. 102 alin. (1) pct. 14 (persoane fizice).
 *
 * Codul muncii (Legea 53/2003, consolidarea din 18.12.2025): art. 169 alin.
 * (2) permite reținerea din salariu „cu titlu de daune cauzate angajatorului”
 * doar pentru o datorie scadentă, lichidă și exigibilă, constatată printr-o
 * hotărâre judecătorească definitivă și irevocabilă; art. 254 alin. (1)–(4)
 * dă răspunderea patrimonială, cu recuperare prin acordul părților (notă de
 * constatare și evaluare, termen de cel puțin 30 de zile, cel mult 5 salarii
 * minime brute). De aceea aplicația NU recuperează nimic automat.
 *
 * ── CE NU FACE ────────────────────────────────────────────────────────────
 * Nu decide vinovăția și nu reține nimic din salariu. Sugestia de șofer e doar
 * sugestie: omul alege.
 */

/** Stadiile amenzii, în oglindă cu enum-ul `amenda_stadiu` (0203). */
export const STADII_AMENDA = [
  "primita",
  "sofer_desemnat",
  "raspuns_trimis",
  "platita",
  "contestata",
  "anulata",
] as const;
export type StadiuAmenda = (typeof STADII_AMENDA)[number];

export const ETICHETE_STADIU_AMENDA: Readonly<Record<StadiuAmenda, string>> = {
  primita: "Primită",
  sofer_desemnat: "Șofer desemnat",
  raspuns_trimis: "Răspuns trimis",
  platita: "Plătită",
  contestata: "Contestată",
  anulata: "Anulată",
};

/**
 * Tranzițiile permise, oglinda matricii din `internal.amenzi_inainte`. Testul
 * `amenzi.test.ts` compară matricea cu textul migrării: dacă una se mișcă
 * singură, pică.
 */
export const TRANZITII_AMENDA: Readonly<Record<StadiuAmenda, readonly StadiuAmenda[]>> = {
  primita: ["sofer_desemnat", "platita", "contestata", "anulata"],
  sofer_desemnat: ["primita", "raspuns_trimis", "platita", "contestata", "anulata"],
  raspuns_trimis: ["platita", "contestata", "anulata"],
  contestata: ["platita", "anulata"],
  platita: [],
  anulata: [],
};

export function poateTrece(din: StadiuAmenda, la: StadiuAmenda): boolean {
  return TRANZITII_AMENDA[din].includes(la);
}

/** „Plătită” și „anulată” sunt capete: baza nu mai primește nicio modificare. */
export function amendaInchisa(stadiu: StadiuAmenda): boolean {
  return stadiu === "platita" || stadiu === "anulata";
}

/**
 * Cât timp răspunsul către autoritate n-a plecat, termenul curge (și rămâne în
 * `expirables`). După răspuns, plată sau anulare nu mai contează.
 */
export function raspunsDeTrimis(stadiu: StadiuAmenda): boolean {
  return stadiu === "primita" || stadiu === "sofer_desemnat" || stadiu === "contestata";
}

export type TonTermen = "pericol" | "atentie" | "neutru";
export type StareTermen =
  "fara_termen" | "nu_se_aplica" | "depasit" | "astazi" | "aproape" | "in_termen";

export interface VerdictTermen {
  readonly stare: StareTermen;
  /** Zile până la termen (negativ = depășit); `null` când termenul nu se judecă. */
  readonly zile: number | null;
  readonly eticheta: string;
  readonly ton: TonTermen;
}

/** Sub atâtea zile rămase, termenul se arată ca „aproape”. */
export const ZILE_TERMEN_APROAPE = 3;

const MS_PE_ZI = 86_400_000;

function ziDinData(data: string): number {
  const [an, luna, zi] = data.split("-").map(Number) as [number, number, number];
  return Date.UTC(an, luna - 1, zi);
}

function zile(n: number): string {
  return n === 1 ? "o zi" : `${String(n)} zile`;
}

/**
 * Verdictul termenului de răspuns la `azi` (ambele `AAAA-LL-ZZ`). Zile
 * calendaristice, prin UTC: ora de vară nu mută nimic.
 */
export function verdictTermen(
  termen: string | null,
  stadiu: StadiuAmenda,
  azi: string,
  raspunsTrimisLa: string | null = null,
): VerdictTermen {
  // Răspunsul a plecat deja (chiar dacă amenda a fost apoi contestată): termenul
  // nu mai curge. Oglinda lui `internal.amenzi_scadenta`.
  if (raspunsTrimisLa !== null || !raspunsDeTrimis(stadiu)) {
    return { stare: "nu_se_aplica", zile: null, eticheta: "Nu mai e de răspuns", ton: "neutru" };
  }
  if (termen === null) {
    return {
      stare: "fara_termen",
      zile: null,
      eticheta: "Fără termen în solicitare",
      ton: "neutru",
    };
  }
  const ramase = Math.round((ziDinData(termen) - ziDinData(azi)) / MS_PE_ZI);
  if (ramase < 0) {
    return {
      stare: "depasit",
      zile: ramase,
      eticheta: `Depășit cu ${zile(-ramase)}`,
      ton: "pericol",
    };
  }
  if (ramase === 0) {
    return { stare: "astazi", zile: 0, eticheta: "Scadent astăzi", ton: "pericol" };
  }
  if (ramase <= ZILE_TERMEN_APROAPE) {
    return {
      stare: "aproape",
      zile: ramase,
      eticheta: ramase === 1 ? "Mai e o zi" : `Mai sunt ${String(ramase)} zile`,
      ton: "atentie",
    };
  }
  return {
    stare: "in_termen",
    zile: ramase,
    eticheta: `Mai sunt ${String(ramase)} zile`,
    ton: "neutru",
  };
}

/** De unde vine sugestia lui `app.sofer_la`. */
export type SursaSugestie = "foaie" | "alocare";

export function textSugestie(sursa: SursaSugestie, nume: string): string {
  return sursa === "foaie"
    ? `${nume} — după foaia de parcurs care acoperă momentul faptei.`
    : `${nume} — după alocarea vehiculului la momentul faptei.`;
}

// ── Incidentele ─────────────────────────────────────────────────────────────

/** Stadiile incidentului, în oglindă cu enum-ul `incident_stadiu` (0203). */
export const STADII_INCIDENT = [
  "raportat",
  "constatat",
  "la_asigurator",
  "in_reparatie",
  "inchis",
] as const;
export type StadiuIncident = (typeof STADII_INCIDENT)[number];

export const ETICHETE_STADIU_INCIDENT: Readonly<Record<StadiuIncident, string>> = {
  raportat: "Raportat",
  constatat: "Constatat",
  la_asigurator: "La asigurător",
  in_reparatie: "În reparație",
  inchis: "Închis",
};

/** Tipurile de incident, în oglindă cu enum-ul `incident_tip` (0203). */
export const TIPURI_INCIDENT = [
  "coliziune",
  "avarie",
  "furt_vandalism",
  "fenomen_natural",
  "altul",
] as const;
export type TipIncident = (typeof TIPURI_INCIDENT)[number];

export const ETICHETE_TIP_INCIDENT: Readonly<Record<TipIncident, string>> = {
  coliziune: "Coliziune",
  avarie: "Avarie",
  furt_vandalism: "Furt sau vandalism",
  fenomen_natural: "Fenomen natural",
  altul: "Altul",
};

/** Un incident închis e înghețat (`internal.incidente_inainte`). */
export function incidentInchis(stadiu: StadiuIncident): boolean {
  return stadiu === "inchis";
}

/**
 * Stadiile în care se poate merge din `stadiu`: oricare altul, inclusiv înapoi
 * (corectura unei greșeli e frecventă); din „închis” nu se mai pleacă.
 */
export function stadiiUrmatoareIncident(stadiu: StadiuIncident): readonly StadiuIncident[] {
  if (incidentInchis(stadiu)) return [];
  return STADII_INCIDENT.filter((s) => s !== stadiu);
}

/**
 * Ce cere baza ca să intre în `stadiu`, ca formularul s-o spună pe câmp
 * înainte de bază (oglinda refuzurilor din `internal.incidente_inainte`).
 * `null` = nimic de completat.
 */
export function cerintaStadiuIncident(
  stadiu: StadiuIncident,
  date: Readonly<{ asigurator: string | null; cost_final: number | null }>,
): string | null {
  if (stadiu === "la_asigurator" && (date.asigurator === null || date.asigurator.trim() === "")) {
    return "Scrieți numele asigurătorului la care ați înregistrat dauna.";
  }
  if (stadiu === "inchis" && date.cost_final === null) {
    return "Scrieți costul final al daunei (0 dacă n-a fost nimic de plătit) înainte de închidere.";
  }
  return null;
}

/** Costul rămas firmei: costul final minus despăgubirea primită. */
export function costNet(costFinal: number | null, despagubire: number | null): number | null {
  if (costFinal === null) return null;
  return Math.round((costFinal - (despagubire ?? 0)) * 100) / 100;
}

// ── Recuperarea de la șofer ─────────────────────────────────────────────────

/**
 * Textul care însoțește orice amendă sau daună pe ecran. Articolele sunt
 * verificate pe forma consolidată din 18.12.2025 a Codului muncii.
 */
export const NOTA_RECUPERARE =
  "Recuperarea de la șofer nu este automată și aplicația nu reține nimic din salariu. " +
  "Potrivit Codului muncii, o reținere cu titlu de daune cauzate angajatorului se poate face doar pentru o datorie " +
  "scadentă, lichidă și exigibilă, constatată printr-o hotărâre judecătorească definitivă și irevocabilă (art. 169 alin. (2)). " +
  "Răspunderea patrimonială a salariatului urmează art. 254: recuperarea prin acordul părților cere o notă de constatare " +
  "și evaluare a pagubei, cu un termen de cel puțin 30 de zile de la comunicare, iar suma nu poate depăși 5 salarii minime brute pe economie. " +
  "Decizia o iau administratorul și, la nevoie, juristul firmei.";

/** Temeiul scrisorii de desemnare, citat pe document și pe ecran. */
export const TEMEI_ART_39 =
  "OUG 195/2002 privind circulația pe drumurile publice, republicată, art. 39 alin. (1)–(2) (forma consolidată la 01.07.2026).";

// ── Scrisoarea de răspuns (art. 39) ─────────────────────────────────────────

export interface DateSoferScrisoare {
  readonly nume: string;
  /** `null` când fișa nu are CNP; scrisoarea lasă linie de completat. */
  readonly cnp: string | null;
  readonly adresa: string | null;
  readonly tipAct: string | null;
  readonly serieAct: string | null;
  readonly numarAct: string | null;
}

export interface IntrareScrisoare {
  readonly organizatie: string;
  readonly autoritate: string | null;
  readonly numarPv: string;
  /** Deja formatată (`ZZ.LL.AAAA`), sau `null`. */
  readonly dataPv: string | null;
  readonly vehiculNr: string;
  /** Deja formatat, cu ora. */
  readonly momentFapta: string;
  readonly locul: string | null;
  readonly fapta: string;
  readonly sofer: DateSoferScrisoare;
  /** Data scrisorii, deja formatată. */
  readonly dataScrisorii: string;
  readonly numarIesire: string | null;
}

export interface ModelScrisoare {
  readonly titlu: string;
  readonly subtitlu: string | null;
  readonly destinatar: string;
  readonly referinta: string;
  readonly paragrafe: readonly string[];
  /** Perechi (rubrică, valoare); valoarea goală rămâne linie de completat. */
  readonly rubriciSofer: readonly (readonly [string, string])[];
  /** Ce lipsește din fișa angajatului, spus pe față. */
  readonly lipsuri: readonly string[];
  readonly note: readonly string[];
  readonly numeFisier: string;
}

export interface AdreseSofer {
  readonly adresa_strada: string | null;
  readonly adresa_oras: string | null;
  readonly adresa_judet: string | null;
  readonly adresa_resedinta_strada: string | null;
  readonly adresa_resedinta_oras: string | null;
  readonly adresa_resedinta_judet: string | null;
}

function alipeste(...parti: readonly (string | null)[]): string | null {
  const nevide = parti.map((p) => p?.trim() ?? "").filter((p) => p !== "");
  return nevide.length === 0 ? null : nevide.join(", ");
}

/**
 * Adresa pentru scrisoare: „domiciliul sau reședința” (art. 39 alin. (2)).
 * Domiciliul are întâietate; reședința intră doar când domiciliul lipsește cu
 * totul. `null` = fișa n-are nicio adresă, iar scrisoarea lasă linie de
 * completat.
 */
export function adresaPentruScrisoare(d: AdreseSofer): string | null {
  return (
    alipeste(d.adresa_strada, d.adresa_oras, d.adresa_judet) ??
    alipeste(d.adresa_resedinta_strada, d.adresa_resedinta_oras, d.adresa_resedinta_judet)
  );
}

function plin(valoare: string | null): string | null {
  const taiat = valoare?.trim() ?? "";
  return taiat === "" ? null : taiat;
}

/**
 * Modelul scrisorii prin care firma comunică autorității cine conducea
 * (art. 39 alin. (1)–(2)). CE se scrie e aici; AȘEZAREA e în
 * `src/lib/pdf/scrisoare-desemnare.ts`. Ce lipsește din fișa angajatului nu se
 * inventează: rămâne linie de completat de mână, iar lista lipsurilor se
 * spune pe document.
 */
export function modelScrisoareDesemnare(intrare: IntrareScrisoare): ModelScrisoare {
  const { sofer } = intrare;
  const cnp = plin(sofer.cnp);
  const adresa = plin(sofer.adresa);
  const serie = plin(sofer.serieAct);
  const numar = plin(sofer.numarAct);
  const tip = plin(sofer.tipAct);

  const act =
    serie === null && numar === null
      ? ""
      : [tip, serie === null ? null : `seria ${serie}`, numar === null ? null : `nr. ${numar}`]
          .filter((p): p is string => p !== null)
          .join(", ");

  const lipsuri: string[] = [];
  if (cnp === null) lipsuri.push("codul numeric personal");
  if (adresa === null) lipsuri.push("domiciliul sau reședința");
  if (serie === null || numar === null) lipsuri.push("seria și numărul actului de identitate");

  const autoritate = plin(intrare.autoritate);
  const dePv = intrare.dataPv === null ? "" : ` din ${intrare.dataPv}`;
  const locul = plin(intrare.locul);

  const note: string[] = [
    `Temei: ${TEMEI_ART_39}`,
    "Datele personale de mai sus se comunică în îndeplinirea unei obligații legale a firmei (art. 6 alin. (1) lit. c) din Regulamentul (UE) 2016/679).",
  ];
  if (lipsuri.length > 0) {
    note.push(
      `Atenție: din fișa angajatului lipsesc ${lipsuri.join(", ")}. Completați de mână, înainte de semnare.`,
    );
  }

  return {
    titlu: "Comunicare privind identitatea conducătorului auto",
    subtitlu:
      intrare.numarIesire === null
        ? `din ${intrare.dataScrisorii}`
        : `Nr. ${intrare.numarIesire} din ${intrare.dataScrisorii}`,
    destinatar: `Către: ${autoritate ?? "autoritatea care a emis solicitarea"}`,
    referinta: `Referitor la: procesul-verbal / solicitarea nr. ${intrare.numarPv}${dePv}, vehiculul ${intrare.vehiculNr}.`,
    paragrafe: [
      `Subscrisa ${intrare.organizatie}, în calitate de proprietar sau deținător mandatat al vehiculului cu numărul de înmatriculare ${intrare.vehiculNr}, vă comunicăm, în temeiul art. 39 din OUG 195/2002 privind circulația pe drumurile publice, datele de identificare ale persoanei căreia i-am încredințat vehiculul pentru a-l conduce pe drumurile publice la data de ${intrare.momentFapta}${locul === null ? "" : `, în zona ${locul}`}:`,
      `Comunicarea răspunde faptei constatate: ${intrare.fapta}. Vă rugăm să luați act de datele de mai sus și să încheiați actul sancționator pe numele persoanei indicate.`,
    ],
    rubriciSofer: [
      ["Nume și prenume", sofer.nume],
      ["Cod numeric personal", cnp ?? ""],
      ["Domiciliul sau reședința", adresa ?? ""],
      ["Act de identitate", act],
    ],
    lipsuri,
    note,
    numeFisier: `scrisoare-art39-${intrare.vehiculNr.replace(/\s+/gu, "-")}-${intrare.numarPv.replace(/[\\/\s]+/gu, "-")}`,
  };
}
