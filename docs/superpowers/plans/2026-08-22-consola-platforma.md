# Consola de platformă — plan de implementare (etapele 1–4)

> **Pentru executanți:** planul se execută sarcină cu sarcină. Pașii au casete
> (`- [ ]`) pentru urmărire. **Fără agenți de implementare** — `CLAUDE.md` al acestui
> repo o interzice explicit, cu motivul: 6 agenți paraleli au produs 91 de erori de
> compilare din căi de import inventate. Se scrie direct, cu `Write`/`Edit`.

**Scop:** super-adminul are cont propriu, aterizează în consola de platformă și găsește
acolo un panou, o listă de firme și un jurnal de audit care arată ca un produs.

**Arhitectură:** politica de rutare devine o funcție pură în `src/config/routes.ts`,
apelată de callback-ul de autentificare; zona `(platform)` primește schelet propriu
(rail navy, antet, fonturi Plex) fără să atingă aplicația de firmă.

**Tehnologii:** Next.js 16 App Router · React 19 · Tailwind v4 · Zod 4 · vitest 4 ·
Supabase (PostgREST + Auth)

**Spec:** `docs/superpowers/specs/2026-08-22-consola-platforma-design.md`

**Cuprins:** etapele 1–4 din spec. Etapa 5 (fișă, membri, module, permisiuni, cereri
demo, e-mailuri, asistentul în 7 pași) primește plan separat — e repetiție mecanică a
aceluiași limbaj și nu lasă 1–4 incomplete.

## Constrângeri globale

- **Limba:** cod, comentarii, mesaje și identificatori de domeniu în **română**, cu ș/ț cu
  **virgulă** dedesubt (U+0219/U+021B), nu cu sedilă. Mesajele de eroare se termină cu punct.
- **`createAdminSupabase()`** e permis de ESLint **doar** în `actions.ts`, `api/**/route.ts`,
  `rate-limit.ts`, `scripts/**`, `tests/**` — fiecare apel cu comentariu care spune de ce
  ocolește RLS.
- **`server-only`:** orice fișier din `src/lib/auth/**` îl importă, deci **nu poate fi testat**
  în vitest (environment `node`, fără condiția `react-server`). Logica testabilă merge în
  `src/config/**`, care e liber de `server-only`.
- **Verificarea reală:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
  `pnpm verify` **NU** include `build`, iar build-ul e singurul care prinde granița
  server/client.
- **pnpm 10.33.0** — pnpm 9 moare pe `pnpm-workspace.yaml`-ul acestui repo. Dacă `pnpm` global
  e 9.x, rulează binarele din `./node_modules/.bin/`.
- **Nicio migrare.** Schema susține deja tot.
- **Aplicația de firmă** (`src/app/(app)/**`) rămâne neatinsă.

## Abatere de la spec, deliberată

Spec-ul cere ramură de rutare și în `src/proxy.ts`. **Nu o facem.** Middleware-ul rulează pe
fiecare cerere potrivită, iar `isPlatformAdmin()` e un drum la bază — l-am pune pe calea
critică a întregii aplicații pentru un caz care apare o dată per login. Callback-ul decide
(o dată), iar `/alege-organizatia` prinde restul cazurilor. Lanțul se închide corect fără
costul din middleware.

---

## Structura fișierelor

| Fișier                                                      | Răspundere                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| `src/config/routes.ts` _(mod.)_                             | Rutele + **politica pură** de destinație după autentificare |
| `src/config/routes.test.ts` _(nou)_                         | Testele politicii                                           |
| `src/app/auth/callback/route.ts` _(mod.)_                   | Aplică politica după schimbul PKCE                          |
| `src/app/(auth)/alege-organizatia/page.tsx` _(mod.)_        | Ieșire spre consolă când lista e goală                      |
| `scripts/creeaza-super-admin.mjs` _(nou)_                   | Creează contul de platformă                                 |
| `src/app/globals.css` _(mod.)_                              | Un token: `--color-navy-abis`                               |
| `.../super-admin/_lib/fonturi.ts` _(nou)_                   | Instanțele Plex Sans + Plex Mono                            |
| `.../super-admin/_components/rail-platforma.tsx` _(nou)_    | Navigația navy (înlocuiește `nav-platforma.tsx`)            |
| `.../super-admin/_components/antet-platforma.tsx` _(nou)_   | Antetul navy + comutatorul de planuri                       |
| `.../super-admin/_components/cifra.tsx` _(nou)_             | Cartela din banda de stări                                  |
| `.../super-admin/_components/stare-organizatie.tsx` _(nou)_ | Pastila de stare                                            |
| `.../super-admin/_components/module-mini.tsx` _(nou)_       | Cele 14 pătrățele                                           |
| `.../super-admin/_components/sarcina.tsx` _(nou)_           | Rândul din coada de lucru                                   |
| `.../super-admin/_lib/sarcini.ts` _(nou)_                   | **Pură:** din date brute → listă de sarcini                 |
| `.../super-admin/_lib/sarcini.test.ts` _(nou)_              | Testele ei                                                  |
| `.../super-admin/organizatii/actions.ts` _(mod.)_           | Citirile cross-organizație (service_role)                   |
| `.../super-admin/layout.tsx` _(mod.)_                       | Scheletul consolei                                          |
| `.../super-admin/page.tsx` _(rescris)_                      | Panoul                                                      |
| `.../super-admin/organizatii/page.tsx` _(rescris)_          | Lista de firme                                              |
| `.../super-admin/audit/` → `jurnal-audit/`                  | Redenumire de rută                                          |

---

## Task 1: Politica de rutare după autentificare

**Fișiere:**

- Modifică: `src/config/routes.ts`
- Test: `src/config/routes.test.ts` _(nou)_

**Interfețe:**

- Produce: `RUTA_SUPER_ADMIN: string`;
  `rutaDupaAutentificare(stare: { estePlatformAdmin: boolean; areOrganizatii: boolean }): string`

- [ ] **Pasul 1 — scrie testul care eșuează**

`src/config/routes.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  RUTA_ALEGE_ORGANIZATIA,
  RUTA_DUPA_AUTENTIFICARE,
  RUTA_SUPER_ADMIN,
  rutaDupaAutentificare,
} from "./routes";

describe("rutaDupaAutentificare", () => {
  it("duce administratorul de platformă fără firme în consolă", () => {
    expect(rutaDupaAutentificare({ estePlatformAdmin: true, areOrganizatii: false })).toBe(
      RUTA_SUPER_ADMIN,
    );
  });

  it("duce administratorul de platformă CU firme tot în consolă", () => {
    // Planul de platformă e „acasă" pentru el; spre firmă comută explicit,
    // din antetul consolei.
    expect(rutaDupaAutentificare({ estePlatformAdmin: true, areOrganizatii: true })).toBe(
      RUTA_SUPER_ADMIN,
    );
  });

  it("duce utilizatorul obișnuit cu firme în aplicație", () => {
    expect(rutaDupaAutentificare({ estePlatformAdmin: false, areOrganizatii: true })).toBe(
      RUTA_DUPA_AUTENTIFICARE,
    );
  });

  it("duce utilizatorul fără firme la ecranul de alegere, care explică situația", () => {
    expect(rutaDupaAutentificare({ estePlatformAdmin: false, areOrganizatii: false })).toBe(
      RUTA_ALEGE_ORGANIZATIA,
    );
  });
});
```

- [ ] **Pasul 2 — rulează testul, confirmă că pică**

```bash
./node_modules/.bin/vitest run --project unit src/config/routes.test.ts
```

Așteptat: FAIL — `rutaDupaAutentificare is not a function`.

- [ ] **Pasul 3 — implementează**

Adaugă la finalul lui `src/config/routes.ts`:

```ts
export const RUTA_SUPER_ADMIN = "/super-admin";

/**
 * Unde ajunge cineva imediat după autentificare.
 *
 * Funcție pură, cu starea primită ca argument: apelantul face interogările, ea
 * doar decide. Așa poate fi testată fără bază de date și fără `server-only` —
 * `src/lib/auth/**` importă `server-only`, deci nimic de acolo nu intră în vitest.
 *
 * Administratorul de platformă ajunge în consolă chiar dacă e și membru într-o
 * firmă: planul de platformă e „acasă" pentru el, iar spre firmă comută explicit
 * din antet. Fără regula asta, cine are dublu rol n-ar vedea niciodată consola
 * la intrare și separarea ar rămâne doar pe hârtie.
 */
export function rutaDupaAutentificare(
  stare: Readonly<{ estePlatformAdmin: boolean; areOrganizatii: boolean }>,
): string {
  if (stare.estePlatformAdmin) return RUTA_SUPER_ADMIN;
  if (stare.areOrganizatii) return RUTA_DUPA_AUTENTIFICARE;
  // Ecranul de alegere tratează explicit lista goală și explică de ce e goală.
  return RUTA_ALEGE_ORGANIZATIA;
}
```

- [ ] **Pasul 4 — rulează testul, confirmă că trece**

```bash
./node_modules/.bin/vitest run --project unit src/config/routes.test.ts
```

Așteptat: PASS, 4 teste.

- [ ] **Pasul 5 — comite**

```bash
git add src/config/routes.ts src/config/routes.test.ts
git commit -m "feat(rutare): politică de destinație după autentificare, testată"
```

---

## Task 2: Callback-ul de autentificare aplică politica

**Fișiere:**

- Modifică: `src/app/auth/callback/route.ts`

**Interfețe:**

- Consumă: `rutaDupaAutentificare()`, `RUTA_SUPER_ADMIN` (Task 1);
  `isPlatformAdmin()` din `@/lib/auth/platform`
- Produce: nimic pentru alte sarcini

- [ ] **Pasul 1 — modifică importurile**

În `src/app/auth/callback/route.ts`, adaugă:

```ts
import { rutaDupaAutentificare } from "@/config/routes";
import { isPlatformAdmin } from "@/lib/auth/platform";
```

- [ ] **Pasul 2 — înlocuiește redirecționarea finală**

Înlocuiește ultima linie a funcției `GET`:

```ts
return NextResponse.redirect(new URL(next, baza));
```

cu:

```ts
// `next` explicit înseamnă link profund (invitație, resetare de parolă): se
// respectă. `caleInterna` întoarce „/" când parametrul lipsește, iar „/" e
// exact cazul în care avem voie să decidem noi destinația.
if (next !== "/") {
  return NextResponse.redirect(new URL(next, baza));
}

const [estePlatformAdmin, organizatii] = await Promise.all([
  isPlatformAdmin(),
  supabase
    .from("organization_members")
    .select("organization_id", { count: "exact", head: true })
    .eq("status", "active"),
]);

const destinatie = rutaDupaAutentificare({
  estePlatformAdmin,
  areOrganizatii: (organizatii.count ?? 0) > 0,
});

return NextResponse.redirect(new URL(destinatie, baza));
```

> Interogarea folosește clientul de sesiune, nu `service_role`: RLS filtrează
> singură rândurile utilizatorului curent, deci nu e nevoie de `.eq("user_id", …)`
> și nu ocolim nimic.

- [ ] **Pasul 3 — verifică granița server/client**

```bash
./node_modules/.bin/tsc --noEmit 2>&1 | grep -v "concedii/setari\|queries/leave" ; echo "cod: $?"
```

Așteptat: nicio linie nouă (cele două filtrate sunt datoria preexistentă din migrarea 0035).

- [ ] **Pasul 4 — comite**

```bash
git add src/app/auth/callback/route.ts
git commit -m "feat(auth): administratorul de platformă aterizează în consolă după login"
```

---

## Task 3: Ecranul „nicio organizație" oferă ieșire spre consolă

**Fișiere:**

- Modifică: `src/app/(auth)/alege-organizatia/page.tsx`

**Interfețe:**

- Consumă: `RUTA_SUPER_ADMIN` (Task 1); `isPlatformAdmin()`

- [ ] **Pasul 1 — adaugă importurile**

```ts
import { RUTA_AUTENTIFICARE, RUTA_SUPER_ADMIN } from "@/config/routes";
import { isPlatformAdmin } from "@/lib/auth/platform";
import { ShieldCheck } from "lucide-react";
```

(înlocuiește importul existent de `RUTA_AUTENTIFICARE`; păstrează `Building2`,
`LifeBuoy`, `LogOut` în importul de la `lucide-react`.)

- [ ] **Pasul 2 — citește starea de platformă**

După `const organizatii = await listUserOrganizations();` adaugă:

```ts
// Un administrator de platformă poate să nu aibă nicio firmă — e chiar forma
// corectă a contului. Fără ieșirea de mai jos, ecranul ăsta i-ar fi fundătură.
const estePlatformAdmin = organizatii.length === 0 ? await isPlatformAdmin() : false;
```

- [ ] **Pasul 3 — adaugă blocul de ieșire**

Imediat după `</header>` și înaintea blocului `areEroareAcces`:

```tsx
{
  estePlatformAdmin ? (
    <Link
      href={RUTA_SUPER_ADMIN}
      className="border-border bg-surface hover:border-primary flex items-center gap-3 rounded-md border px-4 py-3 transition"
    >
      <ShieldCheck aria-hidden="true" className="text-primary size-5 shrink-0" />
      <span className="flex flex-col">
        <span className="text-foreground text-sm font-medium">Intrați în consola de platformă</span>
        <span className="text-muted-foreground text-sm">
          Contul dumneavoastră administrează platforma, nu o firmă anume.
        </span>
      </span>
    </Link>
  ) : null;
}
```

- [ ] **Pasul 4 — verifică**

```bash
./node_modules/.bin/tsc --noEmit 2>&1 | grep -v "concedii/setari\|queries/leave"
./node_modules/.bin/eslint "src/app/(auth)/alege-organizatia/page.tsx"
```

Așteptat: fără ieșire.

- [ ] **Pasul 5 — comite**

```bash
git add "src/app/(auth)/alege-organizatia/page.tsx"
git commit -m "feat(auth): ieșire spre consolă pentru administratorul de platformă fără firme"
```

---

## Task 4: Contul de super-admin

**Fișiere:**

- Creează: `scripts/creeaza-super-admin.mjs`

**Interfețe:** niciuna (unealtă de operare)

- [ ] **Pasul 1 — scrie scriptul**

`scripts/creeaza-super-admin.mjs`:

```js
#!/usr/bin/env node
/**
 * Creează un cont de administrator de platformă — și NIMIC altceva.
 *
 * Contul NU primește rând în `organization_members`. Asta e chiar rostul lui:
 * super-adminul controlează platforma (ce firme există, ce module au pornite,
 * înregistrări), nu operează vreo firmă. Cine e și una și alta comută explicit
 * din antetul consolei.
 *
 * Idempotent: rulat de două ori pe aceeași adresă nu duplică nimic.
 *
 * Rulare:
 *   node scripts/creeaza-super-admin.mjs <email>
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email || !email.includes("@")) {
  console.error("Utilizare: node scripts/creeaza-super-admin.mjs <email>");
  process.exit(1);
}

// Citim .env.production direct: scriptul e o unealtă de operare, rulată din
// afara aplicației, deci nu trece prin `src/config/env.ts`.
const mediu = Object.fromEntries(
  readFileSync(new URL("../.env.production", import.meta.url), "utf8")
    .split("\n")
    .filter((linie) => linie.trim() && !linie.trimStart().startsWith("#"))
    .map((linie) => {
      const taiere = linie.indexOf("=");
      const cheie = linie.slice(0, taiere).trim();
      const valoare = linie
        .slice(taiere + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      return [cheie, valoare];
    }),
);

// service_role: crearea unui utilizator și scrierea în `platform_admins` sunt
// operațiuni de platformă, imposibile sub RLS-ul unui utilizator obișnuit.
const admin = createClient(mediu.NEXT_PUBLIC_SUPABASE_URL, mediu.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: listaUtilizatori, error: eroareLista } = await admin.auth.admin.listUsers({
  perPage: 1000,
});
if (eroareLista) {
  console.error("Nu s-a putut citi lista de utilizatori:", eroareLista.message);
  process.exit(1);
}

let utilizator = listaUtilizatori.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (utilizator) {
  console.log(`• Contul ${email} există deja (${utilizator.id}).`);
} else {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${mediu.NEXT_PUBLIC_APP_URL}/auth/callback`,
  });
  if (error) {
    console.error("Invitația a eșuat:", error.message);
    process.exit(1);
  }
  utilizator = data.user;
  console.log(`✓ Invitație trimisă către ${email} (${utilizator.id}).`);
}

const { data: existent } = await admin
  .from("platform_admins")
  .select("id, revoked_at")
  .eq("user_id", utilizator.id)
  .maybeSingle();

if (existent && existent.revoked_at === null) {
  console.log("• Are deja acces de platformă activ. Nimic de făcut.");
} else if (existent) {
  const { error } = await admin
    .from("platform_admins")
    .update({ revoked_at: null, revoked_by: null })
    .eq("id", existent.id);
  if (error) {
    console.error("Reactivarea accesului a eșuat:", error.message);
    process.exit(1);
  }
  console.log("✓ Acces de platformă reactivat.");
} else {
  const { error } = await admin
    .from("platform_admins")
    .insert({ user_id: utilizator.id, motiv: "cont propriu de super-admin" });
  if (error) {
    console.error("Acordarea accesului a eșuat:", error.message);
    process.exit(1);
  }
  console.log("✓ Acces de platformă acordat.");
}

const { count } = await admin
  .from("organization_members")
  .select("organization_id", { count: "exact", head: true })
  .eq("user_id", utilizator.id);

if ((count ?? 0) > 0) {
  console.warn(
    `⚠ Contul are ${count} apartenențe la firme. Un super-admin pur nu ar trebui să aibă niciuna.`,
  );
} else {
  console.log("✓ Nicio apartenență la vreo firmă — cont de platformă pur.");
}
```

- [ ] **Pasul 2 — rulează**

```bash
node scripts/creeaza-super-admin.mjs scoala.ai43@gmail.com
```

Așteptat: invitație trimisă, acces acordat, „cont de platformă pur".

- [ ] **Pasul 3 — verifică în bază**

```bash
set -a; source .env.production; set +a
curl -sS -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/platform_admins?select=user_id,revoked_at"
```

Așteptat: două rânduri, ambele cu `revoked_at: null`.

- [ ] **Pasul 4 — comite**

```bash
git add scripts/creeaza-super-admin.mjs
git commit -m "feat(scripts): unealtă pentru contul de administrator de platformă"
```

---

## Task 5: Tokenul și fonturile consolei

**Fișiere:**

- Modifică: `src/app/globals.css`
- Creează: `src/app/(platform)/super-admin/_lib/fonturi.ts`

**Interfețe:**

- Produce: `plexSans`, `plexMono` (obiecte `next/font` cu `.variable`);
  tokenul CSS `--color-navy-abis`

- [ ] **Pasul 1 — adaugă tokenul**

În `src/app/globals.css`, în blocul `:root`, imediat sub grupul „Navy":

```css
/*
   * Fundalul consolei de platformă — mai adânc decât primarul, folosit DOAR în
   * `(platform)/super-admin`. Raportul se inversează acolo intenționat: navy
   * devine fundal, crem rămâne pentru conținut. Culoarea spune singură în ce
   * plan ești, fără să fie nevoie de banner.
   */
--color-navy-abis: #0a1428;
```

Și în blocul `@theme inline`, lângă celelalte:

```css
--color-navy-abis: var(--color-navy-abis);
```

- [ ] **Pasul 2 — declară fonturile**

`src/app/(platform)/super-admin/_lib/fonturi.ts`:

```ts
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

/**
 * Fonturile consolei de platformă. Aplicația de firmă rămâne pe Inter.
 *
 * Subsetul `latin-ext` este OBLIGATORIU, din exact motivul documentat în
 * `src/app/layout.tsx`: româna corectă folosește ș și ț cu VIRGULĂ dedesubt
 * (U+0219, U+021B), nu cu sedilă. Fără el, browserul cade pe un font de rezervă
 * exact pentru aceste litere, iar textul apare cu grosimi amestecate în
 * mijlocul cuvintelor.
 *
 * Mono poartă cifrele — CUI, ore, plafoane, ID-uri de cerere — împreună cu
 * `tabular-nums`, ca să se alinieze în coloane la scanare.
 */
export const plexSans = IBM_Plex_Sans({
  variable: "--font-consola",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const plexMono = IBM_Plex_Mono({
  variable: "--font-consola-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});
```

- [ ] **Pasul 3 — verifică**

```bash
./node_modules/.bin/tsc --noEmit 2>&1 | grep -v "concedii/setari\|queries/leave"
```

Așteptat: fără ieșire.

- [ ] **Pasul 4 — comite**

```bash
git add src/app/globals.css "src/app/(platform)/super-admin/_lib/fonturi.ts"
git commit -m "feat(consolă): token navy-abis și fonturile Plex pentru zona de platformă"
```

---

## Task 6: Railul, antetul și scheletul

**Fișiere:**

- Creează: `src/app/(platform)/super-admin/_components/rail-platforma.tsx`
- Creează: `src/app/(platform)/super-admin/_components/antet-platforma.tsx`
- Modifică: `src/app/(platform)/super-admin/layout.tsx`
- Șterge: `src/app/(platform)/super-admin/_components/nav-platforma.tsx`

**Interfețe:**

- Consumă: `plexSans`, `plexMono` (Task 5); `RUTA_DUPA_AUTENTIFICARE`
- Produce: `<RailPlatforma numarOrganizatii numarCereriNoi />`,
  `<AntetPlatforma email titlu cale areFirme />`

- [ ] **Pasul 1 — scrie railul**

`_components/rail-platforma.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ClipboardList, LayoutDashboard, Mail, ScrollText } from "lucide-react";

/**
 * Navigația consolei de platformă.
 *
 * Grupată pe intenție, nu alfabetic: „Control" e ce SCHIMBI, „Urmă" e ce
 * CITEȘTI. Cele două intrări lipsă din vechiul meniu (panoul și e-mailurile)
 * sunt adăugate — existau ca pagini, dar nu se putea ajunge la ele.
 */
const GRUPURI = [
  {
    titlu: "Control",
    legaturi: [
      { href: "/super-admin", eticheta: "Panou", Icon: LayoutDashboard, exact: true },
      { href: "/super-admin/organizatii", eticheta: "Organizații", Icon: Building2 },
      { href: "/super-admin/cereri-demo", eticheta: "Cereri demo", Icon: ClipboardList },
    ],
  },
  {
    titlu: "Urmă",
    legaturi: [
      { href: "/super-admin/jurnal-audit", eticheta: "Jurnal audit", Icon: ScrollText },
      { href: "/super-admin/emailuri", eticheta: "E-mailuri", Icon: Mail },
    ],
  },
] as const;

type Props = Readonly<{ numarOrganizatii: number; numarCereriNoi: number }>;

export function RailPlatforma({ numarOrganizatii, numarCereriNoi }: Props) {
  const cale = usePathname();

  const numarul = (href: string): number | null => {
    if (href === "/super-admin/organizatii") return numarOrganizatii;
    if (href === "/super-admin/cereri-demo") return numarCereriNoi > 0 ? numarCereriNoi : null;
    return null;
  };

  return (
    <nav
      aria-label="Secțiuni ale consolei de platformă"
      className="bg-navy-abis flex shrink-0 flex-col gap-7 border-e border-white/8 p-3 md:w-56"
    >
      {GRUPURI.map((grup) => (
        <div key={grup.titlu} className="flex flex-col gap-1">
          <span className="px-2 font-mono text-[0.6rem] font-medium tracking-[0.15em] text-white/40 uppercase max-md:hidden">
            {grup.titlu}
          </span>
          <ul className="flex gap-1 overflow-x-auto md:flex-col">
            {grup.legaturi.map(({ href, eticheta, Icon, ...rest }) => {
              const exact = "exact" in rest && rest.exact === true;
              const activ = exact ? cale === href : cale === href || cale.startsWith(`${href}/`);
              const numar = numarul(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={activ ? "page" : undefined}
                    className={`relative flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition ${
                      activ
                        ? "bg-white/10 text-white"
                        : "text-white/55 hover:bg-white/5 hover:text-white/90"
                    }`}
                  >
                    {/* Singurul auriu din rail: indicatorul de pagină activă. */}
                    {activ ? (
                      <span
                        aria-hidden="true"
                        className="bg-accent absolute -start-3 top-1.5 bottom-1.5 w-[3px] rounded-e-sm max-md:hidden"
                      />
                    ) : null}
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span className="whitespace-nowrap">{eticheta}</span>
                    {numar !== null ? (
                      <span className="bg-accent text-navy-abis ms-auto rounded-full px-1.5 font-mono text-[0.68rem] font-semibold tabular-nums">
                        {numar}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
```

- [ ] **Pasul 2 — scrie antetul**

`_components/antet-platforma.tsx`:

```tsx
import Link from "next/link";
import { ArrowLeftRight, ShieldCheck } from "lucide-react";

import { RUTA_DUPA_AUTENTIFICARE } from "@/config/routes";

type Props = Readonly<{
  titlu: string;
  cale: string;
  email: string;
  /** Are și apartenență la vreo firmă? Doar atunci arătăm comutatorul. */
  areFirme: boolean;
}>;

/**
 * Antetul consolei.
 *
 * Comutatorul spre aplicația de firmă apare DOAR pentru cine chiar are o firmă.
 * Pentru un super-admin pur, un link către `/panou` ar fi o promisiune falsă:
 * l-ar duce prin `resolveTenant()` în `fara_organizatie` și înapoi la alegere.
 */
export function AntetPlatforma({ titlu, cale, email, areFirme }: Props) {
  return (
    <header className="bg-primary flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/8 px-5 py-2.5">
      <span className="text-accent" aria-hidden="true">
        <ShieldCheck className="size-4" />
      </span>
      <span className="text-sm font-semibold text-white">{titlu}</span>
      <span className="font-mono text-xs text-white/45">{cale}</span>

      <div className="ms-auto flex items-center gap-4">
        {areFirme ? (
          <Link
            href={RUTA_DUPA_AUTENTIFICARE}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeftRight aria-hidden="true" className="size-3.5" />
            Treci în firmă
          </Link>
        ) : null}
        <span className="font-mono text-xs text-white/45">{email}</span>
      </div>
    </header>
  );
}
```

- [ ] **Pasul 3 — rescrie layout-ul**

`src/app/(platform)/super-admin/layout.tsx` — conținut complet:

```tsx
import type { ReactNode } from "react";

import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createServerSupabase } from "@/lib/supabase/server";

import { AntetPlatforma } from "./_components/antet-platforma";
import { RailPlatforma } from "./_components/rail-platforma";
import { plexMono, plexSans } from "./_lib/fonturi";
import { sumarPlatforma } from "./organizatii/actions";

export default async function LayoutSuperAdmin({ children }: { children: ReactNode }) {
  // Poarta principală: nimic din acest segment nu se randează fără verificare
  // server-side. Se repetă în fiecare Server Action — layout-ul nu le protejează.
  const utilizator = await requirePlatformAdmin();
  const supabase = await createServerSupabase();

  const [sumar, apartenente] = await Promise.all([
    sumarPlatforma(),
    supabase
      .from("organization_members")
      .select("organization_id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  const totalOrganizatii = Object.values(sumar.organizatii).reduce((t, v) => t + v, 0);

  return (
    <div
      className={`${plexSans.variable} ${plexMono.variable} bg-navy-abis flex min-h-dvh flex-col md:flex-row`}
      style={{ fontFamily: "var(--font-consola)" }}
    >
      <RailPlatforma numarOrganizatii={totalOrganizatii} numarCereriNoi={sumar.cereriDemoNoi} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AntetPlatforma
          titlu="Consolă de platformă"
          cale="/super-admin"
          email={utilizator.email}
          areFirme={(apartenente.count ?? 0) > 0}
        />
        <main id="continut" className="bg-background min-w-0 flex-1 p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Pasul 4 — șterge vechea navigație**

```bash
git rm "src/app/(platform)/super-admin/_components/nav-platforma.tsx"
```

- [ ] **Pasul 5 — verifică build-ul**

```bash
./node_modules/.bin/next build 2>&1 | tail -25
```

Așteptat: „Compiled successfully". Build-ul e singurul care prinde granița
server/client — `rail-platforma.tsx` e `"use client"`, `antet-platforma.tsx` nu.

- [ ] **Pasul 6 — comite**

```bash
git add -A "src/app/(platform)/super-admin"
git commit -m "feat(consolă): schelet navy — rail, antet, fonturi"
```

---

## Task 7: Componentele de date

**Fișiere:**

- Creează: `_components/cifra.tsx`, `_components/stare-organizatie.tsx`,
  `_components/module-mini.tsx`, `_components/sarcina.tsx`

**Interfețe:**

- Produce: `<Cifra eticheta valoare nota ton />`,
  `<StareOrganizatie stare />`, `<ModuleMini active total />`,
  `<Sarcina titlu detaliu href eticheta ton />`

> Nu au teste: proiectul rulează vitest cu `environment: "node"`, fără jsdom, deci
> nu există infrastructură de test pentru componente. Verificarea lor e `pnpm build`
> plus parcurgerea manuală de la Task 11.

- [ ] **Pasul 1 — `cifra.tsx`**

```tsx
type Ton = "neutru" | "bun" | "atentie";

type Props = Readonly<{
  eticheta: string;
  valoare: number;
  nota?: string;
  ton?: Ton;
}>;

const DUNGA: Readonly<Record<Ton, string>> = {
  neutru: "bg-border",
  bun: "bg-success",
  atentie: "bg-accent",
};

/**
 * Cartela din banda de stări.
 *
 * Starea e codificată și în FORMĂ, nu doar în număr: dunga de sus se citește
 * periferic, fără să compari cifre. Un panou de control se scanează, nu se
 * citește.
 */
export function Cifra({ eticheta, valoare, nota, ton = "neutru" }: Props) {
  return (
    <div
      className={`border-border relative overflow-hidden rounded-lg border p-4 ${
        ton === "atentie" ? "bg-accent/8" : "bg-surface"
      }`}
    >
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-0.5 ${DUNGA[ton]}`} />
      <dt className="text-muted-foreground text-sm font-medium">{eticheta}</dt>
      <dd className="text-primary mt-0.5 text-3xl font-semibold tabular-nums">{valoare}</dd>
      {nota ? (
        <span className="text-muted-foreground mt-0.5 block font-mono text-[0.66rem]">{nota}</span>
      ) : null}
    </div>
  );
}
```

- [ ] **Pasul 2 — `stare-organizatie.tsx`**

```tsx
export type StareOrg = "pending" | "active" | "suspended" | "archived";

const STARI: Readonly<Record<StareOrg, { eticheta: string; clase: string }>> = {
  active: { eticheta: "Activă", clase: "text-success bg-success/10 border-success/25" },
  pending: { eticheta: "În așteptare", clase: "text-warning bg-warning/10 border-warning/25" },
  suspended: { eticheta: "Suspendată", clase: "text-danger bg-danger/10 border-danger/25" },
  archived: { eticheta: "Arhivată", clase: "text-muted-foreground bg-surface border-border" },
};

/** Pastila de stare — culoare ȘI cuvânt, fiindcă culoarea singură nu e accesibilă. */
export function StareOrganizatie({ stare }: Readonly<{ stare: StareOrg }>) {
  const { eticheta, clase } = STARI[stare];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${clase}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {eticheta}
    </span>
  );
}
```

- [ ] **Pasul 3 — `module-mini.tsx`**

```tsx
type Props = Readonly<{ active: number; total: number }>;

/**
 * Modulele ca pătrățele, nu ca fracție.
 *
 * „1/14" te obligă să gândești; un rând aproape gol se vede din reflex. Exact
 * asta vrei să observi la scanarea listei: firme înregistrate dar nepornite.
 */
export function ModuleMini({ active, total }: Props) {
  return (
    <span className="flex items-center gap-[3px]" title={`${active} din ${total} module active`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`size-2 rounded-[2px] ${i < active ? "bg-primary" : "bg-border"}`}
        />
      ))}
      <span className="text-muted-foreground ms-1.5 font-mono text-xs tabular-nums">
        {active}/{total}
      </span>
    </span>
  );
}
```

- [ ] **Pasul 4 — `sarcina.tsx`**

```tsx
import Link from "next/link";

type Props = Readonly<{
  titlu: string;
  detaliu: string;
  href: string;
  eticheta: string;
  urgent?: boolean;
}>;

/** Un rând din coada de lucru: ce e, de ce, și butonul care o rezolvă. */
export function Sarcina({ titlu, detaliu, href, eticheta, urgent = false }: Props) {
  return (
    <li className="border-border flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full ${
          urgent ? "bg-accent ring-accent/20 ring-4" : "bg-muted-foreground/50"
        }`}
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-foreground text-sm font-semibold">{titlu}</span>
        <span className="text-muted-foreground text-sm">{detaliu}</span>
      </span>
      <Link
        href={href}
        className="border-border bg-background text-primary hover:border-primary ms-auto shrink-0 rounded-md border px-3 py-1.5 text-sm font-semibold transition"
      >
        {eticheta}
      </Link>
    </li>
  );
}
```

- [ ] **Pasul 5 — verifică și comite**

```bash
./node_modules/.bin/next build 2>&1 | tail -8
git add "src/app/(platform)/super-admin/_components"
git commit -m "feat(consolă): componente de date — cifră, stare, module, sarcină"
```

---

## Task 8: Datele panoului

**Fișiere:**

- Creează: `src/app/(platform)/super-admin/_lib/sarcini.ts`
- Creează: `src/app/(platform)/super-admin/_lib/sarcini.test.ts`
- Modifică: `src/app/(platform)/super-admin/organizatii/actions.ts`

**Interfețe:**

- Produce: `type RandOrganizatiePanou`, `construiesteSarcini()`,
  `datePanou(): Promise<{ sumar; organizatii; sarcini; activitate }>`

- [ ] **Pasul 1 — scrie testul care eșuează**

`_lib/sarcini.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { construiesteSarcini } from "./sarcini";

const firma = (
  peste: Partial<Parameters<typeof construiesteSarcini>[0]["organizatii"][number]>,
) => ({
  id: "00000000-0000-0000-0000-000000000001",
  name: "Firma X",
  status: "active" as const,
  moduleActive: 8,
  administratori: 1,
  ...peste,
});

describe("construiesteSarcini", () => {
  it("semnalează cererile demo noi, ca sarcină urgentă", () => {
    const sarcini = construiesteSarcini({ cereriDemoNoi: 2, organizatii: [] });
    expect(sarcini).toHaveLength(1);
    expect(sarcini[0]).toMatchObject({ cheie: "cereri-demo", urgent: true });
    expect(sarcini[0].titlu).toContain("2");
  });

  it("nu semnalează nimic când nu sunt cereri noi", () => {
    expect(construiesteSarcini({ cereriDemoNoi: 0, organizatii: [] })).toEqual([]);
  });

  it("semnalează firma pornită doar cu nucleul", () => {
    const sarcini = construiesteSarcini({
      cereriDemoNoi: 0,
      organizatii: [firma({ name: "Beta Demo SRL", moduleActive: 1 })],
    });
    expect(sarcini).toHaveLength(1);
    expect(sarcini[0].cheie).toBe("fara-module");
    expect(sarcini[0].titlu).toContain("Beta Demo SRL");
  });

  it("nu semnalează o firmă cu module de lucru pornite", () => {
    const sarcini = construiesteSarcini({
      cereriDemoNoi: 0,
      organizatii: [firma({ moduleActive: 5 })],
    });
    expect(sarcini).toEqual([]);
  });

  it("semnalează firma rămasă fără administrator", () => {
    const sarcini = construiesteSarcini({
      cereriDemoNoi: 0,
      organizatii: [firma({ name: "Firma Test", administratori: 0 })],
    });
    expect(sarcini.map((s) => s.cheie)).toContain("fara-admin");
  });

  it("ignoră firmele arhivate — nu mai sunt treaba nimănui", () => {
    const sarcini = construiesteSarcini({
      cereriDemoNoi: 0,
      organizatii: [firma({ status: "archived", moduleActive: 1, administratori: 0 })],
    });
    expect(sarcini).toEqual([]);
  });
});
```

- [ ] **Pasul 2 — rulează, confirmă că pică**

```bash
./node_modules/.bin/vitest run --project unit "src/app/(platform)/super-admin/_lib/sarcini.test.ts"
```

Așteptat: FAIL — modulul nu există.

- [ ] **Pasul 3 — implementează**

`_lib/sarcini.ts`:

```ts
import type { StareOrg } from "../_components/stare-organizatie";

export type RandOrganizatiePanou = Readonly<{
  id: string;
  name: string;
  status: StareOrg;
  /** Include `nucleu`, care e mereu pornit. */
  moduleActive: number;
  administratori: number;
}>;

export type SarcinaPanou = Readonly<{
  cheie: string;
  titlu: string;
  detaliu: string;
  href: string;
  eticheta: string;
  urgent: boolean;
}>;

/**
 * Din starea platformei → lista de lucruri care cer acțiune.
 *
 * Funcție pură, ca să poată fi testată fără bază de date: apelantul face
 * interogările, ea doar decide ce merită arătat.
 *
 * Regula care ține panoul folositor: se raportează DOAR ce e detectabil și
 * rezolvabil. Un panou care e mereu plin nu mai înseamnă nimic — ăsta trebuie
 * să se golească atunci când ți-ai făcut treaba.
 */
export function construiesteSarcini(
  stare: Readonly<{ cereriDemoNoi: number; organizatii: readonly RandOrganizatiePanou[] }>,
): readonly SarcinaPanou[] {
  const sarcini: SarcinaPanou[] = [];

  if (stare.cereriDemoNoi > 0) {
    const plural = stare.cereriDemoNoi === 1;
    sarcini.push({
      cheie: "cereri-demo",
      titlu: plural
        ? "O cerere de demonstrație așteaptă răspuns"
        : `${stare.cereriDemoNoi} cereri de demonstrație așteaptă răspuns`,
      detaliu: "Neatinse de la primire.",
      href: "/super-admin/cereri-demo",
      eticheta: "Deschide",
      urgent: true,
    });
  }

  for (const org of stare.organizatii) {
    // O firmă arhivată nu mai e treaba nimănui.
    if (org.status === "archived") continue;

    // `nucleu` e mereu pornit, deci „doar nucleul" înseamnă exact 1.
    if (org.moduleActive <= 1) {
      sarcini.push({
        cheie: "fara-module",
        titlu: `${org.name} are pornit doar nucleul`,
        detaliu: "Niciun modul de lucru activ de la înregistrare.",
        href: `/super-admin/organizatii/${org.id}/module`,
        eticheta: "Module",
        urgent: false,
      });
    }

    if (org.administratori === 0) {
      sarcini.push({
        cheie: "fara-admin",
        titlu: `${org.name} nu are niciun administrator`,
        detaliu: "Nimeni nu poate administra firma din interior.",
        href: `/super-admin/organizatii/${org.id}/membri`,
        eticheta: "Membri",
        urgent: true,
      });
    }
  }

  return sarcini;
}
```

- [ ] **Pasul 4 — rulează, confirmă că trece**

```bash
./node_modules/.bin/vitest run --project unit "src/app/(platform)/super-admin/_lib/sarcini.test.ts"
```

Așteptat: PASS, 6 teste.

- [ ] **Pasul 5 — adaugă citirea în `organizatii/actions.ts`**

La finalul fișierului:

```ts
/**
 * Tot ce afișează panoul, într-o singură trecere.
 *
 * `createAdminSupabase()` ocolește RLS deliberat: citirile de platformă sunt
 * prin definiție cross-organizație, iar un platform admin nu e membru nicăieri,
 * deci politicile per-tenant i-ar întoarce zero rânduri. Poarta e
 * `requirePlatformAdmin()` de mai jos, nu RLS-ul.
 *
 * Stă aici, în `actions.ts`, nu în `src/lib/queries/`, fiindcă ESLint permite
 * `createAdminSupabase()` doar în `actions.ts`, `api/**\/route.ts`,
 * `rate-limit.ts`, `scripts/**` și `tests/**`.
 */
export async function datePanou() {
  await requirePlatformAdmin();
  const admin = createAdminSupabase();

  const [sumar, organizatii, module, membri, activitate] = await Promise.all([
    sumarPlatforma(),
    admin
      .from("organizations")
      .select("id, name, status, cui, oras, plan, seats_limit, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    admin
      .from("organization_features")
      .select("organization_id")
      .eq("enabled", true)
      .is("deleted_at", null),
    admin.from("organization_members").select("organization_id, role").eq("status", "active"),
    admin
      .from("audit_logs")
      .select("id, action, entity_type, created_at, organization_id, status")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const numaraPe = (randuri: readonly { organization_id: string }[]) => {
    const harta = new Map<string, number>();
    for (const rand of randuri) {
      harta.set(rand.organization_id, (harta.get(rand.organization_id) ?? 0) + 1);
    }
    return harta;
  };

  const moduleP = numaraPe(module.data ?? []);
  const adminiP = numaraPe((membri.data ?? []).filter((m) => m.role === "org_admin"));

  const randuri = (organizatii.data ?? []).map((o) => ({
    ...o,
    moduleActive: moduleP.get(o.id) ?? 0,
    administratori: adminiP.get(o.id) ?? 0,
  }));

  return {
    sumar,
    organizatii: randuri,
    sarcini: construiesteSarcini({
      cereriDemoNoi: sumar.cereriDemoNoi,
      organizatii: randuri,
    }),
    activitate: activitate.data ?? [],
  };
}
```

Adaugă importul la începutul fișierului:

```ts
import { construiesteSarcini } from "../_lib/sarcini";
```

- [ ] **Pasul 6 — verifică și comite**

```bash
./node_modules/.bin/tsc --noEmit 2>&1 | grep -v "concedii/setari\|queries/leave"
./node_modules/.bin/vitest run --project unit
git add "src/app/(platform)/super-admin/_lib" "src/app/(platform)/super-admin/organizatii/actions.ts"
git commit -m "feat(consolă): datele panoului + coada de lucru, testată"
```

---

## Task 9: Panoul

**Fișiere:**

- Rescrie: `src/app/(platform)/super-admin/page.tsx`

**Interfețe:**

- Consumă: `datePanou()` (Task 8); `Cifra`, `Sarcina` (Task 7)

- [ ] **Pasul 1 — rescrie pagina**

```tsx
import Link from "next/link";

import { Cifra } from "./_components/cifra";
import { Sarcina } from "./_components/sarcina";
import { datePanou } from "./organizatii/actions";

export const metadata = { title: "Panou de platformă" };

const ETICHETE_ACTIUNE: Readonly<Record<string, string>> = {
  feature_toggled: "Modul comutat",
  invite_sent: "Invitație trimisă",
  invite_revoked: "Invitație anulată",
  role_changed: "Rol schimbat",
  update: "Modificare",
};

export default async function PaginaPanouPlatforma() {
  const { sumar, sarcini, activitate } = await datePanou();
  const { pending, active, suspended } = sumar.organizatii;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-foreground text-2xl font-semibold">Panou de platformă</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Firme, module și înregistrări. Operarea fiecărei firme se face din contul ei.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cifra eticheta="Active" valoare={active} ton={active > 0 ? "bun" : "neutru"} />
        <Cifra eticheta="În așteptare" valoare={pending} />
        <Cifra eticheta="Suspendate" valoare={suspended} />
        <Cifra
          eticheta="Cereri noi"
          valoare={sumar.cereriDemoNoi}
          ton={sumar.cereriDemoNoi > 0 ? "atentie" : "neutru"}
        />
      </dl>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="border-border bg-surface overflow-hidden rounded-lg border">
          <h2 className="border-border bg-background border-b px-4 py-2.5 text-sm font-semibold">
            De rezolvat
          </h2>
          {sarcini.length > 0 ? (
            <ul>
              {sarcini.map((s) => (
                <Sarcina
                  key={`${s.cheie}-${s.href}`}
                  titlu={s.titlu}
                  detaliu={s.detaliu}
                  href={s.href}
                  eticheta={s.eticheta}
                  urgent={s.urgent}
                />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground px-4 py-8 text-center text-sm">
              Nimic de rezolvat. Panoul se golește când totul e în regulă.
            </p>
          )}
        </section>

        <section className="border-border bg-surface overflow-hidden rounded-lg border">
          <h2 className="border-border bg-background border-b px-4 py-2.5 text-sm font-semibold">
            Ce s-a schimbat
          </h2>
          {activitate.length > 0 ? (
            <ul>
              {activitate.map((intrare) => (
                <li
                  key={intrare.id}
                  className="border-border grid grid-cols-[3.5rem_1fr] gap-3 border-b px-4 py-2.5 last:border-b-0"
                >
                  <time
                    dateTime={intrare.created_at}
                    className="text-muted-foreground font-mono text-xs"
                  >
                    {new Date(intrare.created_at).toLocaleDateString("ro-RO", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </time>
                  <span className="text-sm">
                    <b className="font-semibold">
                      {ETICHETE_ACTIUNE[intrare.action] ?? intrare.action}
                    </b>
                    <span className="text-muted-foreground"> · {intrare.entity_type}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground px-4 py-8 text-center text-sm">
              Nicio activitate înregistrată încă.
            </p>
          )}
          <div className="border-border border-t px-4 py-2.5">
            <Link
              href="/super-admin/jurnal-audit"
              className="text-primary text-sm font-semibold underline-offset-4 hover:underline"
            >
              Vezi jurnalul complet
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Pasul 2 — verifică și comite**

```bash
./node_modules/.bin/next build 2>&1 | tail -8
git add "src/app/(platform)/super-admin/page.tsx"
git commit -m "feat(consolă): panou de platformă cu coadă de lucru și activitate"
```

---

## Task 10: Lista de organizații

**Fișiere:**

- Rescrie: `src/app/(platform)/super-admin/organizatii/page.tsx`

**Interfețe:**

- Consumă: `datePanou()` (Task 8); `StareOrganizatie`, `ModuleMini` (Task 7)

> Citește pagina existentă înainte de a o rescrie: are filtre
> (`_components/filtre-organizatii.tsx`) care trebuie păstrate. Se schimbă
> **prezentarea rândurilor**, nu funcționalitatea.

- [ ] **Pasul 1 — citește ce există**

```bash
cat "src/app/(platform)/super-admin/organizatii/page.tsx"
```

- [ ] **Pasul 2 — înlocuiește corpul tabelului**

Păstrează antetul paginii, filtrele și paginarea existente. Rândul devine:

```tsx
<tr key={org.id} className="border-border border-b last:border-b-0">
  <td className="px-4 py-3">
    <Link href={`/super-admin/organizatii/${org.id}`} className="flex flex-col">
      <span className="text-foreground text-sm font-semibold hover:underline">{org.name}</span>
      <span className="text-muted-foreground font-mono text-xs">{org.cui}</span>
    </Link>
  </td>
  <td className="text-muted-foreground px-4 py-3 text-sm">{org.oras ?? "—"}</td>
  <td className="px-4 py-3">
    <StareOrganizatie stare={org.status} />
  </td>
  <td className="px-4 py-3">
    <span className="text-muted-foreground font-mono text-xs uppercase">{org.plan}</span>
  </td>
  <td className="px-4 py-3">
    <ModuleMini active={org.moduleActive} total={TOTAL_MODULE} />
  </td>
  <td className="px-4 py-3">
    <span className="font-mono text-xs tabular-nums">
      {org.administratori}/{org.seats_limit}
    </span>
  </td>
</tr>
```

Cu, în capul fișierului:

```ts
import { FEATURE_KEYS } from "@/config/features";

/** Totalul din catalogul CODULUI, nu din bază: pătrățelele arată ce știe aplicația. */
const TOTAL_MODULE = FEATURE_KEYS.length;
```

Și învelește tabelul, dacă nu e deja:

```tsx
<div className="overflow-x-auto">{/* tabelul */}</div>
```

- [ ] **Pasul 3 — verifică și comite**

```bash
./node_modules/.bin/next build 2>&1 | tail -8
git add "src/app/(platform)/super-admin/organizatii/page.tsx"
git commit -m "feat(consolă): lista de firme cu stare și module citite din rând"
```

---

## Task 11: Redenumirea rutei de audit și proba finală

**Fișiere:**

- Redenumește: `src/app/(platform)/super-admin/audit/` → `jurnal-audit/`

- [ ] **Pasul 1 — redenumește**

```bash
git mv "src/app/(platform)/super-admin/audit" "src/app/(platform)/super-admin/jurnal-audit"
```

- [ ] **Pasul 2 — confirmă că nu mai există referințe la vechea rută**

```bash
grep -rn "super-admin/audit" src/ || echo "✓ nicio referință rămasă"
```

Așteptat: „✓ nicio referință rămasă". (`src/app/api/export/audit/route.ts` e altceva —
ruta de export, nu pagina. Rămâne cum e.)

- [ ] **Pasul 3 — lanțul complet de verificare**

```bash
./node_modules/.bin/tsc --noEmit 2>&1 | grep -v "concedii/setari\|queries/leave"
./node_modules/.bin/eslint .
./node_modules/.bin/vitest run --project unit
./node_modules/.bin/next build
```

Așteptat: typecheck fără linii noi · lint curat · toate testele trec ·
„Compiled successfully".

- [ ] **Pasul 4 — publică**

```bash
./administrativo.sh prod
```

Așteptat: tag nou cu marcaj de timp, „Convergent: 2/2 replici active pe
administrativo-web:&lt;tag&gt;", `healthz` 200.

- [ ] **Pasul 5 — proba manuală**

| Verificare                                         | Așteptat                                                  |
| -------------------------------------------------- | --------------------------------------------------------- |
| Login cu `scoala.ai43@gmail.com`                   | aterizează direct în `/super-admin`                       |
| Antetul consolei                                   | **fără** „Treci în firmă" (cont pur de platformă)         |
| Login cu `demo_admin@gmail.com`                    | aterizează în `/super-admin`, **cu** „Treci în firmă"     |
| Meniu → Jurnal audit                               | se deschide, nu 404                                       |
| Panoul                                             | 3 firme, 1 cerere demo, sarcini pentru Beta și Firma Test |
| `/super-admin` cu un cont `org_admin` obișnuit     | **404**, nu 403                                           |
| `https://infomeditatii.ro/panou` cu cont de firmă  | neschimbat                                                |
| Vecinii (`nortiauno.com`, `buget.scoala-ai.ro`, …) | 200                                                       |

- [ ] **Pasul 6 — comite**

```bash
git add -A "src/app/(platform)/super-admin"
git commit -m "refactor(consolă): ruta de audit devine jurnal-audit, aliniată cu meniul"
```

---

## Auto-verificare a planului

**Acoperirea spec-ului:** etapa 1 → Task 1–3 · etapa 2 → Task 4 · etapa 3 → Task 5–6 ·
etapa 4 → Task 7–11. Etapa 5 e amânată explicit, cu motiv.

**Marcaje neterminate:** niciunul — fiecare pas are cod real sau comandă rulabilă.

**Consecvența tipurilor:** `StareOrg` definit în Task 7 și consumat în Task 8 și 10 ·
`RandOrganizatiePanou` definit în Task 8, consumat de `construiesteSarcini` · `Cifra`,
`Sarcina`, `StareOrganizatie`, `ModuleMini` definite în Task 7, consumate în Task 9–10 ·
`rutaDupaAutentificare` definită în Task 1, consumată în Task 2.

**Abatere de la spec:** `src/proxy.ts` nu se atinge — argumentat mai sus.
