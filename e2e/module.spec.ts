/**
 * Matricea rol × modul: fiecare ecran de modul se încarcă fără eroare și arată
 * EXACT ce îi permite rolul — conținutul modulului sau `AccesRestrictionat`.
 *
 * ── DE UNDE VIN AȘTEPTĂRILE ───────────────────────────────────────────────
 * Nu din memorie. Din trei surse, confruntate cu comportamentul real pe staging
 * (2026-10-02):
 *   · poarta fiecărei pagini (`src/app/(app)/<modul>/page.tsx`): ce cheie de
 *     permisiune și ce prag cere;
 *   · `role_permissions` (seed-ul din `0002_authz.sql` și migrările ulterioare),
 *     citit din baza de staging — fără suprascrieri per firmă la Demo SRL;
 *   · `organization_features` al firmei demo — modulele activate de
 *     `scripts/demo/seed-demo.mjs` (`MODULE_DEMO` + modulul de bază `nucleu`).
 *
 * ── TREI FELURI DE „NU" ────────────────────────────────────────────────────
 *   · modul DEZACTIVAT pentru firmă → `requireFeature` dă `notFound()`: ecranul
 *     „Pagina nu există". Deliberat 404, nu refuz (vezi docblock-ul din
 *     `src/components/feedback/acces-restrictionat.tsx`). Codul HTTP rămâne
 *     200, fiindcă layout-ul `(app)` a început deja streaming-ul — de aceea
 *     verificăm TEXTUL, nu statusul.
 *   · permisiune lipsă într-un modul activ → `AccesRestrictionat`, cu titlul
 *     implicit „Acces restricționat" (niciun apelant nu-l suprascrie).
 *   · rolul `employee` → nu vede deloc învelișul de administrare: poarta din
 *     `src/app/(app)/layout.tsx` (`POARTA_PORTAL_ACTIVA`) îl mută în `/portal`.
 */
import { expect, test, type Page } from "@playwright/test";

import { CONTURI, caleStare, type Rol } from "./conturi";
import { navigheaza } from "./navigare";

/** Ce trebuie să vadă un rol pe o rută. */
type Asteptare =
  { readonly fel: "continut" } | { readonly fel: "acces" } | { readonly fel: "dezactivat" };

const CONTINUT = { fel: "continut" } as const;
const ACCES = { fel: "acces" } as const;
const DEZACTIVAT = { fel: "dezactivat" } as const;

type RolBirou = Exclude<Rol, "employee">;

interface Ruta {
  readonly cale: string;
  /** Unde ajunge un rol de birou (redirect intern al paginii), implicit `cale`. */
  readonly ajunge?: string;
  /** Titlul `h1` al conținutului modulului. */
  readonly titlu: string;
  /** Poarta paginii, pentru cine citește un roșu. */
  readonly poarta: string;
  readonly asteptari: Readonly<Record<RolBirou, Asteptare>>;
}

const TOTI = { org_admin: CONTINUT, hr: CONTINUT, manager: CONTINUT } as const;
const NIMENI = { org_admin: DEZACTIVAT, hr: DEZACTIVAT, manager: DEZACTIVAT } as const;
const DOAR_ADMIN = { org_admin: CONTINUT, hr: ACCES, manager: ACCES } as const;

/**
 * Cele 22 de module cu pagină proprie din `src/app/(app)/`, plus `/panou` și
 * cele trei ecrane din `setari/` (directorul n-are `page.tsx` la rădăcină).
 * `documente/` are doar `[id]`, deci nu are ce încărca fără un id real.
 */
const RUTE: readonly Ruta[] = [
  { cale: "/panou", titlu: "Panou", poarta: "membru activ", asteptari: TOTI },
  {
    cale: "/angajati",
    titlu: "Angajați",
    poarta: "nucleu · employees:read (manager=team)",
    asteptari: TOTI,
  },
  {
    cale: "/anunturi",
    titlu: "Anunțuri",
    poarta: "announcements · announcements:read own",
    asteptari: TOTI,
  },
  {
    // `/concedii` fără parametri, cu `leave:read >= team`, redirectează spre
    // calendar (`concedii/page.tsx:98`). Toate cele trei roluri de birou au team+.
    cale: "/concedii",
    ajunge: "/concedii/calendar",
    titlu: "Calendarul de concedii",
    poarta: "leave · leave:read own; team → calendar",
    asteptari: TOTI,
  },
  { cale: "/cursuri", titlu: "Cursuri", poarta: "courses — oprit la Demo", asteptari: NIMENI },
  {
    cale: "/departamente",
    titlu: "Departamente",
    poarta: "nucleu · departments:read (manager: absent)",
    asteptari: { org_admin: CONTINUT, hr: CONTINUT, manager: ACCES },
  },
  {
    cale: "/diurna",
    titlu: "Deplasări",
    poarta: "per_diem · per_diem:read own (hr: absent)",
    asteptari: { org_admin: CONTINUT, hr: ACCES, manager: CONTINUT },
  },
  {
    cale: "/evaluari",
    titlu: "Evaluări",
    poarta: "evaluations — oprit la Demo",
    asteptari: NIMENI,
  },
  {
    cale: "/flota",
    titlu: "Parc auto",
    poarta: "fleet · vehicles:read own (doar org_admin)",
    asteptari: DOAR_ADMIN,
  },
  {
    cale: "/inventar",
    titlu: "Inventar",
    poarta: "inventory · inventory:read",
    asteptari: TOTI,
  },
  {
    cale: "/mentenanta",
    titlu: "Mentenanță",
    poarta: "maintenance · maintenance:read own (hr: absent)",
    asteptari: { org_admin: CONTINUT, hr: ACCES, manager: CONTINUT },
  },
  {
    cale: "/mentenanta/setari",
    titlu: "Setări mentenanță",
    poarta: "maintenance · maintenance:update all (doar org_admin)",
    asteptari: DOAR_ADMIN,
  },
  {
    cale: "/mentenanta/contoare",
    titlu: "Contoare",
    poarta: "maintenance · maintenance:read team (hr: absent)",
    asteptari: { org_admin: CONTINUT, hr: ACCES, manager: CONTINUT },
  },
  { cale: "/notificari", titlu: "Notificări", poarta: "fără permisiune", asteptari: TOTI },
  {
    cale: "/onboarding",
    titlu: "Onboarding",
    poarta: "onboarding · checklists:read own",
    asteptari: TOTI,
  },
  {
    cale: "/organigrama",
    titlu: "Organigramă",
    poarta: "nucleu · employees:read",
    asteptari: TOTI,
  },
  { cale: "/pontaj", titlu: "Pontaj", poarta: "attendance · attendance:read own", asteptari: TOTI },
  { cale: "/profil", titlu: "Profilul meu", poarta: "fără permisiune", asteptari: TOTI },
  {
    cale: "/puncte-lucru",
    titlu: "Puncte de lucru",
    poarta: "nucleu · departments:read (manager: absent)",
    asteptari: { org_admin: CONTINUT, hr: CONTINUT, manager: ACCES },
  },
  { cale: "/rapoarte", titlu: "Rapoarte", poarta: "rapoarte — oprit la Demo", asteptari: NIMENI },
  { cale: "/reges", titlu: "REGES", poarta: "reges — oprit la Demo", asteptari: NIMENI },
  {
    cale: "/registru",
    titlu: "Registrul documentelor",
    poarta: "nucleu · registru:read all (manager: absent)",
    asteptari: { org_admin: CONTINUT, hr: CONTINUT, manager: ACCES },
  },
  {
    cale: "/salarizare",
    titlu: "Salarizare",
    poarta: "payroll · payroll:read all (manager=none)",
    asteptari: { org_admin: CONTINUT, hr: CONTINUT, manager: ACCES },
  },
  { cale: "/ssm", titlu: "SSM și PSI", poarta: "ssm · ssm:read own", asteptari: TOTI },
  { cale: "/ticketing", titlu: "Tichete", poarta: "ticketing — oprit la Demo", asteptari: NIMENI },
  {
    cale: "/setari/organizatie",
    titlu: "Datele firmei",
    poarta: "organizations:update = all",
    asteptari: DOAR_ADMIN,
  },
  {
    cale: "/setari/membri",
    titlu: "Membri și invitații",
    poarta: "users:update = all",
    asteptari: DOAR_ADMIN,
  },
  {
    cale: "/setari/audit",
    titlu: "Jurnal de audit",
    poarta: "audit:read (hr/manager = none)",
    asteptari: DOAR_ADMIN,
  },
];

/**
 * Încarcă ruta și verifică ce e comun tuturor rezultatelor: niciun 5xx, nicio
 * limită de eroare (`StareEroare` scrie mereu „Cod incident:"), niciun ecran de
 * eroare rădăcină, nicio excepție necapturată în pagină.
 */
async function incarca(page: Page, cale: string): Promise<void> {
  const erori: string[] = [];
  page.on("pageerror", (e) => erori.push(e.message));

  const raspuns = await navigheaza(page, cale);
  expect(raspuns, `niciun răspuns pentru ${cale}`).not.toBeNull();
  expect(raspuns?.status() ?? 0, `${cale} a răspuns cu eroare de server`).toBeLessThan(500);
  // Lasă `Suspense` să se rezolve: o limită de eroare apare abia după ce
  // citirea din spatele ei cade.
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

  await expect(page.getByText("Cod incident:"), "limita de eroare (error.tsx)").toHaveCount(0);
  await expect(page.getByText("Aplicația nu a putut porni")).toHaveCount(0);
  await expect(page, "sesiunea a expirat în timpul rulării").not.toHaveURL(/\/autentificare/);
  expect(erori, `excepții necapturate pe ${cale}`).toEqual([]);
}

const titluH1 = (page: Page, nume: string) =>
  page.getByRole("heading", { level: 1, name: nume, exact: true });

for (const rol of ["org_admin", "hr", "manager"] as const) {
  test.describe(`${rol} (${CONTURI[rol].email})`, () => {
    test.use({ storageState: caleStare(rol) });

    for (const ruta of RUTE) {
      const asteptare = ruta.asteptari[rol];
      test(`${ruta.cale} → ${asteptare.fel}`, async ({ page }) => {
        test.info().annotations.push({ type: "poarta", description: ruta.poarta });
        await incarca(page, ruta.cale);

        if (asteptare.fel === "dezactivat") {
          await expect(titluH1(page, "Pagina nu există")).toBeVisible();
          return;
        }

        await expect(page).toHaveURL(
          (u) =>
            u.pathname === (asteptare.fel === "continut" ? (ruta.ajunge ?? ruta.cale) : ruta.cale),
        );
        if (asteptare.fel === "acces") {
          await expect(titluH1(page, "Acces restricționat")).toBeVisible();
          await expect(titluH1(page, ruta.titlu)).toHaveCount(0);
          return;
        }
        await expect(titluH1(page, ruta.titlu)).toBeVisible();
        await expect(page.getByText("Acces restricționat")).toHaveCount(0);
      });
    }

    test("/portal → /panou (portalul e doar al angajatului)", async ({ page }) => {
      await incarca(page, "/portal");
      await expect(page).toHaveURL((u) => u.pathname === "/panou");
      await expect(titluH1(page, "Panou")).toBeVisible();
    });
  });
}

test.describe(`employee (${CONTURI.employee.email})`, () => {
  test.use({ storageState: caleStare("employee") });

  test("/portal → tabloul angajatului", async ({ page }) => {
    await incarca(page, "/portal");
    await expect(page).toHaveURL((u) => u.pathname === "/portal");
    await expect(page.getByText("Bună ziua,")).toBeVisible();
    const prenume = CONTURI.employee.nume.split(" ")[0] ?? CONTURI.employee.nume;
    await expect(page.getByText(prenume).first()).toBeVisible();
  });

  // Poarta din `(app)/layout.tsx` se aplică ÎNAINTE de `requireFeature`: și
  // modulele dezactivate duc tot în portal, nu într-un 404.
  for (const ruta of RUTE) {
    test(`${ruta.cale} → /portal`, async ({ page }) => {
      await incarca(page, ruta.cale);
      await expect(page).toHaveURL((u) => u.pathname === "/portal");
      await expect(page.getByText("Bună ziua,")).toBeVisible();
      await expect(titluH1(page, "Acces restricționat")).toHaveCount(0);
    });
  }
});
