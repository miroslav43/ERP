# PROGRESS

Stadiul livrării, pe faze. Planul complet: [`docs/design/00-PLAN-APROBAT.md`](docs/design/00-PLAN-APROBAT.md).
Valorile legale de confirmat și configurările restante: [`NOTES.md`](NOTES.md).

---

## Faza 0 — Setup ✅ livrată

**Criteriul de acceptare era:** un PR gol trece CI verde; migrările aplică pe o
bază goală în câteva secunde.

### Ce există și funcționează

- **Proiect** Next.js 16.3.1 · React 19.2 · TypeScript 5.9 `strict` + 7 verificări
  suplimentare (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, ...) ·
  Tailwind v4 · pnpm 10.33.
- **`src/config/env.ts`** — validare Zod care oprește aplicația la boot, nu la
  primul request. Verifică inclusiv că fiecare cheie de criptare are exact 32 de
  octeți și că `HR_ENCRYPTION_ACTIVE_KEY` are corespondent.
- **`src/lib/format/`** — funcții pure, **30 de teste verzi**:
  - `money.ts` — `1.234,56 lei`, rotunjire aritmetică la ban (nu „half to even",
    care ar fi dat `2,67` pentru `2.675`), citirea intrării utilizatorului
    tolerantă la punct/virgulă/spațiu neîntrerupt.
  - `date.ts` — `dd.MM.yyyy` și `Europe/Bucharest`. Ziua calendaristică se
    procesează **ca șir**, fără a construi vreun `Date`, ca să nu se deplaseze
    cu o zi. Testat pe granița de zi (22:30 UTC = ziua următoare la București),
    pe granița de lună și pe ora de vară/iarnă.
- **Design system** — paleta navy/crem din specificație ca variabile CSS, gata de
  suprascriere per organizație. Font Inter cu subsetul `latin-ext`, obligatoriu
  pentru ș/ț **cu virgulă** (nu cu sedilă).
- **ESLint** — `no-restricted-imports` blochează importul clientului
  `service_role` oriunde în afara Server Actions, Route Handlers și scripturi;
  `no-explicit-any` la nivel de eroare.
- **CI** (`.github/workflows/ci.yml`) — două joburi: calitate (typecheck, lint,
  formatare, teste, build) și migrări pe **Postgres 17 curat**, cu cele trei
  bariere.

### Cele trei bariere — verificate, nu doar scrise

Rulate pe Postgres, întâi pe o schemă construită **deliberat greșit**, apoi pe
una curată. În continuare rulează exclusiv în CI, pe un Postgres 17 efemer:

| Barieră                                   | Prinde                                                                        | Verificat                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1 · `scripts/checks/security-definer.sql` | funcții `SECURITY DEFINER` fără `search_path = ''`                            | ✅ eșec (cod 3) pe `search_path = public`; trece pe `= ''`     |
| 2 · `scripts/checks/policies-explain.sql` | politici RLS care referă coloane inexistente; corp de funcție rupt            | ✅ trece pe schemă curată; `plpgsql_check` sărit dacă lipsește |
| 3 · `scripts/checks/rls-enabled.sql`      | tabelă fără RLS · fără `FORCE` în afara listei albe · RLS fără nicio politică | ✅ eșec (cod 3) pe fiecare din cele trei cazuri                |

> Bariera 1 a fost **greșită la prima scriere**: accepta `search_path = public`,
> care nu este sigur, fiindcă `pg_temp` rămâne căutat înaintea lui. Defectul a
> ieșit la iveală exact pentru că bariera a fost testată împotriva unei funcții
> vulnerabile construite intenționat, nu doar rulată pe o bază goală.

### Comenzi

```bash
pnpm verify      # typecheck + lint + teste — de rulat înainte de fiecare commit
pnpm dev         # server de dezvoltare
pnpm test        # doar testele unitare (logica pură)
pnpm test:rls    # izolarea între tenanți (necesită proiectul Supabase de test)
```

### Restant din Faza 0

- ⚠️ MCP Supabase indică proiectul greșit — vezi `NOTES.md` §1.
- ⛔ Cheile Supabase reale în `.env.local` (blocat de MCP).
- ⛔ Proiectul Supabase dedicat testelor.
- ⛔ Verificarea disponibilității `pg_partman`.

**Decizie:** fără Supabase local și fără Docker. Bazele reale sunt în cloud.
Postgres nativ rămâne local, doar ca banc de probă pentru DDL înainte de push;
verificarea autoritară este CI-ul, pe Postgres 17. Detalii: `NOTES.md` §1.

---

## Faza 1a — Fundația ⚠️ scrisă, parțial neverificată

### Ce există

**Baza de date** — 17 tabele, 16 enum-uri, 15 helperi `app.*`, 44 de politici RLS,
7 triggere de gardă, 5 funcții RPC, matricea de permisiuni ca **date** (118 chei
`resursă:acțiune`). Migrările aplică pe un Postgres 17 curat și trec cele trei bariere.

**Aplicația** — `resolveTenant()` cu cookie tratat ca hint neîncrezut,
`createAction()` cu cele 8 straturi, clienți Supabase tipați, autentificare
(parolă, magic link, resetare, invitație), shell cu sidebar generat din
`config/navigation.ts`, `/panou` ca tablou de bord.

### Defecte găsite și corectate

Fiecare a fost verificat pe Postgres 17 **înainte și după** corecție, nu doar citit:

| Defect                                                                                                                   | Cum se manifesta                                                                                                 | Verificare                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `is_service_context()` citea `current_user` din triggere `SECURITY DEFINER`, unde acela e **proprietarul**, nu apelantul | Toate gărzile ieșeau pe prima linie; un `org_admin` își rescria `plan`, `seats_limit`, `status`, `slug`, `cui`   | măsurat: ca `authenticated` → `true` înainte, `false` după                                                                              |
| `role_permissions_update` verifica rolul în `USING` dar nu în `WITH CHECK`, iar `organization_id` nu era fixat           | org_admin în firma A, membru simplu în B → mută rândul în B și își acordă `users:create=all` = preluare completă | politica rescrisă cu predicatul repetat                                                                                                 |
| Cele 44 de politici scriau `= any ((select app.current_org_ids()))`                                                      | `ERROR: uuid = uuid[]` — subquery-ul întoarce **un rând de tip array**, nu un set                                | corectat cu `::uuid[]`, formă aleasă comparând planurile: singura cu `InitPlan` (o evaluare/instrucțiune) în loc de `Hash Semi Join`    |
| `log_audit_event` și `consume_rate_limit` erau apelate dar nu existau                                                    | auditul complet mut (inclusiv `tenant_forged`), limitarea de rată inexistentă                                    | funcțiile adăugate; `consume_rate_limit` expusă **doar** lui `service_role` — altfel oricine blochează contul altcuiva epuizându-i cota |
| Vocabularul de permisiuni diferea între cod și seed (10 chei din 20)                                                     | meniu **complet gol**, inclusiv pentru `org_admin`, fără nicio eroare                                            | aliniat; `permissions.test.ts` compară cele două liste și eșuează dacă diverg din nou                                                   |
| Parametrul de redirect: `proxy` scria `continua`, pagina citea `redirect`                                                | linkurile profunde se pierdeau tăcut după login                                                                  | o singură constantă, `PARAM_REDIRECT`                                                                                                   |
| `src/app/page.tsx` și `(app)/page.tsx` se mapau ambele la `/`                                                            | dashboard-ul era **inaccesibil**                                                                                 | mutat la `/panou`; `config/routes.ts` centralizează destinația                                                                          |

> O observație a criticii a fost **respinsă**: `created_day` ca `GENERATED` peste
> `AT TIME ZONE 'Europe/Bucharest'` ar bloca migrarea. Fals — `timezone(text,
timestamptz)` este `IMMUTABLE` în Postgres 17 (verificat în `pg_proc`), iar
> migrarea se aplică. Agentul afirmase eșecul fără să-l testeze.

### ⛔ Ce NU este verificat

**Testul de izolare între tenanți nu a rulat niciodată.** Este cel mai important
test din proiect — codul lui există (`tests/rls/`), dar are nevoie de un proiect
Supabase de test, resetabil, care nu e configurat. Până atunci, izolarea este
_proiectată_ corect și verificată static, dar nu _dovedită_ pe un tenant real.

De asemenea neverificate: fluxul de invitație end-to-end (cere GoTrue real),
trimiterea de email, cei 25 de pași de testare manuală.

### Ce s-a tăiat deliberat

Exemplul de acțiune pentru concedii: referea tabele din Faza 3a care nu există.
Faza 1a nu are module de business.

### Restant

- ⚠️ MCP Supabase indică proiectul greșit — `NOTES.md` §1.
- ⛔ Cheile Supabase reale în `.env.local`.
- ⛔ Proiectul Supabase de test → deblochează testul de izolare.
- ⛔ Migrările nu au fost aplicate niciodată pe cloud.
- ⛔ Verificarea disponibilității `pg_partman`.

---

## Faza 1b — Super-Admin · următoarea

CRUD organizații, module per organizație, membri și invitații din UI, cereri
demo, jurnal de audit, comutator de organizație, Resend în mod test.

**Regula de aur: nimic din 1b nu modifică o tabelă din 1a.**

Nu poate începe înainte de conectarea MCP-ului și de rularea, măcar o dată, a
testului de izolare.

---

## Faza 1b — Super-Admin ✅ livrată

86 de fișiere, 27 de rute. CRUD organizații cu validare de CUI (cifră de
control reală, cu teste), module per organizație, membri și invitații,
matricea de permisiuni read-only, landing public cu formular de demo, jurnal de
audit cu paginare keyset, email prin Resend în mod test, comutator de
organizație, paletă de comenzi.

### Ce a mers prost și de ce contează

Șase agenți în paralel au produs **91 de erori de compilare**, aproape toate din
aceeași cauză: fiecare și-a inventat propriile căi de import pentru aceleași
module. În loc să le ghicesc, am construit un index simbol→modul din fișierele
care există efectiv și am rescris fiecare import după _ce_ importă — 40
rezolvate automat, 3 simboluri chiar lipseau. Restul de 41 au fost reparate de
17 agenți în paralel, câte unul per fișier.

**Lecție pentru fazele următoare:** agenții paraleli trebuie să primească
inventarul exact al modulelor existente, nu doar contractul de API.

Criticii au raportat 5 observații „CRITICE" **false** — reclamau fișiere lipsă
care există din Faza 1a. Vedeau doar ieșirea 1b, nu depozitul.

### Două vulnerabilități reale, verificate empiric

**Evaziune din jurnalul de audit.** `X-Forwarded-For` este un antet controlat de
client, iar `log_audit_event` îl convertea cu `p_ip::inet`. Un antet care nu e
adresă IP făcea **fiecare** scriere în audit să eșueze cu 22P02:

```
select public.log_audit_event(..., p_ip => '<script>alert(1)</script>', ...);
ERROR: invalid input syntax for type inet
```

Cum `createAction` scrie în audit și la succes, și la refuz, un atacator își
putea face acțiunile invizibile în jurnal. Corectat în `0003`: conversia
întoarce `NULL` în loc să arunce, iar rândul se scrie oricum. Un IP lipsă e o
pierdere acceptabilă; un eveniment neînregistrat nu este.

**Divulgare pe paginile de setări.** `setari/membri` și `setari/organizatie`
citeau datele fără nicio verificare de permisiune — orice membru autentificat
vedea lista membrilor, planul și plafonul de locuri. Acțiunile refuzau corect,
deci nu se putea _modifica_ nimic, dar divulgarea rămâne divulgare.

### Trei defecte de React, corectate de fond

- Componenta `Eroare` era definită în corpul formularului: la fiecare randare
  primea identitate nouă, deci React demonta subarborele — utilizatorul pierdea
  focusul exact în timp ce scria.
- `<dialog>`-ul paletei de comenzi era condus imperativ prin ref din handlere;
  acum din stare, cu reful atins doar într-un efect.
- Variabila `module` intra în conflict cu `module` din CommonJS.

Două module `"use server"` exportau constante. Next refuză build-ul, corect:
tot ce exportă un astfel de modul devine punct de intrare apelabil din rețea.

### Verificare

`typecheck 0` · `lint 0` · **97 teste verzi** · build cu 27 de rute ·
migrări + cele trei bariere + **izolarea 11/11**, atât pe Postgres 17 local cât
și pe **Supabase real**.

### Restant

- ⛔ `SUPABASE_SERVICE_ROLE_KEY` lipsește din `.env.local` — fără ea, panoul
  Super-Admin nu poate rula (folosește clientul admin).
- ⛔ Cei 25 de pași de testare manuală nu au fost executați.
- ⛔ Fluxul de invitație end-to-end (cere GoTrue real + un email).

---

## Faza 2 — corecție: nucleul HR nu funcționa

Faza 2 a fost comisă ca livrată. **Nu era.** Un `org_admin` nu putea insera un
angajat:

```
insert into public.employees (...) as authenticated
→ new row violates row-level security policy for table "employees" (42501)
```

Toate verificările automate treceau — typecheck, lint, 175 de teste, cele trei
bariere, izolarea 11/11. **Niciuna nu execută o scriere reală ca utilizator
obișnuit.** Verificam că nimeni nu vede ce nu are voie, dar nu și că cine are
voie poate lucra.

### Cauzele

| Defect                                                                                                                                                                              | De ce a scăpat                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `WITH CHECK` cerea `manager_path = '{}'`, cu comentariul „calculat de trigger" — dar triggerele `BEFORE` rulează **înaintea** lui `WITH CHECK`, deci politica vedea `array[new.id]` | Comentariul descria exact inversul realității; nimic nu îl contrazicea |
| Politicile cereau `created_by = auth.uid()`, dar `set_actor` nu era atașat pe tabelele HR — bucla din `0002` rulase înainte ca ele să existe                                        | Aceeași clasă ca la granturi: „toate tabelele" înseamnă „cele de acum" |
| `sensitive_select` permitea SELECT direct pe `employee_sensitive_data`, ocolind funcțiile care auditează                                                                            | Politica părea o măsură de securitate, nu o breșă                      |
| `salary_components` și `employee_tax_exemptions` foloseau `has_permission(...) <> 'none'`, tratând `own` și `team` ca `all` — un angajat vedea sporurile tuturor colegilor          | Predicatul arată corect la citire rapidă                               |

### Ce s-a schimbat durabil

Testul de izolare are acum verificarea **(l)**: un `org_admin` chiar poate crea
departamente și angajați, iar coloanele calculate de trigger se completează.
Testat prin regresie — repunerea condiției greșite îl face roșu.

Substitutul local `auth` nu acorda `USAGE` lui `authenticated`, deși Supabase o
face (verificat pe proiectul real). Diferența producea un eșec care exista doar
local și trimitea pe piste false.

### ✅ Cele cinci defecte din vânătoare — închise

| Defect | Corecție |
|---|---|
| Două module de criptare; cel folosit de calea principală citea variabile de mediu inexistente | `src/lib/hr/` eliminat; totul trece prin `crypto/aes-gcm.ts`, unde au fost mutate și conversiile `bytea` |
| **Importul Excel scria CNP și IBAN în CLAR** într-un fișier din Storage | Criptare la parsare; schema lotului nici nu mai acceptă câmpurile în clar |
| Bucket-ul `documente` nu există | `org-documents`, numele real din `0002` |
| REVISAL era cod mort, fără apelanți | Evenimentul de angajare se generează în aceeași acțiune care creează contractul |
| Excel parsa tot registrul înainte de limita de rânduri | Limită separată pe conținutul **decomprimat**, citită din antetele zip fără a decomprima |

Scurgerea de CNP a fost cea mai gravă: lotul de import ajungea în Storage în text
simplu, deci un fișier uitat acolo era o breșă completă — fără să atingă nicio
politică RLS și fără urmă în audit. `protejare.test.ts` verifică acum forma
lotului, ca reintroducerea câmpului în clar să pice imediat.

**Aplicația răspunde.** Rutele publice dau 200, cele protejate redirecționează
către autentificare cu linkul profund păstrat (pasul 26 din testarea manuală).
Diacriticele sunt corecte: 6 ș și 6 ț cu virgulă pe landing, zero cu sedilă.

---

## Faza 4 — expirări și alerte ✅ schema livrată

`0008_expirables.sql`. `expirables` e proiecția comună a scadențelor din toate
modulele, alimentată prin triggere care apelează `internal.sync_expirable()`.
Cheia unică include `kind`, ca un stingător să poată avea simultan verificarea la
zi și proba de presiune expirată.

Trei corecții față de ce au produs agenții:

1. **Toate politicile apelau `app.has_permission(org, 'compliance:read', 'all')`**
   — resursa și acțiunea lipite, iar scope-ul pus în locul acțiunii. Semnătura
   reală e `(org, resursă, acțiune)` și întoarce scope-ul. Nu ar fi funcționat
   niciuna.
2. **`expirables` e polimorfă**, deci același rând descrie fie o rovinietă, fie o
   fișă de aptitudine medicală. Politica verifica doar `compliance:read` — drept
   administrativ pe care îl are și un referent — iar `label` copiază text din
   sursă („Fișă de aptitudine — Popescu Ana, inapt”). ETICHETA este informația.
   `app.poate_vedea_expirabil()` reevaluează acum permisiunea entității sursă, cu
   implicit **restrictiv**: un `entity_type` neînregistrat devine invizibil.
3. `pg_trgm` nu era declarat, deși un index îl folosea.

**Respinsă**, după verificare: constatarea că indexul total de deduplicare
blochează pentru totdeauna o scadență. `due_date` derivă din `expires_at`, deci
un document reînnoit produce o cheie nouă. Argumentul autorului împotriva unui
index parțial — o alertă ștearsă ar fi regenerată zilnic — este corect.

**Restant:** stratul TypeScript (dashboard, job zilnic, notificări) e în
`docs/design/faza-4/`, neinstalat. Și **niciun trigger nu leagă tabelele HR de
`expirables`** — un permis de muncă ce expiră mâine nu apare nicăieri.
Inventarul și flota și-l au; HR-ul nu.

---

## Fazele 3a, 5, 8 — concedii, inventar, flotă ⚠️ schemă livrată, module NEfuncționale

`0009_leave.sql`, `0010_inventory.sql`, `0012_fleet.sql` + `0012b`.

Trei defecte reparate ca să se aplice migrarea de concedii: 14 apeluri
`has_permission` folosite ca boolean, rolurile `owner`/`admin` care nu există, și
fluxurile de aprobare blocate pe **rol** în loc de permisiune — ceea ce ar fi
făcut matricea `role_permissions` decorativă și ar fi picat pasul 14 din
testarea manuală.

### Verificat încrucișat

**Paștele ortodox:** `internal.paste_ortodox` (PL/pgSQL) și `pasteOrtodox`
(TypeScript), scrise separat, dau aceleași 17 valori pentru 2024–2040. Cinci sunt
ancorate în date de referință scrise de mână.

**Reconcilierea calendar ↔ pontaj:** zilele lucrătoare din
`app.numara_zile_lucratoare` și din `calculeazaZileLucratoare` coincid pe **36 de
luni consecutive**. E invariantul de care depinde toată salarizarea; rulat
înainte ca Faza 3b să existe, și din nou după fiecare atingere a funcției.

Cele 51 de zile de sărbătoare 2026–2028 se potrivesc exact, inclusiv 1 iunie
2026, care e simultan Ziua Copilului și a doua zi de Rusalii.

### ⛔ Ce nu funcționează

Vânătoarea adversarială a **reprodus empiric** fiecare punct de mai jos.

**Concedii:** nicio cerere nu se poate crea — `WITH CHECK` cere zerouri pe
coloane pe care triggerul `BEFORE` tocmai le-a calculat, exact defectul reparat
în `0007`, reapărut. Fluxul de aprobare e mort: sarcinile se creează cu
destinatar `NULL`, fiindcă pașii `manager_direct` au `approver_user_id` NULL prin
constrângere. Două funcții crapă la aprobare (o variabilă care umbrește un alias
de tabelă; un `CASE` care dă `text` unde coloana e enum). Soldul devine oricât de
negativ.

**Flotă:** verificarea de regres de kilometraj rulează la **orice** `UPDATE`,
deci o foaie de parcurs nu mai poate fi aprobată, respinsă sau adnotată.
Ștergerea logică e imposibilă pe toate tabelele modulului.

**Inventar:** editarea unei alocări istorice rescrie starea curentă a obiectului;
un obiect returnat „defect” apare imediat disponibil pentru predare.

Găurile de **izolare** din aceleași faze sunt închise în `0016` — vezi mai jos.

---

## Fazele 7, 3b, 6, 10 — SSM, pontaj, checklist, diurne ⚠️ doar schema

`0011_ssm.sql`, `0013_attendance.sql`, `0014_checklist.sql`, `0015_per_diem.sql`.
Se aplică curat, trec cele trei bariere. **Zero cod de aplicație** — agenții de
construcție au murit la limita de sesiune; ce apucaseră e în `docs/design/`.

`0010b_fix_garda_audit.sql` repară un fals pozitiv de limbă română: garda R9
refuza să atașeze auditul pe `safety_committee_meetings`, fiindcă tiparul
`%secret%` prinde **`secretar_employee_id`**. Lăsa neauditată o tabelă din
registrul obligatoriu ITM. Tiparul e acum delimitat de underscore, iar migrarea
verifică singură că restrângerea n-a mers prea departe.

---

## 0016 — găurile de izolare, închise

Clasa R1 din planul de riscuri. Fiecare defect reprodus cap-coadă.

**Ștergere fizică cross-tenant (Faza 5).** Firma B muta un obiect în lotul firmei
A — nimic nu lega lotul de organizație. A revoca lotul, legitim, iar funcția
filtra doar pe `import_batch_id`. Obiectul firmei B dispărea **fizic**, de pe
singura tabelă fără soft delete, iar rândul de audit se scria în organizația A.
Reparat pe două straturi.

**Escaladare la date de sănătate (Faza 3a, art. 9 GDPR).** Un singur `INSERT`
neverificat în `approval_tasks` deschidea certificatul medical al colegului: cod
de indemnizație CNAS, serie, număr, plus câmpul liber în care oamenii scriu
diagnosticul. Politica nu s-a restrâns, s-a **șters** — fluxul normal trece
printr-un trigger `SECURITY DEFINER` și n-avea nevoie de dreptul utilizatorului.

Plus: auto-aprobare la concedii și la foi de parcurs; oracol cross-tenant pe
calendar (`app.este_zi_lucratoare` era definer fără verificare de apartenență);
cheia primară a unei predări-primiri rescriibilă de un angajat cu drepturi
minime; „ce am în primire” arăta și ce returnasem; dreptul de scriere pe flotă
deriva din scope-ul de **citire**; și `grant ... on all tables` recompensa cele
cinci tabele revocate anume în `0001`.

### Două greșeli proprii, prinse înainte de comit

Rescrisesem `app.este_zi_lucratoare` de la zero și pierdusem ramura
`zi_recuperare`, care se evaluează **înaintea** weekendului — o sâmbătă lucrată
în locul unei punți ar fi devenit nelucrătoare, tăcut, în pontaj și în concedii.
Și redefinisem `numara_zile_lucratoare` cu trei parametri când originalul are
cinci: n-am suprascris nimic, am creat o supraîncărcare ambiguă, deci apelul care
mergea înainte de „corecție” a încetat să meargă după ea. Reconcilierea pe 36 de
luni le-a prins pe amândouă.

---

## Starea generală

**18 migrări, 103 tabele local, 37 pe cloud.** Cele trei bariere verzi.
254 de teste unitare, typecheck curat.

Aplicația acoperă `angajati`, `departamente`, `revisal`, `setari`, `panou` și
Super-Admin — adică fazele 0, 1a, 1b și 2. **Opt din unsprezece module au bază de
date și niciun ecran.**

### Ce blochează livrarea

1. Modulele nefuncționale de mai sus.
2. **Fixture-ul de izolare nu acoperă cele ~66 de tabele noi.** Verificarea (c)
   eșuează deliberat, deci testul nu rulează în lanț — și tot el trebuie să
   conțină verificarea **(l)**, scrieri reale ca utilizator obișnuit. Ea ar fi
   prins din prima că nicio cerere de concediu nu se poate crea. Fără ea, nimic
   nu are voie pe cloud.
3. **`plpgsql_check` n-a rulat niciodată pe cele 10 migrări noi.** Extensia există
   doar pe Supabase. Ea a găsit defectele din `0006` — coloane inexistente în
   corpuri de funcții care se creaseră fără nicio eroare. Sunt ~40 de funcții
   PL/pgSQL noi, neverificate.
4. Stratul TypeScript pentru opt module.
5. Fazele **9** (salarizare, depinde de pontaj funcțional) și **11** (portal).

### Restanțe mai mici

- Cei 25 de pași de testare manuală, niciunul executat.
- Valorile marcate „DE VERIFICAT DE JURIST”. Faza 9 nu se livrează fără fișierul
  de cazuri de test de la contabil.
- Parola de bază de date și cheia `service_role` au trecut prin conversație; de
  rotit înainte de producție.

---

## Actualizare — toate modulele cu ecrane, Faza 9 livrată

**Tot ce e deasupra acestei linii e istoric** și nu mai descrie starea reală:
între timp au primit ecrane complete `pontaj`, `flotă`, `SSM și PSI`,
`mentenanță`, `inventar`, `concedii`, `integrare angajați`, `diurne și
deplasări` și `portalul angajatului` — plus o pagină de profil propriu
(`/profil`, `/portal/profilul-meu`) care lipsea complet. Secțiunea asta e
sursa de adevăr curentă.

**27 de migrări** (`0001`–`0027`), aplicate identic local și pe cloud. **354 de
teste unitare** (`domain/`, `format/`, `config/` — încă zero pe `lib/queries/`,
`lib/actions/` sau pagini). Typecheck curat, lint 0 erori, build 101 rute.

### Faza 9 — Salarizare, livrată cu scop redus deliberat

Motorul de calcul (`domain/payroll/calc.ts`, 17 teste) NU acoperă: concediul
medical (indemnizația CNAS e proces separat, doar avertizează), sporurile pe
trepte pentru orele suplimentare (o singură treaptă configurabilă), plafonul
lunar cumulat al veniturilor neimpozabile, integrarea automată cu diurna peste
plafon. Fiecare simplificare e comentată explicit în cod. Banner de
neconformitate pe fiecare ecran; `payroll_settings.verificat_de_contabil`
implicit `false`.

Verificat manual, capăt la capăt, pe organizația demo: setări → prag de
deducere → perioadă → calculat (8 angajați) → aprobat → fluturaș vizibil în
portal pentru angajat, invizibil pentru manager. Trei defecte reale prinse în
timpul verificării, nu doar citind codul — vezi mesajul commit-ului
`9e721ca` pentru detalii (upsert pe index parțial, RLS care se bloca singur pe
propriul fluturaș al angajatului, demo fără niciun contract de muncă).

### Ce chiar blochează încă livrarea

1. **Testul de izolare RLS n-a rulat niciodată pe un proiect de test.** Codul
   acoperă cele 103 tabele (`tests/rls/izolare.test.ts`), dar are nevoie de un
   proiect Supabase resetabil, separat de dezvoltare — încă neconfigurat.
2. **`plpgsql_check` n-a rulat pe migrările de după `0006`.** Extensia există
   doar pe Supabase; ~150 de funcții PL/pgSQL scrise de atunci nu au trecut
   prin verificarea de fond, doar prin bariera 2 (care sare verificarea dacă
   extensia lipsește).
3. **Zero teste pe `lib/queries/`, `lib/actions/` și pagini.** Fiecare defect
   real găsit în sesiunile astea (permisiuni greșite, RLS care se auto-blochează,
   `.upsert` pe index parțial) a scăpat exact de aici — verificat manual în
   browser, nu de un test automat care să prindă regresia data viitoare.
4. **Faza 11** (anunțuri, `employee_change_requests`) — fără schemă încă.
   Singurul modul rămas onest neconstruit în `MODULE_NECONSTRUITE`.
5. Cei 25 de pași de testare manuală din planul aprobat, niciunul executat ca
   parcurs complet — bucăți din ei au fost verificate ad-hoc, pe module.
6. Valorile fiscale din `payroll_settings` — de introdus și verificat de
   contabil înainte de orice calcul real. Cotele din demo sunt ilustrative.
7. Doar 1 proiect Supabase din cele 4 planificate (dev/staging/test/prod).
8. Parola de bază de date și cheia `service_role` au trecut prin conversație
   într-o sesiune anterioară — de rotit înainte de date reale.
