---
tip: modul
titlu: Panou
aliases: [panou, dashboard, acasa]
cai:
  - "src/app/(app)/panou/**"
  - "src/lib/queries/panou.ts"
  - "src/lib/navigation/build-navigation.ts"
tabele: []
permisiuni: [attendance:approve, leave:approve, per_diem:approve, employees:read]
capcane: [26]
scris_pe: 0815fbff2c885cd44b5768ee25f084f16a9e95b8
scris_la: 2026-09-03
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

`resolveTenant` (nu `requireTenant`) plus `redirect`: fără organizație aleasă, pagina
trimite la selecție, nu afișează un panou gol.

Meniul se construiește din aceeași hartă, prin `buildNavigation` — un modul deblocat care
nu apare în meniu înseamnă aproape întotdeauna `getPermissionMap` chemat fără `memberId`,
v. [[rol/manager]].

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

## Când NU e suficientă pagina asta

- De unde vine fiecare cifră: pagina modulului respectiv.
- De ce un card lipsește: [[rol/manager]], [[rol/hr]].
