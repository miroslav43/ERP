// src/lib/queries/audit.ts
import { z } from "zod";

import type { ServerSupabase } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

/**
 * PAGINARE KEYSET (nu OFFSET).
 *
 * `audit_logs` este append-only și crește la sute de mii de rânduri pe an. Cu
 * `OFFSET 50000` PostgreSQL citește și aruncă 50.000 de rânduri înainte să
 * întoarcă primul rând util: costul crește liniar cu numărul paginii, iar
 * inserările concurente mută rândurile între pagini (evenimente sărite sau
 * duplicate).
 *
 * Keyset-ul folosește chiar ordinea de sortare drept cursor. Sortăm mereu
 * descrescător după (created_at, id) — `id` este departajatorul, pentru că mai
 * multe evenimente pot avea aceeași milisecundă. Pagina următoare cere:
 *
 *   created_at < :moment  OR  (created_at = :moment AND id < :id)
 *
 * ceea ce un index pe (created_at DESC, id DESC) rezolvă printr-un simplu salt
 * în index: cost constant, indiferent cât de departe ai ajuns.
 *
 * Cursorul este perechea (created_at, id) a ultimului rând afișat, codificată
 * base64url. La decodificare este VALIDATĂ strict (regex pe moment și pe UUID),
 * pentru că valoarea ajunge într-un filtru textual PostgREST `or(...)` — fără
 * validare, un cursor fabricat ar putea injecta operatori suplimentari.
 */

const REGEX_ZI = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGEX_MOMENT = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}:?\d{2}|Z)?$/;

const FUS = "Europe/Bucharest";
const COLOANE =
  "id, created_at, organization_id, actor_id, action, status, entity_type, entity_id, before, after, ip, user_agent, request_id, error_code";

export const LIMITA_IMPLICITA = 50;
export const LIMITA_MAXIMA = 200;
export const MAX_RANDURI_EXPORT = 5000;
const PAGINA_EXPORT = 500;

export type FiltreAudit = Readonly<{
  organizationId: string | null;
  deLa: string | null;
  panaLa: string | null;
  actor: string | null;
  actiune: string | null;
  status: string | null;
  entitate: string | null;
  entityId: string | null;
  cursor: string | null;
  limita: number;
}>;

export type RandJurnal = Readonly<{
  id: string;
  createdAt: string;
  organizationId: string | null;
  organizationName: string | null;
  actorId: string | null;
  actorNume: string | null;
  actorEmail: string | null;
  action: string;
  status: string;
  entityType: string | null;
  entityId: string | null;
  requestId: string | null;
  errorCode: string | null;
  ip: string | null;
  userAgent: string | null;
  before: unknown;
  after: unknown;
}>;

export type RezultatJurnal =
  | Readonly<{ ok: true; randuri: readonly RandJurnal[]; cursorUrmator: string | null }>
  | Readonly<{ ok: false; mesaj: string }>;

export type OptiuneOrganizatie = Readonly<{ id: string; name: string }>;

const MESAJ_EROARE = "Nu am putut încărca jurnalul de audit. Încearcă din nou.";

/* ------------------------------- filtre --------------------------------- */

/**
 * Oglinda enum-urilor `audit_action` și `audit_status` din baza de date.
 * Filtrele vin din URL, deci sunt simple șiruri; înainte să ajungă într-un
 * `.eq(...)` (care cere chiar valoarea enum-ului) le verificăm cu o gardă de
 * tip. Dacă enum-ul din baza de date se schimbă, `satisfies` semnalează aici.
 */
type ActiuneAudit = Enums<"audit_action">;
type StatusAudit = Enums<"audit_status">;

const ACTIUNI_AUDIT = [
  "create",
  "update",
  "delete",
  "restore",
  "view",
  "export",
  "import",
  "login",
  "logout",
  "login_failed",
  "password_reset",
  "invite_sent",
  "invite_accepted",
  "invite_revoked",
  "member_added",
  "member_removed",
  "role_changed",
  "permission_changed",
  "feature_toggled",
  "org_created",
  "org_activated",
  "org_suspended",
  "tenant_switch",
  "tenant_forged",
  "rate_limited",
  "email_sent",
  "demo_requested",
  "impersonation_start",
  "impersonation_end",
] as const satisfies readonly ActiuneAudit[];

const STATUSURI_AUDIT = ["success", "failure", "denied"] as const satisfies readonly StatusAudit[];

const esteActiuneAudit = (valoare: string): valoare is ActiuneAudit =>
  ACTIUNI_AUDIT.some((actiune) => actiune === valoare);

const esteStatusAudit = (valoare: string): valoare is StatusAudit =>
  STATUSURI_AUDIT.some((status) => status === valoare);

const text = z.string().nullable().catch(null);
const zi = z.string().regex(REGEX_ZI).nullable().catch(null);
const uuid = z.string().regex(REGEX_UUID).nullable().catch(null);

const schemaFiltre = z.object({
  organizationId: uuid,
  deLa: zi,
  panaLa: zi,
  actor: text,
  actiune: z.enum(ACTIUNI_AUDIT).nullable().catch(null),
  status: z.enum(STATUSURI_AUDIT).nullable().catch(null),
  entitate: text,
  entityId: text,
  cursor: text,
  limita: z.coerce.number().int().min(1).max(LIMITA_MAXIMA).catch(LIMITA_IMPLICITA),
});

const primaValoare = (valoare: string | string[] | undefined): string | null => {
  const brut = Array.isArray(valoare) ? valoare[0] : valoare;
  if (typeof brut !== "string") return null;
  const curat = brut.trim();
  return curat === "" ? null : curat;
};

/** Validare la granița sistemului: parametrii din URL nu sunt niciodată de încredere. */
export const parseazaFiltre = (
  brute: Readonly<Record<string, string | string[] | undefined>>,
): FiltreAudit =>
  schemaFiltre.parse({
    organizationId: primaValoare(brute.org),
    deLa: primaValoare(brute.de_la),
    panaLa: primaValoare(brute.pana_la),
    actor: primaValoare(brute.actor),
    actiune: primaValoare(brute.actiune),
    status: primaValoare(brute.status),
    entitate: primaValoare(brute.entitate),
    entityId: primaValoare(brute.entity_id),
    cursor: primaValoare(brute.cursor),
    limita: primaValoare(brute.limita) ?? LIMITA_IMPLICITA,
  });

export const serializeazaFiltre = (
  filtre: FiltreAudit,
  suplimentar: Readonly<Record<string, string>> = {},
): string => {
  const parametri = new URLSearchParams();
  const adauga = (cheie: string, valoare: string | null): void => {
    if (valoare !== null && valoare !== "") parametri.set(cheie, valoare);
  };
  adauga("org", filtre.organizationId);
  adauga("de_la", filtre.deLa);
  adauga("pana_la", filtre.panaLa);
  adauga("actor", filtre.actor);
  adauga("actiune", filtre.actiune);
  adauga("status", filtre.status);
  adauga("entitate", filtre.entitate);
  adauga("entity_id", filtre.entityId);
  for (const [cheie, valoare] of Object.entries(suplimentar)) adauga(cheie, valoare);
  return parametri.toString();
};

/** Cheie stabilă pentru <Suspense>, ca lista să reintre în starea de încărcare. */
export const cheieFiltre = (filtre: FiltreAudit): string =>
  `${serializeazaFiltre(filtre)}|${filtre.cursor ?? ""}`;

/* ------------------------------- cursor --------------------------------- */

type Cursor = Readonly<{ moment: string; id: string }>;

const spreUrlSafe = (valoare: string): string =>
  valoare.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const dinUrlSafe = (valoare: string): string => valoare.replace(/-/g, "+").replace(/_/g, "/");

export const codificaCursor = (moment: string, id: string): string =>
  spreUrlSafe(btoa(`${moment}|${id}`));

export const decodificaCursor = (brut: string | null): Cursor | null => {
  if (brut === null) return null;
  try {
    const [moment, id] = atob(dinUrlSafe(brut)).split("|");
    if (moment === undefined || id === undefined) return null;
    if (!REGEX_MOMENT.test(moment) || !REGEX_UUID.test(id)) return null;
    return { moment, id };
  } catch {
    return null;
  }
};

/* -------------------------- interval de date ---------------------------- */

const decalajOrar = (zi: string): string => {
  const parti = new Intl.DateTimeFormat("en-US", {
    timeZone: FUS,
    timeZoneName: "longOffset",
  }).formatToParts(new Date(`${zi}T12:00:00Z`));
  const nume = parti.find((parte) => parte.type === "timeZoneName")?.value ?? "GMT+00:00";
  return /GMT([+-]\d{2}:\d{2})/.exec(nume)?.[1] ?? "+00:00";
};

const inceputZi = (zi: string): string => `${zi}T00:00:00${decalajOrar(zi)}`;

const ziUrmatoare = (zi: string): string =>
  new Date(new Date(`${zi}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);

/* ----------------------------- îmbogățire ------------------------------- */

const CHEI_NUME = ["full_name", "full_name", "display_name", "nume", "name"] as const;

const primulText = (
  brut: Readonly<Record<string, unknown>>,
  chei: readonly string[],
): string | null => {
  for (const cheie of chei) {
    const valoare = brut[cheie];
    if (typeof valoare === "string" && valoare.trim() !== "") return valoare.trim();
  }
  return null;
};

const numeleActorului = (brut: Readonly<Record<string, unknown>>): string | null => {
  const direct = primulText(brut, CHEI_NUME);
  if (direct !== null) return direct;
  const prenume = primulText(brut, ["prenume"]);
  const nume = primulText(brut, ["nume_familie"]);
  const compus = [prenume, nume]
    .filter((parte) => parte !== null)
    .join(" ")
    .trim();
  return compus === "" ? null : compus;
};

type Actor = Readonly<{ nume: string | null; email: string | null }>;

const incarcaActori = async (
  client: ServerSupabase,
  ids: readonly string[],
): Promise<ReadonlyMap<string, Actor>> => {
  if (ids.length === 0) return new Map();
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .in("id", [...ids]);
  if (error !== null || data === null) {
    console.error("[audit] nu am putut încărca profilurile actorilor", error);
    return new Map();
  }
  return new Map(
    data.map((rand) => {
      const brut = rand as unknown as Record<string, unknown>;
      const id = typeof brut.id === "string" ? brut.id : "";
      return [id, { nume: numeleActorului(brut), email: primulText(brut, ["email"]) }] as const;
    }),
  );
};

const incarcaOrganizatii = async (
  client: ServerSupabase,
  ids: readonly string[],
): Promise<ReadonlyMap<string, string>> => {
  if (ids.length === 0) return new Map();
  const { data, error } = await client
    .from("organizations")
    .select("id, name")
    .in("id", [...ids]);
  if (error !== null || data === null) {
    console.error("[audit] nu am putut încărca denumirile organizațiilor", error);
    return new Map();
  }
  return new Map(data.map((org) => [org.id, org.name] as const));
};

/** Lista pentru filtrul de organizație (doar panoul de super-admin). */
export const listeazaOrganizatiiPentruFiltru = async (
  client: ServerSupabase,
): Promise<readonly OptiuneOrganizatie[]> => {
  const { data, error } = await client
    .from("organizations")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(500);
  if (error !== null || data === null) {
    console.error("[audit] nu am putut încărca lista de organizații", error);
    return [];
  }
  return data.map((org) => ({ id: org.id, name: org.name }));
};

/** `null` = fără filtru pe actor; listă goală = niciun actor potrivit. */
const rezolvaActor = async (
  client: ServerSupabase,
  termen: string | null,
): Promise<readonly string[] | null> => {
  if (termen === null) return null;
  if (REGEX_UUID.test(termen)) return [termen];
  const { data, error } = await client
    .from("profiles")
    .select("id")
    .ilike("email", `%${termen}%`)
    .limit(50);
  if (error !== null || data === null) {
    console.error("[audit] nu am putut căuta actorul după e-mail", error);
    return [];
  }
  return data.map((profil) => profil.id);
};

/* ------------------------------ interogare ------------------------------ */

export const interogheazaJurnal = async (
  client: ServerSupabase,
  filtre: FiltreAudit,
): Promise<RezultatJurnal> => {
  const actorIds = await rezolvaActor(client, filtre.actor);
  if (actorIds !== null && actorIds.length === 0) {
    return { ok: true, randuri: [], cursorUrmator: null };
  }

  const limita = Math.min(Math.max(filtre.limita, 1), LIMITA_MAXIMA);
  let interogare = client
    .from("audit_logs")
    .select(COLOANE)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limita + 1);

  if (filtre.organizationId !== null) {
    interogare = interogare.eq("organization_id", filtre.organizationId);
  }
  if (filtre.deLa !== null) interogare = interogare.gte("created_at", inceputZi(filtre.deLa));
  if (filtre.panaLa !== null) {
    interogare = interogare.lt("created_at", inceputZi(ziUrmatoare(filtre.panaLa)));
  }
  if (actorIds !== null) interogare = interogare.in("actor_id", [...actorIds]);
  if (filtre.actiune !== null && esteActiuneAudit(filtre.actiune)) {
    interogare = interogare.eq("action", filtre.actiune);
  }
  if (filtre.status !== null && esteStatusAudit(filtre.status)) {
    interogare = interogare.eq("status", filtre.status);
  }
  if (filtre.entitate !== null) interogare = interogare.eq("entity_type", filtre.entitate);
  if (filtre.entityId !== null) interogare = interogare.ilike("entity_id", `%${filtre.entityId}%`);

  const cursor = decodificaCursor(filtre.cursor);
  if (cursor !== null) {
    interogare = interogare.or(
      `created_at.lt."${cursor.moment}",and(created_at.eq."${cursor.moment}",id.lt."${cursor.id}")`,
    );
  }

  const { data, error } = await interogare;
  if (error !== null || data === null) {
    console.error("[audit] interogarea jurnalului a eșuat", { error, filtre });
    return { ok: false, mesaj: MESAJ_EROARE };
  }

  const pastrate = data.slice(0, limita);
  const ultimul = pastrate[pastrate.length - 1];
  const cursorUrmator =
    data.length > limita && ultimul !== undefined
      ? codificaCursor(ultimul.created_at, ultimul.id)
      : null;

  const actori = await incarcaActori(client, [
    ...new Set(pastrate.map((r) => r.actor_id).filter((id): id is string => id !== null)),
  ]);
  const organizatii = await incarcaOrganizatii(client, [
    ...new Set(pastrate.map((r) => r.organization_id).filter((id): id is string => id !== null)),
  ]);

  const randuri: readonly RandJurnal[] = pastrate.map((rand) => {
    const actor = rand.actor_id === null ? undefined : actori.get(rand.actor_id);
    return {
      id: rand.id,
      createdAt: rand.created_at,
      organizationId: rand.organization_id,
      organizationName:
        rand.organization_id === null ? null : (organizatii.get(rand.organization_id) ?? null),
      actorId: rand.actor_id,
      actorNume: actor?.nume ?? null,
      actorEmail: actor?.email ?? null,
      action: String(rand.action),
      status: String(rand.status),
      entityType: rand.entity_type,
      entityId: rand.entity_id,
      requestId: rand.request_id,
      errorCode: rand.error_code,
      ip: typeof rand.ip === "string" ? rand.ip : null,
      userAgent: rand.user_agent,
      before: rand.before,
      after: rand.after,
    };
  });

  return { ok: true, randuri, cursorUrmator };
};

/** Parcurge paginile keyset până la `maxim` rânduri, pentru export. */
export const colecteazaPentruExport = async (
  client: ServerSupabase,
  filtre: FiltreAudit,
  maxim: number = MAX_RANDURI_EXPORT,
): Promise<RezultatJurnal> => {
  const aduna = async (
    acumulat: readonly RandJurnal[],
    cursor: string | null,
  ): Promise<RezultatJurnal> => {
    const ramase = maxim - acumulat.length;
    if (ramase <= 0) return { ok: true, randuri: acumulat, cursorUrmator: cursor };
    const pagina = await interogheazaJurnal(client, {
      ...filtre,
      cursor,
      limita: Math.min(PAGINA_EXPORT, ramase, LIMITA_MAXIMA),
    });
    if (!pagina.ok) return pagina;
    const total = [...acumulat, ...pagina.randuri];
    if (pagina.cursorUrmator === null) return { ok: true, randuri: total, cursorUrmator: null };
    return aduna(total, pagina.cursorUrmator);
  };
  return aduna([], filtre.cursor);
};
