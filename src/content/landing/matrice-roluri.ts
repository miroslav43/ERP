/**
 * Matricea „cine ce vede" din banda `#roluri`.
 *
 * Fiecare celulă e DOMENIUL de citire al unui rol pe o resursă, exact cum e
 * așezat în seed-ul global din `0002_authz.sql`. Nu e o simplificare de
 * marketing: `matrice-roluri.test.ts` parsează migrarea și cade dacă vreo
 * celulă de aici nu mai corespunde bazei.
 *
 * Trei decizii deliberate:
 *
 * 1. `super_admin` NU apare. Nu e rol de organizație — CLAUDE.md spune
 *    „NICIODATĂ în `organization_members`" — primește `all` printr-un produs
 *    cartezian, iar prima coloană a secțiunii de încredere i-ar spune unui
 *    patron „furnizorul are un rol care vede tot". Accesul de platformă se
 *    spune ca frază onestă, nu ca o coloană plină.
 *
 * 2. Auditul apare DOAR ca citire. În seed, `org_admin` primește `all` pe toate
 *    cele șase acțiuni, inclusiv `update` și `delete`, tot prin produsul
 *    cartezian — dar în bază nu există NICIO politică DELETE, nicăieri, iar
 *    jurnalul e append-only prin trigger. A publica „administratorul poate
 *    modifica jurnalul" ar contrazice exact ce vinde banda de dedesubt.
 *
 * 3. Foile de parcurs stau pe rând separat de parcul auto. Managerul n-are
 *    niciun drept pe `vehicles`, dar are `trip_sheets` pe echipă — un singur
 *    rând „Parc auto | manager | —" ar fi fost fals prin omisiune.
 */
export const ROLURI_MATRICE = [
  { cheie: "org_admin", eticheta: "Administrator" },
  { cheie: "hr", eticheta: "Resurse umane" },
  { cheie: "manager", eticheta: "Manager" },
  { cheie: "employee", eticheta: "Angajat" },
] as const;

export type RolMatrice = (typeof ROLURI_MATRICE)[number]["cheie"];

/** Domeniile din `public.permission_scope`, în ordinea lor de forță. */
export type Domeniu = "all" | "team" | "own" | "none";

export const ETICHETA_DOMENIU: Readonly<Record<Domeniu, string>> = {
  all: "toate",
  team: "echipă",
  own: "proprii",
  none: "—",
};

export type RandMatrice = Readonly<{
  resursa: string;
  eticheta: string;
  domenii: Readonly<Record<RolMatrice, Domeniu>>;
}>;

export const MATRICE: readonly RandMatrice[] = [
  {
    resursa: "employees",
    eticheta: "Fișele de personal",
    domenii: { org_admin: "all", hr: "all", manager: "team", employee: "none" },
  },
  {
    resursa: "attendance",
    eticheta: "Pontaj",
    domenii: { org_admin: "all", hr: "all", manager: "team", employee: "own" },
  },
  {
    resursa: "leave",
    eticheta: "Concedii",
    domenii: { org_admin: "all", hr: "all", manager: "team", employee: "own" },
  },
  {
    resursa: "payroll",
    eticheta: "Salarizare",
    domenii: { org_admin: "all", hr: "all", manager: "none", employee: "own" },
  },
  {
    resursa: "ssm",
    eticheta: "SSM și PSI",
    domenii: { org_admin: "all", hr: "all", manager: "team", employee: "own" },
  },
  {
    resursa: "trip_sheets",
    eticheta: "Foi de parcurs",
    domenii: { org_admin: "all", hr: "none", manager: "team", employee: "none" },
  },
  {
    resursa: "vehicles",
    eticheta: "Parc auto",
    domenii: { org_admin: "all", hr: "none", manager: "none", employee: "none" },
  },
  {
    resursa: "compliance",
    eticheta: "Scadențe de conformitate",
    domenii: { org_admin: "all", hr: "none", manager: "none", employee: "none" },
  },
  {
    resursa: "audit",
    eticheta: "Jurnal de audit",
    domenii: { org_admin: "all", hr: "none", manager: "none", employee: "none" },
  },
] as const;
