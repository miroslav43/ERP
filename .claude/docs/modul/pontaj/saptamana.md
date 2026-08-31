---
tip: modul
titlu: Pontaj — planul săptămânii
aliases: [pontaj-saptamana, plan-saptamanal]
cai:
  - "src/app/(app)/pontaj/saptamana/**"
  - "src/app/(portal)/portal/pontajul-meu/saptamana/**"
  - "src/domain/attendance/plan-si-fapt.ts"
tabele: [attendance_week_submissions, attendance_week_submission_days]
permisiuni: [attendance:create, attendance:approve]
feature: attendance
capcane: [17]
scris_pe: 2e9e70f178c4a0c33ce2e8ad0a4d0f7f9e3a4d68
scris_la: 2026-08-31
tags: [modul, hr]
---

# Pontaj — planul săptămânii

`attendance_week_submissions` + `_days`: ce PLANIFICĂ omul, spre deosebire de
`attendance_entries`, care e ce a lucrat. Singurul drum de scriere e RPC-ul
`public.trimite_saptamana_pontaj` (0084, șase argumente, `security definer`), care face
`delete` + reinserare completă a zilelor — de aceea orice câmp golit pe ecran se ȘTERGE
din bază la următoarea trimitere, fără nicio eroare.

Două ecrane randează același `FormularSaptamana`: `/pontaj/saptamana` și
`/portal/pontajul-meu/saptamana`. Al doilea a rămas în urmă cel puțin o dată
(implicitele de weekend), deci orice schimbare se face în AMÂNDOUĂ, iar proprietățile
noi se declară OBLIGATORII, ca să oblige compilatorul.

## Planul se leagă de fapt la CITIRE, niciodată printr-o a doua scriere

`src/domain/attendance/plan-si-fapt.ts` (pur, cu teste) — `ziuaInitialaPlan(data,
planificata, pontata)`. Îl folosesc AMÂNDOUĂ ecranele planului: `/pontaj/saptamana` și
`/portal/pontajul-meu/saptamana`.

O scriere ar fi modificat, după fapt, planul unei săptămâni deja trimise sau aprobate —
adică ar fi rescris ce a decis cineva, fără urmă.

Precedența e pe **CÂMP, nu pe rând**, și ăsta e cazul purtător al modulului: o zi deschisă
cu „Am intrat" și neînchisă are `ora_sfarsit` null. Copiată peste plan, ar fi golit
intervalul planificat — iar `trimite_saptamana_pontaj` face `delete` + reinserare (0084),
deci următoarea trimitere l-ar fi șters și din bază, fără nicio eroare. Observația NU se
preia deloc: nota zilei lucrate și nota intenției sunt două texte diferite.

Citirea e `intrariLuna(org, [fisa], …)`, **nu** `intrariProprii` — a doua nu filtrează pe
`employee_id` și se bazează pe RLS, care pentru scope `all` nu îngustează nimic.

