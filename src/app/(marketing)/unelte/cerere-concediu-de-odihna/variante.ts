/**
 * Variantele cererii: ce document produce fiecare și pe ce temei.
 *
 * ── TEMEIURILE, VERIFICATE PE SURSA PRIMARĂ ───────────────────────────────
 * Descărcate cu curl de pe legislatie.just.ro pe 8 oct 2026:
 *  · Codul muncii, forma consolidată (documentul 128647; cea mai recentă
 *    modificare din text: 27.04.2026) — art. 139, 145–158;
 *  · Legea nr. 210/1999 a concediului paternal (documentul 20488; ultima
 *    modificare: OUG 117/2022, la 29.08.2022, aprobată fără modificări prin
 *    Legea 196/2024) — art. 2, 4, 4¹;
 *  · HG nr. 250/1992 (documentul 2564) — art. 24, numai pentru bugetari.
 * Cifrele sunt ⚠ în NOTES.md: de confirmat de jurist înainte de calcul real.
 *
 * ── CE NU E AICI, ȘI DE CE ────────────────────────────────────────────────
 * Rechemarea din concediu (art. 151 alin. (2)) e o decizie a angajatorului,
 * cu obligația lui de a suporta cheltuielile — nu o cerere a salariatului. Un
 * model de rechemare scris de noi ar fi semnat de un patron care nu știe de
 * obligația aceea. Absentarea pentru urgență familială (art. 152²) e o
 * informare cu recuperarea orelor, nu un concediu.
 */

export type TipCerere =
  | "odihna"
  | "fara-plata"
  | "eveniment"
  | "paternal"
  | "ingrijitor"
  | "formare"
  | "reprogramare"
  | "intrerupere";

export type Varianta = Readonly<{
  tip: TipCerere;
  /** Eticheta din bara de variante a paginii. */
  eticheta: string;
  /** Titlul fișierului (metadatele PDF și Word) și al rândului din pagină. */
  titlu: string;
  /** Ce scrie sub „CERERE”. */
  subtitlu: string;
  /** Rubrica de resurse umane are rândurile de sold (doar la concediul de odihnă). */
  cuSold: boolean;
  /** Documentul spune câte zile lucrătoare consumă perioada. */
  numaraZile: boolean;
  /** Nota cu temeiul, tipărită mic la finalul documentului. */
  temei: string;
}>;

export const TIPURI_CERERE: readonly TipCerere[] = [
  "odihna",
  "fara-plata",
  "eveniment",
  "paternal",
  "ingrijitor",
  "formare",
  "reprogramare",
  "intrerupere",
];

export const VARIANTE: Readonly<Record<TipCerere, Varianta>> = {
  odihna: {
    tip: "odihna",
    eticheta: "Odihnă",
    titlu: "Cerere de concediu de odihnă",
    subtitlu: "de concediu de odihnă",
    cuSold: true,
    numaraZile: true,
    temei:
      "Sărbătorile legale în care nu se lucrează nu sunt incluse în durata concediului de odihnă — art. 145 alin. (3) din Codul muncii.",
  },
  "fara-plata": {
    tip: "fara-plata",
    eticheta: "Fără plată",
    titlu: "Cerere de concediu fără plată",
    subtitlu: "de concediu fără plată",
    cuSold: false,
    numaraZile: false,
    temei:
      "Salariații au dreptul la concedii fără plată pentru rezolvarea unor situații personale; durata se stabilește prin contractul colectiv aplicabil sau prin regulamentul intern — art. 153 din Codul muncii.",
  },
  eveniment: {
    tip: "eveniment",
    eticheta: "Eveniment familial",
    titlu: "Cerere de zile libere pentru un eveniment familial",
    subtitlu: "de zile libere plătite pentru un eveniment familial",
    cuSold: false,
    numaraZile: false,
    temei:
      "Evenimentele familiale deosebite și numărul zilelor libere plătite se stabilesc prin lege, prin contractul colectiv aplicabil sau prin regulamentul intern; zilele nu se includ în concediul de odihnă — art. 152 din Codul muncii.",
  },
  paternal: {
    tip: "paternal",
    eticheta: "Paternal",
    titlu: "Cerere de concediu paternal",
    subtitlu: "de concediu paternal",
    cuSold: false,
    numaraZile: true,
    temei:
      "Concediul paternal este de 10 zile lucrătoare, plus 5 zile cu atestatul de absolvire a cursului de puericultură, și se acordă în primele 8 săptămâni de la nașterea copilului — art. 2 alin. (1)–(2) și art. 4 din Legea nr. 210/1999; angajatorul are obligația de a-l aproba — art. 4¹ alin. (1).",
  },
  ingrijitor: {
    tip: "ingrijitor",
    eticheta: "Îngrijitor",
    titlu: "Cerere de concediu de îngrijitor",
    subtitlu: "de concediu de îngrijitor",
    cuSold: false,
    numaraZile: true,
    temei:
      "Concediul de îngrijitor este de 5 zile lucrătoare într-un an calendaristic, se acordă la solicitarea scrisă a salariatului și nu se include în concediul de odihnă — art. 152¹ alin. (1) și (3) din Codul muncii.",
  },
  formare: {
    tip: "formare",
    eticheta: "Formare profesională",
    titlu: "Cerere de concediu pentru formare profesională",
    subtitlu: "de concediu pentru formare profesională",
    cuSold: false,
    numaraZile: true,
    temei:
      "Concediul fără plată pentru formare profesională se cere cu cel puțin o lună înainte și precizează data de începere, domeniul, durata și instituția — art. 155–156 din Codul muncii; concediul plătit, de până la 10 zile lucrătoare sau 80 de ore, se acordă când angajatorul nu a asigurat formarea pe cheltuiala sa — art. 157.",
  },
  reprogramare: {
    tip: "reprogramare",
    eticheta: "Reprogramare",
    titlu: "Cerere de reprogramare a concediului de odihnă",
    subtitlu: "de reprogramare a concediului de odihnă",
    cuSold: true,
    numaraZile: true,
    temei:
      "Salariatul efectuează concediul în perioada programată, cu excepția situațiilor prevăzute de lege sau a celor în care, din motive obiective, concediul nu poate fi efectuat — art. 149 din Codul muncii.",
  },
  intrerupere: {
    tip: "intrerupere",
    eticheta: "Întrerupere",
    titlu: "Cerere de întrerupere a concediului de odihnă",
    subtitlu: "de întrerupere a concediului de odihnă",
    cuSold: false,
    numaraZile: false,
    temei:
      "Concediul de odihnă poate fi întrerupt, la cererea salariatului, pentru motive obiective — art. 151 alin. (1) din Codul muncii.",
  },
};

/** `Object.hasOwn`-ul listelor: „constructor” nu e un tip de cerere. */
export function esteTipCerere(brut: string): brut is TipCerere {
  return (TIPURI_CERERE as readonly string[]).includes(brut);
}

/** Legea 210/1999 art. 2 alin. (1). */
export const ZILE_PATERNAL = 10;
/** Legea 210/1999 art. 4 alin. (1). */
export const ZILE_PATERNAL_PUERICULTURA = 5;
/** Legea 210/1999 art. 2 alin. (2). */
export const SAPTAMANI_PATERNAL = 8;
/** Codul muncii art. 152¹ alin. (1). */
export const ZILE_INGRIJITOR = 5;
/** Codul muncii art. 157 alin. (1): „de până la 10 zile lucrătoare sau de până la 80 de ore”. */
export const ZILE_FORMARE_PLATITA = 10;
/** Codul muncii art. 148 alin. (5). */
export const ZILE_FRACTIUNE_NEINTRERUPTA = 10;
/** Codul muncii art. 148 alin. (4). */
export const ZILE_AVANS_CERERE_ODIHNA = 60;

export type Eveniment =
  "casatorie-salariat" | "nastere-copil" | "casatorie-copil" | "deces" | "alt";

export const EVENIMENTE_ORDINE: readonly Eveniment[] = [
  "casatorie-salariat",
  "nastere-copil",
  "casatorie-copil",
  "deces",
  "alt",
];

/**
 * Evenimentele din art. 24 alin. (1) din HG 250/1992, plus „alt eveniment”.
 *
 * `zileBugetar` e numărul din hotărâre, care se aplică NUMAI salariaților din
 * administrația publică, regiile autonome cu specific deosebit și unitățile
 * bugetare. Într-o firmă privată numărul îl dau contractul colectiv sau
 * regulamentul intern (art. 152 alin. (2) din Codul muncii), deci cifra nu intră
 * în document: pagina o arată ca reper, documentul scrie doar ce trece omul.
 */
export const EVENIMENTE: Readonly<
  Record<
    Eveniment,
    Readonly<{ eticheta: string; inCerere: string; act: string | null; zileBugetar: number | null }>
  >
> = {
  "casatorie-salariat": {
    eticheta: "Căsătoria mea",
    inCerere: "căsătoria mea",
    act: "certificatul de căsătorie",
    zileBugetar: 5,
  },
  "nastere-copil": {
    eticheta: "Nașterea copilului meu",
    inCerere: "nașterea copilului meu",
    act: "certificatul de naștere al copilului",
    zileBugetar: 3,
  },
  "casatorie-copil": {
    eticheta: "Căsătoria copilului meu",
    inCerere: "căsătoria copilului meu",
    act: "certificatul de căsătorie al copilului",
    zileBugetar: 3,
  },
  deces: {
    eticheta: "Decesul soțului sau al unei rude",
    inCerere: "decesul unui membru al familiei",
    act: "certificatul de deces",
    zileBugetar: 3,
  },
  alt: { eticheta: "Alt eveniment", inCerere: "", act: null, zileBugetar: null },
};

export function esteEveniment(brut: string): brut is Eveniment {
  return (EVENIMENTE_ORDINE as readonly string[]).includes(brut);
}
