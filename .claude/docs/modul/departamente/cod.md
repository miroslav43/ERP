---
tip: modul
titlu: Departamente — codul departamentului
cai:
  - "src/app/(app)/departamente/**"
  - "src/schemas/department.ts"
  - "supabase/migrations/0004_hr.sql"
  - "supabase/migrations/0139_cod_departament_optional.sql"
tabele: [departments]
permisiuni: [departments:create, departments:update]
capcane: []
scris_pe: cd77c37564a0a2474dda087e9d2ec85035b57e46
scris_la: 2026-10-25
tags: [modul, hr]
---

# Departamente — codul departamentului

Secțiune extrasă din [[modul/departamente]]: de ce `departments.cod` e opțional, de ce se
poate edita și de ce `lower(cod) = 'conducere'` e cheia conducerii firmei.

## Codul — opțional, editabil, și cheia conducerii

`departments.cod` nu mai e obligatoriu: `0139_cod_departament_optional.sql` scoate
`not null`-ul pus de `0004_hr.sql`. Obligatorie la creare rămâne doar denumirea, iar ea e și
primul câmp al formularului — unul care începe cu un câmp facultativ îl face să pară cerut.

Câmpul gol devine `null`, **nu șir vid** — `codOptional` din `src/schemas/department.ts`.
Diferența e în bază: indexul unic `departments_org_cod_uniq` e pe `lower(cod)` și nu e
declarat `nulls not distinct`, deci oricâte departamente fără cod coexistă, iar unicitatea
mușcă în continuare pentru cine completează codul. Două șiruri vide s-ar ciocni la al doilea.

CHECK-ul `departments_cod_len` nu trebuie rescris: evaluat pe NULL dă NULL, iar Postgres
cere „not false", nu „true" — deci lasă NULL să treacă și continuă să interzică șirul vid și
codurile peste 32 de caractere.

Codul **se poate edita** (`actualizeazaDepartamentSchema` nu-l mai omite): cine a creat
departamente fără cod și își face nomenclatura peste un an trebuie să le poată completa fără
să refacă departamentul, pierzând istoricul. De aceea `"cod"` e și în
`CAMPURI_AUDITATE_ACTUALIZARE`.

`lower(cod) = 'conducere'` e cheia după care triggerele din
`0107_departamentul_conducere.sql` recunosc conducerea firmei. Un cod NULL nu se potrivește
niciodată (comparația dă NULL, deci fals în `where`), deci un departament fără cod nu devine
din greșeală conducerea. Cine **schimbă** codul conducerii pierde repartizarea automată:
comportament, nu defect, iar auditul e singurul loc din care se mai află cine și când.
`esteConducerea` din `panou-departament.tsx` face aceeași verificare, cu gardă pe `null`.

Tipul urcă neschimbat prin toate straturile — `string | null` din `RandDepartament` până în
`OptiuneDepartament` — iar interfața **nu pune substitut** pentru codul lipsă (nici „—",
nici denumirea repetată): ar arăta ca un cod adevărat.
