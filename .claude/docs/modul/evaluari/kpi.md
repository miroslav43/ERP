---
tip: modul
titlu: Evaluări — KPI-ul lunar
aliases: [evaluari-kpi, kpi-lunar, kpi-seturi]
cai:
  - "src/app/(app)/evaluari/kpi/**"
  - "src/app/(app)/evaluari/ale-mele/**"
  - "src/lib/queries/kpi.ts"
  - "src/schemas/kpi.ts"
  - "supabase/migrations/0119_kpi_lunar.sql"
  - "supabase/migrations/0190_kpi_luna_proprie_manager.sql"
tabele: [kpi_seturi, kpi_indicatori, kpi_tinte_angajat, kpi_evaluari_lunare, kpi_valori]
permisiuni: [evaluations:read, evaluations:create, evaluations:update]
feature: kpi
capcane: [17]
scris_pe: f437506578f23173e26c942102cdd3ddd2d109c8
scris_la: 2026-10-28
tags: [modul, hr]
---

# Evaluări — KPI-ul lunar

Secțiuni extrase din [[modul/evaluari]]: predicatul de scriere al fluxului lunar, citirile
lui, setul pe funcție și ce refuză baza pe luna închisă. Rutele și poarta fiecărui ecran
rămân în trunchi; scrierile ambelor fluxuri sunt în [[modul/evaluari/actiuni]].

## Managerul DIRECT, nu subarborele

`app.is_manager_of` verifică `manager_path @> [angajatul curent]`, adică **tot
subarborele** — șeful șefului trece la fel de bine ca șeful direct. Pentru evaluarea anuală
e în regulă. La KPI, cerința e „ținte stabilite de managerul direct", deci **scrierea** cere
`app.este_manager_direct`, care se uită la `manager_employee_id`.

`minScope: "team"` din acțiuni e doar poarta aplicației; predicatul îngust e în politică.
Consecința practică: un director care vede KPI-ul întregii divizii **nu-l poate scrie** —
iar refuzul vine din bază, nu din buton. **Citirea** rămâne pe subarbore, deliberat: tăiată
la managerul direct, ar fi ascuns KPI-ul echipei de cine răspunde de ea.

Propria lună era însă invizibilă chiar celui evaluat: `app.can_access_kpi` pe scope `team`
citea doar subarborele, iar `is_manager_of` nu conține propria fișă — portalul fiind doar
al rolului `employee`, un manager evaluat lunar de șeful lui nu-și vedea luna nicăieri.
`0190` deschide CITIREA propriei luni și pe scope `team`; scrierea rămâne neschimbată, deci
nimeni nu-și deschide, nu-și notează și nu-și închide propria lună. Ecranul ei e secțiunea
„KPI-ul meu" din `/evaluari/ale-mele`, cu aceeași citire ca portalul (`kpiAngajat`): fără
set sau fără lună deschisă nu se randează deloc.

## Citiri

- **Sortarea lunilor după scor.** `scor_procent` e NULL pe orice lună abia deschisă
  (scorul se scrie la salvarea valorilor), iar `gt`/`lt` nu potrivesc niciodată NULL: de
  aceea `listeazaLuniKpi` trece pe `predicatKeysetNulabil` și `VALOARE_NULA` din
  `src/lib/queries/cursor.ts` când cheia de sortare e scorul. Cu keyset-ul simplu,
  „mai departe" pierdea exact lunile fără scor.
- **Țintele proprii ale unui angajat.** `tinteleAngajatului` întoarce
  `indicator_id → { id, tinta }`. `setPentruAngajat` dă doar valoarea abaterii, iar
  `stergeTintaKpi` cere id-ul rândului: fără citirea asta, o țintă proprie se putea pune,
  dar nu scoate.
- **Lista lunilor** acceptă `?angajat=` (toate lunile unui om, indiferent de an și lună) și
  `?status=`; parametrul se validează ca UUID în pagină, altfel se ignoră.

## Ce refuză baza tăcut

- **Luna finalizată nu se redeschide, din nicio cale de cod.** Politica de UPDATE a lui
  `kpi_evaluari_lunare` cere `status = 'draft'` în `USING`; un rând finalizat nu mai trece
  de clauză, deci UPDATE-ul afectează **zero rânduri, fără eroare**. Fiecare tranziție face
  `.select()` după `.update()` și tratează golul drept conflict. — capcana #17

## Setul pe funcție, seria pe lună

Un set KPI activ per **funcție**, ținută ca text, nu ca cheie către `job_positions`
(desființate de 0110). Consecința asumată: doi manageri cu subordonați pe aceeași funcție
împart setul, iar divergențele se rezolvă din `kpi_tinte_angajat`, nu prin seturi paralele.

Seria lunară e valoarea modulului, de aceea KPI-ul are tabele proprii în loc de `jsonb`:
„media pe indicator pe ultimele trei luni" și graficul din portal ar fi devenit altfel
agregări peste `jsonb_array_elements`, care încetinesc tăcut la 200 de angajați × 12 luni.

`kpi_sens` există din motiv de corectitudine: „vizite: țintă 40, realizat 37" e 92%, dar
„rebut: maxim 2%, realizat 1,4%" e 130%, nu 70%. Fără discriminantul de sens, jumătate din
indicatorii reali se calculează exact invers, și nimic nu semnalează asta.
