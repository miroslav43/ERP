---
tip: modul
titlu: Mentenanță — sesizarea ca flux (raportor, tehnician, gestionar)
aliases: [sesizari-flux, fault_reports, atribuire sesizare, tehnician mentenanta]
cai:
  - "src/app/(app)/mentenanta/sesizari/**"
  - "src/app/(portal)/portal/sesizari/**"
  - "src/domain/maintenance/sesizari.ts"
  - "supabase/migrations/0181_sesizari_flux.sql"
  - "tests/rls/proba-sesizari-roluri.sql"
tabele:
  [
    fault_reports,
    fault_report_comments,
    fault_report_history,
    maintenance_attachments,
    equipment_opriri,
    maintenance_settings,
  ]
permisiuni: [maintenance:read, maintenance:create, maintenance:update]
feature: maintenance
capcane: [6, 17, 50]
citeste_daca:
  - "un tehnician sau un raportor „nu poate” ceva pe sesizarea lui → „Cine poate ce”"
  - "o tranziție întoarce zero rânduri sau P0001 → „Ce refuză baza tăcut”"
scris_pe: daddafbae6900219be31f82717adf1ff0217230c
scris_la: 2026-10-07
tags: [modul, operations]
---

# Mentenanță — sesizarea ca flux

Extrasă din [[modul/mentenanta]], ca pagina principală să rămână sub plafon. Din `0181`,
sesizarea are număr (`SZ-AAAA-NNNN`, prin `document_sequences`), tehnician atribuit,
comentarii, istoric, fotografii, jurnal de opriri și setări per firmă.

## Stările și cine le mută

`nou → in_analiza | in_lucru | respins | retrasa` · `in_analiza → in_lucru | in_asteptare |
respins | retrasa` · `in_lucru → rezolvat | in_asteptare | in_analiza` · `in_asteptare →
in_lucru | respins` · `rezolvat → inchis | in_lucru` (redeschidere, cu motiv). `inchis`,
`respins` și `retrasa` sunt terminale. Sursa, în același cuvinte, e
`src/domain/maintenance/sesizari.ts` (`tranzitiiPermise(status, actor)`) și garda
`internal.fault_reports_garda` — testul de domeniu și proba SQL le țin aliniate.

**Trei actori**, deciși de bază, nu de rol: **gestionarul** (`maintenance:update ≥ team`)
face orice; **tehnicianul atribuit** (`atribuit_employee_id = app.fisa_mea`) își începe,
suspendă și rezolvă sesizarea LUI și scrie `nota_rezolvare`; **raportorul** își editează
descrierea și urgența cât e `nou`, o retrage din `nou`/`in_analiza`, iar din `rezolvat`
confirmă (`inchis`) sau redeschide. „Rezolvat” neconfirmat se închide singur după
`inchidere_automata_zile` (`internal.sesizari_inchide_rezolvate`; programarea vine cu
alertele zilnice).

## Rute

| Rută                                                     | Poartă                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `/mentenanta/sesizari` (+ filtre `atribuit`, `deschise`) | `maintenance:read` own                                                       |
| `/mentenanta/sesizari/[id]`                              | `maintenance:read` own; acțiunile după actor                                 |
| `/portal/sesizari`, `/portal/sesizari/[id]`              | `maintenance:read` own; fișa doar raportorului sau tehnicianului, altfel 404 |
| `/mentenanta/setari`                                     | `maintenance:update` all                                                     |

Fișa e aceeași componentă în aplicație și în portal (`sesizari/[id]/fisa-sesizare.tsx`,
datele din `date-sesizare.ts`); diferă actorul și câteva linkuri. Fotografiile urcă în trei
pași (semnare pe clientul utilizatorului → `PUT` din browser → rând cu mărimea citită din
Storage), în bucketul privat `org-mentenanta`, pe calea `{org}/{entity_type}/{entity_id}/…`.

## Server Actions

`src/app/(app)/mentenanta/sesizari/actions.ts` (numele exact `actions.ts` e cel admis de
ESLint; aici nu e nevoie de clientul admin).

| Funcție                                                                                                      | Permisiune / minScope       |
| ------------------------------------------------------------------------------------------------------------ | --------------------------- |
| `atribuieSesizare` (+ „Preiau eu”), `inregistreazaOprire`                                                    | `maintenance:update` / team |
| `salveazaSetariMentenanta`                                                                                   | `maintenance:update` / all  |
| `tehnicianSchimbaStarea`, `retrageSesizare`, `inchideSesizare`, `redeschideSesizare`, `actualizeazaSesizare` | `maintenance:read` / own    |
| `comenteazaSesizare`, `pregatesteFisier`, `confirmaFisier`, `stergeFisier`, `inchideOprire`                  | `maintenance:read` / own    |

Poarta `read`/own pe gesturile nominale e **intenționată**: „e în modul”, iar DECIZIA o ia
baza — politica de UPDATE deschide ușa raportorului și tehnicianului, garda le dă fiecăruia
exact câmpurile lui. Un străin trece de poartă și primește zero rânduri (CONFLICT) sau
P0001 tradus. Așa regula trăiește într-un singur loc, probat de
`tests/rls/proba-sesizari-roluri.sql`. `trieazaSesizare` și `rezolvaSesizare` rămân în
`mentenanta/actions.ts`; a doua a coborât și ea la `read`/own — o face și tehnicianul.

## Ce refuză baza tăcut

- **Garda fixează coloanele scrise de triggere pentru actorii nominali.** `rezolvat_la`,
  `inchis_la`, `atribuit_la`, `redeschisa_de_ori`, `motiv_respingere_tip`, `numar`,
  `raportat_la` trimise de raportor sau tehnician se întorc la valoarea veche înainte de
  verificare; le recalculează tranziția. Un câmp străin schimbat → P0001 cu numele lui.
- **Ștergerea logică a sesizării cere `update ≥ team`**, deși politica de UPDATE lasă și
  actorii nominali pe rând: raportorul RETRAGE, nu șterge.
- **`in_lucru` cere tehnician; `rezolvat` cere `intervention_id`**, iar intervenția trebuie
  să fie a aceleiași firme, pe același echipament și legată de sesizare (sau nelegată —
  rândurile de dinainte de 0181). Politica de INSERT pe intervenții îl lasă pe tehnician
  doar pe echipamentul sesizării lui și fără `plan_id`.
- **Comentariul nu se mută și nu devine intern după scriere**: garda refuză orice schimbare
  în afara textului, iar WITH CHECK cere vizibilitatea părintelui. Nota internă e refuzată
  raportorului la INSERT (42501) și ascunsă la SELECT.
- **O sesizare cu `opreste_functionarea` deschide o oprire în jurnal** la raportare și o
  închide la rezolvare (`rezolvat_la`, corectabil cu `repus_in_functiune_la`) sau respingere.
  Starea echipamentului NU se schimbă automat.
- **`equipment_select` are ramura „există o sesizare vizibilă pe el”**: raportorul și
  tehnicianul citesc denumirea utilajului de pe sesizarea lor, nu parcul.
- **`maintenance_settings` are index unic PARȚIAL pe organizație**, deci fără `upsert`:
  acțiunea citește rândul viu și alege INSERT sau UPDATE (capcana #7).

## Când NU e suficientă pagina asta

- Textul exact al fiecărei verificări pe roluri: `tests/rls/proba-sesizari-roluri.sql`.
- Contractul acțiunilor (payload, filtre, căi revalidate):
  `sesizari/actions.test.ts`, `actions-triaj.test.ts`.
- Traducerea linkurilor din notificări spre portal: [[modul/notificari]].
