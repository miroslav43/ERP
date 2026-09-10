---
tip: modul
titlu: Panou
aliases: [panou, dashboard, acasa]
cai:
  - "src/app/(app)/panou/**"
  - "src/lib/queries/panou.ts"
  - "src/lib/navigation/build-navigation.ts"
tabele: []
permisiuni: [attendance:approve, leave:approve, per_diem:approve, employees:read, reges:transmit]
capcane: [26]
scris_pe: 5621e9e8308157d5103f0b52dd696cb318da688c
scris_la: 2026-09-10
tags: [modul]
---

# Panou

Ecranul de pornire: contoare, o coadă de „ce am de făcut" și scurtături. Nu are date
proprii — e o compunere peste toate celelalte module, ceea ce îl face locul unde greșelile
de poartă din restul aplicației devin vizibile primele.

## Fiecare contor are poarta lui

`contoarePanouPentru` din `src/lib/queries/panou.ts` primește `features` (modulele active)
și harta întreagă de permisiuni, apoi decide **contor cu contor** dacă îl cere. Un contor
cerut fără drept n-ar da eroare — ar întoarce zero, iar utilizatorul ar citi „nimic de
făcut" în loc de „n-ai acces". De aceea decizia se ia înaintea interogării, nu după.

Poarta unui contor e cea a **acțiunii** către care duce, nu cea a listei. `vedeReges` cere
`reges:transmit` la `all`, deși intrarea de meniu se deschide pe `reges:read`: cine doar
citește registrul ar fi primit un număr care îl cheamă undeva unde n-are ce apăsa. Aceeași
regulă ține `vedeAnomalii` pe `vehicles:update`, nu pe `vehicles:read`.

„Netransmis" înseamnă `de_pregatit` SAU `pregatit` — un eveniment pregătit pare rezolvat și
tocmai de aceea e cel mai aproape de a fi uitat; `transmis`, `confirmat` și `respins` au
plecat deja, `anulat` a fost retras deliberat. Stările sunt cele din enumerarea
`reges_stare_eveniment` (`0086_reges_redenumire.sql:32`, creată ca `revisal_status` în
`0004_hr.sql:77`). Contorul se citește direct din coloana `status`, nu derivat din listă:
spre deosebire de concedii, aici starea CHIAR stă în coloana entității numărate.

`resolveTenant` (nu `requireTenant`) plus `redirect`: fără organizație aleasă, pagina
trimite la selecție, nu afișează un panou gol.

Meniul se construiește din aceeași hartă, prin `buildNavigation` — un modul deblocat care
nu apare în meniu înseamnă aproape întotdeauna `getPermissionMap` chemat fără `memberId`,
v. [[rol/manager]]. Insignele lui (`leave_pending`, `ssm_expiring`, `fleet_expiring`,
`maintenance_due`, `reges_pending`) vin din `insigneMeniu`, deci din aceiași contori;
`null` și `0` se omit amândouă, așa că o pastilă absentă nu spune dacă blocul e gol sau
ascuns.

## Două praguri, două surse — deliberat

`PRAG_PANOU_ZILE` = 30 e pragul panoului. Scadențele de flotă folosesc **alt** prag,
`PRAG_FLOTA_AVERTIZARE_ZILE`, din modulul lor. Cifra a fost la un moment dat aceeași în
ambele locuri: în ziua în care una s-ar fi schimbat, contorul de pe panou și lista din flotă
ar fi arătat numere diferite, fără nicio eroare. Contractele care expiră rămân pe pragul
panoului — nu sunt documente de vehicul, e altă scadență.

## Ce refuză baza tăcut

- **Scadențele NU se citesc din `public.expirables`.** Politica ei cere în plus
  `compliance:read`, acordat doar lui `super_admin` și `org_admin`; pentru oricine altcineva
  tabela întoarce zero rânduri fără eroare. Panoul le calculează din tabelele sursă —
  `vehicle_documents` pentru flotă, și așa mai departe. — capcana #26
- **„Lipsește" e o stare distinctă de „expiră curând".** Un vehicul fără niciun document nu
  are dată de la care să numere, deci nu se aprinde NICIODATĂ singur, oricât ar trece.
  Cazul e real în producție, nu ipotetic, de aceea `faraDocumente` se numără separat.
- **`regesDeTransmis` intră în cifra din antet, dar n-are rând în coadă.** Contorul e pus în
  `coada`, iar `totalDeRezolvat` însumează coada întreagă; `coadaDinContoare` din
  `src/app/(app)/panou/page.tsx` nu construiește nicio intrare pentru el. Cine are
  `reges:transmit` și evenimente netransmise citește în antet un număr mai mare decât suma
  rândurilor de dedesubt, fără nicio eroare — semnalul ajunge doar ca pastilă
  `reges_pending` în meniu. — `5621e9e`

## Când NU e suficientă pagina asta

- De unde vine fiecare cifră: pagina modulului respectiv — pentru evenimentele netransmise,
  [[modul/reges]].
- De ce un card lipsește: [[rol/manager]], [[rol/hr]].
