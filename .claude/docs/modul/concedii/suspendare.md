---
tip: modul
titlu: Concedii — suspendarea contractului și REGES
aliases: [concedii-suspendare, suspendare-contract]
cai:
  - "src/app/(app)/concedii/suspendare-contract.ts"
  - "src/lib/reges/genereaza-evenimente.ts"
tabele: [leave_types, employment_contracts, contract_suspendari, reges_evenimente]
permisiuni: [leave:approve, employees:update]
feature: leave
capcane: []
scris_pe: f437506578f23173e26c942102cdd3ddd2d109c8
scris_la: 2026-10-28
tags: [modul, hr]
---

# Concedii — suspendarea contractului și REGES

Secțiune extrasă din [[modul/concedii]]: ce lasă în urmă aprobarea unui concediu care
suspendă contractul de muncă. Acțiunea care o cheamă e descrisă în
[[modul/concedii/actiuni]].

## Ce refuză baza tăcut

- **Declararea suspendării nu aruncă niciodată.** Un concediu cu
  `leave_types.suspenda_contract` produce, la aprobare, un rând în `contract_suspendari` și
  două evenimente REGES: `suspendare` pe `data_inceput` și `reluare_activitate` în ziua de
  DUPĂ `data_sfarsit`. Orice eșec — fișă fără contract activ, suprapunere respinsă cu
  `23P01`, termen REGES negăsit — iese ca `motiv`, nu ca eroare: aprobarea rămâne dată, iar
  declarația rămâne de făcut de mână. Termenul e ziua anterioară începerii și
  netransmiterea în termen e contravenție **per salariat**, deci `motiv` se AFIȘEAZĂ, ca
  `zileInlocuite`. `revalidate` nu conține nicio cale de REGES.
  — `src/app/(app)/concedii/suspendare-contract.ts`

## Ce NU e aici

Termenele și evenimentele REGES nu se calculează aici: `genereazaEvenimenteReges`
(`src/lib/reges/genereaza-evenimente.ts`) le scrie în `reges_evenimente`, pe termenele din
`reges_termene`, iar transmiterea e a lui `[[modul/reges]]`. Concediile doar cer generarea,
prin `declaraSuspendareaContractului`.
