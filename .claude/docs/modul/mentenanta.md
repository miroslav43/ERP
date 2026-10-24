---
tip: modul
titlu: Mentenanță
aliases: [mentenanta, echipamente, sesizari, defecte]
cai:
  - "src/app/(app)/mentenanta/**"
  - "src/app/(scanare)/mentenanta/**"
  - "src/lib/queries/maintenance.ts"
  - "src/schemas/maintenance.ts"
  - "src/domain/maintenance/**"
  - "supabase/migrations/0011_ssm.sql"
  - "supabase/migrations/0180_mentenanta_integritate.sql"
  - "supabase/migrations/0181_sesizari_flux.sql"
  - "supabase/migrations/0182_echipamente_ciclu.sql"
  - "supabase/migrations/0183_planuri_scadente.sql"
  - "supabase/migrations/0191_mentenanta_zilnica.sql"
  - "supabase/migrations/0210_mentenanta_interventii_complete.sql"
  - "supabase/migrations/0211_mentenanta_iscir_conformitate.sql"
  - "supabase/migrations/0212_mentenanta_fisiere_scriu_doar_membrii.sql"
  - "supabase/migrations/0232_mentenanta_costuri_echipament.sql"
  - "tests/rls/izolare.sql"
tabele:
  [
    equipment,
    equipment_costuri,
    equipment_meters,
    maintenance_plans,
    maintenance_interventions,
    maintenance_intervention_parts,
    fault_reports,
    iscir_authorizations,
  ]
permisiuni:
  [maintenance:read, maintenance:create, maintenance:update, maintenance:delete, maintenance:export]
feature: maintenance
capcane: [17, 35, 50, 51, 55, 56, 57, 58]
citeste_daca:
  - "poartă de acțiune care pare prea largă → secțiunea „create nu e poarta”; buton, filă, casetă sau cod QR care duce greșit → [[modul/mentenanta/rute]]"
  - "sesizare care nu se mai mișcă, tehnician sau raportor refuzat → [[modul/mentenanta/sesizari]]"
  - "poartă de acțiune, citire care taie rânduri, mesaj P0001 → [[modul/mentenanta/actiuni]]; casare, contoare, valoarea de achiziție → [[modul/mentenanta/echipamente]]; scadență, amânare → [[modul/mentenanta/planuri]]; ISCIR, VTP → [[modul/mentenanta/iscir]]"
scris_pe: c1ad3b039681d8b4d5f1f466c0c2a4e7f3ab67f8
scris_la: 2026-10-24
tags: [modul]
---

# Mentenanță

Echipamente cu contoare, planuri de mentenanță cu scadențe, intervenții, sesizări de
defecțiune și autorizații ISCIR. Tabelele de bază sunt create de `0011_ssm.sql`, în
aceeași buclă de politici ca SSM-ul, dar sub resursa de permisiune `maintenance` și
feature-ul `maintenance` — **aceeași migrare, alt modul**. Vezi [[modul/ssm]] pentru
cealaltă jumătate. Fluxul complet al sesizării (număr, tehnician, comentarii, fotografii,
opriri, setări — `0181`) are pagina lui: [[modul/mentenanta/sesizari]]. Ciclul de viață al
echipamentului (casare, componente, garanție, contoare în lot, etichete QR, responsabilul
— `0182`) are și el una: [[modul/mentenanta/echipamente]]. Planurile și scadențele (mod de
calcul, amânare, proiecție pe contor, fișa planului — `0183`): [[modul/mentenanta/planuri]].
Jobul de dimineață (alerte, rezumatul per destinatar, închiderea automată, pragurile din
setări — `0191`): [[modul/mentenanta/zilnic]]. Intervenția completă (număr PV, piese,
corectare, anulare, procesul-verbal, garanția lucrării — `0210`):
[[modul/mentenanta/interventii]]. ISCIR și verificările legale (regim RSVTI, suspendare,
reînnoire, categoriile legale, dosarul de control — `0211`): [[modul/mentenanta/iscir]].
Raportul pe perioadă (costuri, disponibilitate, MTTR/MTBF, „la timp”, CSV — M8, fără
migrare): [[modul/mentenanta/rapoarte]]. Rutele cu poarta fiecăreia, banda de file,
casetele de creare, adresa tipărită pe autocolantele QR și panoul:
[[modul/mentenanta/rute]].

## `create` NU e poarta pentru echipamente

Politica de INSERT generată în bucla din `0011` cere
`app.ssm_acces(org, 'maintenance', 'create', null)`. Cu `p_employee` NULL, funcția
răspunde din prima ramură: `can(..., 'all')`. Iar `manager` **și** `employee` au
`maintenance:create = all` în seed — acordat pentru sesizări.

Consecința: baza îi lasă să insereze în `equipment`, `equipment_meters`,
`maintenance_plans` și `maintenance_interventions`. **Poarta reală trebuie pusă în
aplicație**, pe `maintenance:update` cu `minScope: "team"`, și așa e scrisă azi. Doar
sesizarea rămâne pe `maintenance:create` / `own`. — capcana #35

## Server Actions și citiri

Contractul scrierilor (poarta fiecărei acțiuni, ordinea celor două scrieri ale rezolvării),
al citirilor (`src/lib/queries/maintenance.ts` și `maintenance-rapoarte.ts`) și al mesajelor
bazei traduse stă în [[modul/mentenanta/actiuni]]. Regula de reținut de aici: acțiunile
NOMINALE (tehnicianul atribuit, raportorul, responsabilul de utilaj) stau pe `read` / own, iar
decizia o ia baza; tot ce schimbă catalogul stă pe `update` / team. Niciun filtru manual de
scope în citiri: politicile din bucla lui `0011` și cele din `0181` restrâng rândurile în
Postgres.

## Ce refuză baza tăcut

- **Sesizările se ancorează pe `raportat_de_employee_id` (și, din 0181, pe
  `atribuit_employee_id`), restul tabelelor pe nimic.** Un `employee` își vede sesizările
  proprii și pe cele atribuite lui — plus denumirea utilajelor de pe ele —, dar parcul îi e
  invizibil: ecran gol, fără eroare.
- **Scadențele NU se citesc din `public.expirables`.** Politica ei cere în plus
  `compliance:read`; `planuriScadente` și `numarScadenteMentenanta` calculează din tabelele
  sursă. — v. [[modul/ssm]]
- **Ștergerea e logică.** Grant pe `select`, `insert`, `update`; `revoke delete` explicit.
- **Tranzițiile se păzesc ÎN UPDATE**, prin `.in("status", STARI_DESCHISE)` și `.select()`
  după: zero rânduri înseamnă „deja închisă” sau „nu ai dreptul”, nu succes. — capcana #17
- **Rezolvarea nu e atomică, deci se compensează.** Dacă UPDATE-ul condiționat întoarce
  zero rânduri sau eroare, intervenția abia inserată se anulează logic și acțiunea
  întoarce CONFLICT. Din 0180, anularea logică a unei intervenții legate de plan îl READUCE
  la intervenția anterioară.
- **Valoarea de achiziție NU mai stă pe rândul echipamentului** (0232): `equipment.valoare_achizitie`
  e golită, valoarea e în `equipment_costuri` și o citește doar `maintenance:update = all` ori
  `maintenance:read >= team` (`app.poate_vedea_valoarea_echipamentelor`). Responsabilul utilajului
  și tehnicianul atribuit — care văd rândul echipamentului, fiindcă RLS taie rânduri, nu coloane —
  primesc `null`, deci „—", fără semnal; câmpul apare în fișă doar lui `update = all`, iar o
  valoare trimisă totuși de un gestionar pe `team` e refuzată înainte de orice scriere. Coloana
  golită e păzită de `src/lib/queries/coloane.test.ts`. — v. [[modul/mentenanta/echipamente]]
- **Scadența pe contor pornește de la contorul real** (0180): planul nou fără
  `ultima_citire_contor` ia ultima citire a echipamentului; schema de editare OMITE coloana.
- **Autorizația ISCIR are rândurile ei în `expirables`** (0180): `kind` fix, nu `tip`-ul
  liber, iar `entity_id` e autorizația, nu utilajul; suspendarea, planul dezactivat și (din 0211) rândul înlocuit prin reînnoire ies din scadențe — v. [[modul/mentenanta/iscir]]. —
  capcana #55
- **O intervenție pe planul altui echipament e refuzată** cu P0001 (0180); o corecție de
  citire nu sare peste citirea URMĂTOARE. Proba: `tests/rls/proba-mentenanta-integritate.sql`.
- **Administratorul fără fișă poate sesiza**: `raportat_de_employee_id = null`, iar garda
  reține `raportat_de_user_id`.
- **Avertismentul de duplicat EXISTĂ, linkul spre el nu întotdeauna.** `cautaEchipament`
  găsește sesizarea deschisă cu clientul admin, dar întreabă a doua dată, cu clientul
  OMULUI, dacă RLS i-o arată (`sesizare_deschisa.vizibila`). Fără flagul ăsta linkul ducea
  în 404; cu `vizibila: false`, caseta spune „anunțați-l pe cel care a raportat-o”
  (`sesizari/campuri-sesizare.tsx`).
- **Un plan șters logic nu se mai editează — dar numai fiindcă acțiunea o cere.**
  Politica de UPDATE pe `maintenance_plans` nu filtrează `deleted_at`, deci
  `actualizeazaPlan` pune `.is("deleted_at", null)` explicit: fără el un apel direct îl
  reactiva (`activ = true`), cu intrare de audit. Aceeași regulă în toate gesturile din
  `planuri/actions.ts` (`0183`).
- **Linkul spre sesizarea unei opriri** se desenează doar dacă sesizarea a venit prin RLS —
  v. [[modul/mentenanta/echipamente]].
- **Gărzile cu actori nominali au trei ramuri**: omul cu drept larg, raportorul sau
  tehnicianul atribuit și SERVICIUL (jobul de închidere automată, clientul admin).
  Serviciul sare peste drepturi, nu peste apartenența la firmă. — capcanele #50 și #56
- **Platforma citește fișierele firmelor, nu le scrie** (`0212`): ramura `is_platform_admin()` din
  porțile de fișiere stă doar pe `read` — capcana #58.
- **Selectorul de puncte de lucru se golește tăcut** pentru un rol cu `maintenance:update`
  dar fără `departments:read`; de aceea trece printr-o acțiune cu client admin, iar fișa
  arată „Setat" când numele nu se poate citi. — capcana #57

## Ce NU e aici

Vehiculele și foile de parcurs sunt la [[modul/flota]]. Instruirile, EIP-ul și accidentele
sunt la [[modul/ssm]], deși vin din aceeași migrare. Nu există în modul, și nu se adaugă fără
cerere: cronometre pe tehnician, stoc de piese pe depozite, permise de lucru, contracte de
service cu aprobarea devizului, buget, mod offline și alerte prin email sau SMS.

## Când NU e suficientă pagina asta

- Calculul scadenței unui plan: `src/domain/maintenance/`.
- De ce un manager poate sesiza dar nu poate administra: [[rol/manager]].
- Contractul exact al unei acțiuni: [[modul/mentenanta/actiuni]], apoi `actions-*.test.ts` și
  `<sub>/actions.test.ts` din `src/app/(app)/mentenanta/`, pe client Supabase fals.
- Fluxul sesizării de la capăt la capăt, pe conturile demo: `e2e/mentenanta.spec.ts` (rulează
  pe staging, după deploy). Date de demonstrație pentru fiecare zonă: etapele `mentenanta` și
  `mentenantaFlux` din `scripts/demo/populeaza.mjs` (rulate manual, scriu în baza comună).
- Legăturile dintre ecrane (`docs/design/navigare-intre-module.md`, lotul 7h și 7l):
  [[strat/navigare]].
