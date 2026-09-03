---
tip: modul
titlu: Puncte de lucru
aliases: [puncte-lucru, sedii, locatii]
cai:
  - "src/app/(app)/puncte-lucru/**"
  - "src/schemas/puncte-lucru.ts"
  - "supabase/migrations/0030_onboarding_companie.sql"
  - "supabase/migrations/0096_pontaj_rapid.sql"
tabele: [puncte_lucru, attendance_entries]
permisiuni: [departments:read, departments:create, departments:update]
capcane: [17]
citeste_daca:
  - "cod de pontaj care nu mai merge după tipărire → secțiunea „rotește”"
scris_pe: 0815fbff2c885cd44b5768ee25f084f16a9e95b8
scris_la: 2026-09-03
tags: [modul]
---

# Puncte de lucru

Sediile și locațiile firmei, plus **codul de pontaj** afișat la fiecare — hârtia pe care
angajatul o scanează ca să-și marcheze prezența.

**Nu are resursă proprie de permisiune.** Totul trece prin `departments:*`: e structura
firmei, doar pe altă axă decât [[modul/departamente]]. Cine poate schimba departamentele
poate schimba și punctele de lucru; nu există rând `puncte_lucru` în `role_permissions`, iar
o cheie inventată ar întoarce `none` — refuz tăcut.

## Rute

| Rută                      | Poartă                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `/puncte-lucru`           | `requireFeature(..., "nucleu")`; scrierea cere `departments:create` / `departments:update` la `all` |
| `/puncte-lucru/[id]/afis` | afișul tipăribil, cu codul                                                                          |

## Server Actions

`src/app/(app)/puncte-lucru/actions.ts` — toate pe `minScope: "all"`.

| Funcție                                                                     | Permisiune           |
| --------------------------------------------------------------------------- | -------------------- |
| `creeazaPunctLucru`                                                         | `departments:create` |
| `actualizeazaPunctLucru`, `dezactiveazaPunctLucru`, `reactiveazaPunctLucru` | `departments:update` |
| `rotesteCodPontaj`                                                          | `departments:update` |

## „Rotește", nu „generează"

`rotesteCodPontaj` scrie un secret nou de 24 de octeți. Numele e ales cu grijă: **codul
vechi se anulează**, deci toate afișele deja lipite la punctul de lucru devin inutile în
clipa apăsării. Cine apasă trebuie să știe asta înainte, nu după.

Două decizii în jurul lui:

- **Codul NU intră în audit.** `allow: []` — jurnalul de audit e citibil de oricine are
  `audit:read`, iar codul e un secret. Faptul că a fost rotit e tot ce se consemnează.
- **`.select()` după `.update()`.** Politica de UPDATE cere `departments:update = all` în
  `USING`, iar un refuz atinge zero rânduri **fără eroare**. Fără verificare, ecranul ar
  afișa un cod nou care nu s-a scris nicăieri — iar afișul tipărit după el n-ar funcționa
  la nimeni. — capcana #17

## Ce refuză baza tăcut

- **Denumirea e unică pe firmă, case-insensitive**, prin index unic parțial pe
  `lower(denumire)` cu `where deleted_at is null`. Un al doilea „Depozit" scris cu altă
  literă mare e respins cu 23505; un punct de lucru șters logic **nu** blochează refolosirea
  numelui.
- **Indexul e parțial**, deci un `.upsert()` pe el cade cu 42P10 — PostgREST nu emite
  predicatul în `ON CONFLICT`. Se face citire-apoi-INSERT-sau-UPDATE.

## Ce se mișcă împreună

Codul și legătura cu pontajul vin din `0096_pontaj_rapid.sql`, nu din `0030`: acolo s-a
adăugat coloana `cod_pontaj` (token opac, între 16 și 64 de caractere) și
`attendance_entries.punct_lucru_id`, care reține UNDE s-a pontat. Setările operaționale ale
pontării — modul, verificarea, ora de start — sunt la [[modul/pontaj/setari]], nu aici.

## Când NU e suficientă pagina asta

- Ce se întâmplă cu codul după scanare: [[modul/pontaj]].
- Cealaltă axă a structurii: [[modul/departamente]].
