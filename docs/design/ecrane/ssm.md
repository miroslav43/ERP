# Plan de implementare — ssm

MODUL SSM+PSI — feature "ssm", migrările 0011 + 0021. Resursa RLS = `ssm`, cu DOUĂ excepții:
`ssm_legal_parameters` și `environmental_permits` sunt sub resursa `compliance` (doar org_admin/super_admin).

PRECONDIȚIE DE COMPILARE: adaugă `"ssm:update"` în `PERMISSION_KEYS` (src/config/permissions.ts), după
"ssm:create". `ActionDefinition.permission` e uniunea literală de acolo; fără asta nicio acțiune de UPDATE
nu compilează. Cheia există în seed-ul 0002 (blocul super_admin `cross join unnest(...)`), deci
permissions.test.ts trece. NU adăuga alte chei — alt agent editează același fișier.

FIȘIERE
 src/schemas/ssm.ts
 src/domain/ssm/scadente.ts + scadente.test.ts     (semafor pur: expirat/critic/atentie/ok/niciodata)
 src/domain/ssm/termen-itm.ts + termen-itm.test.ts (data+ora+termen_comunicare_ore → moment limită, ore rămase)
 src/lib/queries/ssm.ts
 src/app/(app)/ssm/{page,loading,error}.tsx · {etichete,erori,actions}.ts · dosarul-meu.tsx
 .../ssm/instruiri/{page,loading,error,filtre-instruiri}.tsx · noua/{page,formular-instruire-bloc}.tsx
 .../ssm/medicina-muncii/{page,loading,error}.tsx · noua/{page,formular-fisa}.tsx
 .../ssm/accidente/{page,loading,error}.tsx · nou/{page,formular-accident}.tsx
 .../ssm/accidente/[id]/{page,loading,error,formular-comunicare-itm}.tsx
 .../ssm/stingatoare/{page,loading,error,filtre-stingatoare}.tsx · nou/{page,formular-stingator}.tsx
 .../ssm/stingatoare/[id]/{page,loading,error,formular-verificare}.tsx
 .../ssm/eip/{page,loading,error,formular-eip}.tsx
 .../ssm/autorizatii/{page,loading,error,formular-autorizatie}.tsx

ECRANE (fiecare: requireUser → requireTenant → requireFeature(org,"ssm") → getPermissionMap → poartă)
 /ssm  poartă can(p,"ssm:read","own") altfel AccesRestrictionat; dacă !can(p,"ssm:read","team")
   → <DosarulMeu/>. Panou org = 6 carduri SEPARATE: „Instruiri SSM", „Instruiri PSI" (NICIODATĂ însumate
   — sunt obligații legale distincte, cu periodicități proprii), „Fișe de aptitudine",
   „Stingătoare — verificare", „— reîncărcare", „— probă de presiune"; plus bandă
   „Accidente necomunicate la ITM" cu numărătoare inversă din domain/ssm/termen-itm.
 /ssm/instruiri  can(p,"ssm:read","team") ȘI can(p,"employees:read","team"); matrice angajați × tipuri,
   cu tab obligatoriu `domeniu` (ssm|psi), implicit „ssm"; niciun ecran nu le amestecă.
 /ssm/instruiri/noua  can(p,"ssm:create","team") — ÎNREGISTRARE ÎN BLOC: un tip, o dată, N angajați.
 /ssm/medicina-muncii  read team; /noua  can(p,"ssm:create","team").
 /ssm/accidente[/nou][/[id]]  read team; creare "ssm:create"/team; comunicare ITM și finalizare cercetare
   can(p,"ssm:update","team").
 /ssm/stingatoare[/nou][/[id]], /ssm/eip, /ssm/autorizatii  read team; scriere "ssm:create"/team.
 [id]: `idDinRuta((await params).id)`; filtre: `filtreDinUrl(schema, parametri)`; ani: `anDinUrl`.

GDPR (art. 9) — NENEGOCIABIL
 • Formularul de fișă de aptitudine NU are câmp de diagnostic și NU trimite `observatii`. Se stochează
   doar `rezultat` (apt|apt_conditionat|inapt_temporar|inapt). Restricțiile apar singure: triggerul AFTER
   `ssm_exam_sync` inserează în `employee_work_restrictions` (generata_automat=true, unic pe
   (organization_id, exam_id)) — NU insera manual restricția, dai 23505.
 • `occupational_diseases` are col=null ⇒ cere ssm:read≥team; nu i se face ecran și nu apare în dosar.
 • Audit pentru fișa medicală: allow doar ["employee_id","tip","data_examinarii","valabil_pana",
   "numar_fisa"]. `rezultat`, `medic`, `unitate_medicala`, `cost` NU intră în audit_logs.
 • DosarulMeu arată doar rândurile proprii — RLS le filtrează prin `ssm_acces(...,employee_id)`; nu se
   adaugă filtru după employee_id în cod (nici nu s-ar putea: employees:read = none pentru `employee`).

INTEROGĂRI — src/lib/queries/ssm.ts (toate cu .eq("organization_id",…) ȘI .is("deleted_at",null):
politicile SELECT din 0011 NU filtrează deleted_at)
 tipuriInstruire(org) → ssm_training_types: id, cod, denumire, domeniu, obligatoriu, activ (.eq activ,true)
 periodicitati(org) → ssm_training_type_periods: training_type_id, periodicitate_luni, durata_minima_ore,
   valabil_de_la (se alege în TS ultima cu valabil_de_la ≤ azi)
 matriceInstruiri(org, filtre): PASUL 1 `listeazaAngajati({organizationId, scope, propriaFisaId, filtre})`
   din @/lib/queries/employees (keyset pe full_name+id, deja scris), cu `propriaFisaId` din `idFisaProprie`
   și scope din `employees:read`. PASUL 2 ssm_trainings `.in("employee_id", idPagina)` select: id,
   employee_id, training_type_id, data_instruirii, durata_ore, urmatoarea_scadenta, semnatura_confirmata,
   `.order("data_instruirii",{ascending:false})`; reducere în TS la cea mai recentă per (employee_id,
   training_type_id). Tip obligatoriu fără niciun rând → stare „niciodată efectuată".
 instruirileMele() → ssm_trainings fără filtru de angajat (RLS restrânge la propriu)
 fiseAptitudine(org, filtre) → occupational_health_exams: id, employee_id, tip, data_examinarii, medic,
   unitate_medicala, rezultat, valabil_pana, numar_fisa (FĂRĂ observatii, FĂRĂ cost)
 restrictiiActive(org) → employee_work_restrictions: id, employee_id, exam_id, sursa, restrictie,
   valabil_de_la, valabil_pana, generata_automat, ridicata_la  `.is("ridicata_la", null)`
 accidente(org, filtre) → work_accidents: id, numar_intern, employee_id, data_producerii, ora_producerii,
   locul, tip, zile_incapacitate, comunicat_la_itm_la, termen_comunicare_ore, cercetare_finalizata_la
 citesteAccident(org,id) → + imprejurari, numar_proces_verbal, urmari, created_at
 stingatoare(org, filtre) → fire_extinguishers: id, cod, tip, masa_kg, cladire, locatie, producator, serie,
   ultima_verificare, ultima_reincarcare, ultima_proba_presiune, scadenta_verificare, scadenta_reincarcare,
   scadenta_proba_presiune, status  — cele trei scadențe se afișează pe trei coloane distincte
 verificariStingator(org, extinguisherId) → fire_extinguisher_checks: id, tip_verificare, data, executant,
   firma_autorizata, rezultat, cost, observatii
 eip(org, filtre) → ppe_issuances: id, employee_id, articol, cod_articol, cantitate, unitate, data_predarii,
   durata_utilizare_luni, data_inlocuirii, semnatura_confirmata, returnat_la
 autorizatiiNominale(org) → personnel_authorizations: id, employee_id, tip, grupa, numar, emitent, emis_la,
   valabil_pana, suspendata_la
 numarScadenteSsm(org) → pentru badge-ul „ssm_expiring" (instruiri + stingătoare + fișe, ≤ 30 zile sau expirate)
 Keyset: cursor base64url cu separatorul scris ca secvența de evadare backslash-u-0-0-0-0, ca în employees.ts.
 NU citi `public.expirables` (politica cere ȘI compliance:read — hr vede zero rânduri).
 NU citi `ssm_legal_parameters` (resursa `compliance`): preavizul e constanta PRAG_AVERTIZARE_ZILE = 30
 din src/domain/ssm/scadente.ts.

SCRIERE — src/app/(app)/ssm/actions.ts (createAction; `organization_id` îl pune acțiunea din
ctx.tenant.organizationId, niciodată clientul; `created_by`/`updated_by` le pune triggerul `set_actor`)
 inregistreazaInstruireBloc  "ssm.training.bulkCreate" · feature "ssm" · permission "ssm:create" ·
   minScope "team" · input { training_type_id, data_instruirii, durata_ore, lector_employee_id|lector_extern,
   tematica, materiale, test_punctaj, observatii, employee_ids: 1..200 } · un singur `.insert([...])` cu N
   rânduri (o instrucțiune ⇒ totul sau nimic) · `.select("id")` e sigur (hr/org_admin au ssm:read=all).
   NU trimite `urmatoarea_scadenta` — triggerul o calculează DOAR când e null.
   revalidate ["/ssm","/ssm/instruiri"] · audit create / ssm_trainings.
 adaugaFisaAptitudine "ssm.healthExam.create" · "ssm:create"/team · employee_id, tip, data_examinarii,
   medic, unitate_medicala, rezultat, valabil_pana, numar_fisa, cost. NU trimite observatii.
 inregistreazaAccident "ssm.accident.create" · "ssm:create"/team · NU trimite `termen_comunicare_ore`.
 comunicaAccidentLaItm și finalizeazaCercetare · "ssm:update"/team · doar comunicat_la_itm_la,
   numar_proces_verbal / cercetare_finalizata_la, urmari, zile_incapacitate.
 adaugaStingator, actualizeazaStingator · "ssm:create" și "ssm:update"/team · cod, tip, masa_kg, cladire,
   locatie, producator, serie, data_punerii_in_functiune, ultima_verificare, ultima_reincarcare,
   ultima_proba_presiune, status. NU trimite cele trei `scadenta_*` — triggerul BEFORE le rescrie integral.
 inregistreazaVerificareStingator "ssm.extinguisher.check" · "ssm:create"/team · inserează DOAR în
   fire_extinguisher_checks (extinguisher_id, tip_verificare ∈ verificare|reincarcare|proba_presiune, data,
   executant, firma_autorizata, rezultat, cost, observatii). Triggerul AFTER actualizează singur
   fire_extinguishers.ultima_* și, prin el, scadențele — fără al doilea update din acțiune.
 predaEip "ssm.ppe.issue" · "ssm:create"/team · NU trimite `data_inlocuirii`.
 adaugaAutorizatieNominala "ssm.personnelAuth.create" · "ssm:create"/team (condiționează ISCIR în mentenanță).
 nomenclatorInstruiri "ssm.trainingTypes.read" · "ssm:read"/"own" · audit view · FĂRĂ `revalidate` ·
   createAdminSupabase() cu `.eq("organization_id", ctx.tenant.organizationId)` — un `employee` NU poate citi
   `ssm_training_types` (col=null ⇒ cere team), iar dosarul propriu ar afișa uuid-uri.
   DosarulMeu (RSC) o apelează direct: `await nomenclatorInstruiri({})`.

P0001 → ECRAN: src/app/(app)/ssm/erori.ts, copie a concedii/erori.ts. `traduEroare(error)`:
 "P0001" → businessRule(error.message.slice(0,300)) — mesajele din 0011/0021 sunt scrise în română pentru
 utilizator („Data instruirii nu poate fi în viitor.", „Comunicarea către ITM nu poate fi anterioară
 producerii accidentului.", „Codul tipului de instruire … produce o cheie de scadență nevalidă…").
 "23505" → mesaj propriu pe tabel (cod de stingător duplicat, autorizație duplicată).
 default → re-aruncă nemodificat (calea generică `mapPostgrestError`). `details`/`hint` nu se propagă.
 Fiecare acțiune: `if (error !== null) throw traduEroare(error);`.

STĂRI: fiecare rută are loading.tsx (SkeletonTable) și error.tsx (StareEroare). Gol ≠ filtrat:
EmptyState „Niciun stingător înregistrat" + acțiune „Adaugă stingător", vs. „Niciun rezultat pentru
filtrele alese" + „Șterge filtrele". Dosar gol: „Nu aveți nicio instruire înregistrată. Anunțați
responsabilul SSM al organizației."
