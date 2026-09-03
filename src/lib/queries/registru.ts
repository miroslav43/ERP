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
// `registru_org_an_numar_uniq`), deci cursorul keyset are o singură coloană
// strict monotonă și nu poate nici sări, nici repeta un rând.
//
// ── DE CE NU `.range()` ─────────────────────────────────────────────────────
// Regula proiectului. În plus, aici `max_rows = 1000` ar trunchia TĂCUT: un
// registru de 3000 de rânduri ar arăta complet și n-ar fi — exact felul de
// defect pe care restul stratului îl vânează.

import { z } from "zod";

import { createServerSupabase } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export const LIMITA_IMPLICITA = 50;
export const LIMITA_MAXIMA = 200;

/** Câte rânduri poate lua un export dintr-o singură bucată. */
export const MAX_RANDURI_EXPORT = 5000;

export type SensRegistru = Enums<"registru_sens">;
export type StareExercitiu = Enums<"registru_stare_exercitiu">;

export type FiltreRegistru = Readonly<{
  an: number;
  sens: SensRegistru | null;
  tipDocument: string | null;
  deLa: string | null;
  panaLa: string | null;
  cautare: string | null;
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
  entitateTip: string;
  entitateId: string | null;
  inregistratRetroactiv: boolean;
  anulatLa: string | null;
  motivAnulare: string | null;
}>;

export type PaginaRegistru = Readonly<{
  randuri: readonly RandRegistru[];
  cursorUrmator: string | null;
  total: number;
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
  readonly entitate_tip: string;
  readonly entitate_id: string | null;
  readonly inregistrat_retroactiv: boolean;
  readonly anulat_la: string | null;
  readonly motiv_anulare: string | null;
};

const COLOANE =
  "id, numar, numar_afisat, data_inregistrare, sens, tip_document, continut_rezumat, " +
  "numar_document_emitent, data_document_emitent, emitent, destinatar, compartiment, " +
  "data_expedierii, mod_rezolvare, numar_file, numar_anexe, conexat_la, entitate_tip, " +
  "entitate_id, inregistrat_retroactiv, anulat_la, motiv_anulare";

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
  entitateTip: b.entitate_tip,
  entitateId: b.entitate_id,
  inregistratRetroactiv: b.inregistrat_retroactiv,
  anulatLa: b.anulat_la,
  motivAnulare: b.motiv_anulare,
});

/* --------------------------------- filtre -------------------------------- */

const SENSURI = ["intrare", "iesire", "intern"] as const satisfies readonly SensRegistru[];

/** Anul în fusul operațional — același pe care îl folosește `app.azi_local()` în bază. */
export const anulCurent = (): number =>
  Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Bucharest",
      year: "numeric",
    }).format(new Date()),
  );

const ZI = /^\d{4}-\d{2}-\d{2}$/;

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
    cursor: primaValoare(brute.cursor),
    limita: primaValoare(brute.limita) ?? LIMITA_IMPLICITA,
  });

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
  for (const [cheie, valoare] of Object.entries(suplimentar)) adauga(cheie, valoare);
  return p.toString();
};

/** Cheie stabilă pentru `<Suspense>`, ca lista să reintre în starea de încărcare. */
export const cheieFiltre = (filtre: FiltreRegistru): string =>
  `${serializeazaFiltre(filtre)}|${filtre.cursor ?? ""}`;

/* --------------------------------- cursor -------------------------------- */
//
// O SINGURĂ coloană, fără departajator, spre deosebire de restul citirilor din
// proiect: cu anul fixat, `numar` e unic prin index, deci nu există valori egale
// între care ordinea să fie nedefinită.

export const codificaCursor = (numar: number): string =>
  Buffer.from(String(numar), "utf8").toString("base64url");

export const decodificaCursor = (brut: string | null): number | null => {
  if (brut === null) return null;
  try {
    const text = Buffer.from(brut, "base64url").toString("utf8");
    if (!/^\d{1,9}$/.test(text)) return null;
    return Number(text);
  } catch {
    return null;
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

  /**
   * Filtrele mulțimii, aplicate identic pe amândouă interogările.
   *
   * Generic peste constructorul de interogare, ca în `employees.ts`, nu scris de
   * două ori: două copii ar diverge la primul filtru adăugat, iar divergența s-ar
   * vedea tocmai ca o numărătoare care nu se potrivește cu lista.
   */
  const filtreaza = <
    Q extends {
      eq: (c: string, v: string | number) => Q;
      gte: (c: string, v: string) => Q;
      lte: (c: string, v: string) => Q;
      or: (f: string) => Q;
    },
  >(
    q: Q,
  ): Q => {
    let cu = q.eq("organization_id", organizationId).eq("an", filtre.an);
    if (filtre.sens !== null) cu = cu.eq("sens", filtre.sens);
    if (filtre.tipDocument !== null) cu = cu.eq("tip_document", filtre.tipDocument);
    if (filtre.deLa !== null) cu = cu.gte("data_inregistrare", filtre.deLa);
    if (filtre.panaLa !== null) cu = cu.lte("data_inregistrare", filtre.panaLa);
    if (filtre.cautare !== null) {
      // `%`, `,` și parantezele ar rupe sintaxa `or=(...)` a PostgREST; sunt
      // scoase, nu evadate — o căutare e text liber, nu o expresie.
      const t = filtre.cautare.replace(/[%,()*]/g, " ").trim();
      if (t.length > 0) {
        cu = cu.or(
          `continut_rezumat.ilike.*${t}*,numar_afisat.ilike.*${t}*,` +
            `numar_document_emitent.ilike.*${t}*,destinatar.ilike.*${t}*`,
        );
      }
    }
    return cu;
  };

  const dupa = decodificaCursor(filtre.cursor);

  let interogare = filtreaza(db.from("registru_documente").select(COLOANE))
    .order("numar", { ascending: false })
    .limit(filtre.limita + 1);
  if (dupa !== null) interogare = interogare.lt("numar", dupa);

  const [pagina, numarare] = await Promise.all([
    interogare.returns<RandBrut[]>(),
    filtreaza(db.from("registru_documente").select("id", { count: "exact", head: true })),
  ]);

  if (pagina.error !== null) throw pagina.error;
  if (numarare.error !== null) throw numarare.error;

  const brute = pagina.data ?? [];
  const areUrmatoarea = brute.length > filtre.limita;
  const vizibile = areUrmatoarea ? brute.slice(0, filtre.limita) : brute;
  const ultimul = vizibile.at(-1);

  return {
    randuri: vizibile.map(spreRand),
    cursorUrmator: areUrmatoarea && ultimul !== undefined ? codificaCursor(ultimul.numar) : null,
    total: numarare.count ?? 0,
  };
}

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
  const { data, error } = await db
    .from("registru_documente")
    .select("an")
    .eq("organization_id", organizationId)
    .order("an", { ascending: false })
    .limit(1000)
    .returns<{ readonly an: number }[]>();

  if (error !== null) throw error;

  const ani = new Set<number>((data ?? []).map((r) => r.an));
  ani.add(anulCurent());
  return [...ani].sort((a, b) => b - a);
}

/** Tipurile de document prezente într-un an — pentru lista de filtrare. */
export async function listeazaTipuriDocument(
  organizationId: string,
  an: number,
): Promise<readonly string[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("registru_documente")
    .select("tip_document")
    .eq("organization_id", organizationId)
    .eq("an", an)
    .limit(1000)
    .returns<{ readonly tip_document: string }[]>();

  if (error !== null) throw error;
  return [...new Set((data ?? []).map((r) => r.tip_document))].sort((a, b) => a.localeCompare(b));
}
