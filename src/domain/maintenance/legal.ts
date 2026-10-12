// src/domain/maintenance/legal.ts
/**
 * Categoriile de verificări legale ale unui plan de mentenanță (M7). Funcții
 * pure, fără I/O.
 *
 * Alegerea unei categorii pe plan PRECOMPLETEAZĂ tipul `verificare_legala`,
 * periodicitatea sugerată și temeiul (`maintenance_plans.categorie_legala` și
 * `temei_legal`, coloane puse de 0183). Nimic nu se impune: scadența din
 * documentul emis (PV de verificare, buletin) are prioritate față de calcul
 * (cazul 40) — aplicația doar AVERTIZEAZĂ când documentul trece de maximul legal.
 *
 * ── CE ÎNSEAMNĂ `verificat` ───────────────────────────────────────────────
 * `true` = periodicitatea și articolul au fost citite pe 12 oct 2026 în textul
 * descărcat de pe legislatie.just.ro (adresa e în `sursa`, consolidarea în
 * `nota`). Chiar și atunci valoarea rămâne de confirmat cu RSVTI/jurist pentru
 * cazul concret: prescripțiile ISCIR dau un MAXIM, iar data reală o pune
 * inspectorul în procesul-verbal. `false` = temei de confirmat, nedescărcat sau
 * neconfirmat pe text — UI-ul îl arată cu ⚠ (NOTES.md §3, „SSM / PSI / ISCIR").
 */

export const CODURI_CATEGORII_LEGALE = [
  "vtp_masini_ridicat",
  "vtp_ascensor",
  "revizie_ascensor",
  "vtp_cazan",
  "vtp_recipient",
  "verificare_gpl",
  "verificare_gaze",
  "revizie_gaze",
  "pram",
  "paratrasnet",
  "iluminat_siguranta",
  "usi_rezistente_foc",
  "cos_fum",
  "f_gaz",
  "metrologie",
  "generator_ups",
  "verificare_montare",
] as const;
export type CodCategorieLegala = (typeof CODURI_CATEGORII_LEGALE)[number];

export type CategorieLegala = Readonly<{
  cod: CodCategorieLegala;
  eticheta: string;
  /** Sugestia pentru `periodicitate_zile`; `null` = legată de un eveniment, nu de calendar. */
  periodicitateZile: number | null;
  /**
   * Maximul legal între două verificări, în LUNI („maximum 2 ani” = 24), pentru
   * avertisment; `null` = nu se știe sigur. Luni, nu zile: 730 de zile peste un
   * 29 februarie ar fi cu o zi mai puțin decât „2 ani” și ar avertiza fals.
   */
  maximLuni: number | null;
  /** Textul scris în `temei_legal` (≤ 300 de caractere împreună cu marcajul ⚠). */
  temei: string;
  verificat: boolean;
  /** Adresa textului citit, când `verificat`. */
  sursa?: string;
  /** Ce s-a citit și ce rămâne de confirmat. */
  nota: string;
}>;

const PT_2010 = "https://legislatie.just.ro/Public/DetaliiDocument/122705";

const CATEGORII: Readonly<Record<CodCategorieLegala, Omit<CategorieLegala, "cod">>> = {
  vtp_masini_ridicat: {
    eticheta: "VTP ISCIR — mașini de ridicat (macara, stivuitor, platformă, pod rulant)",
    periodicitateZile: 730,
    maximLuni: 24,
    temei:
      "PT R1-2010, art. 51 alin. (1): următoarea verificare tehnică periodică la maximum 2 ani",
    verificat: true,
    sursa: PT_2010,
    nota: "Textul original din MO 634 bis/2010 (portalul nu listează consolidări). Data exactă o stabilește inspectorul ISCIR sau RSVTI în procesul-verbal.",
  },
  vtp_ascensor: {
    eticheta: "VTP ISCIR — ascensor",
    periodicitateZile: 365,
    maximLuni: 24,
    temei:
      "PT R2-2010, art. 62: următoarea verificare tehnică periodică la maximum 2 ani (maximum 1 an la ascensoarele instituțiilor și serviciilor publice)",
    verificat: true,
    sursa: "https://legislatie.just.ro/Public/DetaliiDocument/122702",
    nota: "Planul presupunea „anual”; textul spune maximum 2 ani, cu 1 an pentru instituțiile publice. Sugestia rămâne 1 an, varianta prudentă.",
  },
  revizie_ascensor: {
    eticheta: "Revizie și întreținere ascensor (firmă autorizată ISCIR)",
    periodicitateZile: 30,
    maximLuni: null,
    temei:
      "PT R2-2010, art. 68 alin. (1): periodic, după instrucțiunile montatorului; cel puțin de două ori pe lună la ascensoarele fără marcaj de conformitate",
    verificat: true,
    sursa: "https://legislatie.just.ro/Public/DetaliiDocument/122702",
    nota: "Intervalul vine din contractul de întreținere și din cartea ascensorului; 30 de zile e doar punctul de pornire.",
  },
  vtp_cazan: {
    eticheta: "VTP ISCIR — cazan de abur sau de apă fierbinte",
    periodicitateZile: 1460,
    maximLuni: 48,
    temei:
      "PT C1-2010, art. 186: revizia interioară cel puțin o dată la 4 ani; art. 197: încercarea la presiune hidraulică cel puțin o dată la 8 ani",
    verificat: true,
    sursa: "https://legislatie.just.ro/Public/DetaliiDocument/158167",
    nota: "Consolidarea din 08.05.2014. Inspectorul sau RSVTI pot stabili termene mai scurte; încercarea hidraulică (8 ani) se urmărește ca plan separat.",
  },
  vtp_recipient: {
    eticheta: "VTP ISCIR — recipient sub presiune, compresor",
    periodicitateZile: 1460,
    maximLuni: 48,
    temei:
      "PT C4-2010, art. 74: revizia interioară cel puțin o dată la 4 ani; art. 83: încercarea de presiune cel puțin o dată la 8 ani",
    verificat: true,
    sursa: "https://legislatie.just.ro/Public/DetaliiDocument/158168",
    nota: "Consolidarea din 08.05.2014. Recipientele căptușite și generatoarele de acetilenă au termene mai scurte (art. 89 și următoarele).",
  },
  verificare_gpl: {
    eticheta: "Instalație GPL — verificare periodică",
    periodicitateZile: 730,
    maximLuni: null,
    temei: "Prescripțiile ISCIR pentru instalațiile GPL",
    verificat: false,
    nota: "Neverificat pe text: prescripția aplicabilă și intervalul se confirmă cu RSVTI.",
  },
  verificare_gaze: {
    eticheta: "Instalație de utilizare a gazelor naturale — verificare tehnică periodică",
    periodicitateZile: 730,
    maximLuni: 24,
    temei: "Ordinul ANRE 179/2015, Procedura, art. 3 alin. (2) lit. a): periodic, la maximum 2 ani",
    verificat: true,
    sursa: "https://legislatie.just.ro/Public/DetaliiDocument/269180",
    nota: "Consolidarea din 03.11.2023. După o revizie, următoarea verificare e scadentă la maximum 2 ani de la revizie.",
  },
  revizie_gaze: {
    eticheta: "Instalație de utilizare a gazelor naturale — revizie tehnică periodică",
    periodicitateZile: 3650,
    maximLuni: 120,
    temei:
      "Ordinul ANRE 179/2015, Procedura, art. 3 alin. (3) lit. a): periodic, la maximum 10 ani, și după o întrerupere mai lungă de 6 luni",
    verificat: true,
    sursa: "https://legislatie.just.ro/Public/DetaliiDocument/269180",
    nota: "Consolidarea din 03.11.2023. Revizia ține locul verificării din același an.",
  },
  pram: {
    eticheta: "PRAM — măsurarea prizei de pământ și a instalației electrice",
    periodicitateZile: 365,
    maximLuni: null,
    temei: "Normativul I7/2011 și reglementările ANRE",
    verificat: false,
    nota: "Neverificat pe text: intervalul anual e practica uzuală, nu o citire a normativului.",
  },
  paratrasnet: {
    eticheta: "Instalația de paratrăsnet",
    periodicitateZile: 365,
    maximLuni: null,
    temei: "Normativul I7/2011",
    verificat: false,
    nota: "Neverificat pe text.",
  },
  iluminat_siguranta: {
    eticheta: "Iluminatul de siguranță — probă de funcționare",
    periodicitateZile: 30,
    maximLuni: null,
    temei: "Normativele I7/2011 și P118-3/2015",
    verificat: false,
    nota: "Neverificat pe text: proba lunară e practica uzuală.",
  },
  usi_rezistente_foc: {
    eticheta: "Uși rezistente la foc — verificare",
    periodicitateZile: 365,
    maximLuni: null,
    temei: "Normele de apărare împotriva incendiilor și instrucțiunile producătorului",
    verificat: false,
    nota: "Neverificat pe text.",
  },
  cos_fum: {
    eticheta: "Coș de fum — verificare, reparare și curățare",
    periodicitateZile: 365,
    maximLuni: 12,
    temei:
      "HG 537/2007, art. 1: contravenție neexecutarea verificării, reparării și curățării periodice, cel puțin o dată pe an, a coșurilor de fum",
    verificat: true,
    sursa: "https://legislatie.just.ro/Public/DetaliiDocument/82739",
    nota: "Textul contravenției a fost citit; litera exactă din articol se confirmă cu juristul.",
  },
  f_gaz: {
    eticheta: "Echipament cu gaze fluorurate (F-gaz) — control de etanșeitate",
    periodicitateZile: 365,
    maximLuni: null,
    temei:
      "Regulamentul (UE) 2024/573, art. 5: frecvența depinde de cantitatea în tone echivalent CO2",
    verificat: false,
    nota: "EUR-Lex n-a putut fi descărcat; frecvența (12, 6 sau 3 luni) se confirmă pe echipament.",
  },
  metrologie: {
    eticheta: "Mijloc de măsurare — verificare metrologică (BRML)",
    periodicitateZile: 365,
    maximLuni: null,
    temei: "Lista oficială a mijloacelor de măsurare supuse controlului metrologic legal (BRML)",
    verificat: false,
    nota: "Neverificat pe text: intervalul depinde de mijlocul de măsurare.",
  },
  generator_ups: {
    eticheta: "Generator sau UPS — probă de funcționare",
    periodicitateZile: 30,
    maximLuni: null,
    temei: "Instrucțiunile producătorului; normativul P118-3/2015 pentru consumatorii de siguranță",
    verificat: false,
    nota: "Neverificat pe text.",
  },
  verificare_montare: {
    eticheta: "Verificare după montare sau mutare într-un loc nou (HG 1146/2006)",
    periodicitateZile: null,
    maximLuni: null,
    temei:
      "HG 1146/2006, art. 5 alin. (1): verificare inițială după instalare, înainte de prima punere în funcțiune, și după fiecare montare într-un loc de muncă nou",
    verificat: true,
    sursa: "https://legislatie.just.ro/Public/DetaliiDocument/75585",
    nota: "Legată de eveniment, nu de calendar: planul se face cu periodicitate pe contor sau se execută o dată. Alin. (4): echipamentul folosit în afara firmei poartă dovada ultimei verificări.",
  },
};

export const CATEGORII_LEGALE: readonly CategorieLegala[] = CODURI_CATEGORII_LEGALE.map((cod) => ({
  cod,
  ...CATEGORII[cod],
}));

export function categorieLegala(cod: string | null): CategorieLegala | null {
  if (cod === null) return null;
  return CATEGORII_LEGALE.find((c) => c.cod === cod) ?? null;
}

/** Ce se scrie în `temei_legal`: temeiul neverificat poartă ⚠, ca la valorile din NOTES.md. */
export function temeiPentruPlan(categorie: CategorieLegala): string {
  const text = categorie.verificat ? categorie.temei : `⚠ ${categorie.temei} (de confirmat)`;
  return text.slice(0, 300);
}

export type PreCompletarePlan = Readonly<{
  tip: "verificare_legala";
  denumire: string;
  /** Text, ca în câmpul formularului: gol când categoria n-are periodicitate. */
  periodicitate_zile: string;
  temei_legal: string;
}>;

/** Valorile cu care alegerea categoriei umple formularul de plan. */
export function preCompletarePlan(cod: string | null): PreCompletarePlan | null {
  const c = categorieLegala(cod);
  if (c === null) return null;
  return {
    tip: "verificare_legala",
    denumire: c.eticheta,
    periodicitate_zile: c.periodicitateZile === null ? "" : String(c.periodicitateZile),
    temei_legal: temeiPentruPlan(c),
  };
}

/**
 * `"2026-01-31"` + n luni, cu ziua tăiată la ultima zi a lunii țintă
 * (31 ian + 1 lună = 28/29 feb), pe calendar UTC — zile întregi, fără fus.
 */
export function adunaLuni(data: string, luni: number): string {
  const [an, luna, zi] = data.split("-").map(Number) as [number, number, number];
  const tinta = new Date(Date.UTC(an, luna - 1 + luni, 1));
  const ultimaZi = new Date(
    Date.UTC(tinta.getUTCFullYear(), tinta.getUTCMonth() + 1, 0),
  ).getUTCDate();
  tinta.setUTCDate(Math.min(zi, ultimaZi));
  return tinta.toISOString().slice(0, 10);
}

/**
 * Scadența dintr-un document trece de maximul legal? (cazul 40)
 *
 * Mai scurtă sau egală: documentul are prioritate, nimic de spus. Mai lungă:
 * se întoarce data maximă, ca UI-ul să AVERTIZEZE — nu să refuze: maximele
 * sunt ⚠ de confirmat, iar documentul emis de inspector e sursa.
 */
export function depasesteMaximulLegal(
  maximLuni: number | null,
  dataDeLa: string | null,
  scadenta: string | null,
): Readonly<{ dataMaxima: string }> | null {
  if (maximLuni === null || dataDeLa === null || scadenta === null) return null;
  const dataMaxima = adunaLuni(dataDeLa, maximLuni);
  return scadenta > dataMaxima ? { dataMaxima } : null;
}
