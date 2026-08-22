---
name: administrativo-actiune
description: Scrie sau modifică o Server Action Administrativo prin `createAction()` — cele opt straturi în ordine fixă, `feature` + `permission` + `minScope`, allow-list de audit, `revalidate` pe DEFINIȚIE nu în handler, `traduEroare` pe fiecare scriere, `.select()` obligatoriu după un UPDATE de tranziție, plus limitele ESLint pentru `createAdminSupabase`. Se folosește când se adaugă sau se schimbă ceva în `src/app/**/actions.ts`, când se scrie o schemă Zod din `src/schemas/`, sau când o cheie de permisiune lipsește și acțiunea nu compilează.
---

# Server Action nouă în Administrativo

## 1. Unde intră codul

| Ce faci        | Unde                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| citire pură    | `src/lib/queries/<modul>.ts` — doar `createServerSupabase()`                                                         |
| scriere        | `src/app/**/actions.ts` — obligatoriu prin `createAction()`                                                          |
| ocolire de RLS | **doar** `actions.ts`, `api/**/route.ts`, `rate-limit.ts`, `scripts/**`, `tests/**` (ESLint `no-restricted-imports`) |

## 2. Cele opt straturi

`src/lib/actions/create-action.ts` le rulează în ordine FIXĂ:

1. autentificare (`resolveTenant()`) · 2. organizația activă, rezolvată
   **pe server** (clientul nu trimite niciodată `organization_id`) · 3. modulul
   activ (`feature`) · 4. permisiunea cu prag (`permission` + `minScope`) ·
2. **validarea Zod** · 6. handler · 7. audit · 8. `revalidatePath()` per cale.

Zod rulează **după** autorizare, deliberat: unui apelant fără drept nu i se
spune ce câmpuri așteaptă acțiunea. Nu reordona.

## 3. Definiția

```ts
export const creeazaX = createAction({
  name: "modul.entitate.creeaza",     // doar pentru jurnalul serverului
  feature: "<cheie>",                  // absent = acțiune de NUCLEU, decizie explicită
  permission: "<resursă>:<acțiune>",  // uniune literală închisă din @/config/permissions
  minScope: "all",                     // obligatoriu; "none" e exclus la nivel de tip
  input: schemaZod,
  audit: {
    action: "create",
    entityType: "<tabela>",
    entityId: (_input, data) => data.id,
    allow: CAMPURI_AUDITATE,           // ALLOW-list, nu deny-list
  },
  revalidate: [...CAI_REVALIDARE],     // se DECLARĂ aici, nu se cheamă din handler
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => { … },
});
```

`audit.allow` ajunge în `audit_logs`. CNP, IBAN, salarii, motivul medical
(art. 9 GDPR), serii și numere de certificat nu au ce căuta acolo.

`revalidate` declarat, nu `revalidatePath()` în handler: altfel acțiunea nu
poate fi `await`-uită dintr-un Server Component — `revalidatePath` în timpul
randării aruncă (capcana 34). În repo sunt azi 14 fișiere cu acest defect.

## 4. Erorile

Nouă coduri, împărțite în `denied` (`NEAUTENTIFICAT`, `FARA_ORGANIZATIE`,
`MODUL_DEZACTIVAT`, `INTERZIS`, `VALIDARE`, `LIMITA_DEPASITA`) și `failure`
(`CONFLICT`, `NEGASIT`, `EROARE_INTERNA`) — un tipar de citit diferit la incident.

Din handler arunci cu helperii din `errors.ts`: `forbidden()`, `notFound()`,
`businessRule()` (⇒ CONFLICT), `limitExceeded()`, `invalidInput()`.

⚠️ `mapPostgrestError` înlocuiește **orice P0001** cu „Operațiunea a fost
respinsă de o regulă a sistemului.” Mesajele care numeau obiectele nereturnate
sau luna blocată dispar. Fiecare `.insert()`/`.update()` trece printr-un
`traduEroare` de modul (`<modul>/erori.ts`) care re-aruncă
`businessRule(error.message.slice(0, 300))`. **Un singur apel uitat readuce
mesajul generic** (capcana 3). Nu retasta mesajul în sursă — în bază e scris cu
sedilă, iar regula proiectului cere virgulă (capcana 24).

## 5. Tranziții de status — regula care lipsește în 15 locuri

```ts
const { data: actualizata, error } = await ctx.supabase
  .from("<tabela>")
  .update({ status: "<nou>" })
  .eq("id", input.id)
  .eq("organization_id", ctx.tenant.organizationId)
  .select("id")
  .maybeSingle();
if (error !== null) traduEroare(error);
if (actualizata === null) throw businessRule("Starea s-a schimbat între timp.");
```

Un UPDATE respins de clauza `USING` a politicii **nu produce nicio eroare** —
afectează zero rânduri, tăcut, iar utilizatorul vede „succes” (capcana 17).
Rulează `node .claude/skills/administrativo/scripts/audit-actiuni.mjs --diff`
ca să confirmi că n-ai adăugat un al șaisprezecelea.

## 6. Coloane pe care clientul NU le trimite

- calculate de triggere BEFORE — **sunt prezente în tipul `Insert` generat**,
  deci `tsc` nu prinde nimic (capcanele 6, 29);
- `GENERATED ALWAYS` — 428C9, iar unele nici nu apar în `Insert` (capcanele 22, 30);
- invers, `vehicles` și `vehicle_documents` **cer** `created_by` ȘI `updated_by`
  explicit: niciun trigger nu le pune, iar omisiunea dă 42501 cu mesajul „Nu
  aveți dreptul”, care trimite investigația în direcția greșită (capcana 23).

Verifică întotdeauna: `node .claude/skills/administrativo/scripts/capcana.mjs --tabela <tabela>`.

## 7. Fișa proprie a angajatului

Rolul `employee` are `employees:read = none` — nu-și vede nici propria fișă
(capcana 10). Rezolvarea e legală **doar** în `actions.ts`, cu
`createAdminSupabase()` și filtru explicit `organization_id + user_id +
is_primary + deleted_at is null`, plus comentariul care spune de ce.

## 8. Schema Zod

`src/schemas/<modul>.ts`: enum-urile se oglindesc manual din SQL (ca să poată
valida și intrarea din URL), mesajele sunt propoziții în română cu punct final,
iar **fiecare câmp de filtru din URL are `.default()`** — altfel un șir gol
ajunge la o coloană `uuid` și produce 22P02.

## 9. Cheie de permisiune lipsă

`permission:` e uniune literală închisă, deci acțiunea nu compilează fără cheie.
Adaugă-o în `PERMISSION_KEYS` (`src/config/permissions.ts`) **și** verifică:

```bash
node .claude/skills/administrativo/scripts/verifica-permisiuni.mjs
```

Atenție: `can()` din `@/lib/auth/permissions` acceptă `string`, deci porțile de
afișare compilează și cu o cheie inventată — și întorc mereu `false`, tăcut.
Regula R3 a scriptului acoperă exact asta.

## 10. Finalizare

```bash
node .claude/skills/administrativo/scripts/audit-actiuni.mjs --diff
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Build-ul e obligatoriu dacă ai atins un fișier `"use server"`: un astfel de
fișier **nu poate exporta o constantă**, iar `tsc` nu semnalează nimic.
