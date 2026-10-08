// src/lib/queries/registru.ts
//
// Citirile registrului de înregistrare a documentelor.
//
// ── DE CE ANUL E FILTRU OBLIGATORIU, NU OPȚIONAL ────────────────────────────
// Ordinul 217/1996 art. 9: „Înregistrarea documentelor începe de la 1 ianuarie
// și se încheie la 31 decembrie ale fiecărui an." Registrul NU e o listă continuă
// din care alegi un interval — e un volum per an, exact ca registrul pe hârtie
// pe care îl cere inspectorul. Numărul 437 înseamnă ceva doar împreună cu anul.
//
// Consecința tehnică e un câștig: cu anul fixat, `numar` e unic (indexul
// `registru_org_an_numar_uniq`), deci e departajatorul perfect al oricărei
// sortări — unic ȘI în ordinea registrului, spre deosebire de un uuid.
//
// ── DE CE NU `.range()` ─────────────────────────────────────────────────────
// Regula proiectului. În plus, aici `max_rows = 1000` ar trunchia TĂCUT: un
// registru de 3000 de rânduri ar arăta complet și n-ar fi — exact felul de
// defect pe care restul stratului îl vânează.

import "server-only";

import { z } from "zod";

import {
  GRUPURI_REGISTRU,
  SORTARI_REGISTRU,
  STARI_REGISTRU,
  SURSE_REGISTRU,
  type CheieSortare,
  type GrupRegistru,
  type StareRegistru,
  type SursaRegistru,
} from "@/lib/registru/filtre";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

import {
  codificaCursor,
  decodificaCursor,
  predicatKeyset,
  predicatKeysetNulabil,
  sortareCeruta,
  tiparContine,
  VALOARE_NULA,
  type Directie,
} from "./cursor";

export const LIMITA_IMPLICITA = 50;
export const LIMITA_MAXIMA = 200;

/** Câte rânduri poate lua un export sau o citire completă dintr-o singură bucată. */
export const MAX_RANDURI_EXPORT = 5000;

export type SensRegistru = Enums<"registru_sens">;
export type StareExercitiu = Enums<"registru_stare_exercitiu">;

/* --------------------------------- filtre -------------------------------- */

const SENSURI = ["intrare", "iesire", "intern"] as const satisfies readonly SensRegistru[];

// Vocabularul filtrelor stă în `@/lib/registru/filtre` (fără `server-only`),
// ca bara de filtre — Client Component — să-l poată importa. Re-exportat de
// aici pentru apelanții de pe server.
export {
  GRUPURI_REGISTRU,
  SORTARI_REGISTRU,
  STARI_REGISTRU,
  SURSE_REGISTRU,
  type CheieSortare,
  type GrupRegistru,
  type StareRegistru,
  type SursaRegistru,
} from "@/lib/registru/filtre";

/**
 * Starea unui rând, dedusă din două coloane: `anulat_la` (pct. 58 lit. d —
 * rândul nu se șterge, se anulează) și `rezolvat_la` (art. 9 — răspunsul
 * închide cazul, fără număr nou).
 */
export type SortareRegistru = Readonly<{ cheie: CheieSortare; directie: Directie }>;

const SORTARE_IMPLICITA: SortareRegistru = { cheie: "numar", directie: "desc" };

const COLOANA_SORTARE: Readonly<Record<CheieSortare, string>> = {
  numar: "numar",
  data: "data_inregistrare",
  tip: "tip_document",
  dosar: "indicativ_dosar",
};

/** `indicativ_dosar` e NULL la tipurile neclasate (art. 9: se completează „după rezolvare"). */
const SORTARE_NULABILA: Readonly<Record<CheieSortare, boolean>> = {
  numar: false,
  data: false,
  tip: false,
  dosar: true,
};

export type FiltreRegistru = Readonly<{
  an: number;
  sens: SensRegistru | null;
  tipDocument: string | null;
  deLa: string | null;
  panaLa: string | null;
  cautare: string | null;
  angajatId: string | null;
  /** Indicativul dosarului din nomenclator: „II.5”, „IV.A.3”. */
  dosar: string | null;
  stare: StareRegistru | null;
  sursa: SursaRegistru | null;
  /** Forma din URL: `data` crescător, `-data` descrescător. Nepermis ⇒ implicit. */
  sort: string | null;
  grup: GrupRegistru | null;
  cursor: string | null;
  limita: number;
}>;

export type RandRegistru = Readonly<{
  id: string;
  numar: number;
  numarAfisat: string;
  dataInregistrare: string;
  sens: SensRegistru;
  tipDocument: string;
  continutRezumat: string;
  numarDocumentEmitent: string | null;
  dataDocumentEmitent: string | null;
  emitent: string | null;
  destinatar: string | null;
  compartiment: string | null;
  dataExpedierii: string | null;
  modRezolvare: string | null;
  numarFile: number | null;
  numarAnexe: number | null;
  conexatLa: string | null;
  /** Ordin 217/1996 art. 9 și art. 11 — indicativul dosarului după nomenclator. */
  indicativDosar: string | null;
  rezolvatLa: string | null;
  entitateTip: string;
  entitateId: string | null;
  /** Salariatul la care se referă documentul (0184) — legătura spre fișa lui. */
  angajatId: string | null;
  inregistratRetroactiv: boolean;
  anulatLa: string | null;
  motivAnulare: string | null;
}>;

export type PaginaRegistru = Readonly<{
  randuri: readonly RandRegistru[];
  cursorUrmator: string | null;
  total: number;
  /** Sortarea EFECTIV aplicată — cea din URL, îngustată la cele permise. */
  sortare: SortareRegistru;
}>;

export type Exercitiu = Readonly<{
  an: number;
  stare: StareExercitiu;
  numarDePornire: number;
  inchisLa: string | null;
  totalInregistrari: number | null;
  amprenta: string | null;
  redeschisLa: string | null;
  motivRedeschidere: string | null;
}>;

/** Rândul brut, exact cum vine din PostgREST. */
type RandBrut = {
  readonly id: string;
  readonly numar: number;
  readonly numar_afisat: string;
  readonly data_inregistrare: string;
  readonly sens: SensRegistru;
  readonly tip_document: string;
  readonly continut_rezumat: string;
  readonly numar_document_emitent: string | null;
  readonly data_document_emitent: string | null;
  readonly emitent: string | null;
  readonly destinatar: string | null;
  readonly compartiment: string | null;
  readonly data_expedierii: string | null;
  readonly mod_rezolvare: string | null;
  readonly numar_file: number | null;
  readonly numar_anexe: number | null;
  readonly conexat_la: string | null;
  readonly indicativ_dosar: string | null;
  readonly rezolvat_la: string | null;
  readonly entitate_tip: string;
  readonly entitate_id: string | null;
  readonly angajat_id: string | null;
  readonly inregistrat_retroactiv: boolean;
  readonly anulat_la: string | null;
  readonly motiv_anulare: string | null;
};

const COLOANE =
  "id, numar, numar_afisat, data_inregistrare, sens, tip_document, continut_rezumat, " +
  "numar_document_emitent, data_document_emitent, emitent, destinatar, compartiment, " +
  "data_expedierii, mod_rezolvare, numar_file, numar_anexe, conexat_la, entitate_tip, " +
  "entitate_id, inregistrat_retroactiv, anulat_la, motiv_anulare, indicativ_dosar, rezolvat_la, " +
  "angajat_id";

const spreRand = (b: RandBrut): RandRegistru => ({
  id: b.id,
  numar: b.numar,
  numarAfisat: b.numar_afisat,
  dataInregistrare: b.data_inregistrare,
  sens: b.sens,
  tipDocument: b.tip_document,
  continutRezumat: b.continut_rezumat,
  numarDocumentEmitent: b.numar_document_emitent,
  dataDocumentEmitent: b.data_document_emitent,
  emitent: b.emitent,
  destinatar: b.destinatar,
  compartiment: b.compartiment,
  dataExpedierii: b.data_expedierii,
  modRezolvare: b.mod_rezolvare,
  numarFile: b.numar_file,
  numarAnexe: b.numar_anexe,
  conexatLa: b.conexat_la,
  indicativDosar: b.indicativ_dosar,
  rezolvatLa: b.rezolvat_la,
  entitateTip: b.entitate_tip,
  entitateId: b.entitate_id,
  angajatId: b.angajat_id,
  inregistratRetroactiv: b.inregistrat_retroactiv,
  anulatLa: b.anulat_la,
  motivAnulare: b.motiv_anulare,
});

/** Anul în fusul operațional — același pe care îl folosește `app.azi_local()` în bază. */
export const anulCurent = (): number =>
  Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Bucharest",
      year: "numeric",
    }).format(new Date()),
  );

const ZI = /^\d{4}-\d{2}-\d{2}$/;
/** Indicativul e GENERAT în bază (0135): cifră romană, literă opțională, cifră arabă. */
const INDICATIV = /^[IVXLCDM]{1,8}(?:\.[A-Z])?\.\d{1,4}$/u;

const schemaFiltre = z.object({
  an: z.coerce.number().int().min(2000).max(2200),
  sens: z.enum(SENSURI).nullable().catch(null),
  tipDocument: z
    .string()
    .regex(/^[a-z][a-z0-9_]{1,63}$/)
    .nullable()
    .catch(null),
  deLa: z.string().regex(ZI).nullable().catch(null),
  panaLa: z.string().regex(ZI).nullable().catch(null),
  cautare: z.string().trim().min(1).max(120).nullable().catch(null),
  angajatId: z.uuid().nullable().catch(null),
  dosar: z.string().regex(INDICATIV).nullable().catch(null),
  stare: z.enum(STARI_REGISTRU).nullable().catch(null),
  sursa: z.enum(SURSE_REGISTRU).nullable().catch(null),
  // Numele coloanei ajunge într-un `.order()`: nu vine liber din adresă —
  // `sortareCeruta` îl mai îngustează o dată, la lista permisă.
  sort: z
    .string()
    .regex(/^-?[a-z]{1,32}$/)
    .nullable()
    .catch(null),
  grup: z.enum(GRUPURI_REGISTRU).nullable().catch(null),
  cursor: z.string().max(64).nullable().catch(null),
  limita: z.coerce.number().int().min(1).max(LIMITA_MAXIMA).catch(LIMITA_IMPLICITA),
});

const primaValoare = (valoare: string | string[] | undefined): string | null => {
  const brut = Array.isArray(valoare) ? valoare[0] : valoare;
  if (typeof brut !== "string") return null;
  const curat = brut.trim();
  return curat === "" ? null : curat;
};

/** Validare la graniță: parametrii din URL nu sunt niciodată de încredere. */
export const parseazaFiltre = (
  brute: Readonly<Record<string, string | string[] | undefined>>,
): FiltreRegistru =>
  schemaFiltre.parse({
    an: primaValoare(brute.an) ?? anulCurent(),
    sens: primaValoare(brute.sens),
    tipDocument: primaValoare(brute.tip),
    deLa: primaValoare(brute.de_la),
    panaLa: primaValoare(brute.pana_la),
    cautare: primaValoare(brute.q),
    angajatId: primaValoare(brute.angajat),
    dosar: primaValoare(brute.dosar),
    stare: primaValoare(brute.stare),
    sursa: primaValoare(brute.sursa),
    sort: primaValoare(brute.sort),
    grup: primaValoare(brute.grup),
    cursor: primaValoare(brute.cursor),
    limita: primaValoare(brute.limita) ?? LIMITA_IMPLICITA,
  });

/**
 * Toate cheile de filtrare, sortare și grupare — nu și cursorul sau limita.
 * `Paginare` construiește „pagina următoare" de aici: o cheie uitată aici
 * dispare la primul „mai departe".
 */
export const serializeazaFiltre = (
  filtre: FiltreRegistru,
  suplimentar: Readonly<Record<string, string>> = {},
): string => {
  const p = new URLSearchParams();
  const adauga = (cheie: string, valoare: string | null): void => {
    if (valoare !== null && valoare !== "") p.set(cheie, valoare);
  };
  p.set("an", String(filtre.an));
  adauga("sens", filtre.sens);
  adauga("tip", filtre.tipDocument);
  adauga("de_la", filtre.deLa);
  adauga("pana_la", filtre.panaLa);
  adauga("q", filtre.cautare);
  adauga("angajat", filtre.angajatId);
  adauga("dosar", filtre.dosar);
  adauga("stare", filtre.stare);
  adauga("sursa", filtre.sursa);
  adauga("sort", filtre.sort);
  adauga("grup", filtre.grup);
  for (const [cheie, valoare] of Object.entries(suplimentar)) adauga(cheie, valoare);
  return p.toString();
};

/** Cheie stabilă pentru `<Suspense>`, ca lista să reintre în starea de încărcare. */
export const cheieFiltre = (filtre: FiltreRegistru): string =>
  `${serializeazaFiltre(filtre)}|${filtre.cursor ?? ""}`;

/** Sortarea cerută din URL, îngustată la cele permise; nepermis ⇒ implicit, tăcut. */
export const sortareRegistru = (sort: string | null): SortareRegistru =>
  sortareCeruta(sort, SORTARI_REGISTRU, SORTARE_IMPLICITA);

/* ------------------------------ filtrele comune --------------------------- */

/**
 * Filtrele mulțimii, aplicate identic pe pagină, pe numărătoare și pe citirea
 * completă. Generic peste constructorul de interogare, nu scris de trei ori:
 * copiile ar diverge la primul filtru adăugat, iar divergența s-ar vedea
 * tocmai ca o numărătoare care nu se potrivește cu lista.
 */
type Filtrabil<Q> = {
  eq: (c: string, v: string | number) => Q;
  neq: (c: string, v: string) => Q;
  gte: (c: string, v: string) => Q;
  lte: (c: string, v: string) => Q;
  is: (c: string, v: null) => Q;
  not: (c: string, op: string, v: null) => Q;
  or: (f: string) => Q;
};

const COLOANE_CAUTARE = [
  "continut_rezumat",
  "numar_afisat",
  "numar_document_emitent",
  "destinatar",
  "emitent",
] as const;

function aplicaFiltre<Q extends Filtrabil<Q>>(
  q: Q,
  organizationId: string,
  filtre: FiltreRegistru,
): Q {
  let cu = q.eq("organization_id", organizationId).eq("an", filtre.an);
  if (filtre.sens !== null) cu = cu.eq("sens", filtre.sens);
  if (filtre.tipDocument !== null) cu = cu.eq("tip_document", filtre.tipDocument);
  if (filtre.deLa !== null) cu = cu.gte("data_inregistrare", filtre.deLa);
  if (filtre.panaLa !== null) cu = cu.lte("data_inregistrare", filtre.panaLa);
  if (filtre.angajatId !== null) cu = cu.eq("angajat_id", filtre.angajatId);
  if (filtre.dosar !== null) cu = cu.eq("indicativ_dosar", filtre.dosar);
  switch (filtre.stare) {
    case "active":
      cu = cu.is("anulat_la", null);
      break;
    case "anulate":
      cu = cu.not("anulat_la", "is", null);
      break;
    case "in_lucru":
      cu = cu.is("anulat_la", null).is("rezolvat_la", null);
      break;
    case "rezolvate":
      cu = cu.not("rezolvat_la", "is", null);
      break;
    case null:
      break;
  }
  if (filtre.sursa === "manual") cu = cu.eq("entitate_tip", "manual");
  if (filtre.sursa === "automat") cu = cu.neq("entitate_tip", "manual");
  if (filtre.cautare !== null) {
    // `tiparContine` scapă `%`, `_` și ghilimelele și ÎNCADREAZĂ termenul, deci
    // virgula și parantezele nu mai pot rupe sintaxa `or=(...)`. Înainte se
    // tăiau caracterele — „100%" căuta „100 ".
    const util = filtre.cautare.replace(/[*]/gu, " ").trim();
    if (util.length > 0) {
      const tipar = tiparContine(filtre.cautare);
      cu = cu.or(COLOANE_CAUTARE.map((c) => `${c}.ilike.${tipar}`).join(","));
    }
  }
  return cu;
}

/* --------------------------------- cursor -------------------------------- */
//
// Cursorul poartă valoarea coloanei de sortare și NUMĂRUL ultimului rând —
// `numar`, nu `id`, ca departajator: cu anul fixat e unic prin index și e
// ordinea registrului, deci rândurile din aceeași zi rămân în ordinea
// înregistrării. Codecul e cel comun din `cursor.ts`.

const valoareSortare = (rand: RandBrut, cheie: CheieSortare): string => {
  switch (cheie) {
    case "numar":
      return String(rand.numar);
    case "data":
      return rand.data_inregistrare;
    case "tip":
      return rand.tip_document;
    case "dosar":
      return rand.indicativ_dosar ?? VALOARE_NULA;
  }
};

/* -------------------------------- citirile ------------------------------- */

/**
 * O pagină din registru, plus totalul mulțimii filtrate.
 *
 * Numărătoarea merge pe o interogare SEPARATĂ, nu pe aceeași cu `count: "exact"`.
 * Motivul e greșeala deja făcută în `employees.ts`: predicatul KEYSET e și el un
 * filtru, iar pus pe aceeași interogare `count` numără doar ce a rămas DUPĂ
 * cursor — de la pagina a doua, totalul scade cu fiecare „mai departe”. Cele
 * două interogări împart aceleași filtre, aplicate de aceeași funcție, ca să nu
 * poată diverge.
 */
export async function listeazaRegistru(
  organizationId: string,
  filtre: FiltreRegistru,
): Promise<PaginaRegistru> {
  const db = await createServerSupabase();
  const sortare = sortareRegistru(filtre.sort);
  const coloana = COLOANA_SORTARE[sortare.cheie];
  const ascending = sortare.directie === "asc";

  let interogare = aplicaFiltre(
    db.from("registru_documente").select(COLOANE),
    organizationId,
    filtre,
  );
  // Ordinea EXACTĂ a predicatului de continuare: coloana, apoi departajatorul.
  if (sortare.cheie !== "numar")
    interogare = interogare.order(coloana, { ascending, nullsFirst: false });
  interogare = interogare.order("numar", { ascending }).limit(filtre.limita + 1);

  const cursor = filtre.cursor === null ? null : decodificaCursor(filtre.cursor);
  if (cursor !== null && /^\d{1,9}$/u.test(cursor.id)) {
    if (sortare.cheie === "numar") {
      const numar = Number(cursor.id);
      interogare = ascending ? interogare.gt("numar", numar) : interogare.lt("numar", numar);
    } else {
      const predicat = SORTARE_NULABILA[sortare.cheie] ? predicatKeysetNulabil : predicatKeyset;
      interogare = interogare.or(predicat(coloana, cursor, sortare.directie, "numar"));
    }
  }

  const [pagina, numarare] = await Promise.all([
    interogare.returns<RandBrut[]>(),
    aplicaFiltre(
      db.from("registru_documente").select("id", { count: "exact", head: true }),
      organizationId,
      filtre,
    ),
  ]);

  if (pagina.error !== null) throw pagina.error;
  if (numarare.error !== null) throw numarare.error;

  const brute = pagina.data ?? [];
  const areUrmatoarea = brute.length > filtre.limita;
  const vizibile = areUrmatoarea ? brute.slice(0, filtre.limita) : brute;
  const ultimul = vizibile.at(-1);

  return {
    randuri: vizibile.map(spreRand),
    cursorUrmator:
      areUrmatoarea && ultimul !== undefined
        ? codificaCursor({
            valoare: valoareSortare(ultimul, sortare.cheie),
            id: String(ultimul.numar),
          })
        : null,
    total: numarare.count ?? 0,
    sortare,
  };
}

/**
 * TOT anul filtrat, pentru gruparea din ecran și pentru listarea de la control.
 *
 * Nu se paginează — gruparea cu cursor ar da grupuri tăiate la marginea paginii.
 * Se citește în pagini de 1000 (capcana #2), cu salt peste ultimul număr văzut,
 * până la plafonul explicit `MAX_RANDURI_EXPORT`; peste el, `trunchiat` spune
 * că lista e tăiată, în loc s-o arate scurtată. Rândurile vin crescător pe
 * `numar`; cine grupează le reordonează.
 */
export async function listeazaRegistruComplet(
  organizationId: string,
  filtre: FiltreRegistru,
): Promise<Readonly<{ randuri: readonly RandRegistru[]; trunchiat: boolean }>> {
  const db = await createServerSupabase();
  const randuri: RandRegistru[] = [];
  let dupaNumarul: number | null = null;
  let paginaPlina = false;
  for (;;) {
    let cerere = aplicaFiltre(
      db.from("registru_documente").select(COLOANE),
      organizationId,
      filtre,
    );
    if (dupaNumarul !== null) cerere = cerere.gt("numar", dupaNumarul);
    const { data, error } = await cerere
      .order("numar", { ascending: true })
      .limit(1000)
      .returns<RandBrut[]>();
    if (error !== null) throw error;
    const pagina = data ?? [];
    for (const r of pagina) randuri.push(spreRand(r));
    const ultim = pagina.at(-1);
    paginaPlina = pagina.length >= 1000;
    if (!paginaPlina || ultim === undefined || randuri.length >= MAX_RANDURI_EXPORT) break;
    dupaNumarul = ultim.numar;
  }
  return { randuri, trunchiat: paginaPlina && randuri.length >= MAX_RANDURI_EXPORT };
}

/* ------------------------------- sumarul -------------------------------- */

export type SumarAn = Readonly<{
  total: number;
  peSens: Readonly<Record<SensRegistru, number>>;
  anulate: number;
  /** Neanulate și nerezolvate — art. 9, „modul rezolvării" încă gol. */
  inLucru: number;
  rezolvate: number;
  /** Tipurile prezente în an, pentru filtru. */
  tipuri: readonly string[];
  /** Indicativele prezente în an, pentru filtru. */
  dosare: readonly string[];
  /** Câte documente are fiecare dosar — contorul din nomenclator. */
  peDosar: Readonly<Record<string, number>>;
}>;

type RandSumar = {
  readonly numar: number;
  readonly sens: SensRegistru;
  readonly tip_document: string;
  readonly indicativ_dosar: string | null;
  readonly anulat_la: string | null;
  readonly rezolvat_la: string | null;
};

/**
 * Cifrele anului, dintr-o singură citire în buclă de 1000 (capcana #2):
 * banda de cifre, tipurile și dosarele pentru filtre, contorul per dosar din
 * nomenclator. La volumele reale — sute pe an — e o singură cerere; agregarea
 * în TypeScript scutește patru numărători `head` și o funcție SQL.
 */
export async function citesteSumarAn(organizationId: string, an: number): Promise<SumarAn> {
  const db = await createServerSupabase();
  const peSens: Record<SensRegistru, number> = { intrare: 0, iesire: 0, intern: 0 };
  const tipuri = new Set<string>();
  const peDosar: Record<string, number> = {};
  let total = 0;
  let anulate = 0;
  let inLucru = 0;
  let rezolvate = 0;

  let dupaNumarul: number | null = null;
  for (;;) {
    let cerere = db
      .from("registru_documente")
      .select("numar, sens, tip_document, indicativ_dosar, anulat_la, rezolvat_la")
      .eq("organization_id", organizationId)
      .eq("an", an);
    if (dupaNumarul !== null) cerere = cerere.gt("numar", dupaNumarul);
    const { data, error } = await cerere
      .order("numar", { ascending: true })
      .limit(1000)
      .returns<RandSumar[]>();
    if (error !== null) throw error;
    const pagina = data ?? [];
    for (const r of pagina) {
      total += 1;
      peSens[r.sens] += 1;
      tipuri.add(r.tip_document);
      if (r.indicativ_dosar !== null) {
        peDosar[r.indicativ_dosar] = (peDosar[r.indicativ_dosar] ?? 0) + 1;
      }
      if (r.anulat_la !== null) anulate += 1;
      else if (r.rezolvat_la !== null) rezolvate += 1;
      else inLucru += 1;
    }
    const ultim = pagina.at(-1);
    if (pagina.length < 1000 || ultim === undefined) break;
    dupaNumarul = ultim.numar;
  }

  return {
    total,
    peSens,
    anulate,
    inLucru,
    rezolvate,
    tipuri: [...tipuri].sort((a, b) => a.localeCompare(b)),
    dosare: Object.keys(peDosar).sort((a, b) => a.localeCompare(b)),
    peDosar,
  };
}

/* ------------------------------- exercițiul ------------------------------ */

/** Exercițiul unui an. `null` = firma n-a deschis încă un rând pentru anul ăsta. */
export async function citesteExercitiu(
  organizationId: string,
  an: number,
): Promise<Exercitiu | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("registru_exercitii")
    .select(
      "an, stare, numar_de_pornire, inchis_la, total_inregistrari, amprenta, redeschis_la, motiv_redeschidere",
    )
    .eq("organization_id", organizationId)
    .eq("an", an)
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) return null;

  return {
    an: data.an,
    stare: data.stare,
    numarDePornire: data.numar_de_pornire,
    inchisLa: data.inchis_la,
    totalInregistrari: data.total_inregistrari,
    amprenta: data.amprenta,
    redeschisLa: data.redeschis_la,
    motivRedeschidere: data.motiv_redeschidere,
  };
}

/**
 * Anii care au măcar o înregistrare, plus anul curent.
 *
 * Anul curent se adaugă mereu, chiar gol: altfel o firmă care tocmai a pornit
 * ar deschide pagina și n-ar găsi niciun an de ales, adică un ecran care pare
 * stricat în loc de un registru care încă n-a primit nimic.
 */
export async function listeazaAni(organizationId: string): Promise<readonly number[]> {
  const db = await createServerSupabase();
  const ani = new Set<number>([anulCurent()]);
  // Pagini de 1000 (max_rows, capcana #2), cu SALT peste anul deja văzut: un rând
  // per document, deci o firmă cu peste 1000 de înregistrări în anul curent nu
  // mai vedea deloc anii vechi în selector.
  let subAnul: number | null = null;
  for (;;) {
    let cerere = db.from("registru_documente").select("an").eq("organization_id", organizationId);
    if (subAnul !== null) cerere = cerere.lt("an", subAnul);
    const { data, error } = await cerere
      .order("an", { ascending: false })
      .limit(1000)
      .returns<{ readonly an: number }[]>();
    if (error !== null) throw error;
    const pagina = data ?? [];
    for (const r of pagina) ani.add(r.an);
    const ultim = pagina.at(-1);
    if (pagina.length < 1000 || ultim === undefined) break;
    subAnul = ultim.an;
  }
  return [...ani].sort((a, b) => b - a);
}

/* ------------------------------- detaliul -------------------------------- */

export type DocumentRegistru = RandRegistru &
  Readonly<{
    punctLucruId: string | null;
    createdAt: string;
  }>;

export type DocumentConexat = Readonly<{
  id: string;
  numarAfisat: string;
  tipDocument: string;
  continutRezumat: string;
}>;

/** Tot ce arată panoul unui rând: rândul, cine și ce se leagă de el. */
export type DetaliuDocument = Readonly<{
  document: DocumentRegistru;
  angajat: Readonly<{ id: string; nume: string }> | null;
  dosar: Readonly<{ indicativ: string; continut: string; termenPastrare: string }> | null;
  /** Art. 9: documentul la care e conexat acesta. */
  conexatLa: Readonly<{ id: string; numarAfisat: string }> | null;
  /** Documentele conexate LA acesta. */
  conexate: readonly DocumentConexat[];
  /**
   * Rândul-părinte, pentru tipurile al căror ecran e al părintelui (documentul
   * vehiculului → fișa vehiculului). `null` = tipul n-are părinte sau RLS îl ascunde.
   */
  parinteId: string | null;
}>;

type DetaliuBrut = RandBrut & {
  readonly punct_lucru_id: string | null;
  readonly created_at: string;
  readonly angajat: { readonly full_name: string } | null;
};

type Client = Awaited<ReturnType<typeof createServerSupabase>>;

// Embed LITERAL, cu numele cheii străine din 0184: `coloane.test.ts` verifică
// `employees.full_name`, iar PostgREST nu trebuie să ghicească relația.
const COLOANE_DETALIU =
  COLOANE +
  ", punct_lucru_id, created_at, angajat:employees!registru_documente_angajat_id_fkey(full_name)";

async function citesteDosarDupaIndicativ(
  db: Client,
  organizationId: string,
  indicativ: string,
): Promise<DetaliuDocument["dosar"]> {
  const { data, error } = await db
    .from("nomenclator_dosare")
    .select("indicativ, continut, termen_pastrare")
    .eq("organization_id", organizationId)
    .eq("indicativ", indicativ)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<{ indicativ: string; continut: string; termen_pastrare: string }>();
  if (error !== null) throw error;
  if (data === null) return null;
  return {
    indicativ: data.indicativ,
    continut: data.continut,
    termenPastrare: data.termen_pastrare,
  };
}

async function citesteNumarDocument(
  db: Client,
  organizationId: string,
  id: string,
): Promise<DetaliuDocument["conexatLa"]> {
  const { data, error } = await db
    .from("registru_documente")
    .select("id, numar_afisat")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle<{ id: string; numar_afisat: string }>();
  if (error !== null) throw error;
  if (data === null) return null;
  return { id: data.id, numarAfisat: data.numar_afisat };
}

/** Indexul `registru_conexat_idx` (0120) servește exact citirea asta. */
async function listeazaConexate(
  db: Client,
  organizationId: string,
  id: string,
): Promise<readonly DocumentConexat[]> {
  const { data, error } = await db
    .from("registru_documente")
    .select("id, numar_afisat, tip_document, continut_rezumat")
    .eq("organization_id", organizationId)
    .eq("conexat_la", id)
    .order("numar", { ascending: true })
    .limit(50)
    .returns<
      { id: string; numar_afisat: string; tip_document: string; continut_rezumat: string }[]
    >();
  if (error !== null) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    numarAfisat: c.numar_afisat,
    tipDocument: c.tip_document,
    continutRezumat: c.continut_rezumat,
  }));
}

/**
 * Părintele, DOAR pentru tipurile al căror ecran e al părintelui — lista e
 * `TIPURI_CU_PARINTE` din `registru/legaturi.ts`. Un `switch` cu selecturi
 * literale, nu `from(tabela).select(coloana)` dinamic: poarta `coloane.test.ts`
 * verifică doar literalele, iar o coloană de părinte redenumită ar cădea altfel
 * abia la execuție, cu 42703.
 */
async function citesteParinte(
  db: Client,
  organizationId: string,
  entitateTip: string,
  entitateId: string,
): Promise<string | null> {
  switch (entitateTip) {
    case "vehicle_documents": {
      const { data, error } = await db
        .from("vehicle_documents")
        .select("vehicle_id")
        .eq("organization_id", organizationId)
        .eq("id", entitateId)
        .maybeSingle();
      if (error !== null) throw error;
      return data?.vehicle_id ?? null;
    }
    case "fire_extinguisher_checks": {
      const { data, error } = await db
        .from("fire_extinguisher_checks")
        .select("extinguisher_id")
        .eq("organization_id", organizationId)
        .eq("id", entitateId)
        .maybeSingle();
      if (error !== null) throw error;
      return data?.extinguisher_id ?? null;
    }
    case "iscir_authorizations": {
      const { data, error } = await db
        .from("iscir_authorizations")
        .select("equipment_id")
        .eq("organization_id", organizationId)
        .eq("id", entitateId)
        .maybeSingle();
      if (error !== null) throw error;
      return data?.equipment_id ?? null;
    }
    case "inventory_allocations": {
      const { data, error } = await db
        .from("inventory_allocations")
        .select("item_id")
        .eq("organization_id", organizationId)
        .eq("id", entitateId)
        .maybeSingle();
      if (error !== null) throw error;
      return data?.item_id ?? null;
    }
    case "payroll_entries": {
      const { data, error } = await db
        .from("payroll_entries")
        .select("period_id")
        .eq("organization_id", organizationId)
        .eq("id", entitateId)
        .maybeSingle();
      if (error !== null) throw error;
      return data?.period_id ?? null;
    }
    case "per_diem_calculations": {
      const { data, error } = await db
        .from("per_diem_calculations")
        .select("business_trip_id")
        .eq("organization_id", organizationId)
        .eq("id", entitateId)
        .maybeSingle();
      if (error !== null) throw error;
      return data?.business_trip_id ?? null;
    }
    default:
      return null;
  }
}

/**
 * Un rând, cu tot ce arată panoul lui. `null` când id-ul nu e al firmei: RLS
 * întoarce gol, nu eroare, iar pagina spune „nu e vizibil", nu ignoră adresa.
 */
export async function citesteDocumentRegistru(
  organizationId: string,
  id: string,
): Promise<DetaliuDocument | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("registru_documente")
    .select(COLOANE_DETALIU)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle<DetaliuBrut>();
  if (error !== null) throw error;
  if (data === null) return null;

  // Patru citiri independente, în paralel: costul e rețea, nu bază.
  const [dosar, conexatLa, conexate, parinteId] = await Promise.all([
    data.indicativ_dosar === null
      ? null
      : citesteDosarDupaIndicativ(db, organizationId, data.indicativ_dosar),
    data.conexat_la === null ? null : citesteNumarDocument(db, organizationId, data.conexat_la),
    listeazaConexate(db, organizationId, id),
    data.entitate_id === null
      ? null
      : citesteParinte(db, organizationId, data.entitate_tip, data.entitate_id),
  ]);

  return {
    document: { ...spreRand(data), punctLucruId: data.punct_lucru_id, createdAt: data.created_at },
    angajat:
      data.angajat_id !== null && data.angajat !== null
        ? { id: data.angajat_id, nume: data.angajat.full_name }
        : null,
    dosar,
    conexatLa,
    conexate,
    parinteId,
  };
}
