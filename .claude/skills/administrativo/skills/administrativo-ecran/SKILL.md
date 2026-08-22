---
name: administrativo-ecran
description: Construiește o pagină de modul Administrativo și stratul ei de citire — preambulul `requireTenant` → `requireFeature` → `getPermissionMap` → `can()` → `AccesRestrictionat`, booleeni `poateX` calculați pe server, funcții libere în `src/lib/queries/` cu `organizationId` primul argument, cursor keyset în locul lui `.range()`, formular client cu `useTransition` + `FormData` + `useId`. Se folosește când se creează sau se modifică un `page.tsx` din `src/app/(app)/`, o funcție de citire, sau o componentă client care trimite date către o Server Action.
---

# Ecran nou în Administrativo

## 1. Preambulul paginii — nenegociabil

```tsx
export const metadata: Metadata = { title: "<Titlu>" };

export default async function Pagina() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "<cheie>");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "<resursă>:read", "own")) {
    return <main className="p-6"><AccesRestrictionat mesaj="…" /></main>;
  }
  const poateAdministra = can(permisiuni, "<resursă>:update", "all");
  …
}
```

**O pagină de citire fără verificare de permisiune E divulgare.** S-a întâmplat:
`setari/membri` și `setari/organizatie` arătau lista de membri, planul și
plafonul de locuri oricărui membru autentificat.

⚠️ `scopeFor(...) !== null` e poarta **greșită** — `"none"` e truthy. Folosește
`can(permisiuni, cheie, prag)`.

`requireFeature` întoarce **404, nu 403** — un modul dezactivat nu există, nu e
interzis.

## 2. Booleeni pe server

`poateEdita`, `poateAproba`, `poateSterge` se calculează în componenta server și
se trimit ca props. Componenta client întoarce `null` când sunt false. Clientul
nu recalculează permisiuni. Ascunderea e UX, nu securitate — bariera reală e
RLS plus verificarea din `createAction()`.

## 3. Stratul de citire

`src/lib/queries/<modul>.ts`, funcții libere, `organizationId` primul argument,
tipuri `readonly`, `.returns<T[]>()` obligatoriu (tipurile generate emit
`Relationships: []`, deci embed-urile nu se infera). `createServerSupabase()` se
apelează per funcție, **niciodată memoizat**.

Capcanele care golesc ecrane fără nicio eroare:

| Simptom | Cauză | Ce faci |
|---|---|---|
| lipsesc rânduri peste 1000 | `max_rows` din PostgREST **trunchiază tăcut** | paginează după entitatea logică (angajat), nu după rândul brut |
| listă cu rânduri șterse | politicile din `0011` n-au `deleted_at is null` | adaugă `.is("deleted_at", null)` explicit |
| embed `null` fără eroare | rolul n-are permisiunea pe tabela embed-ată | tipează `| null`, afișează „—”; NU compensa cu clientul admin |
| semafor de scadențe gol | `expirables` cere ȘI `compliance:read` | calculează din tabelele sursă |
| listă de tipuri de document goală | 11 rânduri de platformă au `organization_id IS NULL` | filtrează doar `activ` + `deleted_at` |

Rulează `node .claude/skills/administrativo/scripts/capcana.mjs --rol <rol>`
înainte de a construi un ecran pentru un rol anume.

## 4. Paginare keyset

Nu `.range()`. Cursor base64url + `limit(n + 1)` + tăiere, returnând
`{ randuri, urmatorulCursor }`. Referință: `src/lib/queries/employees.ts`
(`codificaCursor`, `decodificaCursor`, `ghilimeleaza`).

Separatorul se scrie ca **secvență de evadare**, niciodată ca octet NUL brut —
altfel fișierul devine binar pentru `grep` și `git grep`. Pentru cursoare de
text, `ghilimeleaza()` e obligatoriu: o virgulă dintr-un nume rupe filtrul
PostgREST `or=(…)`.

## 5. Formularul client

Tiparul dominant — 101 fișiere. **react-hook-form apare în doar 4 din 118**; nu
e implicitul, copiază-l doar dacă editezi unul dintre acelea.

```tsx
"use client";
const [inCurs, porneste] = useTransition();
const [eroare, setEroare] = useState<string | null>(null);
const idCamp = useId();                       // un useId per câmp, legat cu htmlFor

function trimite(formular: FormData): void {
  setEroare(null);
  porneste(async () => {
    const rezultat = await actiune({ camp: String(formular.get("camp") ?? "") });
    if (!rezultat.ok) { setEroare(rezultat.error.message); return; }
    router.push(`/…/${rezultat.data.id}`);
  });
}
```

Eroarea se afișează ca `<p role="alert" className="text-danger …">`. Nu există
librărie de toast în proiect.

**Mapează `rezultat.error.fieldErrors` pe câmpuri.** Azi e citit în 4 componente
din 118; restul aruncă erorile de câmp într-un singur string.

Butoanele: `disabled={inCurs}` și etichetă de progres („Se publică…”).

## 6. Granița server/client

Un fișier `"use server"` **nu poate exporta o constantă** — Next refuză build-ul,
`tsc` nu semnalează. Tipurile și constantele partajate cu componenta client merg
într-un fișier alăturat (`actions-types.ts`, `constante.ts`).

Nu defini o componentă în corpul altei componente: identitate nouă la fiecare
randare, React demontează subarborele, utilizatorul pierde focusul în timp ce
scrie. S-a întâmplat deja în acest proiect.

## 7. Navigație

Intrare nouă în `src/config/navigation.ts`, cu `featureKey` + `permission` +
`minScope` + `order` (zeci, cu valori intermediare pentru inserții).
`navigation.test.ts` verifică la nivel de fișier că fiecare rută are un
`page.tsx` real.

## 8. Finalizare

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Build-ul e obligatoriu aici — e singurul care prinde granița server/client.
