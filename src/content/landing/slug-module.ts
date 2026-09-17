/**
 * Adresa publică a fiecărui modul: cheia de modul → slug românesc.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * Paginile de modul stăteau la `/module/<cheie>`, cu cheile din `features.ts`:
 * `/module/attendance`, `/module/per_diem`. Compromisul era scris în pagină — o
 * singură listă, cu prețul unor adrese în engleză pe un sit în română. Auditul
 * SEO din 17 sept 2026 l-a trecut la „schimbă acum sau niciodată”: situl încă nu
 * are istoric de căutare, deci mutarea costă doar cele unsprezece redirecturi de
 * mai jos.
 *
 * Slug-ul e DOAR adresa. Cheia rămâne identificatorul peste tot în rest: în
 * baza de date (`features.feature_key`), în permisiuni, în `PRETURI_MODULE`, în
 * `FISE`, în capturile `/capturi/<cheie>-*.webp` și în `/vitrina/<cheie>`.
 * Slug-urile urmează rutele aplicației (`/pontaj`, `/concedii`, `/flota`).
 *
 * ── DE CE FĂRĂ NICIUN IMPORT ──────────────────────────────────────────────
 * `next.config.ts` citește fișierul pentru `redirects()`, iar acolo rezoluția de
 * module e a lui Node, fără alias-ul `@/`. Tipul cheilor nu se ia din
 * `features.ts` (care trage după el `lucide-react`); garanția că lista acoperă
 * exact catalogul o dă `continut.test.ts`.
 */
export const SLUG_MODUL = {
  nucleu: "nucleu",
  asistent: "asistent",
  attendance: "pontaj",
  leave: "concedii",
  onboarding: "onboarding",
  courses: "cursuri",
  reges: "reges",
  evaluations: "evaluari",
  kpi: "kpi",
  ssm: "ssm",
  fleet: "flota",
  maintenance: "mentenanta",
  inventory: "inventar",
  ticketing: "ticketing",
  payroll: "salarizare",
  per_diem: "diurna",
  rapoarte: "rapoarte",
  announcements: "anunturi",
  employee_portal: "portal-angajat",
} as const satisfies Readonly<Record<string, string>>;

/** Slug-ul unei chei; o cheie necunoscută rămâne ea însăși, ca adresa să dea 404, nu să cadă. */
export function slugModul(cheie: string): string {
  return (SLUG_MODUL as Readonly<Record<string, string>>)[cheie] ?? cheie;
}

/** Cheia unui slug, sau `undefined` pentru o adresă care nu e a niciunui modul. */
export function cheieDinSlug(slug: string): string | undefined {
  return Object.entries(SLUG_MODUL).find(([, s]) => s === slug)?.[0];
}

/**
 * Redirecturile permanente de la adresele vechi, pentru `next.config.ts`.
 *
 * DOAR cheile al căror slug diferă: pentru `reges`, `ssm` sau `kpi`, sursa și
 * destinația ar fi aceeași adresă — un redirect către el însuși, adică o buclă
 * pe care browserul o oprește cu eroare.
 */
export const REDIRECTURI_MODULE: readonly Readonly<{
  source: string;
  destination: string;
  permanent: true;
}>[] = Object.entries(SLUG_MODUL)
  .filter(([cheie, slug]) => cheie !== slug)
  .map(([cheie, slug]) => ({
    source: `/module/${cheie}`,
    destination: `/module/${slug}`,
    permanent: true as const,
  }));
