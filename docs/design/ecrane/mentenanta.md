# Plan de implementare — mentenanta

MODUL MENTENANȚĂ — feature "maintenance", migrarea 0011. Resursa RLS = `maintenance` pentru equipment,
equipment_meters, maintenance_plans, maintenance_interventions, fault_reports, iscir_authorizations.
`personnel_authorizations` (autorizațiile nominale, cerute de garda ISCIR) e sub feature "ssm" și resursa
`ssm` — nu se poate citi din acest modul dacă organizația nu are și modulul SSM activ.

PRECONDIȚIE DE COMPILARE: adaugă `"maintenance:create"` în `PERMISSION_KEYS` (src/config/permissions.ts),
înaintea lui "maintenance:read". Există în seed-ul 0002 (super_admin cross join + rândurile explicite
('manager','maintenance','all','{create}') și ('employee','maintenance','all','{create}')), deci
permissions.test.ts trece. NU adăuga alte chei — alt agent editează același fișier.

SCOPURI DIN SEED (0002): employee → maintenance:read=own, maintenance:create=all (pentru sesizări);
manager → read=team, create=all; org_admin/super_admin → tot=all; maintenance:update NU e acordat
nimănui în afară de org_admin/super_admin. De aici poarta: TOATE scrierile de echipamente/planuri/
intervenvenții/contoare se gătează pe "maintenance:update" cu minScope "team" (mai STRICT decât politica
bazei, care cere doar maintenance:create — pe care și un `employee` îl are „all"). NU slăbi poarta la
"maintenance:create": ar lăsa orice angajat să creeze echipamente. O organizație care vrea tehnicieni
adaugă un rând propriu în role_permissions (manager, maintenance, update, team) — fără modificare de cod.

FIȘIERE
 src/schemas/maintenance.ts
 src/domain/maintenance/scadente.ts + test  (plan scadent: zile și/sau contor → stare semafor)
 src/lib/queries/maintenance.ts
 src/app/(app)/mentenanta/{page,loading,error}.tsx · {etichete,erori,actions}.ts · sesizarile-mele.tsx
 .../mentenanta/echipamente/{page,loading,error,filtre-echipamente}.tsx · nou/{page,formular-echipament}.tsx
 .../mentenanta/echipamente/[id]/{page,loading,error}.tsx · formular-contor.tsx · formular-interventie.tsx
   · formular-plan.tsx · formular-iscir.tsx
 .../mentenanta/planuri/{page,loading,error}.tsx
 .../mentenanta/interventii/{page,loading,error,filtre-interventii}.tsx
 .../mentenanta/sesizari/{page,loading,error,filtre-sesizari}.tsx · noua/{page,formular-sesizare}.tsx
 .../mentenanta/sesizari/[id]/{page,loading,error,actiuni-sesizare}.tsx

ECRANE (fiecare: requireUser → requireTenant → requireFeature(org,"maintenance") → getPermissionMap)
 /mentenanta  poartă can(p,"maintenance:read","own") altfel AccesRestrictionat. Dacă
   !can(p,"maintenance:read","team") → <SesizarileMele/> (angajatul ajunge aici prin QR/link direct;
   în meniu itemul are minScope team, deci nu-l vede). Panou org: planuri scadente / în întârziere,
   sesizări deschise pe urgență, echipamente cu status ≠ in_functiune, autorizații ISCIR ce expiră.
 /mentenanta/echipamente  read team · /nou și /[id] editare: can(p,"maintenance:update","team").
 /mentenanta/echipamente/[id]  FIȘA: identificare, contoare (ultimele citiri pe fiecare `tip`), planuri,
   istoricul intervențiilor cu costuri, autorizații ISCIR, sesizări legate.
 /mentenanta/planuri, /mentenanta/interventii  read team; scriere "maintenance:update"/team.
 /mentenanta/sesizari  read: can(p,"maintenance:read","own") · /noua: can(p,"maintenance:create","own")
   · triaj/rezolvare în /[id]: can(p,"maintenance:update","team").
 [id]: `idDinRuta((await params).id)`; filtre: `filtreDinUrl(schema, parametri)`.

INTEROGĂRI — src/lib/queries/maintenance.ts (toate .eq("organization_id",…) ȘI .is("deleted_at",null);
politicile SELECT din 0011 nu filtrează deleted_at)
 listeazaEchipamente(org, filtre) → equipment: id, cod, denumire, serie, producator, model, an_fabricatie,
   locatie, department_id, responsabil_employee_id, status, este_iscir, tip_autorizare_necesara,
   data_punerii_in_functiune. Keyset pe (cod, id) `.order("cod").order("id")`; cursor base64url cu
   separatorul scris ca secvența de evadare backslash-u-0-0-0-0 (ca în queries/employees.ts).
 citesteEchipament(org,id) → + valoare_achizitie, derogare_motiv, derogare_acordata_de,
   derogare_acordata_la, created_at, updated_at
 contoareEchipament(org, equipmentId) → equipment_meters: id, tip, citire, data_citirii, resetare_contor,
   sursa, citit_de_employee_id, observatii  `.order("data_citirii",{ascending:false})`
 planuriEchipament / planuriScadente(org) → maintenance_plans: id, equipment_id, denumire, tip,
   periodicitate_zile, periodicitate_contor, tip_contor, ultima_executie, ultima_citire_contor,
   urmatoarea_scadenta, urmatoarea_scadenta_contor, responsabil_employee_id, instructiuni, activ
   (.eq("activ",true) pe ecranul de scadențe, `.order("urmatoarea_scadenta")`)
 interventii(org, filtre) → maintenance_interventions: id, plan_id, equipment_id, tip, data, ora_start,
   durata_ore, executant_employee_id, executant_extern, descriere, piese, cost_piese, cost_manopera,
   cost_total, rezultat, oprire_minute, citire_contor, observatii
 sesizari(org, filtre) → fault_reports: id, equipment_id, raportat_de_employee_id, descriere, urgenta,
   status, raportat_la, opreste_functionarea, intervention_id, rezolvat_la, motiv_respingere
 autorizatiiIscir(org, equipmentId?) → iscir_authorizations: id, equipment_id, numar, tip, emitent,
   emis_la, valabil_pana, scadenta_verificare_tehnica, conditii, suspendata_la
 angajatiAutorizati(org, tipAutorizare) → personnel_authorizations: employee_id, tip, numar, valabil_pana
   `.is("suspendata_la",null).gte("valabil_pana", todayInBucharest())` — alimentează selectorul de
   responsabil pe echipamente ISCIR. Cere feature "ssm" activ: `getEnabledFeatures(org).has("ssm")`;
   dacă nu, formularul afișează explicit „Autorizațiile nominale se administrează în modulul SSM; fără el,
   un responsabil pe echipament ISCIR se poate desemna doar prin derogare motivată."
 numarScadenteMentenanta(org) → pentru badge-ul „maintenance_due".
 NU citi `public.expirables` — politica ei cere ȘI compliance:read (doar org_admin), deci un manager
 vede zero rânduri; semaforul se calculează din maintenance_plans și iscir_authorizations.

SCRIERE — src/app/(app)/mentenanta/actions.ts (organization_id din ctx.tenant; created_by/updated_by de la
triggerul `set_actor`)
 creeazaSesizare "maintenance.fault.create" · feature "maintenance" · permission "maintenance:create" ·
   minScope "own" · input { equipment_id, descriere (min 10), urgenta, opreste_functionarea } — TREI câmpuri
   + echipamentul. Handlerul rezolvă fișa proprie cu createAdminSupabase() (`employees`, filtre explicite
   organization_id + user_id + is_primary + deleted_at is null), exact ca în concedii/actions.ts, și scrie
   `raportat_de_employee_id`. Fără el, politica SELECT (col = raportat_de_employee_id) ascunde rândul și
   `.select("id")` cade cu 42501. NU trimite status / raportat_la / rezolvat_la / intervention_id.
   revalidate ["/mentenanta","/mentenanta/sesizari"] · audit create / fault_reports.
 cautaEchipament "maintenance.equipment.search" · "maintenance:create"/"own" · audit view · fără revalidate ·
   createAdminSupabase(): un `employee` (read=own) NU vede niciun rând din `equipment` (col=null ⇒ team).
   `.eq("organization_id", ctx.tenant.organizationId).is("deleted_at",null).neq("status","casat")`,
   `.or("cod.ilike.*q*,denumire.ilike.*q*")` cu `q` curățat de `,()*:"` înainte de interpolare (virgula și
   parantezele sunt sintaxă în filtrul PostgREST), `.limit(10)`, select "id, cod, denumire, locatie".
   Formularul acceptă și prefill din `?echipament=<uuid>` (QR), validat cu `idDinRuta`.
 numeleEchipamentelorMele "maintenance.equipment.mine" · "maintenance:read"/"own" · audit view · fără
   revalidate · citește întâi fault_reports cu ctx.supabase (RLS ⇒ doar propriile), apoi equipment cu
   clientul admin `.in("id", idUnice)` — nu poate enumera parcul. <SesizarileMele/> (RSC) o apelează direct.
 creeazaEchipament / actualizeazaEchipament · "maintenance:update"/"team" · trimite cod, denumire, serie,
   producator, model, an_fabricatie, locatie, department_id, responsabil_employee_id, status, este_iscir,
   tip_autorizare_necesara, valoare_achizitie, data_punerii_in_functiune, derogare_motiv.
   NU trimite `derogare_acordata_de` / `derogare_acordata_la` — le scrie garda ISCIR. Când responsabilul
   are autorizație valabilă, aceeași gardă golеște singură cele trei câmpuri de derogare.
 inregistreazaContor "maintenance.meter.create" · "maintenance:update"/"team" · equipment_id, tip
   (ore|km|cicluri), citire, data_citirii, resetare_contor, sursa, citit_de_employee_id, observatii.
   Pre-verificare în handler cu `verificaContinuitate(ultimaCitire, citireNoua, null)` din
   @/domain/fleet/kilometraj (se refolosește, nu se rescrie): „regres" + resetare_contor=false ⇒
   businessRule înainte de a atinge baza; „salt" ⇒ doar avertisment în formular.
 creeazaPlan / actualizeazaPlan · "maintenance:update"/"team" · equipment_id, denumire, tip,
   periodicitate_zile, periodicitate_contor, tip_contor, ultima_executie, ultima_citire_contor,
   responsabil_employee_id, instructiuni, activ. NU trimite `urmatoarea_scadenta` și
   `urmatoarea_scadenta_contor` — triggerul BEFORE le recalculează la fiecare insert și update.
 inregistreazaInterventie "maintenance.intervention.create" · "maintenance:update"/"team" · plan_id,
   equipment_id, tip, data, ora_start, durata_ore, executant_employee_id|executant_extern, descriere, piese,
   cost_piese, cost_manopera, rezultat, oprire_minute, citire_contor, observatii. `cost_total` e GENERATED
   ALWAYS (absent din tipul Insert) — nu încerca să-l trimiți. Nu actualiza planul: triggerul AFTER
   `ssm_intervention_apply` îi scrie ultima_executie și ultima_citire_contor când rezultat = "reusita".
 trieazaSesizare "maintenance.fault.triage" · "maintenance:update"/"team" · status ∈ in_analiza|in_lucru|
   respins; pentru „respins", `motiv_respingere` obligatoriu ≥ 5 caractere (garda o cere oricum).
 rezolvaSesizare "maintenance.fault.resolve" · "maintenance:update"/"team" · creează întâi intervenția,
   apoi update-ul cu { status: "rezolvat", intervention_id }. Garda refuză „rezolvat" fără intervenție și
   completează singură `rezolvat_la` — nu-l trimite.
 adaugaAutorizatieIscir "maintenance.iscir.create" · "maintenance:update"/"team".

P0001 → ECRAN: src/app/(app)/mentenanta/erori.ts, după modelul concedii/erori.ts. `traduEroare(error)`:
 "P0001" → businessRule(error.message.slice(0,300)). Mesajele bazei sunt deja scrise pentru utilizator:
 garda ISCIR (247 de caractere, încape în limită) explică exact ce trebuie făcut — alt responsabil sau
 derogare de minimum 20 de caractere de la un administrator; garda de contor conține ambele valori
 („Citirea (%s) este mai mică decât ultima citire înregistrată (%s)…"); gardă de sesizare rezolvată fără
 intervenție și de respingere fără motiv. "23505" → „Există deja un echipament cu acest cod." /
 „Există deja o autorizație ISCIR cu acest număr." default → re-aruncă (calea `mapPostgrestError`).
 `details`/`hint` nu se propagă. Fiecare scriere: `if (error !== null) throw traduEroare(error);`.
 Formularul de echipament afișează mesajul ISCIR lângă câmpul `responsabil_employee_id` și deschide
 automat câmpul `derogare_motiv` când utilizatorul are can(p,"maintenance:update","all").

STĂRI: fiecare rută cu loading.tsx (SkeletonTable) și error.tsx (StareEroare). Gol ≠ filtrat:
„Niciun echipament înregistrat" + „Adaugă echipament" vs. „Niciun rezultat pentru filtrele alese" +
„Șterge filtrele". Sesizări: „Nu ați trimis nicio sesizare. Dacă un echipament s-a defectat, raportați-l —
durează un minut." + acțiune „Sesizare nouă". Fișa fără contoare: „Nicio citire de contor. Prima citire
fixează punctul de pornire pentru planurile pe contor."
