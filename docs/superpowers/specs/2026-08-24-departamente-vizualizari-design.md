# Departamente — două vizualizări și managementul persoanelor

**Data:** 2026-08-24
**Stare:** aprobat în discuție, gata de plan de implementare
**Ecran:** `/departamente`

---

## 1. De ce

Cererea a fost „listă + organigramă cu pătrate, plus să pot adăuga, modifica și
muta o persoană dintr-un departament". Explorarea codului a arătat că sub cerere
stau cinci defecte reale, nu doar o lipsă de vizualizare.

| #   | Constatare                                                                                                                                                                                                                                                     | Dovada                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| D1  | `dezactiveazaDepartament` refuză cu „Mutați-i în altă structură înainte de dezactivare", dar **unealta de mutat oameni nu există în aplicație**. Singura cale e fișa completă a fiecărui angajat, una câte una.                                                  | `departamente/actions.ts:159`              |
| D2  | Citirile stau inline în `page.tsx`, **fără `.limit()` și fără cursor**. Peste `max_rows = 1000` PostgREST trunchiază tăcut: pastilele de efectiv arată cifre mai mici, iar un departament plin poate afișa „Departament gol".                                    | `departamente/page.tsx:253`                |
| D3  | Fiindcă citirea nu e în `src/lib/queries/`, **scapă de poarta structurală** care caută numărători greșite — aceea enumeră doar directorul de citiri.                                                                                                            | `numaratoare-paginata.test.ts:35`          |
| D4  | `employees.department_id` e cheie străină simplă, **fără verificare de organizație** — nici trigger, nici `WITH CHECK`. În aceeași migrare, `departments.parent_id` și `departments.manager_employee_id` au verificarea. E singura relație din trio-ul HR nepăzită. | `0004_hr.sql:174` vs `:754` și `:819`      |
| D5  | Modulul are **zero teste**. `grep departamente` prin toate testele iese gol.                                                                                                                                                                                    | —                                          |

Refacerea închide D1–D3 și D5 ca efect direct al lucrului cerut, și acoperă D4
în aplicație (vezi §8, riscuri).

## 2. Ce nu face

- **Nicio migrare.** Gaura cross-tenant D4 se astupă corect cu un trigger, ca la
  `parent_id`, dar aceea e o schimbare de bază pe producție și cere cerere
  separată cu confirmare explicită.
- **Nu atinge `/organigrama`** — organigrama de _persoane_ (ierarhia
  `manager_employee_id`) rămâne neschimbată. Este o ierarhie diferită de cea de
  departamente (`parent_id`) și cele două se pot contrazice legitim.
- **Fără drag & drop.** Mutarea se face prin dialog cu selector — decizie luată
  în discuție, pentru accesibilitate la tastatură și pe telefon.
- **Fără creare de fișă nouă din acest ecran.** „Adaugă persoană" înseamnă
  _repartizarea unui angajat existent_. Fișa se creează în continuare din
  `/angajati`.
- **Nu extinde permisiunile.** Niciun rol nou, niciun seed nou.

## 3. Arhitectura

Șapte unități, fiecare cu o singură responsabilitate.

```
src/domain/departments/arbore.ts             NOU  pur, testabil fără bază
src/lib/queries/departments.ts                NOU  proprietarul citirilor
src/components/ui/comutator-vizualizare.tsx   NOU  primitivă partajată
src/app/(app)/departamente/
  page.tsx                                    modificat: porți + citiri + rutare
  vizualizare-lista.tsx                       NOU
  vizualizare-organigrama.tsx                 NOU
  panou-departament.tsx                       NOU  client, pop-up de lucru
  actions.ts                                  modificat: +1 acțiune
```

### 3.1 `src/domain/departments/arbore.ts` — logica pură

`grupeaza` și `construieste` trăiesc azi în `page.tsx`, deci nu pot fi testate.
Amândouă vizualizările au nevoie de ele. Mutate în `src/domain/`, alături de
restul calculului pur al proiectului, devin primul test al modulului.

```ts
export interface NodDepartament<T> {
  readonly id: string;
  readonly parent_id: string | null;
  readonly copii: readonly NodDepartament<T>[];
  readonly efectivDirect: number;
  readonly efectivCumulat: number; // cu tot cu subarbore
  readonly date: T;
}

export function construiesteArbore<T extends { id: string; parent_id: string | null }>(
  randuri: readonly T[],
  efectivPeDepartament: ReadonlyMap<string, number>,
): readonly NodDepartament<T>[];
```

Reguli fixate, fiecare cu un test:

- Un rând al cărui `parent_id` nu e în setul primit devine **rădăcină**
  (departament șters logic sau invizibil prin RLS). Nu se pierde niciodată.
- `efectivCumulat` = suma proprie plus a tuturor descendenților. Cifra asta nu
  există azi nicăieri și e motivul principal pentru care organigrama e utilă.
- Ordinea între frați o dă apelantul prin ordinea din `randuri`; funcția nu
  resortează.
- Adâncimea maximă e 12, impusă de trigger-ul din bază; funcția nu se apără
  suplimentar de cicluri, dar are un test care documentează comportamentul la un
  ciclu injectat (nu intră în buclă infinită, nodul ciclat rămâne rădăcină).

### 3.2 `src/lib/queries/departments.ts` — citirile

Modulul nu există azi, deși `.from("departments")` apare în 3 module de citiri și
8 pagini. `/angajati` își ia lista de departamente din `queries/attendance.ts`,
cu un comentariu care recunoaște că nu e locul ei.

Convențiile stratului: funcții libere, `organizationId` primul argument, tipuri
`readonly`, `.returns<T[]>()`, `.is("deleted_at", null)` explicit.

```ts
export async function structuraDepartamentelor(
  organizationId: string,
): Promise<readonly RandDepartament[]>;

export async function angajatiPentruStructura(
  organizationId: string,
  scope: PermissionScope,
  propriaFisaId: string | null,
): Promise<readonly AngajatStructura[]>;
```

- Ambele trec prin `citesteTot` din `src/lib/queries/citeste-tot.ts`, cu cheie
  keyset pe `id` — repară D2. `citesteTot` **aruncă** la plafon în loc să
  trunchieze, ceea ce e exact comportamentul dorit: o eroare se vede, o cifră mai
  mică cu 15 % nu.
- `angajatiPentruStructura` întoarce **și angajații cu `department_id = null`** —
  nerepartizații, azi complet invizibili pe ecran.
- Mutarea codului în `src/lib/queries/` îl aduce automat sub poarta structurală
  din D3.
- Avatarele rămân un singur apel `avataturiPeUtilizatori` pentru angajați **și**
  manageri, ca azi, urmat de `urlAvatar`.

### 3.3 `src/components/ui/comutator-vizualizare.tsx` — primitiva

Există deja patru comutatoare pe URL scrise de mână: `/concedii`,
`/ssm/instruiri`, `/rapoarte`, `/revisal`. Unul e greșit — `/ssm/instruiri` pune
`role="tablist"` fără `tabpanel`, fără `aria-controls` și fără roving tabindex,
adică fix promisiunea neonorată despre care `bara-actiuni.tsx:69-73` spune în
scris că trebuie evitată. Al cincilea consumator justifică extragerea tiparului
**corect**, cel din `/concedii`.

```ts
export type OptiuneVizualizare = Readonly<{
  cheie: string;
  eticheta: string;
  pictograma?: LucideIcon;
}>;

export type PropsComutatorVizualizare = Readonly<{
  eticheta: string; // numele accesibil al grupului
  cheieParametru: string; // cheia din query string
  optiuni: readonly OptiuneVizualizare[];
  curenta: string;
  implicita: string; // valoarea care se ȘTERGE din URL, nu se scrie
  parametri: Readonly<Record<string, string | readonly string[] | undefined>>;
  cale: string;
}>;
```

Contract, fiecare punct cu test:

- **Server Component.** Segmentele sunt `<Link replace>`, nu butoane cu
  `onClick` — deci zero JavaScript livrat pentru comutator.
- Marcaj: `<div role="group" aria-label={eticheta}>` cu `aria-current="true"` pe
  segmentul activ. **Nu** `role="tablist"`.
- Clasele vin din helperul `buton({ varianta: curenta ? "primar" : "tertiar" })`,
  ca la `/concedii`.
- Adresa se construiește **pornind de la parametrii existenți**, nu de la un
  `URLSearchParams` gol — altfel comutarea pierde filtrele. Valoarea implicită se
  șterge din URL în loc să fie scrisă.
- **Șterge întotdeauna `cursor`.** Invariant respectat de toate cele trei
  implementări existente: citirile folosesc cursor keyset, iar un cursor vechi ar
  continua de la un rând care nu mai e în rezultat.

### 3.4 `page.tsx` — subțiat

Rămâne: preambulul de porți (`requireTenant` → `requireFeature("nucleu")` →
`getPermissionMap` → `scopeFor`/`can` → `AccesRestrictionat`), apelurile de
citire, construcția arborelui, alegerea vizualizării, calculul booleenilor de
permisiune pe server. Toată randarea pleacă în cele două fișiere de vizualizare.

Parametrul de vizualizare se validează cu Zod, listă închisă:
`z.enum(["lista", "organigrama"]).default("lista")` — un URL copiat greșit cade
pe implicit, nu strică ecranul.

## 4. Cele două vizualizări

### 4.1 Listă

Card lat per departament, indentat pe niveluri. Lista de angajați nu mai stă
imbricată într-un `<details>` pe fiecare card: persoanele se văd din stiva de
avatare, iar lucrul cu ele se face în panou. Cardul rămâne astfel de înălțime
fixă, deci organigrama și lista au același vocabular vizual.

- pătrat de identitate · denumire · cod cu `font-mono` · badge „Inactiv"
- manager cu avatar `sm`, link către fișă; „manager nedesemnat" în italic altfel
- **stivă de avatare**: primii 5, apoi „+N". Se vede cine e în departament fără
  să se desfacă nimic.
- **efectiv dublu**: direct și cumulat („12 · 34 cu subordonatele"). A doua cifră
  lipsește azi complet.
- centru de cost, când există
- acțiuni pe `BaraActiuni`: **Persoane** (deschide panoul) · Editează · Mută ·
  Dezactivează/Reactivează

### 4.2 Organigramă

Pătrate conectate prin `.og-radacina` / `.og-ramura` — CSS-ul de conectori
**există deja** în `globals.css:341`, e pur CSS, folosește `var(--color-border)`
și a fost scris exact pentru forma asta. Nu se rescrie nimic.

- pătrat: cod mic sus · denumire · manager (avatar `sm` + nume) · **cifra de
  efectiv** cu `text-cifra font-mono tabular-nums` (tokenul de KPI al
  proiectului) · stivă de 3 avatare jos
- pătratul e **buton**, nu link — deschide panoul, fiindcă acolo se lucrează
- departament inactiv: **hașurat** cu utilitarul `hasura`, notația proiectului
  pentru „nu s-a întâmplat și nu se mai poate scrie aici". Există deja și
  supraviețuiește tipăririi alb-negru, spre deosebire de culoare.
- derulare orizontală proprie, cu bleed `-mx-4 px-4`, ca la `/organigrama` —
  niciodată pe `body`

### 4.3 Banda „Nerepartizați"

Vizibilă în **ambele** vizualizări, deasupra structurii, doar când există:
„7 persoane fără departament" + acțiune care deschide panoul de repartizare.
`department_id is null` e azi invizibil pe acest ecran; e câștigul cel mai mare
al refacerii.

## 5. Panoul de lucru

`PanouLateral` (`dialog.tsx:241`), nu `Dialog`: conținutul e lung și are nevoie
de derulare proprie fără să acopere contextul. Pe telefon e deja `w-full h-dvh`,
deci ecran plin — responsive fără cod suplimentar.

- titlu = denumirea departamentului; descriere = codul + managerul
- căutare locală după nume și marcă (filtrare în client, lista e deja încărcată)
- listă de persoane cu bife → **selecție multiplă**
- subsol: „Mută N persoane în…" cu `Combobox` de departamente, plus opțiunea
  „— fără departament —"
- secțiune „Adaugă în departament": `Combobox` cu **nerepartizații primii**, apoi
  ceilalți angajați marcați cu departamentul lor curent, ca mutarea să fie o
  decizie informată
- **notă permanentă**: mutarea între departamente **nu** schimbă cine vede pe
  cine. Scope-ul `team` se rezolvă peste tot pe `manager_path`, niciodată pe
  `department_id` (`0005_hr_rls.sql:191`). Cele două câmpuri stau alături în fișă
  și n-au nicio legătură. Fără nota asta, utilizatorul crede că a mutat și
  drepturile de aprobare.

## 6. Acțiunea nouă

O singură acțiune acoperă mutarea unui om, repartizarea în masă și scoaterea din
departament.

```ts
export const mutaAngajatiSchema = z.object({
  employee_ids: z.array(z.uuid()).min(1).max(200),
  department_id: z.uuid().nullable().default(null),
});

export const mutaAngajati = createAction<typeof mutaAngajatiSchema, { mutati: number }>({
  name: "employees.move_department",
  permission: "employees:update",
  minScope: "all",
  input: mutaAngajatiSchema,
  audit: {
    action: "update",
    entityType: "employee",
    entityId: (input) => input.employee_ids[0],
    allow: ["employee_ids", "department_id"],
  },
  revalidate: ["/departamente", "/angajati", "/organigrama"],
  handler: /* vezi cele șase decizii de mai jos */,
});
```

Cinci decizii de siguranță, fiecare cu motivul ei:

1. **Nu refolosește `actualizeazaAngajat`.** Aceea are 36 de câmpuri, aproape
   toate cu `.default()`. Un payload `{ id, department_id }` ar trece de Zod și
   ar scrie 34 de coloane cu valorile implicite — ștergând adresa, reședința,
   actul de identitate, contactul de urgență, CNP-ul și IBAN-ul, și rescriind
   `manager_employee_id = null`, ceea ce declanșează `tg_employees_manager_path`
   și **rescrie `manager_path` la toți subordonații**, făcând o ramură întreagă
   invizibilă pentru managerul ei. UPDATE reușit, zero erori. Este exact defectul
   reparat în commitul `e8983a5`.
2. **`minScope: "all"`**, nu `"team"`. `actualizeazaAngajat` are azi `team` deși
   pagina lui cere `all` — deci e invocabilă direct, ca endpoint POST, de cineva
   care n-a văzut niciodată ecranul. Discrepanța nu se repetă aici.
3. **Verificare explicită că departamentul-țintă aparține organizației**, cu un
   SELECT filtrat pe `organization_id` și `deleted_at is null`, înainte de
   UPDATE. Baza nu o face (D4).
4. **`.select("id")` după `.update()`**, cu lungimea comparată cu
   `employee_ids.length`. RLS refuză cu **zero rânduri și fără eroare**; la o
   mutare în masă, un refuz parțial ar raporta altfel succes deplin. Diferența se
   raportează ca refuz, nu ca reușită parțială tăcută.
5. **`revalidate:` declarat**, nu `revalidatePath()` chemat din handler —
   tiparul canonic. Include `/organigrama` fiindcă acolo se afișează
   departamentul fiecărui nod.

Mesajele de eroare sunt în română și se termină cu punct.

## 7. Permisiuni

Neschimbate. Ecranul citește cu `departments:read`; butoanele de structură cer
`departments:create` / `departments:update` la `all`; mutarea persoanelor cere
`employees:update` la `all`.

| Rol           | Vede structura | Editează departamente | Mută persoane |
| ------------- | -------------- | --------------------- | ------------- |
| `super_admin` | da             | da                    | da            |
| `org_admin`   | da             | da                    | da            |
| `hr`          | da             | da                    | da            |
| `manager`     | da             | nu                    | **nu**        |
| `employee`    | după seed      | nu                    | nu            |

`manager` are în seed doar `('manager','employees','team','{read}')` — nu are
`employees:update` deloc. Absența unei permisiuni este refuz. Un comentariu
învechit din `0038_evaluari_angajati.sql:62` susține contrariul; e fals și a fost
deja corectat de `0070`.

Booleenii se calculează pe server (`poateEditaStructura`, `poateMutaPersoane`) și
coboară ca props. Panoul nu randează controale de scriere fără ele.

## 8. Riscuri și găuri cunoscute

- **D4 rămâne deschis în bază.** Acțiunea nouă e păzită în aplicație, dar
  `actualizeazaAngajat` scrie în continuare `department_id` fără verificare de
  organizație. Reparația corectă e un trigger, ca la `parent_id`; cere migrare și
  confirmare pe producție.
- **Trunchierea la 1000** dispare din `/departamente`, dar rămâne în
  `/organigrama`, care are deja un `Callout` care o anunță. Nu se atinge.
- **Volume reale mici** — cea mai mare firmă are 8 angajați, două au zero. Toate
  vizualizările se proiectează pentru „aproape gol": stările goale contează mai
  mult decât densitatea.

## 9. Teste

Modulul are azi zero. Minimul care intră odată cu refacerea:

- `src/domain/departments/arbore.test.ts` — orfani promovați la rădăcină,
  ordonarea între frați păstrată, `efectivCumulat` pe subarbore adânc, ciclu
  injectat fără buclă infinită, listă goală.
- `src/components/ui/comutator-vizualizare.test.tsx` — păstrează cheile
  necunoscute din URL, șterge `cursor`, scrie `aria-current` pe segmentul activ,
  **nu** scrie valoarea implicită în URL. Tipar de testare al proiectului:
  vitest + @testing-library/react + happy-dom, `fireEvent` (nu `user-event`),
  matcheri vitest nativi (nu există `jest-dom`), `next/navigation` mock-uit
  înaintea importului componentei.
- test de schemă pe `mutaAngajatiSchema` — respinge lista goală, respinge un
  UUID invalid, acceptă `department_id: null`.

## 10. Criterii de acceptare

1. `/departamente` afișează un comutator Listă/Organigramă; starea stă în URL, se
   păstrează la reîncărcare și la partajarea adresei.
2. Comutarea păstrează ceilalți parametri din URL și șterge `cursor`.
3. Organigrama arată fiecare departament ca pătrat, cu efectiv și manager,
   conectat ierarhic prin `parent_id`; departamentele inactive sunt hașurate.
4. Ambele vizualizări arată banda „Nerepartizați" când există astfel de angajați.
5. Din panou se poate muta o persoană și se pot muta mai multe deodată; o mutare
   refuzată parțial de RLS se raportează ca refuz, nu ca reușită.
6. Un `manager` vede structura și nu vede niciun control de scriere.
7. Ecranul e utilizabil pe telefon: panoul e ecran plin, organigrama derulează
   orizontal fără ca `body` să deruleze.
8. `pnpm typecheck && pnpm lint && pnpm test` trec. `pnpm build` **nu** se rulează
   în sesiune, la cererea explicită a utilizatorului; ce rămâne neverificat este
   granița server/client pe fișierele noi și se declară ca atare.
