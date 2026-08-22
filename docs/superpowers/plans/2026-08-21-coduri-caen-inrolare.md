# Coduri CAEN (principal + secundare) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Înlocuiește câmpul text liber „Cod CAEN” cu selecție asistată (căutare cod/denumire) din nomenclatorul CAEN Rev.3, cu reguli diferite de câte coduri secundare sunt permise în funcție de forma juridică — la înrolare și la ambele ecrane de editare a organizației.

**Architecture:** Un strat de domeniu pur (`caen-nomenclator.ts` deja existent, `caen-reguli.ts` nou) validează selecția independent de UI/DB. Schema Zod din `src/schemas/organization.ts` îl apelează prin `superRefine`. O coloană nouă `cod_caen_secundare text[]` pe `organizations`. O componentă UI nouă, partajată și fără dependență de react-hook-form (`value`/`onChange` simplu), e cablată diferit în cele 3 ecrane: wizard (react-hook-form prin `watch`/`setValue`), editare super-admin (FormData + `useState` local), Setări → Organizație (deja `useState` local).

**Tech Stack:** Next.js 16 / React 19, react-hook-form 7 + zodResolver, Zod 4, Supabase (Postgres), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-21-coduri-caen-inrolare-design.md`

## Global Constraints

- Nomenclatorul CAEN (`src/domain/organization/caen-nomenclator.ts`, 651 clase) e DEJA generat, testat și comis (`076c2a2`) — nicio sarcină din acest plan nu îl regenerează.
- Limite pe formă juridică: PFA max 4 secundare (5 total), II max 9 secundare (10 total), restul (SRL, SA, SNC, SCS, RA, IF, ONG, SRL-D) nelimitat numeric.
- SRL-D: toate codurile (principal + secundare) trebuie să facă parte din cel mult 5 grupe distincte (primele 3 cifre); plus lista explicită de coduri interzise din `caen-reguli.ts` (19 coduri, dată de utilizator — vezi spec).
- La **înrolare**, `cod_caen` (principal) e obligatoriu. La **editare** (ambele ecrane), rămâne opțional.
- Fără DB CHECK pe formatul array-ului — validarea e în Zod/domeniu, la fel ca CUI/IBAN/CNP în acest proiect.
- Comenzi de verificare disponibile în acest repo: `pnpm typecheck`, `pnpm eslint <fișiere>`, `pnpm test` (= `vitest run --project unit`), `pnpm vitest run <fișier>` pentru un singur fișier.

---

### Task 1: Reguli de business pe formă juridică

**Files:**

- Create: `src/domain/organization/caen-reguli.ts`
- Test: `src/domain/organization/caen-reguli.test.ts`

**Interfaces:**

- Consumes: nimic (funcții pure, fără dependențe de alte task-uri).
- Produces: `maximSecundare(forma: string): number | null`, `CODURI_INTERZISE_SRLD: ReadonlySet<string>`, `valideazaSelectieCaen(forma: string, principal: string | undefined, secundare: readonly string[]): { valid: true } | { valid: false; eroare: string }` — folosite de Task 2 și Task 3.

- [ ] **Step 1: Scrie testele care eșuează**

```ts
// src/domain/organization/caen-reguli.test.ts
import { describe, expect, it } from "vitest";
import { CODURI_INTERZISE_SRLD, maximSecundare, valideazaSelectieCaen } from "./caen-reguli";

describe("maximSecundare", () => {
  it("PFA: maxim 4", () => {
    expect(maximSecundare("PFA")).toBe(4);
  });
  it("II: maxim 9", () => {
    expect(maximSecundare("II")).toBe(9);
  });
  it.each(["SRL", "SRL-D", "SA", "SNC", "SCS", "RA", "IF", "ONG"])(
    "%s: nelimitat (null)",
    (forma) => {
      expect(maximSecundare(forma)).toBeNull();
    },
  );
});

describe("valideazaSelectieCaen", () => {
  it("acceptă fără principal (ecran de editare, câmp încă necompletat)", () => {
    expect(valideazaSelectieCaen("SRL", undefined, [])).toEqual({ valid: true });
  });

  it("respinge codul principal duplicat printre cele secundare", () => {
    const rezultat = valideazaSelectieCaen("SRL", "6210", ["6210"]);
    expect(rezultat.valid).toBe(false);
  });

  it("respinge coduri secundare duplicate între ele", () => {
    const rezultat = valideazaSelectieCaen("SRL", "6210", ["6220", "6220"]);
    expect(rezultat.valid).toBe(false);
  });

  it("PFA: acceptă exact 4 secundare (5 total)", () => {
    expect(valideazaSelectieCaen("PFA", "0111", ["0112", "0113", "0114", "0115"])).toEqual({
      valid: true,
    });
  });

  it("PFA: respinge al 5-lea cod secundar (6 total)", () => {
    const rezultat = valideazaSelectieCaen("PFA", "0111", ["0112", "0113", "0114", "0115", "0116"]);
    expect(rezultat.valid).toBe(false);
  });

  it("II: acceptă exact 9 secundare, respinge al 10-lea", () => {
    const noua = ["0112", "0113", "0114", "0115", "0116", "0119", "0121", "0122", "0123"];
    expect(valideazaSelectieCaen("II", "0111", noua)).toEqual({ valid: true });
    expect(valideazaSelectieCaen("II", "0111", [...noua, "0124"]).valid).toBe(false);
  });

  it("SRL: nelimitat — acceptă 20 de coduri secundare distincte", () => {
    const secundare = Array.from({ length: 20 }, (_, i) => `01${String(11 + i).padStart(2, "0")}`);
    expect(valideazaSelectieCaen("SRL", "0111", secundare).valid).toBe(true);
  });

  it("SRL-D: acceptă coduri din exact 5 grupe distincte", () => {
    // 011, 012, 013, 014, 015 — 5 grupe distincte, câte un cod din fiecare
    const rezultat = valideazaSelectieCaen("SRL-D", "0111", ["0121", "0130", "0141", "0150"]);
    expect(rezultat).toEqual({ valid: true });
  });

  it("SRL-D: respinge a 6-a grupă distinctă", () => {
    const rezultat = valideazaSelectieCaen("SRL-D", "0111", [
      "0121",
      "0130",
      "0141",
      "0150",
      "0161", // grupa 016 — a 6-a
    ]);
    expect(rezultat.valid).toBe(false);
  });

  it.each([...CODURI_INTERZISE_SRLD])("SRL-D: respinge codul interzis %s ca principal", (cod) => {
    expect(valideazaSelectieCaen("SRL-D", cod, []).valid).toBe(false);
  });

  it("SRL-D: respinge un cod interzis aflat printre cele secundare", () => {
    expect(valideazaSelectieCaen("SRL-D", "0111", ["9200"]).valid).toBe(false);
  });

  it("SRL-D: codurile interzise NU se aplică altor forme juridice (SRL le acceptă)", () => {
    expect(valideazaSelectieCaen("SRL", "9200", []).valid).toBe(true);
  });
});
```

- [ ] **Step 2: Rulează testele, confirmă eșecul**

Run: `pnpm vitest run src/domain/organization/caen-reguli.test.ts`
Expected: FAIL — `Cannot find module './caen-reguli'`

- [ ] **Step 3: Implementează**

```ts
// src/domain/organization/caen-reguli.ts
// Reguli de compoziție a codurilor CAEN pe formă juridică — Legea 31/1990,
// OUG 44/2008, Legea 182/2016. Funcții pure, independente de Zod/React/DB;
// apelate din superRefine-urile din `src/schemas/organization.ts` și din
// `src/app/(app)/setari/organizatie/actions.ts` (schemă locală separată).

/** `null` = nelimitat numeric. */
export function maximSecundare(forma: string): number | null {
  switch (forma) {
    case "PFA":
      return 4;
    case "II":
      return 9;
    default:
      return null; // SRL, SRL-D, SA, SNC, SCS, RA, IF, ONG
  }
}

/**
 * Coduri complet interzise pentru SRL-D — listă dată explicit de utilizator,
 * NU dedusă din secțiuni întregi (excepție: imobiliare, unde lista dată
 * coincide cu toată secțiunea M din nomenclator — verificat, nu presupus).
 * "Intermedieri financiare" e o selecție de bază, NU toată secțiunea L.
 */
export const CODURI_INTERZISE_SRLD: ReadonlySet<string> = new Set([
  "9200", // jocuri de noroc și pariuri
  "2530", // fabricarea armamentului și muniției
  "1200",
  "4635",
  "4726", // tutun: producție, comerț ridicata, comerț amănuntul
  "1101",
  "1102",
  "1105",
  "4634",
  "4725", // alcool: distilare, vin, bere, comerț ridicata/amănuntul
  "6811",
  "6812",
  "6820",
  "6831",
  "6832", // tranzacții imobiliare (toată secțiunea M)
  "6419",
  "6492",
  "6511",
  "6512", // intermedieri financiare/asigurări — selecție de bază
]);

const NUMAR_MAXIM_GRUPE_SRLD = 5;

export type RezultatValidareCaen =
  Readonly<{ valid: true }> | Readonly<{ valid: false; eroare: string }>;

/**
 * `principal` poate lipsi (ecranele de editare îl permit opțional) — atunci
 * nu e nimic de validat împreună cu `secundare`.
 */
export function valideazaSelectieCaen(
  forma: string,
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

- [ ] **Step 4: Rulează testele, confirmă succesul**

Run: `pnpm vitest run src/domain/organization/caen-reguli.test.ts`
Expected: PASS — toate testele (≈19 + numărul din `it.each` pe cele 19 coduri interzise).

- [ ] **Step 5: Lint + commit**

```bash
pnpm eslint src/domain/organization/caen-reguli.ts src/domain/organization/caen-reguli.test.ts
git add src/domain/organization/caen-reguli.ts src/domain/organization/caen-reguli.test.ts
git commit -m "feat: reguli de compoziție CAEN pe formă juridică (PFA/II/SRL-D)"
```

---

### Task 2: Schema Zod — `caenClasaSchema` și `onboardeazaOrganizatieSchema`

**Files:**

- Modify: `src/schemas/organization.ts`
- Test: `src/schemas/organization.test.ts` (nou — nu există încă un fișier de test pentru acest modul)

**Interfaces:**

- Consumes: `NOMENCLATOR_CAEN`, `CODURI_CAEN_VALIDE` din `src/domain/organization/caen-nomenclator.ts` (Task deja finalizat); `valideazaSelectieCaen` din Task 1.
- Produces: `caenClasaSchema` (export), câmpurile `cod_caen: string` (obligatoriu) și `cod_caen_secundare: readonly string[]` pe `OnboardeazaOrganizatieInput`/`Output` — consumate de Task 6/7 (wizard).

- [ ] **Step 1: Scrie testul care eșuează**

```ts
// src/schemas/organization.test.ts
import { describe, expect, it } from "vitest";
import { onboardeazaOrganizatieSchema } from "./organization";

const BAZA = {
  name: "Firma Mea",
  forma_juridica: "SRL" as const,
  cui: "14399840",
  platitor_tva: false,
  slug: "firma-mea",
  email_contact: "contact@firma.ro",
  telefon_contact: "0721234567",
  judet: "București" as const,
  oras: "București",
  plan: "trial" as const,
  seats_limit: 10,
  legal_name: "SC Firma Mea SRL",
  zile_concediu_anual_implicit: 20,
  owner_nume: "Popescu",
  owner_prenume: "Ion",
  owner_email: "ion@firma.ro",
  owner_telefon: "0731234567",
};

describe("onboardeazaOrganizatieSchema — cod_caen", () => {
  it("respinge lipsa codului principal", () => {
    const rezultat = onboardeazaOrganizatieSchema.safeParse({ ...BAZA, cod_caen_secundare: [] });
    expect(rezultat.success).toBe(false);
  });

  it("respinge un cod care nu există în nomenclator", () => {
    const rezultat = onboardeazaOrganizatieSchema.safeParse({
      ...BAZA,
      cod_caen: "0000",
      cod_caen_secundare: [],
    });
    expect(rezultat.success).toBe(false);
  });

  it("acceptă un cod principal valid, fără secundare", () => {
    const rezultat = onboardeazaOrganizatieSchema.safeParse({
      ...BAZA,
      cod_caen: "6210",
      cod_caen_secundare: [],
    });
    expect(rezultat.success).toBe(true);
  });

  it("respinge PFA cu 5 coduri secundare (peste limita de 4)", () => {
    const rezultat = onboardeazaOrganizatieSchema.safeParse({
      ...BAZA,
      forma_juridica: "PFA",
      cod_caen: "0111",
      cod_caen_secundare: ["0112", "0113", "0114", "0115", "0116"],
    });
    expect(rezultat.success).toBe(false);
  });

  it("cod_caen_secundare implicit e listă goală când lipsește din input", () => {
    const rezultat = onboardeazaOrganizatieSchema.safeParse({ ...BAZA, cod_caen: "6210" });
    expect(rezultat.success).toBe(true);
    if (rezultat.success) expect(rezultat.data.cod_caen_secundare).toEqual([]);
  });
});
```

- [ ] **Step 2: Rulează testul, confirmă eșecul**

Run: `pnpm vitest run src/schemas/organization.test.ts`
Expected: FAIL — cel puțin testele „respinge lipsa codului principal” și „respinge un cod care nu există în nomenclator” trec fals ca succes azi (schema actuală acceptă `cod_caen` opțional, orice 4 cifre).

- [ ] **Step 3: Implementează**

În `src/schemas/organization.ts`, adaugă importurile la începutul fișierului (după cele existente):

```ts
import { CODURI_CAEN_VALIDE } from "@/domain/organization/caen-nomenclator";
import { valideazaSelectieCaen } from "@/domain/organization/caen-reguli";
```

Adaugă lângă `codCaenSchema` existent (păstrează `codCaenSchema` neschimbat — e folosit tale-quale de `actualizeazaOrganizatieSchema` momentan, până la Task 3):

```ts
export const caenClasaSchema = z
  .string()
  .regex(/^[0-9]{4}$/, "Codul CAEN are 4 cifre.")
  .refine((cod) => CODURI_CAEN_VALIDE.has(cod), "Acest cod CAEN nu există în nomenclator.");
```

Modifică `onboardeazaOrganizatieSchema` — înlocuiește linia `cod_caen: codCaenSchema,` (moștenită implicit din `creeazaOrganizatieSchema` prin `.extend`) și adaugă `cod_caen_secundare`, apoi adaugă `.superRefine` la finalul lanțului:

```ts
export const onboardeazaOrganizatieSchema = creeazaOrganizatieSchema
  .extend({
    // Suprascrie `cod_caen` moștenit (opțional) din `creeazaOrganizatieSchema`:
    // la înrolare e obligatoriu, ca `legal_name` — documentele oficiale și
    // viitoarele transmiteri ANAF au nevoie de el.
    cod_caen: caenClasaSchema,
    cod_caen_secundare: z.array(caenClasaSchema).max(50).default([]),

    capital_social: capitalSocialSchema,
    sector: sectorSchema,
    functie_reprezentant_legal: functieReprezentantSchema,
    reprezentant_cnp: cnpReprezentantSchema,

    banca_nume: textOptional(160),
    banca_iban: opțional(ibanOrganizatieSchema),

    plata_avans: z.boolean().default(false),
    ziua_plata_avans: ziuaLuniiSchema,
    ziua_plata_lichidare: ziuaLuniiSchema,
    tichete_furnizor: ticheteFurnizorSchema,

    punct_lucru_denumire: textOptional(160),
    punct_lucru_adresa: textOptional(240),
    punct_lucru_judet: opțional(judetSchema),
    punct_lucru_oras: textOptional(80),
    punct_lucru_cod_postal: textOptional(10),

    zile_concediu_anual_implicit: zileConcediuImplicitSchema,

    ssm_furnizor_extern: textOptional(200),
    ssm_persoana_responsabila: textOptional(160),

    owner_nume: z.string().trim().min(1, "Introduceți numele proprietarului.").max(120),
    owner_prenume: z.string().trim().min(1, "Introduceți prenumele proprietarului.").max(120),
    owner_email: emailSchema,
    owner_telefon: telefonSchema,
  })
  .superRefine((valori, ctx) => {
    const rezultat = valideazaSelectieCaen(
      valori.forma_juridica,
      valori.cod_caen,
      valori.cod_caen_secundare,
    );
    if (!rezultat.valid) {
      ctx.addIssue({ code: "custom", message: rezultat.eroare, path: ["cod_caen_secundare"] });
    }
  });
```

**Notă**: `cod_caen` dispare din `codCaenSchema` doar la nivelul acestui schema — `codCaenSchema` original rămâne definit și folosit de `actualizeazaOrganizatieSchema` (neschimbat până la Task 3).

- [ ] **Step 4: Rulează testul, confirmă succesul**

Run: `pnpm vitest run src/schemas/organization.test.ts`
Expected: PASS (toate cele 5 teste).

- [ ] **Step 5: Typecheck + lint + commit**

```bash
pnpm typecheck
pnpm eslint src/schemas/organization.ts src/schemas/organization.test.ts
git add src/schemas/organization.ts src/schemas/organization.test.ts
git commit -m "feat: cod_caen obligatoriu + cod_caen_secundare cu validare pe formă juridică (înrolare)"
```

---

### Task 3: Schema Zod — `actualizeazaOrganizatieSchema` (editare)

**Files:**

- Modify: `src/schemas/organization.ts`
- Modify: `src/schemas/organization.test.ts`

**Interfaces:**

- Consumes: `caenClasaSchema` (Task 2), `valideazaSelectieCaen` (Task 1).
- Produces: `actualizeazaOrganizatieSchema` cu `cod_caen: string | undefined` (opțional) + `cod_caen_secundare: readonly string[]` — consumate de Task 8 (super-admin edit).

- [ ] **Step 1: Adaugă testele care eșuează** (în `organization.test.ts`, sub un nou `describe`)

```ts
import { actualizeazaOrganizatieSchema } from "./organization";

const BAZA_ACTUALIZARE = {
  orgId: "00000000-0000-0000-0000-000000000000",
  name: "Firma Mea",
  email_contact: "contact@firma.ro",
  telefon_contact: "0721234567",
  judet: "București" as const,
  oras: "București",
  plan: "trial" as const,
  seats_limit: 10,
};

describe("actualizeazaOrganizatieSchema — cod_caen", () => {
  it("acceptă lipsa completă a codului CAEN (organizație veche, neatinsă)", () => {
    const rezultat = actualizeazaOrganizatieSchema.safeParse(BAZA_ACTUALIZARE);
    expect(rezultat.success).toBe(true);
  });

  it("dacă principalul e completat, validează regula pe formă juridică", () => {
    const rezultat = actualizeazaOrganizatieSchema.safeParse({
      ...BAZA_ACTUALIZARE,
      forma_juridica: "PFA",
      cod_caen: "0111",
      cod_caen_secundare: ["0112", "0113", "0114", "0115", "0116"],
    });
    expect(rezultat.success).toBe(false);
  });

  it("acceptă un principal valid cu secundare în limită", () => {
    const rezultat = actualizeazaOrganizatieSchema.safeParse({
      ...BAZA_ACTUALIZARE,
      forma_juridica: "SRL",
      cod_caen: "6210",
      cod_caen_secundare: ["6220"],
    });
    expect(rezultat.success).toBe(true);
  });
});
```

- [ ] **Step 2: Rulează, confirmă eșecul**

Run: `pnpm vitest run src/schemas/organization.test.ts`
Expected: FAIL — `actualizeazaOrganizatieSchema` nu are azi `cod_caen_secundare`, iar validarea pe formă juridică nu rulează (forma_juridica nici nu există pe acest schema azi).

- [ ] **Step 3: Implementează**

`actualizeazaOrganizatieSchema` nu are azi câmpul `forma_juridica` deloc (organizația nu-și schimbă forma juridică din acest formular — corect, rămâne așa). Regula pe formă juridică tot trebuie să știe forma curentă ca să valideze corect; o primim ca parametru separat, NU ca un câmp nou needitabil în schemă (ar fi confuz să apară în payload un câmp needitat de utilizator). Adaugă la `actualizeazaOrganizatieSchema`:

```ts
export const actualizeazaOrganizatieSchema = z
  .object({
    orgId: z.uuid("Organizație invalidă."),
    name: z.string().trim().min(2, "Denumirea trebuie să aibă cel puțin 2 caractere.").max(120),
    legal_name: textOptional(160),
    email_contact: emailSchema,
    telefon_contact: telefonSchema,
    judet: judetSchema,
    oras: z.string().trim().min(2, "Introduceți localitatea.").max(80),
    adresa: textOptional(240),
    cod_postal: textOptional(10),
    website: z
      .url("Introduceți o adresă web validă.")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    reprezentant_legal: textOptional(120),
    plan: planSchema,
    seats_limit: seatsLimitSchema,
    capital_social: capitalSocialSchema,
    // Formă juridică opțională DOAR ca sursă pentru regula de mai jos — NU se
    // salvează separat (organizația nu-și schimbă forma juridică din acest
    // formular). Dacă lipsește, regula per-formă nu se aplică (echivalent cu
    // "nelimitat"), consistent cu faptul că principalul însuși e opțional aici.
    forma_juridica: z.enum(FORME_JURIDICE).optional(),
    cod_caen: opțional(caenClasaSchema),
    cod_caen_secundare: z.array(caenClasaSchema).max(50).default([]),
    sector: sectorSchema,
    functie_reprezentant_legal: functieReprezentantSchema,
    ssm_furnizor_extern: textOptional(200),
    ssm_persoana_responsabila: textOptional(160),
    zile_concediu_anual_implicit: opțional(zileConcediuImplicitBaza),
  })
  .superRefine((valori, ctx) => {
    const rezultat = valideazaSelectieCaen(
      valori.forma_juridica ?? "SRL", // fallback neutru: fără formă cunoscută, doar regulile "nelimitat" se aplică
      valori.cod_caen,
      valori.cod_caen_secundare,
    );
    if (!rezultat.valid) {
      ctx.addIssue({ code: "custom", message: rezultat.eroare, path: ["cod_caen_secundare"] });
    }
  });
```

**Decizie**: fallback-ul `"SRL"` la `forma_juridica` lipsă înseamnă "aplică doar regulile generale (fără duplicate), nu limitele specifice PFA/II/SRL-D" — corect, pentru că fără să știm forma reală nu putem aplica o limită specifică fără riscul de a bloca greșit o organizație SRL/SA/etc. Task 8 va trimite mereu `forma_juridica` reală a organizației (citită din bază), deci fallback-ul e doar o gardă teoretică.

- [ ] **Step 4: Rulează, confirmă succesul**

Run: `pnpm vitest run src/schemas/organization.test.ts`
Expected: PASS (toate cele 8 teste din fișier).

- [ ] **Step 5: Typecheck + lint + commit**

```bash
pnpm typecheck
pnpm eslint src/schemas/organization.ts src/schemas/organization.test.ts
git add src/schemas/organization.ts src/schemas/organization.test.ts
git commit -m "feat: cod_caen_secundare pe schema de editare a organizației"
```

---

### Task 4: Migrație DB

**Files:**

- Create: `supabase/migrations/0040_organizations_caen_secundare.sql`

**Interfaces:**

- Consumes: nimic.
- Produces: coloana `organizations.cod_caen_secundare text[]` — necesară pentru ca Task 7/8/9 să poată scrie/citi valoarea.

- [ ] **Step 1: Scrie migrația**

```sql
-- supabase/migrations/0040_organizations_caen_secundare.sql
-- Coduri CAEN secundare, alături de `cod_caen` (principal, coloană
-- existentă). Array simplu — fără atribute suplimentare per cod, deci fără
-- tabel separat. Fără CHECK de format: regula (4 cifre + apartenență la
-- nomenclator + limite pe formă juridică) trăiește în Zod
-- (`src/schemas/organization.ts`), la fel ca CUI/IBAN/CNP în acest proiect.
alter table organizations
  add column cod_caen_secundare text[] not null default '{}';
```

- [ ] **Step 2: Aplică local și regenerează tipurile**

Run: `pnpm db:push`
Expected: migrația se aplică fără erori (e pur aditivă).

Run: `pnpm db:types`
Expected: `src/types/database.ts` se regenerează, acum cu `cod_caen_secundare: string[]` pe tipul rândului `organizations`.

**Notă pentru executor**: dacă `pnpm db:push`/`pnpm db:types` eșuează pentru că nu există un proiect Supabase legat local (`supabase link`), oprește-te aici și cere utilizatorului să aplice migrația manual — NU continua la Task 7/8/9 fără ca `database.ts` să reflecte coloana nouă, altfel `pnpm typecheck` va eșua fals pe acele task-uri.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0040_organizations_caen_secundare.sql src/types/database.ts
git commit -m "feat: migrație — organizations.cod_caen_secundare (text[])"
```

---

### Task 5: Componenta UI partajată — selector CAEN

**Files:**

- Create: `src/components/forms/selector-cod-caen.tsx`
- Test: `src/components/forms/filtreaza-caen.test.ts`

**Interfaces:**

- Consumes: `NOMENCLATOR_CAEN`, `CodCaen` din `src/domain/organization/caen-nomenclator.ts`.
- Produces: `filtreazaCaen(interogare: string, exclude: ReadonlySet<string>): readonly CodCaen[]` (exportată, testată separat de UI); componentele `SelectorCodCaenPrincipal` și `SelectorCodCaenSecundare` — consumate de Task 6 (wizard), Task 8 (super-admin edit), Task 9 (Setări → Organizație).

**Notă despre testare**: acest proiect NU are `@testing-library/react` instalat — componentele React nu se testează prin randare, doar prin Vitest pe funcții pure (vezi `cui.test.ts`) sau manual/Playwright pentru interacțiune. De aceea logica de filtrare e extrasă ca funcție pură testabilă separat de JSX; interacțiunea (tastatură, click) se verifică manual la Task 10.

- [ ] **Step 1: Scrie testul pentru filtrare, care eșuează**

```ts
// src/components/forms/filtreaza-caen.test.ts
import { describe, expect, it } from "vitest";
import { filtreazaCaen } from "./selector-cod-caen";

describe("filtreazaCaen", () => {
  it("fără interogare, întoarce primele 20 din nomenclator", () => {
    const rezultat = filtreazaCaen("", new Set());
    expect(rezultat.length).toBe(20);
  });

  it("filtrează după prefixul codului", () => {
    const rezultat = filtreazaCaen("6210", new Set());
    expect(rezultat.some((c) => c.cod === "6210")).toBe(true);
    expect(rezultat.every((c) => c.cod.startsWith("6210"))).toBe(true);
  });

  it("filtrează după denumire, fără diacritice și case-insensitive", () => {
    const rezultat = filtreazaCaen("agricultura", new Set());
    expect(rezultat.length).toBeGreaterThan(0);
    expect(rezultat.every((c) => c.denumire.toLowerCase().includes("agricultur"))).toBe(true);
  });

  it("exclude codurile din setul `exclude`", () => {
    const rezultat = filtreazaCaen("6210", new Set(["6210"]));
    expect(rezultat.some((c) => c.cod === "6210")).toBe(false);
  });

  it("limitează rezultatele la 20", () => {
    const rezultat = filtreazaCaen("Activit", new Set());
    expect(rezultat.length).toBeLessThanOrEqual(20);
  });
});
```

- [ ] **Step 2: Rulează, confirmă eșecul**

Run: `pnpm vitest run src/components/forms/filtreaza-caen.test.ts`
Expected: FAIL — `Cannot find module './selector-cod-caen'`

- [ ] **Step 3: Implementează**

```tsx
// src/components/forms/selector-cod-caen.tsx
"use client";

import { useId, useRef, useState } from "react";
import { NOMENCLATOR_CAEN, type CodCaen } from "@/domain/organization/caen-nomenclator";

function normalizeaza(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const LIMITA_REZULTATE = 20;

/** Filtrare cod SAU denumire, fără diacritice; exclude codurile deja alese. */
export function filtreazaCaen(
  interogare: string,
  exclude: ReadonlySet<string>,
): readonly CodCaen[] {
  const termen = normalizeaza(interogare.trim());
  const sursa =
    termen.length === 0
      ? NOMENCLATOR_CAEN
      : NOMENCLATOR_CAEN.filter(
          (c) => c.cod.startsWith(termen) || normalizeaza(c.denumire).includes(termen),
        );
  const rezultat: CodCaen[] = [];
  for (const c of sursa) {
    if (exclude.has(c.cod)) continue;
    rezultat.push(c);
    if (rezultat.length >= LIMITA_REZULTATE) break;
  }
  return rezultat;
}

const CLASA_CAMP =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

function ListaRezultate({
  rezultate,
  indiceActiv,
  onAlege,
  idListbox,
}: Readonly<{
  rezultate: readonly CodCaen[];
  indiceActiv: number;
  onAlege: (cod: CodCaen) => void;
  idListbox: string;
}>) {
  if (rezultate.length === 0) {
    return (
      <div className="border-border bg-surface text-muted-foreground absolute z-10 mt-1 w-full rounded-md border p-2 text-sm shadow-md">
        Niciun cod CAEN găsit.
      </div>
    );
  }
  return (
    <ul
      id={idListbox}
      role="listbox"
      className="border-border bg-surface absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border shadow-md"
    >
      {rezultate.map((c, index) => (
        <li key={c.cod}>
          <button
            type="button"
            role="option"
            aria-selected={index === indiceActiv}
            onMouseDown={(e) => {
              e.preventDefault(); // păstrează focusul pe input, nu-l fură butonul
              onAlege(c);
            }}
            className={
              "flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm " +
              (index === indiceActiv ? "bg-primary/10" : "hover:bg-primary/5")
            }
          >
            <span className="text-foreground font-mono font-medium">{c.cod}</span>
            <span className="text-muted-foreground">{c.denumire}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

interface ProprietatiPrincipal {
  readonly value: string | undefined;
  readonly onChange: (cod: string) => void;
  readonly id: string;
  readonly ariaInvalid?: boolean;
  readonly ariaDescribedBy?: string;
}

export function SelectorCodCaenPrincipal({
  value,
  onChange,
  id,
  ariaInvalid,
  ariaDescribedBy,
}: ProprietatiPrincipal) {
  const [interogare, setInterogare] = useState("");
  const [deschis, setDeschis] = useState(false);
  const [indiceActiv, setIndiceActiv] = useState(0);
  const idListbox = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const selectat = value !== undefined ? NOMENCLATOR_CAEN.find((c) => c.cod === value) : undefined;
  const rezultate = filtreazaCaen(interogare, new Set());

  function alege(c: CodCaen): void {
    onChange(c.cod);
    setInterogare("");
    setDeschis(false);
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDeschis(false);
      }}
    >
      <input
        id={id}
        role="combobox"
        aria-expanded={deschis}
        aria-controls={idListbox}
        aria-autocomplete="list"
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        value={deschis ? interogare : selectat ? `${selectat.cod} — ${selectat.denumire}` : ""}
        placeholder="Scrie codul sau denumirea (ex. 6210, agricultură)"
        onFocus={() => {
          setDeschis(true);
          setInterogare("");
        }}
        onChange={(e) => {
          setInterogare(e.target.value);
          setIndiceActiv(0);
          setDeschis(true);
        }}
        onKeyDown={(e) => {
          if (!deschis) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndiceActiv((i) => Math.min(rezultate.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndiceActiv((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const ales = rezultate[indiceActiv];
            if (ales !== undefined) alege(ales);
          } else if (e.key === "Escape") {
            setDeschis(false);
          }
        }}
        className={CLASA_CAMP}
      />
      {deschis && (
        <ListaRezultate
          rezultate={rezultate}
          indiceActiv={indiceActiv}
          onAlege={alege}
          idListbox={idListbox}
        />
      )}
    </div>
  );
}

interface ProprietatiSecundare {
  readonly value: readonly string[];
  readonly onChange: (coduri: readonly string[]) => void;
  readonly exclude?: string | undefined; // codul principal, dacă e ales
  readonly max: number | null;
  readonly id: string;
  readonly ariaInvalid?: boolean;
}

export function SelectorCodCaenSecundare({
  value,
  onChange,
  exclude,
  max,
  id,
  ariaInvalid,
}: ProprietatiSecundare) {
  const [interogare, setInterogare] = useState("");
  const [deschis, setDeschis] = useState(false);
  const [indiceActiv, setIndiceActiv] = useState(0);
  const idListbox = useId();

  const excluse = new Set(value);
  if (exclude !== undefined) excluse.add(exclude);
  const laLimita = max !== null && value.length >= max;
  const rezultate = laLimita ? [] : filtreazaCaen(interogare, excluse);

  function adauga(c: CodCaen): void {
    onChange([...value, c.cod]);
    setInterogare("");
  }
  function elimina(cod: string): void {
    onChange(value.filter((v) => v !== cod));
  }

  return (
    <div className="space-y-2">
      <div
        className="relative"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setDeschis(false);
        }}
      >
        <input
          id={id}
          role="combobox"
          aria-expanded={deschis}
          aria-controls={idListbox}
          aria-autocomplete="list"
          aria-invalid={ariaInvalid}
          disabled={laLimita}
          value={interogare}
          placeholder={
            laLimita ? "Limită atinsă pentru forma juridică aleasă" : "Adaugă un cod secundar…"
          }
          onFocus={() => setDeschis(true)}
          onChange={(e) => {
            setInterogare(e.target.value);
            setIndiceActiv(0);
            setDeschis(true);
          }}
          onKeyDown={(e) => {
            if (!deschis) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndiceActiv((i) => Math.min(rezultate.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndiceActiv((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const ales = rezultate[indiceActiv];
              if (ales !== undefined) adauga(ales);
            } else if (e.key === "Escape") {
              setDeschis(false);
            }
          }}
          className={CLASA_CAMP + (laLimita ? " cursor-not-allowed opacity-60" : "")}
        />
        {deschis && !laLimita && (
          <ListaRezultate
            rezultate={rezultate}
            indiceActiv={indiceActiv}
            onAlege={adauga}
            idListbox={idListbox}
          />
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        {value.length} {max === null ? "coduri (nelimitat)" : `din ${max} coduri folosite`}
      </p>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((cod) => {
            const info = NOMENCLATOR_CAEN.find((c) => c.cod === cod);
            return (
              <li
                key={cod}
                className="bg-primary/10 text-foreground flex items-center gap-2 rounded-full px-3 py-1 text-xs"
              >
                <span className="font-mono font-medium">{cod}</span>
                {info !== undefined && (
                  <span className="text-muted-foreground">{info.denumire}</span>
                )}
                <button
                  type="button"
                  onClick={() => elimina(cod)}
                  aria-label={`Elimină codul ${cod}`}
                  className="text-muted-foreground hover:text-danger"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rulează testul, confirmă succesul**

Run: `pnpm vitest run src/components/forms/filtreaza-caen.test.ts`
Expected: PASS (5 teste).

- [ ] **Step 5: Typecheck + lint + commit**

```bash
pnpm typecheck
pnpm eslint src/components/forms/selector-cod-caen.tsx src/components/forms/filtreaza-caen.test.ts
git add src/components/forms/selector-cod-caen.tsx src/components/forms/filtreaza-caen.test.ts
git commit -m "feat: componentă partajată de selecție cod CAEN (principal + secundare)"
```

---

### Task 6: Integrare în wizard — pas 1 „Date fiscale”

**Files:**

- Modify: `src/app/(platform)/super-admin/organizatii/nou/_components/pas-1-identitate.tsx`

**Interfaces:**

- Consumes: `SelectorCodCaenPrincipal`, `SelectorCodCaenSecundare` (Task 5); `maximSecundare` (Task 1); `onboardeazaOrganizatieSchema` cu `cod_caen`/`cod_caen_secundare` (Task 2).
- Produces: nimic consumat de alte task-uri — capăt de lanț UI.

- [ ] **Step 1: Înlocuiește câmpul „Cod CAEN” existent**

În `pas-1-identitate.tsx`, adaugă la importuri:

```ts
import { maximSecundare } from "@/domain/organization/caen-reguli";
import {
  SelectorCodCaenPrincipal,
  SelectorCodCaenSecundare,
} from "@/components/forms/selector-cod-caen";
```

Extinde destructurarea din `formular` (linia `const { register, watch, formState: { errors } } = formular;`) cu `setValue`:

```ts
const {
  register,
  watch,
  setValue,
  formState: { errors },
} = formular;
const formaJuridicaSelectata = watch("forma_juridica");
const codCaenPrincipal = watch("cod_caen");
const codCaenSecundare = watch("cod_caen_secundare") ?? [];
const limitaSecundare = maximSecundare(formaJuridicaSelectata);
```

Înlocuiește tot blocul existent al câmpului „Cod CAEN” (de la `<label htmlFor={\`${idFormular}-caen\`}...` până la `<Eroare id={\`${idFormular}-caen-eroare\`} mesaj={errors.cod_caen?.message} />`, inclusiv `</div>` de închidere) cu:

```tsx
<div>
  <label htmlFor={`${idFormular}-caen`} className={claseLabel}>
    Cod CAEN principal *
  </label>
  <SelectorCodCaenPrincipal
    id={`${idFormular}-caen`}
    value={codCaenPrincipal}
    onChange={(cod) => setValue("cod_caen", cod, { shouldValidate: true })}
    ariaInvalid={Boolean(errors.cod_caen)}
    ariaDescribedBy={`${idFormular}-caen-ajutor`}
  />
  <p id={`${idFormular}-caen-ajutor`} className="text-muted-foreground mt-1 text-xs">
    Anumite coduri (IT, Construcții, Agricultură, Industria Alimentară) permit scutiri fiscale
    per-angajat în modulul de Salarizare.
  </p>
  <Eroare id={`${idFormular}-caen-eroare`} mesaj={errors.cod_caen?.message} />
</div>
```

Adaugă imediat după (înainte de `</div>` de închidere a grid-ului `sm:grid-cols-2` care conținea capital_social + cod_caen — verifică indentarea existentă din fișier), un bloc nou full-width pentru codurile secundare:

```tsx
<div>
  <label htmlFor={`${idFormular}-caen-secundare`} className={claseLabel}>
    Coduri CAEN secundare
  </label>
  <SelectorCodCaenSecundare
    id={`${idFormular}-caen-secundare`}
    value={codCaenSecundare}
    onChange={(coduri) => setValue("cod_caen_secundare", coduri, { shouldValidate: true })}
    exclude={codCaenPrincipal}
    max={limitaSecundare}
    ariaInvalid={Boolean(errors.cod_caen_secundare)}
  />
  {formaJuridicaSelectata === "SRL-D" && (
    <p className="text-muted-foreground mt-1 text-xs">
      SRL-D: toate codurile alese trebuie să facă parte din cel mult 5 grupe de activitate (primele
      3 cifre ale codului), iar anumite activități sunt excluse prin lege pentru forma debutant.
    </p>
  )}
  <Eroare id={`${idFormular}-caen-secundare-eroare`} mesaj={errors.cod_caen_secundare?.message} />
</div>
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: fără erori noi în `pas-1-identitate.tsx` (câmpurile `cod_caen`/`cod_caen_secundare` există deja pe `OnboardeazaOrganizatieInput` din Task 2).

- [ ] **Step 3: Lint + commit**

```bash
pnpm eslint "src/app/(platform)/super-admin/organizatii/nou/_components/pas-1-identitate.tsx"
git add "src/app/(platform)/super-admin/organizatii/nou/_components/pas-1-identitate.tsx"
git commit -m "feat: selecție asistată de coduri CAEN în pasul Date fiscale al înrolării"
```

---

### Task 7: Acțiunea de înrolare — salvează `cod_caen_secundare`

**Files:**

- Modify: `src/app/(platform)/super-admin/organizatii/nou/actions.ts`

**Interfaces:**

- Consumes: `input.cod_caen_secundare` (din `onboardeazaOrganizatieSchema`, Task 2).
- Produces: nimic — capăt de lanț server.

- [ ] **Step 1: Adaugă câmpul la insert**

În `handler`, lângă linia `cod_caen: input.cod_caen,` (deja necondiționată — vezi commit anterior din sesiune care a scos condiția `undefined`), adaugă imediat după:

```ts
cod_caen: input.cod_caen,
cod_caen_secundare: input.cod_caen_secundare,
```

Adaugă `"cod_caen_secundare"` în lista `allow` a auditului (lângă `"cod_caen"` existent, linia ~54).

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: fără erori (necesită `src/types/database.ts` regenerat din Task 4 — dacă Task 4 s-a oprit la nota de „migrație neaplicată”, acest typecheck va eșua pe `cod_caen_secundare` inexistent în tipul de insert; nu continua fără să rezolvi asta).

- [ ] **Step 3: Lint + commit**

```bash
pnpm eslint "src/app/(platform)/super-admin/organizatii/nou/actions.ts"
git add "src/app/(platform)/super-admin/organizatii/nou/actions.ts"
git commit -m "feat: salvează cod_caen_secundare la înrolarea organizației"
```

---

### Task 8: Editare — super-admin (`formular-editeaza-organizatie.tsx`)

**Files:**

- Modify: `src/app/(platform)/super-admin/organizatii/actions.ts` (select de coloane + update handler)
- Modify: `src/app/(platform)/super-admin/organizatii/[orgId]/page.tsx` (props către formular)
- Modify: `src/app/(platform)/super-admin/organizatii/[orgId]/_components/formular-editeaza-organizatie.tsx`

**Interfaces:**

- Consumes: `actualizeazaOrganizatieSchema` cu `cod_caen`/`cod_caen_secundare`/`forma_juridica` opțional (Task 3); `SelectorCodCaenPrincipal`/`SelectorCodCaenSecundare` (Task 5); `maximSecundare` (Task 1).
- Produces: nimic — capăt de lanț UI.

- [ ] **Step 1: Extinde select-ul de coloane și update handler-ul**

În `src/app/(platform)/super-admin/organizatii/actions.ts`, linia ~351 (select-ul din `fisaOrganizatiei`), adaugă `cod_caen_secundare` și `forma_juridica` dacă lipsește din listă (verifică — `forma_juridica` e deja acolo; adaugă doar `cod_caen_secundare` imediat după `cod_caen`):

```
"..., capital_social, cod_caen, cod_caen_secundare, sector, ..."
```

În `actualizeazaOrganizatie` (același fișier, handler-ul de `.update`), adaugă lângă linia `...(input.cod_caen === undefined ? {} : { cod_caen: input.cod_caen }),`:

```ts
...(input.cod_caen === undefined ? {} : { cod_caen: input.cod_caen }),
cod_caen_secundare: input.cod_caen_secundare,
```

(necondiționat — `cod_caen_secundare` are `.default([])` în schemă, deci e mereu un array, chiar dacă gol).

Adaugă `"cod_caen_secundare"` în `allow` al auditului (linia ~132).

- [ ] **Step 2: Trece forma juridică și codurile prin props**

În `src/app/(platform)/super-admin/organizatii/[orgId]/page.tsx`, în obiectul `organizatie={{...}}` pasat către `FormularEditeazaOrganizatie` (linia ~124), adaugă:

```ts
forma_juridica: organizatie.forma_juridica,
cod_caen: organizatie.cod_caen,
cod_caen_secundare: organizatie.cod_caen_secundare,
```

- [ ] **Step 3: Actualizează formularul**

În `formular-editeaza-organizatie.tsx`:

Extinde interfața `OrganizatieExistenta`:

```ts
interface OrganizatieExistenta {
  readonly orgId: string;
  readonly name: string;
  readonly legal_name: string | null;
  readonly email_contact: string | null;
  readonly telefon_contact: string | null;
  readonly judet: string | null;
  readonly oras: string | null;
  readonly adresa: string | null;
  readonly cod_postal: string | null;
  readonly website: string | null;
  readonly reprezentant_legal: string | null;
  readonly plan: string;
  readonly seats_limit: number;
  readonly zile_concediu_anual_implicit: number;
  readonly forma_juridica: string | null;
  readonly cod_caen: string | null;
  readonly cod_caen_secundare: readonly string[];
}
```

Adaugă import:

```ts
import { useState } from "react"; // deja importat — doar confirmă că e prezent
import {
  SelectorCodCaenPrincipal,
  SelectorCodCaenSecundare,
} from "@/components/forms/selector-cod-caen";
import { maximSecundare } from "@/domain/organization/caen-reguli";
```

În corpul componentei, adaugă stare locală pentru cele două câmpuri (formularul ăsta nu e react-hook-form — e `<form action={fn}>` cu `FormData`, iar un array nu trece natural prin `FormData`, deci aceste două câmpuri se citesc din closure, nu din `fd`):

```ts
const [codCaen, setCodCaen] = useState<string | undefined>(organizatie.cod_caen ?? undefined);
const [codCaenSecundare, setCodCaenSecundare] = useState<readonly string[]>(
  organizatie.cod_caen_secundare,
);
const limitaSecundare = maximSecundare(organizatie.forma_juridica ?? "SRL");
```

În `trimite(fd: FormData)`, adaugă la obiectul trimis către `actualizeazaOrganizatie`:

```ts
cod_caen: codCaen,
cod_caen_secundare: codCaenSecundare,
forma_juridica: organizatie.forma_juridica ?? undefined,
```

În JSX, adaugă un bloc nou (lângă celelalte `<div className="flex flex-col gap-1">`, de exemplu după blocul „Reprezentant legal”):

```tsx
<div className="flex flex-col gap-1">
  <label htmlFor={`${idFormular}-caen`} className="text-sm font-medium">
    Cod CAEN principal
  </label>
  <SelectorCodCaenPrincipal
    id={`${idFormular}-caen`}
    value={codCaen}
    onChange={setCodCaen}
  />
</div>
<div className="flex flex-col gap-1 sm:col-span-2">
  <label htmlFor={`${idFormular}-caen-secundare`} className="text-sm font-medium">
    Coduri CAEN secundare
  </label>
  <SelectorCodCaenSecundare
    id={`${idFormular}-caen-secundare`}
    value={codCaenSecundare}
    onChange={setCodCaenSecundare}
    exclude={codCaen}
    max={limitaSecundare}
  />
</div>
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: fără erori.

- [ ] **Step 5: Lint + commit**

```bash
pnpm eslint "src/app/(platform)/super-admin/organizatii/actions.ts" "src/app/(platform)/super-admin/organizatii/[orgId]/page.tsx" "src/app/(platform)/super-admin/organizatii/[orgId]/_components/formular-editeaza-organizatie.tsx"
git add "src/app/(platform)/super-admin/organizatii/actions.ts" "src/app/(platform)/super-admin/organizatii/[orgId]/page.tsx" "src/app/(platform)/super-admin/organizatii/[orgId]/_components/formular-editeaza-organizatie.tsx"
git commit -m "feat: editare coduri CAEN (principal + secundare) din fișa organizației (super-admin)"
```

---

### Task 9: Editare — Setări → Organizație

**Files:**

- Modify: `src/app/(app)/setari/organizatie/actions.ts`
- Modify: `src/app/(app)/setari/organizatie/page.tsx`
- Modify: `src/app/(app)/setari/organizatie/organizatie-form.tsx`

**Interfaces:**

- Consumes: `caenClasaSchema` (Task 2, reexportat din `@/schemas/organization` — verifică export la Task 2, altfel importă direct), `valideazaSelectieCaen` (Task 1), `SelectorCodCaenPrincipal`/`SelectorCodCaenSecundare` (Task 5), `maximSecundare` (Task 1).
- Produces: nimic — capăt de lanț UI.

- [ ] **Step 1: Extinde schema locală și select-ul de coloane**

În `src/app/(app)/setari/organizatie/actions.ts`, adaugă la importuri:

```ts
import { caenClasaSchema } from "@/schemas/organization";
import { valideazaSelectieCaen } from "@/domain/organization/caen-reguli";
```

Înlocuiește linia `cod_caen: z.union([...]).optional(),` din `schemaOrganizatie` cu:

```ts
cod_caen: z.union([z.literal(""), caenClasaSchema]).optional(),
cod_caen_secundare: z.array(caenClasaSchema).max(50).default([]),
```

Transformă `schemaOrganizatie` dintr-un `z.object({...})` simplu într-unul cu `.superRefine` — înlocuiește linia de închidere `});` a obiectului cu:

```ts
  })
  .superRefine((valori, ctx) => {
    const principal = valori.cod_caen === "" ? undefined : valori.cod_caen;
    const rezultat = valideazaSelectieCaen(
      valori.forma_juridica ?? "SRL",
      principal,
      valori.cod_caen_secundare,
    );
    if (!rezultat.valid) {
      ctx.addIssue({ code: "custom", message: rezultat.eroare, path: ["cod_caen_secundare"] });
    }
  });
```

(Zod: `z.object({...}).superRefine(...)` — schimbă doar delimitatorul `})` final în `})\n  .superRefine(...)`.)

Adaugă `"cod_caen_secundare"` în `CAMPURI_AUDITATE`.

În `handler`, adaugă lângă linia `cod_caen: codCaen,`:

```ts
cod_caen: codCaen,
cod_caen_secundare: input.cod_caen_secundare,
```

- [ ] **Step 2: Extinde tipul și mapping-ul de date inițiale**

În `page.tsx`: adaugă `cod_caen_secundare` la select-ul de coloane (linia ~66, lângă `cod_caen`):

```
"..., capital_social, cod_caen, cod_caen_secundare, sector, ..."
```

Adaugă în obiectul `initiale` (lângă `cod_caen: text(data.cod_caen),`):

```ts
cod_caen_secundare: data.cod_caen_secundare ?? [],
```

- [ ] **Step 3: Actualizează formularul**

În `organizatie-form.tsx`:

Extinde `ValoriOrganizatie`:

```ts
export type ValoriOrganizatie = Readonly<{
  name: string;
  legal_name: string;
  forma_juridica: string;
  cui: string;
  platitor_tva: boolean;
  reg_com: string;
  adresa: string;
  judet: string;
  oras: string;
  cod_postal: string;
  tara: string;
  email_contact: string;
  telefon_contact: string;
  website: string;
  reprezentant_legal: string;
  capital_social: string;
  cod_caen: string;
  cod_caen_secundare: readonly string[];
  sector: string;
  functie_reprezentant_legal: string;
  ssm_furnizor_extern: string;
  ssm_persoana_responsabila: string;
  zile_concediu_anual_implicit: string;
}>;
```

Scoate `"cod_caen"` din array-ul `ORDINE` (nu se mai randează generic ca text simplu) și din `ETICHETE` (lasă restul neschimbat).

Adaugă import:

```ts
import {
  SelectorCodCaenPrincipal,
  SelectorCodCaenSecundare,
} from "@/components/forms/selector-cod-caen";
import { maximSecundare } from "@/domain/organization/caen-reguli";
```

În JSX, imediat după `{ORDINE.map(...)}` (înainte de checkbox-ul „Plătitor de TVA”), adaugă:

```tsx
<Camp id="org-cod-caen" eticheta="Cod CAEN principal" erori={stare.erori?.["cod_caen_secundare"]}>
  <SelectorCodCaenPrincipal
    id="org-cod-caen"
    value={valori.cod_caen === "" ? undefined : valori.cod_caen}
    onChange={(cod) => setValori((precedente) => ({ ...precedente, cod_caen: cod }))}
  />
</Camp>
<Camp id="org-cod-caen-secundare" eticheta="Coduri CAEN secundare" erori={undefined}>
  <SelectorCodCaenSecundare
    id="org-cod-caen-secundare"
    value={valori.cod_caen_secundare}
    onChange={(coduri) =>
      setValori((precedente) => ({ ...precedente, cod_caen_secundare: coduri }))
    }
    exclude={valori.cod_caen === "" ? undefined : valori.cod_caen}
    max={maximSecundare(valori.forma_juridica)}
  />
</Camp>
```

(Mesajul de eroare al `valideazaSelectieCaen` e atașat la `cod_caen_secundare` — de-asta ambele câmpuri împart aceeași sursă de eroare, afișată sub primul `Camp` care o citește; e suficient să apară o singură dată, sub selectorul principal, ca să nu se dubleze vizual.)

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: fără erori.

- [ ] **Step 5: Lint + commit**

```bash
pnpm eslint "src/app/(app)/setari/organizatie/actions.ts" "src/app/(app)/setari/organizatie/page.tsx" "src/app/(app)/setari/organizatie/organizatie-form.tsx"
git add "src/app/(app)/setari/organizatie/actions.ts" "src/app/(app)/setari/organizatie/page.tsx" "src/app/(app)/setari/organizatie/organizatie-form.tsx"
git commit -m "feat: editare coduri CAEN (principal + secundare) din Setări → Organizație"
```

---

### Task 10: Verificare finală

**Files:** niciunul — doar verificare.

**Interfaces:** N/A.

- [ ] **Step 1: Suită completă**

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Expected: toate trec, zero erori noi față de starea de dinainte de acest plan (verifică explicit că orice eroare rămasă e cea deja cunoscută/preexistentă din `concedii/setari/actions.ts` și `lib/queries/leave.ts`, legată de migrații neaplicate anterioare acestui plan — nu una introdusă aici).

- [ ] **Step 2: Verificare manuală în browser**

Pornește `pnpm dev`, apoi:

1. Deschide wizardul de înrolare (`/super-admin/organizatii/nou`), pasul „Date fiscale”.
2. Alege forma juridică „PFA” — completează codul principal, apoi adaugă 4 coduri secundare (trebuie acceptate), încearcă un al 5-lea (trebuie blocat cu mesaj).
3. Schimbă forma juridică la „SRL-D” — încearcă să adaugi codul `9200` (trebuie respins la trimiterea pasului, cu mesaj despre activitate exclusă); adaugă coduri din 6 grupe diferite (trebuie respins cu mesaj despre limita de 5 grupe).
4. Termină înrolarea unei organizații de test cu formă „SRL” (nelimitat) și 2-3 coduri secundare.
5. Din fișa organizației nou create (super-admin), deschide „Editează datele” — confirmă că cele două câmpuri CAEN apar populate corect și pot fi modificate.
6. Din contul organizației (Setări → Organizație), confirmă aceeași funcționalitate.

- [ ] **Step 3: Commit final (dacă a rezultat vreo corecție din verificarea manuală)**

```bash
git add -A
git commit -m "fix: corecții din verificarea manuală a selecției de coduri CAEN"
```
