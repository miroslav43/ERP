// src/app/(app)/notificari/legaturi.ts
/**
 * Unde duce o notificare în APLICAȚIA MARE (org_admin, hr, manager).
 *
 * Producătorii (triggere SQL, câteva acțiuni) scriu un `link` fix la momentul
 * evenimentului: coada de aprobări în loc de cerere, `/pontaj/saptamana` fără
 * săptămână, `/portal/...` pentru oricine și-a pontat ziua, `/reges` și la
 * firmele fără modul. Analiza din 2026-10-08 (§4.3) a numărat 14 clase.
 *
 * Traducerea se face LA RANDARE, nu printr-o migrare a rândurilor: acoperă și
 * notificările deja scrise, iar regula stă într-un singur loc, testabil. E
 * oglinda lui `caleaDePortal` (portal/notificarile-mele/legaturi.ts).
 *
 * Reguli:
 *  1. Obiectul bate coada: cu `entity_type`/`entity_id` cunoscute, ținta e
 *     fișa obiectului (cererea, săptămâna cu `?saptamana=`, luna omului).
 *  2. Orice țintă trece prin poarta paginii-ȚINTĂ (`poateDeschide`): modul
 *     activ + permisiunea paginii. Ce nu se deschide devine `null` — rândul
 *     se randează ca text, nu ca link spre refuz sau 404.
 *  3. Legăturile de portal scrise pentru „angajatul" care e de fapt manager,
 *     hr sau org_admin se traduc în echivalentul din aplicație; layout-ul
 *     portalului i-ar arunca altfel pe /panou.
 *  4. O rută necunoscută registrului se lasă cum e: lipsa din registru nu e
 *     un refuz.
 *
 * Fișier PUR: contextul (fișa proprie, săptămânile, înrolările, anunțurile
 * vizibile) vine citit de `context.ts`, sub RLS.
 */
import { poartaRutei, poateDeschide, type ContextPorti } from "@/config/porti-ruta";
import { lunieaSaptamanii, ziuaRomaneascaDinText } from "@/domain/attendance/saptamana";

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const TIPAR_ZI_PORTAL = new RegExp(`^/portal/pontajul-meu/zi/(\\d{4}-\\d{2}-\\d{2})$`, "u");
const TIPAR_LUNA_PORTAL = /^\/portal\/pontajul-meu\?an=(\d{4})&luna=(\d{1,2})$/u;
const TIPAR_KPI_PORTAL = /^\/portal\/kpi-ul-meu(?:\?an=(\d{4})&luna=(\d{1,2}))?$/u;
const TIPAR_CURS_PORTAL = new RegExp(`^/portal/cursurile-mele/(${UUID})$`, "u");
const TIPAR_CONCEDIU_PORTAL = new RegExp(`^/portal/concediile-mele/(${UUID})$`, "u");
const TIPAR_DEPLASARE_PORTAL = new RegExp(`^/portal/diurna-mea/(${UUID})$`, "u");
const TIPAR_ANUNT = new RegExp(`^/anunturi/(${UUID})$`, "u");
const TIPAR_ANUNT_PORTAL = new RegExp(`^/portal/anunturi/(${UUID})$`, "u");

/** Săptămâna de pontaj din spatele unei notificări (`attendance_week_submissions`). */
export type SaptamanaNotificata = Readonly<{ saptamanaStart: string; employeeId: string }>;
/** Înrolarea din spatele unei legături `/portal/cursurile-mele/<id>`. */
export type InrolareNotificata = Readonly<{ courseId: string; employeeId: string }>;

export type ContextAplicatie = Readonly<{
  porti: ContextPorti;
  /** Fișa privitorului; `null` = cont fără fișă (administrator extern). */
  fisaProprie: string | null;
  /** Cheia e `entity_id` (id-ul submisiei). */
  saptamani: ReadonlyMap<string, SaptamanaNotificata>;
  /** Cheia e id-ul înrolării din link. */
  inrolari: ReadonlyMap<string, InrolareNotificata>;
  /** Anunțurile din linkuri care se MAI VĂD sub RLS (neexpirate, neșterse). */
  anunturiVizibile: ReadonlySet<string>;
}>;

export const CONTEXT_APLICATIE_GOL: Omit<ContextAplicatie, "porti" | "fisaProprie"> = {
  saptamani: new Map(),
  inrolari: new Map(),
  anunturiVizibile: new Set(),
};

export type NotificareDeTradus = Readonly<{
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  /** Corpul: mementourile de pontaj (0166) numesc săptămâna doar aici. */
  body?: string | null;
}>;

const TIPURI_SAPTAMANA = new Set([
  "attendance_week_submission",
  "attendance_week_submission_fara_pontaj",
]);

function anLuna(zi: string): string {
  return `an=${zi.slice(0, 4)}&luna=${String(Number(zi.slice(5, 7)))}`;
}

/** Poarta țintei; o rută pe care registrul n-o cunoaște se lasă cum e. */
function prinPoarta(href: string, porti: ContextPorti): string | null {
  const cale = href.split(/[?#]/u)[0] ?? href;
  if (poartaRutei(cale) === null) return href;
  return poateDeschide(cale, porti) ? href : null;
}

export function caleaInAplicatie(n: NotificareDeTradus, ctx: ContextAplicatie): string | null {
  const { link } = n;
  if (link === null || link.length === 0) return null;
  const { porti } = ctx;
  const saptamana =
    n.entity_id !== null && n.entity_type !== null && TIPURI_SAPTAMANA.has(n.entity_type)
      ? (ctx.saptamani.get(n.entity_id) ?? null)
      : null;

  // 3. Legăturile de portal, scrise pentru un „angajat" care e rol din aplicație.
  if (link === "/portal" || link.startsWith("/portal/")) {
    const zi = TIPAR_ZI_PORTAL.exec(link)?.[1];
    if (zi !== undefined) {
      const propria = ctx.fisaProprie === null ? "" : `&angajat=${ctx.fisaProprie}`;
      return (
        prinPoarta(`/pontaj/saptamana?saptamana=${lunieaSaptamanii(zi)}${propria}`, porti) ??
        prinPoarta(`/pontaj?${anLuna(zi)}${propria}`, porti)
      );
    }
    const luna = TIPAR_LUNA_PORTAL.exec(link);
    if (luna !== null) {
      const propria = ctx.fisaProprie === null ? "" : `&angajat=${ctx.fisaProprie}`;
      return prinPoarta(`/pontaj?an=${luna[1] ?? ""}&luna=${luna[2] ?? ""}${propria}`, porti);
    }
    if (link === "/portal/pontajul-meu") return prinPoarta("/pontaj", porti);
    const kpi = TIPAR_KPI_PORTAL.exec(link);
    if (kpi !== null) {
      // Un manager evaluat lunar n-are portal: luna lui e în lista KPI, pe fișa proprie.
      const propria = ctx.fisaProprie === null ? "" : `&angajat=${ctx.fisaProprie}`;
      const perioada = kpi[1] === undefined ? "" : `an=${kpi[1]}&luna=${kpi[2] ?? ""}`;
      const interogare = `${perioada}${propria}`.replace(/^&/u, "");
      return prinPoarta(interogare === "" ? "/evaluari/kpi" : `/evaluari/kpi?${interogare}`, porti);
    }
    if (link === "/portal/pontajul-meu/saptamana") return prinPoarta("/pontaj/saptamana", porti);
    const inrolareId = TIPAR_CURS_PORTAL.exec(link)?.[1];
    if (inrolareId !== undefined) {
      const inrolare = ctx.inrolari.get(inrolareId);
      return inrolare === undefined
        ? prinPoarta("/cursuri", porti)
        : prinPoarta(`/cursuri/${inrolare.courseId}/stadiu?angajat=${inrolare.employeeId}`, porti);
    }
    const concediuId = TIPAR_CONCEDIU_PORTAL.exec(link)?.[1];
    if (concediuId !== undefined) return prinPoarta(`/concedii/${concediuId}`, porti);
    const deplasareId = TIPAR_DEPLASARE_PORTAL.exec(link)?.[1];
    if (deplasareId !== undefined) return prinPoarta(`/diurna/${deplasareId}`, porti);
    if (link === "/portal/concediile-mele") return prinPoarta("/concedii", porti);
    if (link.startsWith("/portal/evaluarile-mele"))
      return prinPoarta(link.replace("/portal/evaluarile-mele", "/evaluari/ale-mele"), porti);
    const anuntId = TIPAR_ANUNT_PORTAL.exec(link)?.[1];
    if (anuntId !== undefined)
      return ctx.anunturiVizibile.has(anuntId) ? prinPoarta(`/anunturi/${anuntId}`, porti) : null;
    if (link === "/portal/anunturi") return prinPoarta("/anunturi", porti);
    return null;
  }

  // 1. Obiectul bate coada.
  if (link === "/concedii/aprobari" && n.entity_type === "leave_request" && n.entity_id !== null) {
    return prinPoarta(`/concedii/${n.entity_id}`, porti) ?? prinPoarta(link, porti);
  }
  if (link === "/pontaj/aprobare" && saptamana !== null && n.entity_id !== null) {
    return prinPoarta(
      `/pontaj/aprobare?${anLuna(saptamana.saptamanaStart)}#saptamana-${n.entity_id}`,
      porti,
    );
  }
  // Mementourile de vineri–duminică: săptămâna e doar în corp („…din 05.10.2026"),
  // iar entitatea e fișa omului. Fără ziua din corp, rămâne ruta fixă.
  if (link === "/pontaj/saptamana" && n.entity_type === "attendance_week_submission_missing") {
    const luni = ziuaRomaneascaDinText(n.body ?? null);
    if (luni !== null) {
      const propria = n.entity_id === null ? "" : `&angajat=${n.entity_id}`;
      return prinPoarta(`/pontaj/saptamana?saptamana=${luni}${propria}`, porti);
    }
  }
  if (link === "/pontaj/saptamana" && saptamana !== null) {
    return prinPoarta(
      `/pontaj/saptamana?saptamana=${saptamana.saptamanaStart}&angajat=${saptamana.employeeId}`,
      porti,
    );
  }
  if (link === "/pontaj" && saptamana !== null) {
    return prinPoarta(
      `/pontaj?${anLuna(saptamana.saptamanaStart)}&angajat=${saptamana.employeeId}`,
      porti,
    );
  }
  if (link === "/reges") return prinPoarta("/reges?stare=de_transmis", porti);
  const anunt = TIPAR_ANUNT.exec(link)?.[1];
  if (anunt !== undefined) return ctx.anunturiVizibile.has(anunt) ? prinPoarta(link, porti) : null;

  // 2 + 4.
  return prinPoarta(link, porti);
}
