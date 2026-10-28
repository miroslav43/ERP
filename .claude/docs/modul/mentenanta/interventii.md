---
tip: modul
titlu: Mentenanță — intervenții
aliases: [intervenții, proces-verbal de intervenție, PV intervenție, piese, garanția lucrării]
cai:
  - "src/app/(app)/mentenanta/interventii/**"
  - "src/app/(app)/mentenanta/fisiere.ts"
  - "src/app/(app)/mentenanta/echipamente/[id]/formular-interventie.tsx"
  - "src/app/(app)/mentenanta/planuri/dialog-executa-plan.tsx"
  - "supabase/migrations/0210_mentenanta_interventii_complete.sql"
  - "tests/rls/proba-interventii.sql"
  - "tests/rls/proba-oracol-intre-firme.sql"
tabele:
  [
    maintenance_interventions,
    maintenance_intervention_parts,
    maintenance_attachments,
    equipment_opriri,
    registru_documente,
  ]
permisiuni: [maintenance:read, maintenance:update]
feature: maintenance
capcane: [17, 39]
citeste_daca:
  - "intervenția nu se anulează sau „Rezolvată” pare legată de una anulată → „Ce refuză baza tăcut”"
  - "o verificare legală nu se salvează sau PV-ul nu urcă → „Procesul-verbal înaintea intervenției”"
  - "costul pieselor nu e cel tastat → „Piesele”"
scris_pe: f437506578f23173e26c942102cdd3ddd2d109c8
scris_la: 2026-10-28
tags: [modul, operations]
---

# Mentenanță — intervenții

Extrasă din [[modul/mentenanta]]. Din `0210` (faza M6) o intervenție are număr propriu
`PV-AAAA-NNNN` (prin `document_sequences`, tipul `pv_interventie`, dat de trigger la
INSERT; rândurile vechi l-au primit retroactiv, în ordinea datei), numărul documentului
furnizorului, garanția lucrării (`garantie_lucrare_pana`), bifa „acoperit de garanție” și
linii de piese. Registrul de documente o înregistra deja ca `pv_interventie` la INSERT
(harta din `0142`); numărul `PV-…` nu intră în coloana „număr de la emitent” a
registrului — documentul e intern, poartă numărul registrului.

## Rute

| Rută                                         | Poartă                                                           |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `/mentenanta/interventii`                    | `maintenance:read` team                                          |
| `/mentenanta/interventii?interventie=noua`   | caseta „Intervenție nouă”, `maintenance:update` team             |
| `/mentenanta/interventii/[id]`               | `maintenance:read` team; Corectează/Anulează/piese `update` team |
| `/mentenanta/interventii/[id]/proces-verbal` | `maintenance:read` team — pagină de tipărit                      |

Lista: rândurile duc la fișă (titlul e numărul PV); filtre `tip`, `rezultat`, `executant`
(fișă de angajat), `de_la`/`pana_la` pe `data`; `echipament` și `plan` rămân chei EXTERNE
ale barei (pastilă, fără câmp). Sub tabel stă totalul pe TOATĂ mulțimea filtrată
(`totalInterventii`: pagini keyset pe `id`, plafon `PLAFON_TOTAL_INTERVENTII`, peste el
`trunchiat`), cu partea acoperită de garanție separat. Filtrele se scriu o singură dată
(`filtreazaInterventii`) pentru pagină, numărare și total.

Fișa intervenției leagă echipamentul, planul și sesizarea, are piesele, documentele
(PV semnat, buletin, factură — `maintenance_attachments` cu `entity_type = intervention`)
și istoricul din audit. „Rezolvată prin” de pe sesizare și tabelele de intervenții de pe
fișa echipamentului și a planului duc aici.

## Server Actions

| Funcție                                          | Unde                     | Poartă                      |
| ------------------------------------------------ | ------------------------ | --------------------------- |
| `inregistreazaInterventie`                       | `mentenanta/actions.ts`  | `maintenance:update` / team |
| `actualizeazaInterventie`, `anuleazaInterventie` | `interventii/actions.ts` | `maintenance:update` / team |
| `adaugaPiesa`, `stergePiesa`                     | `interventii/actions.ts` | `maintenance:update` / team |

Zod cere **exact un executant** — angajat SAU firmă externă (cazul 33) — și garanția
lucrării ≥ data. `rezolvaSesizare` refuză doar „amândoi”: lăsat gol, executantul devine
fișa celui care rezolvă; fără fișă și fără firmă externă, refuz explicit. Tot acolo, o
`verificare_legala` e refuzată: se înregistrează din planul ei, cu PV.

## Procesul-verbal înaintea intervenției

O verificare legală (tipul intervenției SAU tipul planului; nu și la rezultat
`amanata`) se înregistrează doar cu PV sau buletin (cazul 34). Regula e în acțiune, nu
în trigger: atașamentul se scrie după intervenție. Drumul, în cele trei casete de creare
(fișa echipamentului, „Execută” de pe plan, lista):

1. browserul generează id-ul intervenției și urcă fișierul pe
   `{org}/intervention/{id}/…` (`useDocumentInterventie`, `document-interventie.ts`);
2. `app.mentenanta_poate_fisier` (rescrisă în `0210`) tratează un id de intervenție
   care nu există în NICIO firmă drept rezervare — doar pentru un MEMBRU cu
   `maintenance:update` în organizația din cale (consola de platformă nu, din `0212`); un id existent în altă firmă cade pe
   ramura veche și e refuzat;
3. acțiunea măsoară obiectul real (`masoaraObiectul`), scrie intervenția cu acel id,
   apoi rândul atașamentului. Atașamentul refuzat ⇒ intervenția se anulează logic.

Obiectul unei încercări eșuate se șterge cu clientul admin numai dacă niciun rând din
`maintenance_attachments` nu-l folosește. O retrimitere după refuz refolosește id-ul și
calea dacă fișierul e același (nume, mărime, dată); 23505 pe id = trimitere dublă.
O casetă închisă fără trimitere (sau un fișier schimbat, cu id nou) lasă o rezervare
abandonată: `pregatesteFisier` pe `intervention` mătură, la fiecare rezervare nouă din
firmă, folderele `{org}/intervention/{id}` al căror id nu există în organizație —
doar obiectele de peste 24 h fără rând (`curataRezervarileAbandonate`).

**Nici corectura nu ocolește PV-ul**: `actualizeazaInterventie` cere PV/buletin deja
atașat când intervenția DEVINE verificare legală făcută (tip schimbat pe
`verificare_legala`, sau `amanata` → alt rezultat pe un plan legal). Rândurile vechi,
deja făcute fără PV, rămân corectabile (cazul 46). Ștergerea ultimului PV al unei
verificări legale NU e păzită încă (faza M7).

## Piesele

Cât există măcar o linie vie, `cost_piese` = suma valorilor (garda BEFORE UPDATE a
intervenției și triggerul AFTER al liniilor), deci o sumă tastată se înlocuiește (cazul
32); ecranul o arată „calculat din piese” și câmpul devine doar de citit. Ultima linie
ștearsă lasă `cost_piese = 0`, nu suma veche. `valoare` e GENERATĂ — nu se trimite.

## Ce refuză baza tăcut

- **Garda de firmă vine prima** (Y2): `internal.maintenance_interventions_numar` și
  `internal.maintenance_intervention_parts_garda` rulează înaintea WITH CHECK. Fără gardă,
  un rând pus pe altă firmă atingea registrul ei de PV-uri (o firmă inexistentă cădea pe
  cheia străină a registrului), iar piesa spunea dacă intervenția există acolo. Acum 42501
  neutru, înaintea oricărei căutări. Proba: `tests/rls/proba-oracol-intre-firme.sql`.
- **Un id existent nu consumă numărul PV.** Triggerul de număr rulează înaintea
  conflictului din `INSERT … ON CONFLICT`; un rând sărit lăsa o gaură în registru, fără
  audit. Acum id-ul existent (orice firmă, și anulat) dă 23505 pe cheia primară, ca un
  INSERT obișnuit, sub un zăvor pe id; `inregistreazaInterventie` îl citește ca
  trimitere dublă. Proba: `proba-interventii.sql` (11).
- **Anul numărului nu e mereu al datei** (`internal.an_pv_interventie`, `0210`): în afara
  intervalului 2000–2200 se ia tăcut anul de azi — altfel `document_sequences_year_check`
  ar opri inserarea.
- **Anularea intervenției care a rezolvat o sesizare** `rezolvat` → P0001 cu numărul
  sesizării („Redeschideți întâi…”); pe una `inchis` → definitiv (cazul 31). După
  redeschidere, `intervention_id` e golit de gardă și anularea trece.
- **O intervenție anulată nu se reactivează**; echipamentul, sesizarea și numărul nu se
  schimbă prin editare (garda, în afara contextului de serviciu).
- **Editarea nu mai șterge amânarea planului.** `ssm_intervention_apply` (rescris de la
  `0183`) aplică planul doar când intervenția DEVINE aplicată; o dată sau o citire
  corectată recalculează planul din intervențiile lui; restul editărilor nu-l ating.
- **Oprirea intervenției planificate urmează editarea** (`maintenance_interventions_oprire`
  de la `0181`): minute, dată, oră sau tip schimbate mută rândul din jurnal; 0 îl anulează.
- Liniile de piese le vede cine vede intervenția (subinterogare sub politica ei); le
  scrie doar `maintenance:update`. `super_admin` le citește, dar nu scrie — ca pe
  intervenții. Proba: `tests/rls/proba-interventii.sql` și `(l)` din `izolare.sql`.
- Toate tranzițiile fac `.select()` după UPDATE: zero rânduri = NEGASIT (capcana #17).

## Garanția

Sesizarea nouă pe un utilaj cu o lucrare în garanție sau cu garanția echipamentului în
curs arată un `Callout` (cazul 23): `cautaEchipament` aduce, cu clientul admin filtrat pe
organizație, doar numărul PV-ului, data și termenul — fără costuri.

## Ce NU e aici

Cronometre, stoc de piese pe depozite, aprobarea devizului — „la cerere” în plan. Planul
și scadența: [[modul/mentenanta/planuri]]. Sesizarea care o rezolvă:
[[modul/mentenanta/sesizari]].
