// src/domain/fleet/foaie.ts

/**
 * Foaia de parcurs ZILNICĂ (0197): cursele, totalurile și modelul documentului
 * justificativ. Funcții pure, fără I/O și fără ceas: apelantul aduce rândurile
 * citite și momentul generării.
 *
 * ── CE CERE DOCUMENTUL ────────────────────────────────────────────────────
 * HG 1/2016 (normele Codului fiscal), titlul II pct. 16 alin. (2) și titlul VII
 * pct. 68 alin. (2): foaia de parcurs cuprinde „cel puțin” categoria de
 * vehicul utilizat, scopul și locul deplasării, kilometrii parcurși și norma
 * proprie de consum carburant pe kilometru parcurs. Aceleași patru elemente
 * le arată unealta publică `unelte/foaie-de-parcurs`, cu forma consolidată
 * citată acolo (legislatie.just.ro, verificată pe 8 oct 2026).
 *
 * OMFP 2634/2015, anexa 1 pct. 2–3 (orice document justificativ): denumirea
 * documentului, denumirea și codul de identificare fiscală ale entității,
 * numărul și data întocmirii, conținutul operațiunii cu datele cantitative,
 * persoanele care răspund de operațiune. Aprobarea se consemnează din audit
 * (cine, când), ca la orice document generat de aplicație.
 *
 * ── CE NU FACE ────────────────────────────────────────────────────────────
 * Nu decide regimul fiscal al vehiculului (pct. 68 alin. (8): îl stabilește
 * fiecare persoană impozabilă). Nu citește alimentările altor zile: consumul
 * normat se compară doar cu ce s-a alimentat pe foaia asta.
 */

/** O cursă, în forma citită din `trip_sheet_curse`. */
export interface CursaFoaie {
  readonly id: string;
  readonly ordine: number;
  readonly plecare_la: string;
  readonly sosire_la: string | null;
  readonly de_la_loc: string | null;
  readonly pana_la_loc: string | null;
  readonly scop: string | null;
  readonly km_plecare: number;
  readonly km_sosire: number | null;
  readonly km_parcursi: number | null;
}

/** Cursele în ordinea zilei. Baza le renumerotează, dar ordinea se reface aici din oră. */
export function ordoneazaCurse<T extends Pick<CursaFoaie, "plecare_la" | "ordine">>(
  curse: readonly T[],
): readonly T[] {
  return [...curse].sort((a, b) =>
    a.plecare_la === b.plecare_la ? a.ordine - b.ordine : a.plecare_la < b.plecare_la ? -1 : 1,
  );
}

/**
 * Alimentările în ordinea orei. O citire prin embed (pachetul lunar) nu are
 * `ORDER BY`, iar ruta foii singure le ordonează în interogare: ordinea se
 * reface aici, ca documentul să iasă la fel din ambele căi.
 */
export function ordoneazaAlimentari<T extends { readonly alimentat_la: string }>(
  alimentari: readonly T[],
): readonly T[] {
  return [...alimentari].sort((a, b) =>
    a.alimentat_la === b.alimentat_la ? 0 : a.alimentat_la < b.alimentat_la ? -1 : 1,
  );
}

export interface TotaluriCurse {
  /** Suma kilometrilor curselor încheiate. */
  readonly kmCurse: number;
  /** Ultima sosire − prima plecare: kilometrii de bord ai zilei. */
  readonly kmBord: number | null;
  /**
   * Kilometri fără cursă scrisă între două curse (bordul a urcat mai mult
   * decât suma curselor). Baza nu-i refuză — planul cere kilometraj monoton,
   * nu continuu —, dar aprobatorul trebuie să-i vadă.
   */
  readonly kmFaraCursa: number;
  /** Curse fără sosire. Pe o foaie trimisă: zero, baza o cere. */
  readonly deschise: number;
}

export function totaluriCurse(curse: readonly CursaFoaie[]): TotaluriCurse {
  const ordonate = ordoneazaCurse(curse);
  const kmCurse = ordonate.reduce((s, c) => s + (c.km_parcursi ?? 0), 0);
  const deschise = ordonate.filter((c) => c.sosire_la === null || c.km_sosire === null).length;
  const prima = ordonate[0];
  const ultima = ordonate.at(-1);
  const kmBord =
    prima === undefined || ultima === undefined || ultima.km_sosire === null
      ? null
      : ultima.km_sosire - prima.km_plecare;
  return {
    kmCurse,
    kmBord,
    kmFaraCursa: kmBord === null ? 0 : Math.max(0, kmBord - kmCurse),
    deschise,
  };
}

export interface PropunereCursa {
  readonly kmPlecare: number;
  /** Momentul de la care poate începe cursa nouă (ISO), sau `null` pe o foaie fără curse. */
  readonly dupa: string | null;
  /** Locul de plecare propus: unde s-a încheiat cursa precedentă. */
  readonly deLaLoc: string | null;
  /** Ultima cursă e deschisă: cursa nouă nu se poate adăuga până nu se încheie. */
  readonly blocata: boolean;
}

/**
 * Ce propune caseta „Cursă nouă”: kilometrajul de la sosirea ultimei curse
 * (sau de la plecarea foii, pe o foaie goală) și locul unde s-a ajuns.
 * Exact regula bazei, ca omul să vadă cifra acceptată ÎNAINTE de a salva.
 */
export function propunereCursaNoua(
  curse: readonly CursaFoaie[],
  kmPlecareFoaie: number,
): PropunereCursa {
  const ultima = ordoneazaCurse(curse).at(-1);
  if (ultima === undefined) {
    return { kmPlecare: kmPlecareFoaie, dupa: null, deLaLoc: null, blocata: false };
  }
  if (ultima.sosire_la === null || ultima.km_sosire === null) {
    return { kmPlecare: ultima.km_plecare, dupa: ultima.plecare_la, deLaLoc: null, blocata: true };
  }
  return {
    kmPlecare: ultima.km_sosire,
    dupa: ultima.sosire_la,
    deLaLoc: ultima.pana_la_loc,
    blocata: false,
  };
}

/** Un șablon de traseu, aplicat peste propunere. */
export interface SablonTraseu {
  readonly id: string;
  readonly denumire: string;
  readonly de_la_loc: string;
  readonly pana_la_loc: string;
  readonly scop: string;
  readonly km_estimat: number | null;
}

/**
 * Cursa propusă din șablon: locurile și scopul din șablon, kilometrajul de
 * plecare din propunere, cel de sosire estimat. Ora rămâne a omului.
 */
export function cursaDinSablon(
  sablon: SablonTraseu,
  propunere: PropunereCursa,
): Readonly<{
  de_la_loc: string;
  pana_la_loc: string;
  scop: string;
  km_plecare: number;
  km_sosire: number | null;
}> {
  return {
    de_la_loc: sablon.de_la_loc,
    pana_la_loc: sablon.pana_la_loc,
    scop: sablon.scop,
    km_plecare: propunere.kmPlecare,
    km_sosire: sablon.km_estimat === null ? null : propunere.kmPlecare + sablon.km_estimat,
  };
}

// ── Modelul documentului ───────────────────────────────────────────────────

export interface AlimentareFoaie {
  readonly alimentat_la: string;
  readonly litri: number;
  readonly cost: number;
  readonly statie: string | null;
  readonly numar_bon: string | null;
  readonly plin: boolean;
}

export interface IntrareFoaieParcurs {
  readonly numar: string | null;
  /** Ziua foii, `AAAA-LL-ZZ`. */
  readonly data: string;
  readonly status: "draft" | "trimis" | "aprobat" | "respins";
  readonly vehiculNr: string;
  /** Eticheta categoriei („Autoturism”), deja tradusă de apelant. */
  readonly vehiculCategorie: string | null;
  readonly vehiculCombustibil: string | null;
  readonly normaL100km: number | null;
  /** Combustibilul electric se măsoară în kWh, restul în litri. */
  readonly unitate: "l" | "kWh";
  readonly sofer: string;
  readonly kmPlecare: number | null;
  readonly kmSosire: number | null;
  readonly observatii: string | null;
  readonly trimisLa: string | null;
  readonly aprobatDe: string | null;
  readonly aprobatLa: string | null;
  readonly curse: readonly CursaFoaie[];
  readonly alimentari: readonly AlimentareFoaie[];
  /** Formatarea momentelor, injectată: modelul nu citește fusul orar. */
  readonly ora: (moment: string) => string;
  readonly dataSiOra: (moment: string) => string;
  readonly ziua: (data: string) => string;
}

export interface RandCursaDocument {
  readonly nr: string;
  readonly plecare: string;
  readonly sosire: string;
  readonly deLa: string;
  readonly panaLa: string;
  readonly scop: string;
  readonly kmPlecare: string;
  readonly kmSosire: string;
  readonly km: string;
}

export interface ModelFoaieParcurs {
  readonly titlu: string;
  readonly subtitlu: string;
  /** Rubricile antetului, în ordinea documentului. Valoarea goală = de completat. */
  readonly rubrici: readonly (readonly [string, string])[];
  readonly curse: readonly RandCursaDocument[];
  readonly totaluri: readonly (readonly [string, string])[];
  readonly alimentari: readonly (readonly [string, string, string, string])[];
  readonly aprobare: string;
  /** Avertismente tipărite pe document: ce lipsește ca să fie complet. */
  readonly avertismente: readonly string[];
  readonly note: readonly string[];
  readonly numeFisier: string;
}

const FORMAT_KM = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
const FORMAT_ZECIMAL = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const km = (v: number | null): string => (v === null ? "" : FORMAT_KM.format(v));

export const ETICHETE_STARE_DOCUMENT: Readonly<Record<IntrareFoaieParcurs["status"], string>> = {
  draft: "Ciornă — netrimisă spre aprobare",
  trimis: "Trimisă spre aprobare — neaprobată încă",
  aprobat: "Aprobată",
  respins: "Respinsă",
};

export function modelFoaieParcurs(p: IntrareFoaieParcurs): ModelFoaieParcurs {
  const curse = ordoneazaCurse(p.curse);
  const alimentari = ordoneazaAlimentari(p.alimentari);
  const totaluri = totaluriCurse(curse);
  const kmBord =
    totaluri.kmBord ??
    (p.kmSosire === null || p.kmPlecare === null ? null : p.kmSosire - p.kmPlecare);
  const litri = alimentari.reduce((s, a) => s + a.litri, 0);
  const cost = alimentari.reduce((s, a) => s + a.cost, 0);
  const consumNormat =
    p.normaL100km === null || kmBord === null ? null : (kmBord * p.normaL100km) / 100;

  const avertismente: string[] = [];
  if (p.status !== "aprobat")
    avertismente.push(`Document neaprobat: ${ETICHETE_STARE_DOCUMENT[p.status]}.`);
  if (p.numar === null)
    avertismente.push("Foaia nu are număr: îl primește la trimiterea spre aprobare.");
  if (p.normaL100km === null) {
    avertismente.push(
      "Norma proprie de consum nu e completată pe vehicul (HG 1/2016 pct. 16 alin. (2)).",
    );
  }
  if (p.vehiculCategorie === null) avertismente.push("Categoria vehiculului lipsește.");
  const faraLoc = curse.filter(
    (c) => c.de_la_loc === null || c.pana_la_loc === null || c.scop === null,
  ).length;
  if (faraLoc > 0) {
    avertismente.push(
      faraLoc === 1
        ? "O cursă nu are locul sau scopul completat."
        : `${String(faraLoc)} curse nu au locul sau scopul completat.`,
    );
  }
  if (curse.length === 0) avertismente.push("Foaia nu are nicio cursă.");

  const unitate = p.unitate === "kWh" ? "kWh" : "l";
  const nrDoc = p.numar ?? "fără număr";

  return {
    titlu: "FOAIE DE PARCURS",
    subtitlu: `Nr. ${nrDoc} din ${p.ziua(p.data)}`,
    rubrici: [
      ["Număr și dată", `${nrDoc} / ${p.ziua(p.data)}`],
      ["Vehicul (nr. de înmatriculare)", p.vehiculNr],
      ["Categoria vehiculului", p.vehiculCategorie ?? ""],
      ["Combustibil", p.vehiculCombustibil ?? ""],
      [
        "Norma proprie de consum",
        p.normaL100km === null ? "" : `${FORMAT_ZECIMAL.format(p.normaL100km)} ${unitate}/100 km`,
      ],
      ["Conducător auto", p.sofer],
      ["Starea documentului", ETICHETE_STARE_DOCUMENT[p.status]],
    ],
    curse: curse.map((c, i) => ({
      nr: String(i + 1),
      plecare: p.ora(c.plecare_la),
      sosire: c.sosire_la === null ? "" : p.ora(c.sosire_la),
      deLa: c.de_la_loc ?? "",
      panaLa: c.pana_la_loc ?? "",
      scop: c.scop ?? "",
      kmPlecare: km(c.km_plecare),
      kmSosire: km(c.km_sosire),
      km: km(c.km_parcursi),
    })),
    totaluri: [
      ["Kilometraj la plecare", km(curse[0]?.km_plecare ?? p.kmPlecare)],
      ["Kilometraj la sosire", km(p.kmSosire)],
      ["Km parcurși (bord)", km(kmBord)],
      ["Km pe curse", km(totaluri.kmCurse)],
      ...(totaluri.kmFaraCursa > 0
        ? ([["Km fără cursă scrisă", km(totaluri.kmFaraCursa)]] as const)
        : []),
      [
        "Consum după normă",
        consumNormat === null ? "" : `${FORMAT_ZECIMAL.format(consumNormat)} ${unitate}`,
      ],
      ["Alimentat pe foaie", `${FORMAT_ZECIMAL.format(litri)} ${unitate}`],
      ["Cost alimentări", `${FORMAT_ZECIMAL.format(cost)} lei`],
    ],
    alimentari: alimentari.map((a) => [
      p.dataSiOra(a.alimentat_la),
      [a.statie, a.numar_bon === null ? null : `bon ${a.numar_bon}`, a.plin ? "plin" : null]
        .filter((v): v is string => v !== null)
        .join(" · ") || "—",
      `${FORMAT_ZECIMAL.format(a.litri)} ${unitate}`,
      `${FORMAT_ZECIMAL.format(a.cost)} lei`,
    ]),
    aprobare:
      p.status === "aprobat" && p.aprobatLa !== null
        ? `Aprobată de ${p.aprobatDe ?? "—"} la ${p.dataSiOra(p.aprobatLa)}.`
        : p.trimisLa !== null && p.status === "trimis"
          ? `Trimisă spre aprobare la ${p.dataSiOra(p.trimisLa)}.`
          : "Neaprobată.",
    avertismente,
    note: [
      "Km parcurși = kilometrajul la sosirea ultimei curse − kilometrajul la plecarea primei curse. Consum după normă = km parcurși × norma proprie de consum ÷ 100.",
      "Foaia cuprinde elementele minime din normele Codului fiscal (HG 1/2016, titlul II pct. 16 alin. (2) și titlul VII pct. 68 alin. (2)): categoria vehiculului, scopul și locul deplasării, kilometrii parcurși și norma proprie de consum.",
      "Document justificativ întocmit electronic (OMFP 2634/2015, anexa 1): întocmirea, trimiterea și aprobarea sunt consemnate în jurnalul de audit al aplicației, cu persoana și momentul.",
      ...(p.observatii === null ? [] : [`Observații: ${p.observatii}`]),
    ],
    numeFisier: `foaie-de-parcurs-${p.vehiculNr}-${p.data}${p.numar === null ? "" : `-${p.numar}`}`,
  };
}
