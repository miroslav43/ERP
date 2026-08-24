// src/lib/queries/evaluari.ts

/**
 * Citirile modulului de evaluări.
 *
 * Până acum nu exista: `sabloane/page.tsx` interoga Supabase direct, cu tipuri
 * declarate local în fișierul de pagină, fără paginare și fără cursor. Nu era
 * o scurtătură inofensivă — `max_rows` din PostgREST taie TĂCUT la 1000 de
 * rânduri, deci lista ar fi început să mintă fără niciun semn.
 *
 * ── PUNCTAJUL SE CALCULEAZĂ AICI, NU ÎN PAGINĂ ────────────────────────────
 * Fiecare rând poartă instantaneul criteriilor (`criterii_sablon`) și
 * răspunsurile. Punctajul se derivă din ele prin `calculeazaScor`, funcția pură
 * din `src/domain/evaluations/`, ca ecranul de listă, fișa angajatului și banda
 * de indicatori să nu poată ajunge la trei cifre diferite pentru aceeași
 * evaluare.
 */

import "server-only";

import { normalizeazaCriterii, type CriteriuSablon } from "@/domain/evaluations/criterii";
import {
  calculeazaScor,
  mediaProcentelor,
  type Punctaj,
  type RaspunsCriteriu,
} from "@/domain/evaluations/scor";
import { createServerSupabase } from "@/lib/supabase/server";
import type { StatusEvaluare } from "@/schemas/evaluation";

import {
  codificaCursor as codificaKeyset,
  decodificaCursor as decodificaKeyset,
  predicatKeyset,
  sortareCeruta,
  type Directie,
} from "./cursor";

export const SORTARI_EVALUARI = ["data", "angajat", "status"] as const;
export type SortareEvaluari = (typeof SORTARI_EVALUARI)[number];

const COLOANA_SORTARE: Readonly<Record<SortareEvaluari, string>> = {
  data: "data_evaluarii",
  angajat: "employee_id",
  status: "status",
};

const SORTARE_IMPLICITA = { cheie: "data" as SortareEvaluari, directie: "desc" as Directie };

export interface FiltreEvaluari {
  readonly status: StatusEvaluare | null;
  readonly template_id: string | null;
  readonly de_la: string | null;
  readonly pana_la: string | null;
  readonly sort: string | null;
  readonly cursor: string | null;
  readonly limita: number;
}

export const FILTRE_EVALUARI_GOALE: FiltreEvaluari = {
  status: null,
  template_id: null,
  de_la: null,
  pana_la: null,
  sort: null,
  cursor: null,
  limita: 25,
};

/**
 * Embed-ul angajatului.
 *
 * Poate întoarce NULL chiar când `employee_id` e completat: politica de SELECT
 * de pe `employees` se aplică și în interiorul embed-ului, iar un rol care vede
 * evaluarea nu vede neapărat fișa. Ecranele tratează cazul explicit, nu prin
 * `!`.
 */
const EMBED_ANGAJAT = "employee:employees!employee_id(id, full_name, marca)";
const EMBED_SABLON = "template:evaluation_templates!template_id(id, denumire)";

interface RandBrut {
  readonly id: string;
  readonly employee_id: string;
  readonly data_evaluarii: string;
  readonly status: StatusEvaluare;
  readonly concluzie: string | null;
  readonly criterii_sablon: unknown;
  readonly raspunsuri: unknown;
  readonly versiune_sablon: number | null;
  readonly employee: Readonly<{ id: string; full_name: string; marca: string | null }> | null;
  readonly template: Readonly<{ id: string; denumire: string }> | null;
}

export interface RandEvaluare {
  readonly id: string;
  readonly employee_id: string;
  readonly angajat: string | null;
  readonly marca: string | null;
  readonly sablon: string | null;
  readonly data_evaluarii: string;
  readonly status: StatusEvaluare;
  readonly punctaj: Punctaj;
  readonly nrCriterii: number;
}

export interface RezultatEvaluari {
  readonly randuri: readonly RandEvaluare[];
  readonly urmatorulCursor: string | null;
  readonly total: number;
  readonly sortare: Readonly<{ cheie: SortareEvaluari; directie: Directie }>;
}

/** Răspunsurile din jsonb, curățate defensiv. Nu aruncă niciodată. */
function citesteRaspunsuri(valoare: unknown): readonly RaspunsCriteriu[] {
  if (!Array.isArray(valoare)) return [];
  const iesire: RaspunsCriteriu[] = [];
  for (const brut of valoare) {
    if (typeof brut !== "object" || brut === null || Array.isArray(brut)) continue;
    const r = brut as Record<string, unknown>;
    if (typeof r.criteriu_cod !== "string" || r.criteriu_cod === "") continue;
    iesire.push({
      criteriu_cod: r.criteriu_cod,
      scor: typeof r.scor === "number" && Number.isFinite(r.scor) ? r.scor : null,
      raspuns_text: typeof r.raspuns_text === "string" ? r.raspuns_text : null,
      comentariu: typeof r.comentariu === "string" ? r.comentariu : null,
    });
  }
  return iesire;
}

export async function listeazaEvaluari(
  organizationId: string,
  filtre: FiltreEvaluari,
): Promise<RezultatEvaluari> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(filtre.sort, SORTARI_EVALUARI, SORTARE_IMPLICITA);
  const coloana = COLOANA_SORTARE[sortare.cheie];
  const crescator = sortare.directie === "asc";

  // Aceleași filtre pe amândouă interogările, aplicate de aceeași funcție.
  // Numărătoarea NU poate sta pe interogarea paginată: predicatul keyset e și
  // el un filtru, deci `count` ar număra doar ce a rămas după cursor, iar
  // totalul ar scădea cu fiecare „mai departe".
  const filtreaza = <
    Q extends {
      eq: (c: string, v: string) => Q;
      is: (c: string, v: null) => Q;
      gte: (c: string, v: string) => Q;
      lte: (c: string, v: string) => Q;
    },
  >(
    q: Q,
  ): Q => {
    let cu = q.eq("organization_id", organizationId).is("deleted_at", null);
    if (filtre.status !== null) cu = cu.eq("status", filtre.status);
    if (filtre.template_id !== null) cu = cu.eq("template_id", filtre.template_id);
    if (filtre.de_la !== null) cu = cu.gte("data_evaluarii", filtre.de_la);
    if (filtre.pana_la !== null) cu = cu.lte("data_evaluarii", filtre.pana_la);
    return cu;
  };

  let interogare = filtreaza(
    db.from("employee_evaluations").select(
      `id, employee_id, data_evaluarii, status, concluzie, criterii_sablon, raspunsuri,
         versiune_sablon, ${EMBED_ANGAJAT}, ${EMBED_SABLON}`,
    ),
  )
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  const cursor = filtre.cursor === null ? null : decodificaKeyset(filtre.cursor);
  if (cursor !== null) {
    interogare = interogare.or(predicatKeyset(coloana, cursor, sortare.directie));
  }

  const [rezultat, numarare] = await Promise.all([
    interogare.returns<RandBrut[]>(),
    filtreaza(db.from("employee_evaluations").select("id", { count: "exact", head: true })),
  ]);
  if (rezultat.error !== null) throw rezultat.error;
  if (numarare.error !== null) throw numarare.error;

  const toate = rezultat.data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const brute = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;

  const randuri: readonly RandEvaluare[] = brute.map((b) => {
    const criterii = normalizeazaCriterii(b.criterii_sablon);
    return {
      id: b.id,
      employee_id: b.employee_id,
      angajat: b.employee?.full_name ?? null,
      marca: b.employee?.marca ?? null,
      sablon: b.template?.denumire ?? null,
      data_evaluarii: b.data_evaluarii,
      status: b.status,
      punctaj: calculeazaScor(criterii, citesteRaspunsuri(b.raspunsuri)),
      nrCriterii: criterii.length,
    };
  });

  const ultimul = brute.at(-1);
  const valoareCursor =
    ultimul === undefined
      ? null
      : sortare.cheie === "data"
        ? ultimul.data_evaluarii
        : sortare.cheie === "angajat"
          ? ultimul.employee_id
          : ultimul.status;

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultimul !== undefined && valoareCursor !== null
        ? codificaKeyset({ valoare: valoareCursor, id: ultimul.id })
        : null,
    total: numarare.count ?? randuri.length,
    sortare,
  };
}

// ── Un singur rând, pentru editare ────────────────────────────────────────────

export interface EvaluareDetaliu {
  readonly id: string;
  readonly employee_id: string;
  readonly angajat: string | null;
  readonly template_id: string;
  readonly sablon: string | null;
  readonly versiune_sablon: number | null;
  readonly data_evaluarii: string;
  readonly status: StatusEvaluare;
  readonly concluzie: string | null;
  readonly criterii: readonly CriteriuSablon[];
  readonly raspunsuri: readonly RaspunsCriteriu[];
  readonly punctaj: Punctaj;
}

export async function citesteEvaluare(
  organizationId: string,
  id: string,
): Promise<EvaluareDetaliu | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employee_evaluations")
    .select(
      `id, employee_id, template_id, data_evaluarii, status, concluzie, criterii_sablon,
       raspunsuri, versiune_sablon, ${EMBED_ANGAJAT}, ${EMBED_SABLON}`,
    )
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<RandBrut & { template_id: string }>();
  if (error !== null) throw error;
  if (data === null) return null;

  const criterii = normalizeazaCriterii(data.criterii_sablon);
  const raspunsuri = citesteRaspunsuri(data.raspunsuri);
  return {
    id: data.id,
    employee_id: data.employee_id,
    angajat: data.employee?.full_name ?? null,
    template_id: data.template_id,
    sablon: data.template?.denumire ?? null,
    versiune_sablon: data.versiune_sablon,
    data_evaluarii: data.data_evaluarii,
    status: data.status,
    concluzie: data.concluzie,
    criterii,
    raspunsuri,
    punctaj: calculeazaScor(criterii, raspunsuri),
  };
}

// ── Șabloane ──────────────────────────────────────────────────────────────────

export interface RandSablon {
  readonly id: string;
  readonly denumire: string;
  readonly descriere: string | null;
  readonly criterii: readonly CriteriuSablon[];
  readonly versiune: number;
  readonly activ: boolean;
  /** `true` când e șablon de platformă: vizibil tuturor, editabil de nimeni. */
  readonly dePlatforma: boolean;
  /** Câte evaluări îl folosesc. Zero înseamnă că se poate schimba liber. */
  readonly nrEvaluari: number;
}

/**
 * Șabloanele vizibile firmei: ale ei plus cele de platformă.
 *
 * ── DE CE DOUĂ INTEROGĂRI ȘI NU UN `.or()` ────────────────────────────────
 * Versiunea anterioară scria `.or(\`organization_id.eq.${id},organization_id.is.null\`)`,
 * adică interpola un identificator direct în gramatica de filtre PostgREST.
 * Valoarea vine de la server, deci nu e o breșă azi, dar sintaxa `or` are
 * separatori proprii (virgulă, paranteze) și nicio funcție de ghilimelare pe
 * acest drum. Două interogări cu `eq` și `is` nu au gramatică de scăpat.
 *
 * ── DE CE NUMĂRĂTOAREA DE EVALUĂRI E SEPARATĂ ─────────────────────────────
 * Un embed agregat (`evaluations(count)`) ar fi trecut prin RLS-ul evaluărilor,
 * deci un manager ar fi văzut „folosit în 2 evaluări" acolo unde firma are 40 —
 * și ar fi editat un șablon crezând că nu atinge pe nimeni. Numărătoarea se
 * face o singură dată, pe toate evaluările vizibile, și se grupează în TypeScript.
 */
export async function listeazaSabloane(
  organizationId: string,
  optiuni: Readonly<{ includeArhivate: boolean }> = { includeArhivate: true },
): Promise<readonly RandSablon[]> {
  const db = await createServerSupabase();
  const coloane = "id, denumire, descriere, criterii, versiune, activ, organization_id";

  interface SablonBrut {
    readonly id: string;
    readonly denumire: string;
    readonly descriere: string | null;
    readonly criterii: unknown;
    readonly versiune: number;
    readonly activ: boolean;
    readonly organization_id: string | null;
  }

  const [aleFirmei, alePlatformei, folosire] = await Promise.all([
    db
      .from("evaluation_templates")
      .select(coloane)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("denumire")
      .returns<SablonBrut[]>(),
    db
      .from("evaluation_templates")
      .select(coloane)
      .is("organization_id", null)
      .is("deleted_at", null)
      .order("denumire")
      .returns<SablonBrut[]>(),
    db
      .from("employee_evaluations")
      .select("template_id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .returns<{ template_id: string }[]>(),
  ]);
  if (aleFirmei.error !== null) throw aleFirmei.error;
  if (alePlatformei.error !== null) throw alePlatformei.error;
  if (folosire.error !== null) throw folosire.error;

  const peSablon = new Map<string, number>();
  for (const e of folosire.data ?? []) {
    peSablon.set(e.template_id, (peSablon.get(e.template_id) ?? 0) + 1);
  }

  // Șabloanele de platformă la urmă: ale firmei sunt cele pe care omul le
  // folosește zilnic, iar cel generic e punctul de plecare, nu destinația.
  const brute = [...(aleFirmei.data ?? []), ...(alePlatformei.data ?? [])];
  return brute
    .filter((s) => optiuni.includeArhivate || s.activ)
    .map((s) => ({
      id: s.id,
      denumire: s.denumire,
      descriere: s.descriere,
      criterii: normalizeazaCriterii(s.criterii),
      versiune: s.versiune,
      activ: s.activ,
      dePlatforma: s.organization_id === null,
      nrEvaluari: peSablon.get(s.id) ?? 0,
    }));
}

// ── Indicatori ────────────────────────────────────────────────────────────────

export interface IndicatoriEvaluari {
  readonly total: number;
  readonly ciorne: number;
  readonly finalizateAnulAcesta: number;
  readonly angajatiEvaluati: number;
  readonly angajatiActivi: number;
  readonly mediaProcent: number | null;
  /** Media s-a calculat pe un eșantion, nu pe toate evaluările finalizate. */
  readonly esantionTrunchiat: boolean;
}

/**
 * Cifrele din capul paginii.
 *
 * ── DE CE CONTOARELE SUNT `count`, IAR MEDIA E PE UN EȘANTION ─────────────
 * Prima variantă citea toate evaluările firmei și număra în TypeScript. Ar fi
 * mers azi (cea mai mare firmă reală are 8 angajați), dar `max_rows` din
 * PostgREST taie la 1000 de rânduri TĂCUT: peste prag, „total: 1000" ar fi
 * arătat perfect plauzibil și ar fi fost fals pentru totdeauna.
 *
 * Contoarele se cer deci ca `count` cu `head: true` — exacte, indiferent de
 * volum, fără să aducă niciun rând. Media are nevoie de conținut, deci se
 * calculează pe cele mai recente `ESANTION_MEDIE` evaluări finalizate, iar
 * ecranul spune asta atunci când eșantionul e mai mic decât mulțimea. O medie
 * pe un eșantion declarat e onestă; una pe primele 1000 de rânduri întoarse
 * întâmplător nu e.
 */
const ESANTION_MEDIE = 200;

export async function indicatoriEvaluari(
  organizationId: string,
  anul: number,
): Promise<IndicatoriEvaluari> {
  const db = await createServerSupabase();
  const baza = () =>
    db
      .from("employee_evaluations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

  const [total, ciorne, anulAcesta, finalizate, angajati] = await Promise.all([
    baza(),
    baza().eq("status", "draft"),
    baza()
      .eq("status", "finalizat")
      .gte("data_evaluarii", `${String(anul)}-01-01`)
      .lte("data_evaluarii", `${String(anul)}-12-31`),
    db
      .from("employee_evaluations")
      .select("employee_id, criterii_sablon, raspunsuri")
      .eq("organization_id", organizationId)
      .eq("status", "finalizat")
      .is("deleted_at", null)
      .order("data_evaluarii", { ascending: false })
      .order("id", { ascending: false })
      .limit(ESANTION_MEDIE)
      .returns<{ employee_id: string; criterii_sablon: unknown; raspunsuri: unknown }[]>(),
    db
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "activ")
      .is("deleted_at", null),
  ]);
  for (const r of [total, ciorne, anulAcesta, finalizate, angajati]) {
    if (r.error !== null) throw r.error;
  }

  const esantion = finalizate.data ?? [];
  return {
    total: total.count ?? 0,
    ciorne: ciorne.count ?? 0,
    finalizateAnulAcesta: anulAcesta.count ?? 0,
    angajatiEvaluati: new Set(esantion.map((e) => e.employee_id)).size,
    angajatiActivi: angajati.count ?? 0,
    mediaProcent: mediaProcentelor(
      esantion.map(
        (e) =>
          calculeazaScor(normalizeazaCriterii(e.criterii_sablon), citesteRaspunsuri(e.raspunsuri))
            .procent,
      ),
    ),
    esantionTrunchiat: esantion.length === ESANTION_MEDIE,
  };
}
