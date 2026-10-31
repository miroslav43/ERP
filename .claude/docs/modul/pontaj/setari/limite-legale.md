---
tip: modul
titlu: Pontaj — setările firmei — limitele legale
aliases: [pontaj-limite-legale, avertismente-pontaj]
cai:
  - "src/domain/attendance/limite-legale.ts"
tabele: [attendance_settings, holiday_compensation, overtime_compensation]
permisiuni: [attendance:read]
feature: attendance
capcane: []
scris_pe: a67bb3cc1be0a37072b4d1bb96fb262cf8338586
scris_la: 2026-10-31
tags: [modul, hr]
---

# Pontaj — setările firmei — limitele legale

Secțiune extrasă din [[modul/pontaj/setari]]: corpul paginii-mamă se apropia de plafonul
dur, iar avertismentele sunt CITIRI derivate din setări, nu o scriere a ecranului de setări.

## Limitele legale: se AVERTIZEAZĂ, nu se refuză

`src/domain/attendance/limite-legale.ts` (pur, cu teste) + `pontaj/avertismente.ts`
(citirile) + `pontaj/lista-avertismente.tsx` (ecranul). Cele două acțiuni de scriere —
`salveazaZiPontaj` și `trimiteSaptamanaPontaj` — întorc `{ id, avertismente }`, calculate
DUPĂ scriere. Forma veche a rezultatului a rămas întreagă; `avertismente` s-a adăugat
lângă ea.

Codurile: `repaus_zilnic` · `repaus_saptamanal` · `saptamana_peste_maxim` ·
`saptamana_peste_norma` · `medie_perioada_referinta` · `suplimentare_nepermise` ·
`noapte_nepermisa` · `zi_de_repaus_lucrata` · `sarbatoare_lucrata` ·
`compensare_sarbatoare`. Severitatea `informativ` e pentru ce e legal și doar merită spus
(norma depășită = ore suplimentare); `avertisment` e pentru o limită a firmei depășită.

Trei reguli care nu se pot deduce din cod citindu-l pe sărite:

- **Firma fără rând în `attendance_settings` nu primește NICIUN avertisment.**
  `limiteleFirmei(null)` întoarce `null`, iar toate cele trei intrări publice ies cu
  listă goală. Un plafon implicit ar fi pus o cifră juridică neconfirmată pe ecran.
- **Aceleași coduri și aceeași aritmetică sunt deja în SQL**, în `app.verifica_pontaj`
  (`0013_attendance.sql:582`), care NU e apelabilă: trăiește în schema `app`, iar
  PostgREST expune doar `public`. Cine schimbă formula într-un loc o schimbă în amândouă.
- **`termen_compensare_suplimentare_zile` rămâne neacoperit**, deliberat:
  `overtime_compensation` n-are niciun scriitor în tot produsul — nici trigger, nici cod —
  deci n-ar avea ce număra. Perechea lui, `termen_compensare_sarbatoare_zile`, se
  verifică: triggerul `internal.pontaj_genereaza_compensare_sarbatoare` (`0013:387`) chiar
  scrie rândul în `holiday_compensation`, de unde salarizarea plătește.

Ce se vede unde: formularul zilei din portal RĂMÂNE pe ecran când există avertismente (o
navigare imediată le-ar fi făcut să clipească); formularul săptămânii le arată sub cifre;
foaia colectivă le calculează în CLIENT, din luna deja încărcată, fără nicio citire nouă —
de aceea acolo lipsesc media pe perioada de referință și repausul de la granița lunii, iar
panoul o spune.
