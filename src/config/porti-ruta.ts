// src/config/porti-ruta.ts
/**
 * Registrul porților de rută: pentru fiecare pagină din `(app)` și `(portal)`,
 * modulul, permisiunea și pragul pe care PAGINA le verifică în preambulul ei.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * Analiza de navigare din 2026-10-08 (`docs/design/navigare-intre-module.md`,
 * §4.4) a găsit peste o sută de legături existente care se terminau în
 * `AccesRestrictionat` sau 404 pentru cel puțin un rol: file, firimituri,
 * butoane din stări goale, linkuri din notificări. Fiecare loc își calcula
 * singur condiția, cu altă permisiune decât cea pe care o cere pagina-țintă —
 * sau fără nicio condiție.
 *
 * Regula care iese de aici: **un link spre altă pagină trece prin poarta
 * ȚINTEI, nu a sursei.** `poateDeschide(href, context)` răspunde exact la
 * întrebarea „dacă apăs, ajung pe pagină sau într-un refuz?", citind aceeași
 * matrice de permisiuni și aceeași listă de module ca pagina însăși.
 *
 * ── CE NU E ───────────────────────────────────────────────────────────────
 * Nu e barieră de securitate. Pagina își repetă verificarea, acțiunea o reface
 * prin `createAction`, iar RLS respinge rândurile chiar dacă cineva tastează
 * adresa. Aici e doar igienă: un link care duce garantat într-un refuz e
 * zgomot, nu descoperire.
 *
 * ── CUM RĂMÂNE ADEVĂRAT ───────────────────────────────────────────────────
 * `porti-ruta.test.ts` compară tiparele de aici cu fișierele `page.tsx` de pe
 * disc, în ambele sensuri: o pagină nouă fără intrare sau o intrare fără pagină
 * pică testul. Pragul declarat e cel din preambulul paginii (`can(...)`,
 * `scopeFor(...)`), nu cel din meniu — la `/salarizare/popriri` meniul cere
 * `all`, pagina refuză doar absența. Când preambulul se schimbă, se schimbă și
 * rândul de aici, în același commit.
 *
 * Fișierul e PUR: fără `server-only`, fără bază de date. Îl importă și
 * firimiturile (componentă client), și paginile de server.
 */
import type { FeatureKey } from "@/config/features";
import {
  meetsScope,
  type MinScope,
  type PermissionKey,
  type PermissionScope,
} from "@/config/permissions";

export type PoartaRuta = Readonly<{
  /**
   * Tiparul rutei, cu segmentele dinamice între paranteze drepte exact ca pe
   * disc: `/angajati/[id]`, `/salarizare/[id]/[entryId]`.
   */
  tipar: string;
  /** `null` = nucleu, mereu disponibil. */
  featureKey: FeatureKey | null;
  /** `null` = orice membru activ (panoul, profilul, notificările). */
  permission: PermissionKey | null;
  minScope: MinScope;
}>;

export type ContextPorti = Readonly<{
  features: ReadonlySet<FeatureKey> | ReadonlySet<string>;
  permissions: ReadonlyMap<string, PermissionScope>;
}>;

const p = (
  tipar: string,
  featureKey: FeatureKey | null,
  permission: PermissionKey | null,
  minScope: MinScope = "own",
): PoartaRuta => ({ tipar, featureKey, permission, minScope });

/**
 * Paginile din `(app)`. Ordinea e cea a directoarelor, ca diff-ul față de
 * `find src/app/\(app\) -name page.tsx | sort` să se citească direct.
 */
export const PORTI_APP: readonly PoartaRuta[] = [
  p("/angajati", null, "employees:read"),
  p("/angajati/[id]", null, "employees:read"),
  p("/angajati/[id]/documente", null, "employees:read"),
  p("/angajati/[id]/editeaza", null, "employees:update", "all"),
  p("/angajati/[id]/permisiuni", null, "roles:update", "team"),
  p("/angajati/import", null, "employees:create", "all"),
  p("/angajati/nou", null, "employees:create", "all"),
  p("/angajati/sabloane-documente", null, "employees:update", "all"),
  p("/angajati/sabloane-documente/[cod]", null, "employees:update", "all"),
  p("/angajati/sabloane-documente/nou", null, "employees:create", "all"),
  p("/anunturi", "announcements", "announcements:read"),
  p("/anunturi/[id]", "announcements", "announcements:read"),
  p("/concedii", "leave", "leave:read"),
  p("/concedii/[id]", "leave", "leave:read"),
  p("/concedii/aprobari", "leave", "leave:approve", "team"),
  p("/concedii/calendar", "leave", "leave:read", "team"),
  p("/concedii/echipa", "leave", "leave:read", "team"),
  p("/concedii/setari", "leave", "leave:update", "all"),
  p("/concedii/sold", "leave", "leave:read"),
  p("/cursuri", "courses", "courses:read", "team"),
  p("/cursuri/[id]", "courses", "courses:read", "team"),
  p("/cursuri/[id]/atribuire", "courses", "courses:create", "team"),
  p("/cursuri/[id]/editare", "courses", "courses:update", "team"),
  p("/cursuri/[id]/reguli", "courses", "courses:read", "team"),
  p("/cursuri/[id]/stadiu", "courses", "courses:read", "team"),
  p("/cursuri/biblioteca", "courses", "courses:read", "team"),
  p("/cursuri/biblioteca/[id]", "courses", "courses:read", "team"),
  p("/cursuri/biblioteca/nou", "courses", "courses:create", "team"),
  p("/cursuri/conformitate", "courses", "courses:read", "team"),
  p("/cursuri/nou", "courses", "courses:create", "team"),
  p("/departamente", null, "departments:read"),
  p("/diurna", "per_diem", "per_diem:read"),
  p("/diurna/[id]", "per_diem", "per_diem:read"),
  p("/diurna/[id]/decont", "per_diem", "per_diem:read"),
  p("/diurna/[id]/editeaza", "per_diem", "per_diem:update"),
  p("/diurna/aprobari", "per_diem", "per_diem:approve", "team"),
  p("/diurna/noua", "per_diem", "per_diem:create"),
  p("/diurna/politica", "per_diem", "per_diem:read"),
  p("/evaluari", "evaluations", "evaluations:read", "team"),
  p("/evaluari/ale-mele", "evaluations", null),
  p("/evaluari/kpi", "kpi", "evaluations:read", "team"),
  p("/evaluari/kpi/[id]", "kpi", "evaluations:read", "team"),
  p("/evaluari/kpi/seturi", "kpi", "evaluations:read", "team"),
  p("/evaluari/sabloane", "evaluations", "evaluations:read", "team"),
  p("/flota", "fleet", "vehicles:read"),
  p("/flota/[id]", "fleet", "vehicles:read"),
  p("/flota/anomalii", "fleet", "vehicles:update", "team"),
  p("/flota/aprobari", "fleet", "trip_sheets:approve", "team"),
  p("/flota/foi", "fleet", "trip_sheets:read"),
  p("/flota/foi/[id]", "fleet", "trip_sheets:read"),
  p("/inventar", "inventory", "inventory:read"),
  p("/inventar/[id]", "inventory", "inventory:read"),
  p("/inventar/[id]/pv/[alocare]", "inventory", "inventory:read"),
  p("/inventar/in-primire", "inventory", "inventory:read"),
  p("/mentenanta", "maintenance", "maintenance:read"),
  p("/mentenanta/contoare", "maintenance", "maintenance:read", "team"),
  p("/mentenanta/echipamente", "maintenance", "maintenance:read", "team"),
  p("/mentenanta/echipamente/[id]", "maintenance", "maintenance:read", "team"),
  p("/mentenanta/echipamente/[id]/eticheta", "maintenance", "maintenance:read", "team"),
  p("/mentenanta/echipamente/etichete", "maintenance", "maintenance:read", "team"),
  p("/mentenanta/interventii", "maintenance", "maintenance:read", "team"),
  p("/mentenanta/planuri", "maintenance", "maintenance:read", "team"),
  p("/mentenanta/planuri/[id]", "maintenance", "maintenance:read", "team"),
  p("/mentenanta/sesizari", "maintenance", "maintenance:read"),
  p("/mentenanta/sesizari/[id]", "maintenance", "maintenance:read"),
  // Redirecționează spre caseta `?sesizare=noua` din listă; poarta e a casetei.
  p("/mentenanta/sesizari/noua", "maintenance", "maintenance:create"),
  p("/mentenanta/setari", "maintenance", "maintenance:update", "all"),
  p("/notificari", null, null),
  p("/onboarding", "onboarding", "checklists:read"),
  p("/onboarding/[id]", "onboarding", "checklists:read"),
  p("/onboarding/[id]/dovada", "onboarding", "checklists:read"),
  p("/onboarding/noua", "onboarding", "checklists:create", "all"),
  p("/onboarding/sabloane", "onboarding", "checklists:read"),
  p("/onboarding/sabloane/[id]", "onboarding", "checklists:read"),
  p("/onboarding/sabloane/nou", "onboarding", "checklists:create", "all"),
  p("/onboarding/sarcinile-mele", "onboarding", "checklists:read"),
  p("/organigrama", null, "employees:read"),
  p("/panou", null, null),
  p("/pontaj", "attendance", "attendance:read"),
  p("/pontaj/aprobare", "attendance", "attendance:approve", "team"),
  p("/pontaj/arhiva", "attendance", "attendance:export", "all"),
  p("/pontaj/perioade", "attendance", "attendance:read"),
  p("/pontaj/perioade/[id]", "attendance", "attendance:read", "team"),
  p("/pontaj/saptamana", "attendance", "attendance:create"),
  p("/pontaj/setari", "attendance", "attendance:update", "all"),
  // Poarta SECRETULUI, nu a pontajului: codul QR stă pe punctul de lucru.
  p("/pontaj/setari/coduri-qr", "attendance", "departments:update", "all"),
  p("/pontaj/setari/reguli", "attendance", "attendance:update", "all"),
  p("/profil", null, null),
  p("/puncte-lucru", null, "departments:read"),
  p("/puncte-lucru/[id]", null, "departments:read"),
  p("/puncte-lucru/[id]/afis", null, "departments:update", "all"),
  p("/rapoarte", "rapoarte", "payroll:read", "all"),
  p("/reges", "reges", "reges:read", "all"),
  p("/reges/[id]", "reges", "reges:read", "all"),
  p("/reges/propuneri", "reges", "reges:read", "all"),
  p("/reges/setari", "reges", "reges:configure", "all"),
  p("/registru", null, "registru:read", "all"),
  p("/registru/listare", null, "registru:export", "all"),
  p("/registru/nomenclator", null, "registru:read", "all"),
  p("/salarizare", "payroll", "payroll:read", "all"),
  p("/salarizare/[id]", "payroll", "payroll:read", "all"),
  p("/salarizare/[id]/[entryId]", "payroll", "payroll:read", "all"),
  p("/salarizare/componente", "payroll", "payroll:read"),
  p("/salarizare/istoric-venituri", "payroll", "payroll:create", "all"),
  p("/salarizare/popriri", "payroll", "payroll:read"),
  p("/salarizare/setari", "payroll", "payroll:update", "all"),
  p("/setari/audit", null, "audit:read", "all"),
  p("/setari/membri", null, "users:update", "all"),
  p("/setari/organizatie", null, "organizations:update", "all"),
  p("/ssm", "ssm", "ssm:read"),
  p("/ssm/accidente", "ssm", "ssm:read", "team"),
  p("/ssm/accidente/[id]", "ssm", "ssm:read", "team"),
  p("/ssm/accidente/nou", "ssm", "ssm:create", "team"),
  p("/ssm/autorizatii", "ssm", "ssm:read", "team"),
  p("/ssm/eip", "ssm", "ssm:read", "team"),
  p("/ssm/instruiri", "ssm", "ssm:read", "team"),
  p("/ssm/instruiri/noua", "ssm", "ssm:create", "team"),
  p("/ssm/medicina-muncii", "ssm", "ssm:read", "team"),
  p("/ssm/medicina-muncii/noua", "ssm", "ssm:create", "team"),
  p("/ssm/stingatoare", "ssm", "ssm:read", "team"),
  p("/ssm/stingatoare/[id]", "ssm", "ssm:read", "team"),
  p("/ssm/stingatoare/[id]/editeaza", "ssm", "ssm:update", "team"),
  p("/ssm/stingatoare/nou", "ssm", "ssm:create", "team"),
  p("/ticketing", "ticketing", "tickets:read"),
  p("/ticketing/[id]", "ticketing", "tickets:read"),
  p("/ticketing/coada", "ticketing", "tickets:read", "team"),
  p("/ticketing/nou", "ticketing", "tickets:create"),
];

/** Paginile din `(portal)`. Toate la `own`: portalul e al unui singur om. */
export const PORTI_PORTAL: readonly PoartaRuta[] = [
  p("/portal", null, null),
  p("/portal/anunturi", "announcements", "announcements:read"),
  p("/portal/anunturi/[id]", "announcements", "announcements:read"),
  p("/portal/ceas", "attendance", "attendance:create"),
  p("/portal/concediile-mele", "leave", "leave:read"),
  p("/portal/concediile-mele/[id]", "leave", "leave:read"),
  p("/portal/concediile-mele/noua", "leave", "leave:create"),
  p("/portal/cursurile-mele", "courses", "courses:read"),
  p("/portal/cursurile-mele/[id]", "courses", "courses:read"),
  p("/portal/cursurile-mele/[id]/[lectieId]", "courses", "courses:read"),
  p("/portal/diurna-mea", "per_diem", "per_diem:read"),
  p("/portal/diurna-mea/[id]", "per_diem", "per_diem:read"),
  p("/portal/diurna-mea/[id]/decont", "per_diem", "per_diem:read"),
  p("/portal/diurna-mea/noua", "per_diem", "per_diem:create"),
  p("/portal/documentele-mele", "employee_portal", "employees:read"),
  p("/portal/echipa-mea", null, null),
  p("/portal/evaluarile-mele", "evaluations", "evaluations:read"),
  p("/portal/in-primirea-mea", "inventory", "inventory:read"),
  p("/portal/instalare", null, null),
  p("/portal/instruirile-mele", "ssm", "ssm:read"),
  p("/portal/integrarea-mea", "onboarding", "checklists:read"),
  p("/portal/integrarea-mea/[id]", "onboarding", "checklists:read"),
  p("/portal/integrarea-mea/sarcini", "onboarding", "checklists:read"),
  p("/portal/kpi-ul-meu", "kpi", "evaluations:read"),
  p("/portal/notificarile-mele", null, null),
  p("/portal/pontajul-meu", "attendance", "attendance:read"),
  p("/portal/pontajul-meu/saptamana", "attendance", "attendance:create"),
  p("/portal/pontajul-meu/zi/[data]", "attendance", "attendance:create"),
  p("/portal/ponteaza", "attendance", "attendance:create"),
  p("/portal/ponteaza/[cod]", "attendance", "attendance:create"),
  p("/portal/profilul-meu", null, null),
  p("/portal/salariul-meu", "payroll", "payroll:read"),
  p("/portal/sesizari", "maintenance", "maintenance:read"),
  p("/portal/sesizari/[id]", "maintenance", "maintenance:read"),
  p("/portal/sesizari/noua", "maintenance", "maintenance:create"),
  p("/portal/tichetele-mele", "ticketing", "tickets:read"),
  p("/portal/tichetele-mele/[id]", "ticketing", "tickets:read"),
  p("/portal/tichetele-mele/nou", "ticketing", "tickets:create"),
];

/**
 * Rute care nu sunt pagini, dar sunt ținte de link: Route Handlers.
 * `/documente/[id]` rămâne deschis angajatului intenționat (vezi `routes.ts`).
 */
export const PORTI_HANDLER: readonly PoartaRuta[] = [p("/documente/[id]", null, null)];

export const PORTI_RUTA: readonly PoartaRuta[] = [...PORTI_APP, ...PORTI_PORTAL, ...PORTI_HANDLER];

const DUPA_TIPAR: ReadonlyMap<string, PoartaRuta> = new Map(
  PORTI_RUTA.map((poarta) => [poarta.tipar, poarta] as const),
);

/** Calea fără interogare și fără ancoră: `/angajati?q=x#sus` → `/angajati`. */
export function caleaDin(href: string): string {
  const faraAncora = href.split("#")[0] ?? "";
  const cale = faraAncora.split("?")[0] ?? "";
  return cale.length > 1 && cale.endsWith("/") ? cale.slice(0, -1) : cale;
}

function segmente(cale: string): readonly string[] {
  return cale.split("/").filter((s) => s.length > 0);
}

function sePotriveste(tipar: string, cale: readonly string[]): boolean {
  const t = segmente(tipar);
  if (t.length !== cale.length) return false;
  return t.every((s, i) => s.startsWith("[") || s === cale[i]);
}

/**
 * Poarta paginii de la adresa dată, sau `null` când nicio pagină nu răspunde
 * acolo. Un segment static bate unul dinamic: `/cursuri/biblioteca` nu e
 * `/cursuri/[id]`.
 */
export function poartaRutei(href: string): PoartaRuta | null {
  const cale = caleaDin(href);
  const exacta = DUPA_TIPAR.get(cale);
  if (exacta !== undefined) return exacta;
  const parti = segmente(cale);
  let gasita: PoartaRuta | null = null;
  let celeMaiMulteStatice = -1;
  for (const poarta of PORTI_RUTA) {
    if (!sePotriveste(poarta.tipar, parti)) continue;
    const statice = segmente(poarta.tipar).filter((s) => !s.startsWith("[")).length;
    if (statice > celeMaiMulteStatice) {
      gasita = poarta;
      celeMaiMulteStatice = statice;
    }
  }
  return gasita;
}

/** Trece poarta — fără să știe de rută: pentru contoare, insigne, file. */
export function trecePoarta(poarta: PoartaRuta, context: ContextPorti): boolean {
  const modulActiv = poarta.featureKey === null || context.features.has(poarta.featureKey);
  const arePermisiune =
    poarta.permission === null ||
    meetsScope(context.permissions.get(poarta.permission), poarta.minScope);
  return modulActiv && arePermisiune;
}

/**
 * „Dacă apăs pe linkul ăsta, ajung pe pagină?"
 *
 * `false` și pentru o adresă necunoscută: un link spre o rută fără pagină e un
 * 404, nu o pagină nepăzită. Testul registrului garantează că „necunoscut"
 * înseamnă chiar „nu există", nu „am uitat s-o declar".
 */
export function poateDeschide(href: string, context: ContextPorti): boolean {
  const poarta = poartaRutei(href);
  return poarta !== null && trecePoarta(poarta, context);
}

/**
 * Linkul sau `null`: pentru componentele care afișează text când nu se poate
 * deschide. Scurtătura pentru `poateDeschide(href, c) ? href : null`.
 */
export function legaturaSigura(href: string, context: ContextPorti): string | null {
  return poateDeschide(href, context) ? href : null;
}

/** Tiparele pe care contextul le poate deschide — pentru firimituri și paletă. */
export function tiparePermise(context: ContextPorti): readonly string[] {
  return PORTI_RUTA.filter((poarta) => trecePoarta(poarta, context)).map((poarta) => poarta.tipar);
}

/**
 * Tiparul care răspunde la o cale, dintr-o listă dată — varianta pură, fără
 * context, pentru componentele client care primesc lista gata filtrată.
 */
export function tiparulCaii(cale: string, tipare: readonly string[]): string | null {
  const parti = segmente(caleaDin(cale));
  if (tipare.includes(caleaDin(cale))) return caleaDin(cale);
  let gasit: string | null = null;
  let celeMaiMulteStatice = -1;
  for (const tipar of tipare) {
    if (!sePotriveste(tipar, parti)) continue;
    const statice = segmente(tipar).filter((s) => !s.startsWith("[")).length;
    if (statice > celeMaiMulteStatice) {
      gasit = tipar;
      celeMaiMulteStatice = statice;
    }
  }
  return gasit;
}
