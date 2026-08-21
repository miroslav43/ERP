# Coduri CAEN (principal + secundare) la înrolare și editare — design

Data: 2026-08-21
Stare: aprobat de utilizator (design în chat), în așteptare de revizuire a acestui document

## Context și scop

Astăzi `organizations.cod_caen` e o singură coloană text opțională, cu un singur
cod CAEN pe 4 cifre. Realitatea legală (Legea 31/1990, OUG 44/2008, Legea
182/2016) impune reguli diferite pe formă juridică:

| Formă juridică | Principal | Secundare (maxim) |
|---|---|---|
| SRL, SA, SNC, SCS, RA, IF, ONG | exact 1 | nelimitat |
| PFA | exact 1 | 4 (total ≤ 5) |
| II | exact 1 | 9 (total ≤ 10) |
| SRL-D | exact 1 | nelimitat ca număr, dar principal+secundare împreună trebuie să facă parte din **cel mult 5 grupe** distincte (cod pe 3 cifre); anumite coduri sunt complet interzise (listă mai jos) |

Aplicația va transmite date către ANAF și va genera documente oficiale —
denumirea juridică completă a fost deja rezolvată (`legal_name`, obligatoriu la
înrolare). Codul CAEN principal are aceeași miză: trebuie să fie corect ca
formă (cod real din nomenclator) și corect ca număr/compoziție față de forma
juridică aleasă.

**Scop**: înlocuirea câmpului text liber „Cod CAEN” cu o selecție asistată
(cod + denumire, căutare live) pentru codul principal și pentru codurile
secundare, cu regulile de mai sus aplicate automat în funcție de forma
juridică selectată. Se aplică la înrolare **și** la editarea ulterioară a
organizației (super-admin și Setări → Organizație).

**Decizii confirmate cu utilizatorul** (nu se redeschid fără discuție explicită):
- Se aplică peste tot (înrolare + ambele ecrane de editare), nu doar la înrolare.
- Codurile secundare se stochează într-o coloană `text[]`, nu un tabel separat.
- Zona de coduri secundare e mereu vizibilă; doar limita maximă variază pe formă
  juridică (nicio formă nu o ascunde complet).
- Căutarea în dropdown filtrează după cod **sau** denumire, fără diacritice.
- La **înrolare**, codul CAEN principal e obligatoriu (ca `legal_name`). La
  **editare**, principalul rămâne opțional (organizațiile vechi nu sunt
  forțate să-l completeze doar ca să salveze o modificare fără legătură);
  dacă e completat, regulile de mai sus se validează normal.
- Lista de coduri interzise pentru SRL-D e dată explicit de utilizator (mai
  jos) — **nu** e o regulă „toată secțiunea X”, cu excepția imobiliarelor
  unde lista dată coincide exact cu toată secțiunea M (verificat împotriva
  nomenclatorului). Lista nu e revendicată ca exhaustivă din punct de vedere
  legal — e ce a furnizat utilizatorul, extensibilă ulterior.

## Nomenclatorul CAEN — DEJA GENERAT ȘI COMIS

Sursă: `CAEN-Rev.3_structura-completa.pdf` (furnizat de utilizator). Conține
21 secțiuni (A–U), 86 diviziuni (2 cifre), 269 grupe (3 cifre), **651 clase**
(4 cifre) — nu 643, cum se estimase inițial dintr-o numărătoare brută de
linii. Doar clasele (nivelul de 4 cifre) sunt coduri CAEN valide de
înregistrat — astea sunt singurele selectabile.

**Notă importantă de extracție**: `pdftotext -layout` (varianta încercată
inițial) are o eroare de aliniere cod↔denumire pe acest document specific —
verificat pe 17 clase unde textul unei clase apărea atribuit greșit clasei
următoare (ex. codul `1105` „Fabricarea berii” ajungea cu denumire goală, iar
„Fabricarea berii” apărea sub codul `1106`). `pdftotext -table` (optimizat
pentru conținut tabelar) nu are această problemă — verificat prin comparare
directă a celor două extrageri și cross-check manual pe toate cele 19 coduri
interzise SRL-D (potrivire exactă, cuvânt cu cuvânt, cu lista dată de
utilizator). Comanda folosită: `pdftotext -table -enc UTF-8 <pdf> <txt>`.

Fișierul e deja creat, testat și comis (commit `076c2a2`):
`src/domain/organization/caen-nomenclator.ts` — 651 intrări `{ cod, denumire }`
plus `CODURI_CAEN_VALIDE: ReadonlySet<string>`. Test însoțitor
`caen-nomenclator.test.ts` (6 teste: număr exact de intrări, format cod pe 4
cifre, fără duplicate, denumiri nevide, cele 3 coduri SRL-D verificate exact,
`CODURI_CAEN_VALIDE` în sincron cu lista). **Planul de implementare de mai jos
nu regenerează acest fișier** — pornește de la el ca dependență existentă.

## Reguli de business

Fișier nou: `src/domain/organization/caen-reguli.ts`. Funcții pure, fără
dependențe de React/Zod/DB — testabile direct, după tiparul `cui.ts`.

```ts
import type { FORME_JURIDICE } from "@/schemas/organization";

/** Nu există azi un alias `FormaJuridica` exportat — doar array-ul `as const`. */
type FormaJuridica = (typeof FORME_JURIDICE)[number];

/** `null` = nelimitat. */
export function maximSecundare(forma: FormaJuridica): number | null {
  switch (forma) {
    case "PFA": return 4;
    case "II": return 9;
    default: return null; // SRL, SRL-D, SA, SNC, SCS, RA, IF, ONG
  }
}

/**
 * Coduri complet interzise pentru SRL-D — listă dată explicit de utilizator,
 * NU dedusă din secțiuni întregi (excepție: imobiliare, unde lista dată
 * coincide cu toată secțiunea M — verificat, nu presupus).
 */
export const CODURI_INTERZISE_SRLD: ReadonlySet<string> = new Set([
  "9200", // jocuri de noroc și pariuri
  "2530", // fabricarea armamentului și muniției
  "1200", "4635", "4726", // tutun: producție, comerț cu ridicata, comerț cu amănuntul
  "1101", "1102", "1105", "4634", "4725", // alcool: distilare, vin, bere, comerț ridicata/amănuntul
  "6811", "6812", "6820", "6831", "6832", // tranzacții imobiliare (toată secțiunea M)
  "6419", "6492", "6511", "6512", // intermedieri financiare/asigurări — selecție de bază, NU toată secțiunea L
]);

const NUMAR_MAXIM_GRUPE_SRLD = 5;

export type RezultatValidareCaen =
  | Readonly<{ valid: true }>
  | Readonly<{ valid: false; eroare: string }>;

/**
 * `principal` poate lipsi (ecranele de editare îl permit opțional) — în acest
 * caz nu există nimic de validat împreună cu `secundare` (dacă există totuși
 * secundare fără principal, e o stare pe care Zod o respinge înainte să ajungă
 * aici — vezi schema).
 */
export function valideazaSelectieCaen(
  forma: FormaJuridica,
  principal: string | undefined,
  secundare: readonly string[],
): RezultatValidareCaen {
  if (principal === undefined) return { valid: true };

  if (secundare.includes(principal)) {
    return { valid: false, eroare: "Codul principal nu poate apărea și printre cele secundare." };
  }
  if (new Set(secundare).size !== secundare.length) {
    return { valid: false, eroare: "Fiecare cod secundar poate apărea o singură dată." };
  }

  const maxim = maximSecundare(forma);
  if (maxim !== null && secundare.length > maxim) {
    return {
      valid: false,
      eroare: `${forma} permite maxim ${maxim} coduri CAEN secundare (${maxim + 1} în total, cu principalul).`,
    };
  }

  if (forma === "SRL-D") {
    const toate = [principal, ...secundare];
    const interzis = toate.find((cod) => CODURI_INTERZISE_SRLD.has(cod));
    if (interzis !== undefined) {
      return {
        valid: false,
        eroare: `Codul ${interzis} nu este permis pentru SRL-D (activitate exclusă prin lege pentru forma debutant).`,
      };
    }
    const grupe = new Set(toate.map((cod) => cod.slice(0, 3)));
    if (grupe.size > NUMAR_MAXIM_GRUPE_SRLD) {
      return {
        valid: false,
        eroare: `SRL-D: toate codurile CAEN trebuie să facă parte din cel mult ${NUMAR_MAXIM_GRUPE_SRLD} grupe de activitate (cod pe 3 cifre). Ai selectat ${grupe.size}.`,
      };
    }
  }

  return { valid: true };
}
```

## Schema Zod (`src/schemas/organization.ts`)

```ts
export const caenClasaSchema = z
  .string()
  .regex(/^[0-9]{4}$/, "Codul CAEN are 4 cifre.")
  .refine((cod) => CODURI_CAEN_VALIDE.has(cod), "Acest cod CAEN nu există în nomenclator.");
```

`onboardeazaOrganizatieSchema`:
- `cod_caen`: `caenClasaSchema` (înlocuiește `codCaenSchema` opțional de azi — devine obligatoriu, ca `legal_name`).
- `cod_caen_secundare: z.array(caenClasaSchema).max(50).default([])` (plafonul de 50 e doar o gardă de sanitate împotriva unui payload absurd, nu o regulă de business — niciuna dintre formele juridice nu are un maxim sub 10 în practică, dar SRL/SA/IF/ONG sunt „nelimitat”, deci tot trebuie un plafon tehnic undeva).
- `.superRefine((valori, ctx) => { const r = valideazaSelectieCaen(valori.forma_juridica, valori.cod_caen, valori.cod_caen_secundare); if (!r.valid) ctx.addIssue({ code: "custom", message: r.eroare, path: ["cod_caen_secundare"] }); })` — același tipar folosit deja de `cuiSchema`/`ibanOrganizatieSchema` (nu `.check()`, ca să rămână consistent cu restul fișierului).

`actualizeazaOrganizatieSchema`:
- `cod_caen: opțional(caenClasaSchema)` (rămâne opțional).
- `cod_caen_secundare: z.array(caenClasaSchema).max(50).default([])`.
- Același `.check(...)`, care cu `principal === undefined` întoarce mereu `valid: true` (regula de mai sus).

## Migrație DB

Fișier nou `supabase/migrations/0040_organizations_caen_secundare.sql` (ultima
migrație existentă e `0039_feature_evaluari.sql`):

```sql
alter table organizations
  add column cod_caen_secundare text[] not null default '{}';
```

Pur aditivă — fără backfill, fără risc pentru rânduri existente.
Fără CHECK de format pe array (Postgres nu acceptă subquery într-un CHECK
constraint fără o funcție IMMUTABLE dedicată; regula de business rămâne unde
sunt și celelalte reguli similare din acest proiect — CUI, IBAN, CNP — în
Zod/domeniu, nu în constrângeri SQL).

## Componenta UI

Nouă, partajată (nu sub `nou/_components`, fiindcă e folosită și de cele două
ecrane de editare): `src/components/forms/selector-cod-caen.tsx`.

Filtrare comună (extrasă ca funcție, nu duplicată în cele două variante):

```ts
function filtreazaCaen(interogare: string, exclude: ReadonlySet<string>): readonly CodCaen[] {
  const termen = normalizeaza(interogare.trim()); // reia normalizarea din command-palette.tsx
  const rezultate = termen.length === 0
    ? NOMENCLATOR_CAEN
    : NOMENCLATOR_CAEN.filter(
        (c) => c.cod.startsWith(termen) || normalizeaza(c.denumire).includes(termen),
      );
  return rezultate.filter((c) => !exclude.has(c.cod)).slice(0, 20);
}
```

Două componente peste această logică:

- `SelectorCodCaenPrincipal({ value, onChange, id, ariaInvalid, ariaDescribedBy })`
  — un input de căutare + listbox; alegerea unei opțiuni înlocuiește `value`.
- `SelectorCodCaenSecundare({ value, onChange, exclude, max, id, ariaInvalid })`
  — la fel, dar alegerea unei opțiuni **adaugă** codul la array (dacă nu e deja
  prezent și `max` nu e atins) și golește inputul; fiecare cod selectat apare
  ca „chip” cu buton de eliminare; sub input, un text live „`N` din `max`
  coduri folosite” sau „`N` coduri (nelimitat)”; la `N === max`, inputul de
  căutare se dezactivează cu un mesaj „Limită atinsă pentru {forma_juridica}”.

Ambele: navigare cu tastatura (săgeți sus/jos, Enter selectează, Escape
închide), închidere la click în afara componentei, fără librărie externă —
tipar hand-rolled, consistent cu restul aplicației (nu există `shadcn/ui` sau
echivalent în acest repo).

Integrare cu react-hook-form: `useController` (nu `register`, pentru că nu
sunt `<input>` native simple) — primă folosire a acestui hook în proiect;
restul câmpurilor din formulare sunt `register()` direct pe elemente native.

## Integrare în ecrane

1. **Pas 1 „Date fiscale”** (`pas-1-identitate.tsx`): înlocuiește inputul text
   „Cod CAEN” cu `SelectorCodCaenPrincipal` (obligatoriu) +
   `SelectorCodCaenSecundare` (limita citită din `maximSecundare(watch("forma_juridica"))`,
   re-evaluată live la schimbarea formei juridice). Pentru SRL-D, un text
   ajutător explică regula de grupe; eroarea din `valideazaSelectieCaen`
   (afișată la `cod_caen_secundare`) acoperă interdicțiile și limita.
2. **Editare organizație — super-admin** (`formular-editeaza-organizatie.tsx`):
   aceleași două componente, `cod_caen` opțional.
3. **Setări → Organizație** (`organizatie-form.tsx`): idem.

Codurile CAEN existente (coloana `cod_caen`, un singur cod per organizație
azi) rămân valide ca „principal” fără nicio migrare de date — formatul nu se
schimbă, doar se adaugă `cod_caen_secundare` gol alături.

## În afara scopului (explicit)

- Generatoarele de documente oficiale (contract, adeverințe) nu sunt atinse
  în acest task — nu folosesc azi `cod_caen`, nu li se cere să-l folosească
  acum.
- Scutirile fiscale per-CAEN (menționate în commit-ul `785598d`) nu sunt
  atinse — rămân pe logica lor actuală.
- Nicio integrare live cu ANAF; doar structura de date pregătită pentru o
  viitoare transmitere.

## Testare

- `src/domain/organization/caen-reguli.test.ts` (tipar `cui.test.ts`): câte un
  caz per formă juridică pentru limita numerică; cazuri SRL-D pentru regula de
  grupe (exact 5 grupe → valid, 6 grupe → invalid) și pentru fiecare cod din
  `CODURI_INTERZISE_SRLD`; caz de duplicat principal/secundar.
- Verificare manuală (browser, `pnpm dev`) a wizardului: schimbarea formei
  juridice actualizează limita afișată live; SRL-D respinge un cod interzis
  cu mesaj clar; PFA blochează la al 5-lea cod total.
