// src/lib/asistent/unelte/flota/comun.ts
/**
 * Bucățile pure ale uneltelor de flotă (F12e): normalizarea numărului de
 * înmatriculare, luna cerută, numeralele și destinațiile efemere.
 *
 * Fără `server-only` și fără nimic din `@/lib/auth/permissions` (care e
 * `server-only`): fișierul se testează fără bază, ca `poarta.ts`. `destinatii.ts`
 * importă doar `@/config/navigation`, deci e neutru.
 *
 * ── DESTINAȚIILE EFEMERE (D6, D7) ─────────────────────────────────────────────
 * Trei prefixe: `vehicul.<uuid>`, `foaie.<uuid>`, `propune.foaie.<uuidVehicul>`.
 * Fiecare se construiește DOAR aici, după zonă, fiindcă `marcaje.ts` rezolvă un
 * identificator fără să știe zona: o foaie trimisă angajatului spre
 * `/flota/foi/<id>` ar fi un buton spre un ecran pe care portalul nu-l deschide.
 * Drumul de click nu se scrie: se ia din destinația STATICĂ a părintelui, ca
 * pastila să urmeze meniul când meniul se mută.
 */
import { meetsScope } from "@/config/permissions";
import { adaugaZileIso, ziIso } from "@/domain/calendar/grila-lunara";
import { formatDate } from "@/lib/format/date";
import { textZile } from "@/lib/format/numar";

import { destinatiaDupaId, type Destinatie, type ZonaAsistent } from "../../destinatii";
import type { ContextUnealta, RezultatUnealta } from "../tip";

/**
 * Argumentul modelului nu trece de schemă: răspuns de refuz, nu excepție.
 * `executaUnealta` ar prinde excepția, dar ar înghiți motivul în „Nu am putut
 * citi datele acestea acum.”, iar modelul n-ar ști ce să corecteze.
 */
export const ARGUMENTE_NEVALIDE: RezultatUnealta = {
  text: "Parametrii cererii nu sunt valizi. Reformulează întrebarea, de exemplu cu numărul de înmatriculare scris întreg.",
};

/** Vehiculul nu e printre cele vizibile. NU „nu există”: diferența ar confirma existența. */
export const VEHICUL_NEGASIT =
  "Nu găsesc vehiculul printre cele la care ai acces. Verifică numărul de înmatriculare.";

/** „azi”, „în 12 zile”, „acum 3 zile”, față de `aziISO`. */
export function relativLaAzi(aziISO: string, zi: string): string {
  const d = Math.round(
    (Date.parse(`${zi}T00:00:00Z`) - Date.parse(`${aziISO}T00:00:00Z`)) / 86_400_000,
  );
  if (d === 0) return "azi";
  return d > 0 ? `în ${textZile(d)}` : `acum ${textZile(-d)}`;
}

/** „pe 03.11.2026 (în 12 zile)”, „azi, 22.10.2026”. */
export function peZiua(aziISO: string, zi: string): string {
  const relativ = relativLaAzi(aziISO, zi);
  return relativ === "azi" ? `azi, ${formatDate(zi)}` : `pe ${formatDate(zi)} (${relativ})`;
}

/**
 * Exact normalizarea din `internal.vehicles_normalizeaza` (0012, forma ultimă în
 * 0173), ÎN ACEEAȘI ORDINE: întâi se scot caracterele din afara [A-Za-z0-9],
 * apoi majusculele. Ordinea inversă nu e echivalentă: `"ß".toUpperCase()` e
 * `"SS"`, iar `"ı".toUpperCase()` e `"I"` în JS, pe când baza le-ar fi șters.
 */
export function normalizeazaNr(text: string): string {
  return text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/**
 * Sub două caractere după normalizare („--”, „ă”), căutarea ar fi `ilike '%%'`,
 * adică tot parcul. Refuzul e mai cinstit decât o listă care nu răspunde.
 */
export const NR_MINIM_CARACTERE = 2;

/**
 * Luna cerută, `AAAA-LL`. Fără parametri, luna din `aziISO` (ziua de la
 * București). O lună dată fără an, mai mare decât luna curentă („decembrie”,
 * întrebat în ianuarie), e luna aceea din anul TRECUT: viitorul n-are foi.
 */
export function lunaCeruta(aziISO: string, an?: number, luna?: number): string {
  const anAzi = Number(aziISO.slice(0, 4));
  const lunaAzi = Number(aziISO.slice(5, 7));
  const lunaAleasa = luna ?? lunaAzi;
  const anAles = an ?? (lunaAleasa > lunaAzi ? anAzi - 1 : anAzi);
  return ziIso(anAles, lunaAleasa, 1).slice(0, 7);
}

/** Luna cerută e după luna curentă: nicio foaie n-are cum să existe încă. */
export function lunaInViitor(luna: string, aziISO: string): boolean {
  return luna > aziISO.slice(0, 7);
}

/** Ziua-prag a unei scadențe: `aziISO` + `zile`, socotită pe zile românești (D11). */
export function pragZile(aziISO: string, zile: number): string {
  return adaugaZileIso(aziISO, zile);
}

/** Câte rânduri scrie o unealtă înainte de „…și încă N” (D10: `MAX_TOKENS` acoperă și răspunsul). */
export const MAX_RANDURI = 12;

/** Primele `MAX_RANDURI` rânduri și coada „…și încă N”, dacă e cazul. */
export function plafoneaza(randuri: readonly string[], maxim: number = MAX_RANDURI): string[] {
  if (randuri.length <= maxim) return [...randuri];
  return [...randuri.slice(0, maxim), `…și încă ${randuri.length - maxim}.`];
}

/** Destinația statică a „Mașinii mele” din portal (0199). */
export const ID_PORTAL_MASINA = "portal.masina";

/** Părintele de meniu al fiecărei zone: `NAV_ITEMS` „flota”, `PORTAL_NAV_ITEMS` „portal-masina”. */
const PARINTE: Readonly<Record<ZonaAsistent, string>> = {
  app: "flota",
  portal: "portal-masina",
};

function drumDupa(idStatic: string, ultimul: string): readonly string[] {
  return [...(destinatiaDupaId(idStatic)?.drum ?? []), ultimul];
}

/**
 * Fișa vehiculului. În portal nu există fișă de vehicul: „Mașina mea” e locul.
 * Poarta e a PAGINII-țintă: `/flota/[id]` cere `vehicles:read` own, iar „Mașina
 * mea” cere `trip_sheets:read` own (intrarea `portal-masina` din `navigation.ts`).
 */
export function destinatieVehicul(zona: ZonaAsistent, id: string, nr: string): Destinatie {
  const inApp = zona === "app";
  return {
    id: `vehicul.${id}`,
    href: inApp ? `/flota/${id}` : "/portal/masina-mea",
    eticheta: nr,
    zona,
    parinte: PARINTE[zona],
    fila: null,
    featureKey: "fleet",
    permission: inApp ? "vehicles:read" : "trip_sheets:read",
    minScope: "own",
    descriere: inApp
      ? `Fișa vehiculului ${nr}: documentele, alocările și foile lui.`
      : `Mașina ${nr} și foile dumneavoastră pe ea.`,
    drum: drumDupa(inApp ? "flota" : ID_PORTAL_MASINA, nr),
  };
}

/** O foaie de parcurs anume, în zona omului. Poarta: `trip_sheets:read` own, în ambele. */
export function destinatieFoaie(zona: ZonaAsistent, id: string, eticheta: string): Destinatie {
  const inApp = zona === "app";
  return {
    id: `foaie.${id}`,
    href: inApp ? `/flota/foi/${id}` : `/portal/masina-mea/foi/${id}`,
    eticheta,
    zona,
    parinte: PARINTE[zona],
    fila: null,
    featureKey: "fleet",
    permission: "trip_sheets:read",
    minScope: "own",
    descriere: `Foaia de parcurs ${eticheta}: cursele, kilometrii și alimentările.`,
    drum: drumDupa(inApp ? "flota.foi" : ID_PORTAL_MASINA, eticheta),
  };
}

/**
 * Caseta „Foaie nouă”, deschisă și PRECOMPLETATĂ cu vehiculul. Nu creează nimic:
 * omul verifică și apasă „Salvează” (asistentul rămâne fără nicio scriere).
 * Prefixul `propune.` are regula lui în prompt (D8).
 */
export function destinatiePropunereFoaie(
  zona: ZonaAsistent,
  vehiculId: string,
  nr: string,
): Destinatie {
  const inApp = zona === "app";
  const eticheta = `Foaie nouă pe ${nr}`;
  return {
    id: `propune.foaie.${vehiculId}`,
    href: inApp
      ? `/flota/foi?vehicul=${vehiculId}&foaie=noua`
      : `/portal/masina-mea?foaie=noua&vehicul=${vehiculId}`,
    eticheta,
    zona,
    parinte: PARINTE[zona],
    fila: null,
    featureKey: "fleet",
    permission: "trip_sheets:create",
    minScope: "own",
    descriere: `Caseta foii noi, cu vehiculul ${nr} ales. Se verifică și se salvează.`,
    drum: drumDupa(inApp ? "flota.foi" : ID_PORTAL_MASINA, eticheta),
  };
}

/**
 * Fișa unui angajat, ca în `cauta_om` (`fisa.<uuid>`), pentru permisele din F9:
 * permisul stă pe fișă. Poarta e a listei de angajați (`employees:read` team);
 * drumul e al destinației statice „angajati”, nu un literal.
 */
export function destinatieFisa(id: string, nume: string): Destinatie {
  return {
    id: `fisa.${id}`,
    href: `/angajati/${id}`,
    eticheta: nume,
    zona: "app",
    parinte: "angajati",
    fila: null,
    featureKey: null,
    permission: "employees:read",
    minScope: "team",
    descriere: `Fișa angajatului ${nume}.`,
    drum: drumDupa("angajati", nume),
  };
}

/**
 * Identificatorii STATICI sugerați modelului, tăiați la ce poate deschide omul.
 *
 * `marcaje.ts` rezolvă un identificator din indexul GLOBAL, nefiltrat pe zonă
 * sau pe permisiune: o referință pe care omul n-o poate deschide ar deveni o
 * pastilă spre un ecran de refuz. Aceeași regulă ca `filtreaza.ts` (modulul,
 * `meetsScope`), plus zona.
 */
export function referintePermise(
  context: Pick<ContextUnealta, "zona" | "features" | "permisiuni">,
  ids: readonly string[],
): string[] {
  return [...new Set(ids)].filter((id) => {
    const d = destinatiaDupaId(id);
    if (d === undefined || d.zona !== context.zona) return false;
    if (d.featureKey !== null && !context.features.has(d.featureKey)) return false;
    return d.permission === null || meetsScope(context.permisiuni.get(d.permission), d.minScope);
  });
}

/** Destinația statică a parcului, în zona omului: „Parc auto” sau „Mașina mea”. */
export function referintaParc(zona: ZonaAsistent): string {
  return zona === "app" ? "flota" : ID_PORTAL_MASINA;
}

/** Destinația statică a foilor, în zona omului. */
export function referintaFoi(zona: ZonaAsistent): string {
  return zona === "app" ? "flota.foi" : ID_PORTAL_MASINA;
}
