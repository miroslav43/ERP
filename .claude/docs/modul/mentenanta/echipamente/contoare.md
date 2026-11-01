---
tip: modul
titlu: Mentenanță — ciclul de viață al echipamentului — contoarele
aliases: [contoare, citiri-contor, resetare-contor, citire-rapida, responsabil echipament]
cai:
  - "src/app/(app)/mentenanta/contoare/**"
  - "src/app/(portal)/portal/sesizari/dialog-citire-rapida.tsx"
  - "src/app/(portal)/portal/sesizari/echipamentele-mele.tsx"
  - "supabase/migrations/0182_echipamente_ciclu.sql"
  - "tests/rls/proba-echipamente-ciclu.sql"
tabele: [equipment_meters, equipment, maintenance_plans, maintenance_settings]
permisiuni: [maintenance:read, maintenance:update]
feature: maintenance
capcane: []
scris_pe: c78f84c1a25c63c9490dcfe8104b51bf51aff507
scris_la: 2026-11-01
tags: [modul, operations]
---

# Mentenanță — ciclul de viață al echipamentului — contoarele

Secțiune extrasă din [[modul/mentenanta/echipamente]]: corpul paginii-mamă se apropia de
plafonul dur, iar contorul se citește singur — are ecranul lui, scrierea lui și omul lui.

## Ecranul contoarelor

`/mentenanta/contoare` listează doar ce are cel puțin o citire, restanțele primele, după
`prag_contor_necitit_zile` din `maintenance_settings`; utilajele fără nicio citire stau
separat, cu linkul spre fișă — prima citire fixează punctul de pornire al planurilor pe
contor. Codul fiecărui rând duce la secțiunea `contoare` a fișei (ancora `#contoare`), în
lista read-only și în formularul de lot la fel.

## Scrierea citirilor

`inregistreazaContor` (în `mentenanta/actions.ts`) a coborât la `read`/own: o face și
responsabilul utilajului, din portal (`dialog-citire-rapida.tsx`, cu `resetare_contor`
fixat pe `false`); cine poate pe ce utilaj decide politica de INSERT.

`inregistreazaCitiri` **nu e o tranzacție** (PostgREST nu oferă una peste mai multe
cereri): fiecare rând e un INSERT judecat separat de politică și de gardă, iar acțiunea
întoarce un `RezultatCitireLot` pe rând, cu mesajul gărzii. O valoare greșită nu le
pierde pe celelalte, iar formularul repune în câmp doar refuzatele. Poarta ecranului e
mai strânsă decât a acțiunii (`update` team ca să vezi formularul, `read`/own în
acțiune): la lot decide politica de INSERT, nu harta de permisiuni.

## Ce refuză baza tăcut

- **Resetarea contorului păstrează restul până la țintă**: `equipment_meters_resetare`
  mută `ultima_citire_contor` a planurilor pe acel tip cu diferența, iar `ssm_plan_calc`
  recalculează ținta. Verificat: 1000 → 1500, contor nou de la 20 → țintă 520. Anularea
  sau corectarea unei resetări **desface** mutarea (delta inversă), deci ținta revine la
  1500 — altfel planurile rămâneau pe o referință inventată de o citire ștearsă.
- **Responsabilul** (fișa lui pe `responsabil_employee_id`) vede rândul utilajului VIU și
  citirile lui și poate insera o citire OBIȘNUITĂ — nu o resetare, care mută țintele
  planurilor. Politica de INSERT pe contoare cere `update ≥ team` (din 0150) sau
  responsabilul; pentru toți, utilajul trebuie să fie al firmei și necasat. Un angajat
  oarecare primește 42501 direct prin PostgREST.

## Când NU e suficientă pagina asta

- Textul fiecărei verificări: `tests/rls/proba-echipamente-ciclu.sql`.
- Stările, casarea, ștergerea și restul contractului: [[modul/mentenanta/echipamente]].
