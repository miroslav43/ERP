# Auditul „atinge frontendul baza de date direct?" — 21 septembrie 2026

Întrebarea a fost simplă: _atinge vreodată codul care rulează în browser baza de
date direct?_ Răspunsul are două jumătăți, iar a doua e cea care contează.

**Nu, prin cod.** Niciun fișier `"use client"` din proiect nu conține un `.from()`,
un `.rpc()` sau un abonament Realtime. Închiderea tranzitivă a importurilor
pornind din toate cele 329 de intrări de client a fost calculată cu un script, nu
citită cu ochiul: singurul contact cu Supabase erau șapte ecrane care urcau
fișiere în Storage.

**Da, prin acreditări.** Browserului i se dădeau amândouă cheile de care are
nevoie ca să fie un client PostgREST complet: cheia publicabilă, coaptă în
bundle, și sesiunea, lizibilă din `document.cookie` (`httpOnly: false`). Cu ele,
orice bucată de JavaScript de pe origine — inclusiv un XSS sau o extensie — putea
vorbi direct cu baza, ca utilizatorul logat, ocolind toate cele opt straturi din
`createAction`. Nu e o ipoteză: 55 de constatări verificate adversarial arată ce
se poate face pe ușa aia, de la fabricarea orelor de pontaj până la enumerarea
avatarurilor tuturor firmelor-client.

Ușa s-a închis (§2). Ce se putea face prin ea rămâne, în cea mai mare parte,
posibil pentru un utilizator determinat cu instrumentele de dezvoltare deschise
— fiindcă sesiunea lui e a lui, iar cheia publicabilă e publică prin design la
Supabase. Apărarea reală rămâne baza: RLS, triggere, constrângeri (§3).

---

## 1. Cum s-a măsurat

Zece lentile independente, read-only, rulate în paralel, plus un critic de
completitudine; fiecare constatare a trecut apoi prin doi verificatori
adversariali (al treilea la egalitate), cu verdictul implicit „respins" când
dovada nu era concludentă. 124 de agenți, ~4300 de apeluri de unealtă.

| Lentila                 | Ce a urmărit                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| graf-importuri          | închiderea tranzitivă a importurilor din toate intrările `"use client"`, calculată cu script                 |
| iesiri-retea            | fiecare `fetch`/XHR/WebSocket/`sendBeacon`/`<img>`/`window.open` din cod de browser                          |
| incarcari-storage       | cele 7 încărcări și acțiunile lor de pregătire/salvare                                                       |
| acreditari-browser      | cookie-uri, cheia în bundle, CSP                                                                             |
| suprafata-api-live      | granturi, funcții SECURITY DEFINER, pg_graphql, Realtime, bucket-uri (SELECT-uri pe producție)               |
| ocolire-postgrest A/B/C | pentru toate cele 22 de module: reguli impuse DOAR în Server Action                                          |
| injectie-filtre         | șiruri de la client ajunse nescăpate în `.or()`/`.order()`/`.ilike`                                          |
| pasaj-server            | rute `/api/**`, mass-assignment, acțiuni fără `createAction`                                                 |
| critic                  | goluri: GoTrue din browser, `/auth/callback`, service worker, Edge Functions, portal public, învelișul mobil |

Probele de scriere au rulat pe un banc local — `postgres:17-alpine` cu toate cele
145 de migrări aplicate — în `begin; … rollback;`, sub identitatea rolului
potrivit (`set local role authenticated` + `request.jwt.claim.sub`), adică exact
cum execută PostgREST. Pe producție: exclusiv SELECT-uri de catalog.

---

## 2. Ce s-a reparat acum (cod)

### 2.1 Încărcările nu mai cer un client Supabase în browser

Cele șapte ecrane cu fișiere (material de curs, versiune de material, document de
angajat, import de angajați, document de concediu, dovadă de integrare, avatar)
chemau `getBrowserSupabase().storage…uploadToSignedUrl()`. Acum acțiunea de
pregătire întoarce URL-ul semnat întreg, iar clientul face un `PUT` obișnuit:
`src/lib/storage/urca-semnat.ts`, 50 de linii, fără nicio dependență.

Motivul pentru care se putea: tokenul din URL ESTE autorizația. Autorizarea se
face pe server, la semnare, sub sesiunea apelantului; ruta
`object/upload/sign/...` din `storage-api` validează doar semnătura tokenului.

**Măsurat în browser real** (Chromium, serverul de dezvoltare, cont demo):

```
PUT https://<proiect>.supabase.co/storage/v1/object/upload/sign/avatars/…   → 200
PUT https://<proiect>.supabase.co/storage/v1/object/upload/sign/org-documents/… → 200
antete trimise: content-type (atât) — fără apikey, fără Authorization
```

Asta a demontat și justificarea scrisă în `optiuni-cookie.ts`, care ținea cookie-ul
lizibil din JavaScript ca să nu se rupă încărcările.

### 2.2 Sesiunea nu mai e lizibilă din JavaScript

`OPTIUNI_COOKIE.httpOnly` a trecut pe `true`. Reîmprospătarea sesiunii nu suferă:
o face `updateSession()` din `src/proxy.ts`, pe server, la fiecare cerere de
pagină.

**Măsurat:** `document.cookie` nu mai conține niciun jeton; cookie-ul de sesiune
apare în browser cu `httpOnly=true`, iar aplicația funcționează normal.

### 2.3 Cheia publicabilă nu mai ajunge în bundle

Cheia stătea în `clientEnv` (`src/config/env.ts`), iar `env.ts` e importat de
paisprezece module care ajung în browser — deci ștergerea clientului de browser,
singură, n-ar fi scos-o. A trecut în `src/config/cheie-supabase.ts`, marcat
`server-only`. Numele variabilei de mediu rămâne neschimbat (prefixul decide doar
unde poate Next să înlocuiască literalul, nu unde ajunge valoarea), deci
`Dockerfile`, `ci.yml` și mediile de rulare nu se ating.

**Măsurat, după `pnpm build`:** cheia apare în `.next/server/**` (acolo e locul
ei) și în zero din cele 251 de fișiere servite browserului. SDK-ul Supabase
(`createBrowserClient`, `GoTrueClient`, `PostgrestClient`) — absent din bundle.

**Cât valorează, de fapt** (măsurat pe producție, cu sesiunea unui cont demo):

| Cerere către `/rest/v1/profiles`                  | Răspuns                           |
| ------------------------------------------------- | --------------------------------- |
| `apikey` = cheia publicabilă + `Bearer <JWT>`     | 200 (ce face serverul azi)        |
| `apikey` = JWT-ul utilizatorului + `Bearer <JWT>` | 401 `Invalid API key`             |
| doar `Bearer <JWT>`, fără `apikey`                | 401 `No API key found in request` |
| doar `apikey`, fără sesiune                       | 401 `42501` (RLS refuză)          |

Deci fără cheie, JavaScript-ul paginii nu ajunge la PostgREST deloc — gateway-ul
refuză înainte de orice politică. **Dar** cheia e publică prin design: un
utilizator determinat o găsește în tabloul de bord Supabase sau în orice bundle
livrat înainte de azi. Asta face din §2.3 apărare în adâncime, nu o graniță.
Granița rămâne §3.

### 2.4 Porți ca să nu se redeschidă

- `eslint.config.mjs`: `@supabase/ssr` și `@supabase/supabase-js` sunt importabile
  doar în cele trei fabrici din `src/lib/supabase/` (tipurile rămân permise).
- `scripts/checks/cheie-in-bundle.mjs` + `pnpm check:bundle`: caută cheia și
  clasele SDK-ului în tot ce se servește browserului. Rulează în CI după build
  **și în `Dockerfile`** — build-ul din Docker e singurul care coace cheia reală.
- `import "server-only"` adăugat în 21 de module din `src/lib/queries/` care nu-l
  aveau: un import dintr-o componentă de client rupe acum build-ul.
- CSP: `wss://` scos din `connect-src` (nu există Realtime în proiect), originea
  Supabase adăugată la `img-src` (avatarurile veneau de acolo și ar fi dispărut
  în ziua în care politica devenea executorie).

### 2.5 Ce NU s-a schimbat, deliberat

Octeții fișierelor continuă să urce direct din browser în Storage, pe URL semnat.
Un film de curs are 200 MB; trecut prin serverul nostru ar lovi
`client_max_body_size` din nginx și ar ocupa un proces de Node minute întregi.
Un `PUT` cu token semnat, emis după autorizare, nu atinge baza de date — atinge
depozitul de obiecte. La fel, patru ecrane deschid descărcări pe URL-uri semnate
de 60–120 s (`window.open`), fără nicio acreditare în browser.

---

## 3. Baza de date: ce s-a reparat, ce rămâne

Cele 55 de constatări confirmate sunt, aproape toate, forma asta: _regula există
în Server Action, dar nu și în bază_. Cât timp un utilizator își are sesiunea în
browser, ele rămân exploatabile de el însuși, prin instrumentele de dezvoltare.
Fiecare cere o migrare — deci și confirmarea explicită a aplicării pe producție.

### Lotul 1 — izolarea între firme · `0144_izolare_intre_firme.sql`

Scris, aplicat pe bancul local, probat cu `tests/rls/proba-izolare-intre-firme.sql`
(19 verificări, din care 8 POZITIVE), trecut prin revizorul adversarial de tenant.
**Nu e încă aplicat pe producție.**

| F01 | `avatars_select`/`_update` restrânse la folderul propriu sau la membrii administrați (`users:update = all`), plus `owner = auth.uid()` la UPDATE: enumerarea și mutarea între firme dispar |
| F12 | `organization_members_insert` ȘTEARSĂ — apartenența se scrie doar prin `accept_invitation` (consimțământ dovedit) sau cu `service_role` |
| F13 | `app.can_path`: ramura `team` verifică ENTITATEA din cale, nu doar resursa — dar numai pentru `employees` și `leave`, fiindcă la `courses` segmentul 3 e un material, nu o fișă |
| F38 | `notifications_insert` cere ca destinatarul să fie membru activ al organizației scrise |

Revizia adversarială a prins o regresie pozitivă pe care cele 14 verificări
inițiale n-o atingeau: prima formă a lui `can_path` tăia managerului TOT modulul
Cursuri (căile de curs poartă `course_materials.id` în segmentul 3). Proba are
acum și cele trei verificări care o prind.

Verificat read-only pe producție înainte de aplicare: zero căi de concediu și
zero căi de document cu altceva decât o fișă în segmentul 3; cinci avatare, toate
cu `owner` completat; `storage.prefixes` nu există pe proiect (deci enumerarea
trece doar prin `storage.objects`).

### Lotul 2 — marginea platformei · `0145_marginea_platformei.sql`

Aceeași stare: aplicat pe banc, probat cu `tests/rls/proba-marginea-platformei.sql`
(7 verificări), **neaplicat pe producție**.

| F02 | `inregistreaza_organizatie` nu mai e apelabilă de `anon` — doar cu `service_role`, din Server Action. Cât era publică, oricine putea crea un cont CONFIRMAT pe adresa altcuiva, fiindcă funcția primește `token_hash` de la apelant |
| F27 | limitatoarele de rată din bază erau două defecte suprapuse: IP-ul citit era al serverului nostru (o singură găleată pentru toți vizitatorii), iar numărătoarea se derula înapoi la fiecare eșec. Scoase din cele două funcții de scriere; limita reală rămâne cea din `createPublicAction`, pe IP-ul verificat |
| F21 | `revoke all … from anon` pe tabele și secvențe, `revoke truncate/references/trigger` de la `authenticated`, plus `alter default privileges` ca drepturile să nu se întoarcă la următoarea tabelă |
| F24 | `config.toml` trece pe `enable_signup = false`; pe producție comutatorul e în tabloul de bord Supabase și rămâne de apăsat cu mâna |

**Defect nou, găsit în timpul reparației** (nu era în cele 55): `internal.rate_limit_hit`
scrie contorul în aceeași tranzacție din care funcția apelantă apoi aruncă
excepția, deci Postgres îl derulează înapoi. Măsurat: după un `peek_invitation`
cu token inexistent, `rate_limits` rămâne gol. Un limitator care numără doar
reușitele nu apără de ghicit. `peek_invitation` întoarce acum `{"gasit": false}`
în loc să arunce, iar comportamentul e scris în comentariul funcției.

### Lotul 3 — bani și timp · `0146_bani_si_timp.sql`

Aplicat pe banc, probat cu `tests/rls/proba-bani-si-timp.sql` (13 verificări, din
care 5 POZITIVE), **neaplicat pe producție**.

| F05 | `payroll_entries` primește o poartă: scrierile trec doar prin motorul de calcul (`payroll_scrie_rezultate`), marcat cu un steag local de tranzacție. Un PATCH direct cu `net_de_plata` ales de mână e refuzat cu 42501 |
| F06 | orele nu mai pot depăși intervalul declarat; fără interval nu pot trece de norma zilnică din contract, iar sporurile (suplimentare, noapte) cer ceasul. Derivarea reală rămâne în `src/domain/attendance` — nu se duplică în SQL |
| F07, F47 | `overtime_compensation` și `holiday_compensation` nu mai sunt scriibile din client (politici scoase + granturi revocate). Singurul scriitor rămâne triggerul SECURITY DEFINER, exact cum presupunea codul |
| F08 | tranzițiile de diurnă către `in_aprobare`/`aprobata`/`respinsa`/`decontata` cer `per_diem:approve`. Deținătorul rămâne cu ciorna și trimiterea |
| F28 | parțial: `approved_by`, `respins_de`, `decis_de` și `decis_la` se scriu din sesiune, nu din cererea clientului. Auto-aprobarea la pontaj RĂMÂNE — e o decizie scrisă în `app.aproba_pontaj_bloc`, nu un accident (managerul care pontează cu echipa) |

Prima formă a gărzii de la F06 interzicea orice oră fără interval și a fost
prinsă de verificarea `(l)` din `tests/rls/izolare.sql` — singura poartă POZITIVĂ
a proiectului: ziua de homeoffice trecută cu norma întreagă, fără ceas, e o
scriere legitimă a unui `employee`. Plafonul e acum norma, nu zero.

### Loturile 4-5 — rămase

### Critic

| F01 | critic | Bucket-ul `avatars` e deschis între firme: orice cont autentificat listează avatarele TUTUROR firmelor și poate MUTA (deci șterge de la locul lor) pozele membrilor altor firme | `supabase/migrations/0029_avatare.sql` |
| F12 | critic | organization_members: org_admin atașează orice utilizator existent (inclusiv al altei firme) fără invitație și îi citește profilul | `supabase/migrations/0002_authz.sql` |

### Ridicat

| F02 | ridicat | Oricine, fără cont, apelează direct /rest/v1/rpc/inregistreaza_organizatie cu un token_hash ales de el și obține un cont CONFIRMAT pentru orice adresă de e-mail, ca org_admin | `supabase/migrations/0121_inregistrare_publica.sql` |
| F03 | ridicat | role_permissions: PATCH pe member_id (retintire) escaladează permisiuni în propria firmă până la CNP/IBAN, iar org_admin poate fi lăsat fără drepturi ireversibil | `supabase/migrations/0063_permisiuni_per_angajat.sql` |
| F04 | ridicat | Documente HR: șabloanele și documentele deja emise se pot rescrie direct prin PostgREST — sanitizarea HTML și imutabilitatea sunt doar în aplicație (XSS stocat same-origin + falsificare de act semnat) | `src/app/(app)/angajati/sabloane-documente/actions.ts` |
| F05 | ridicat | hr/org_admin scriu direct în payroll_entries (PATCH /rest/v1/payroll_entries) orice sumă, ocolind motorul de calcul, apoi aprobă perioada | `supabase/migrations/0026_payroll.sql` |
| F06 | ridicat | Angajatul își fabrică orele de pontaj (lucrate/suplimentare/noapte) scriind direct în attendance_entries, iar salarizarea le plătește | `src/app/(app)/pontaj/actions.ts` |
| F07 | ridicat | Angajatul scrie în overtime_compensation (tabelă tratată de aplicație drept „doar trigger”), iar valorile alimentează plata orelor suplimentare | `src/lib/queries/payroll.ts` |
| F08 | ridicat | Angajatul își aprobă și își decontează singur propria deplasare (business_trips) prin PATCH direct, ocolind aprobatorul | `src/app/(app)/diurna/actions.ts` |
| F09 | ridicat | Tichete: gărzile de câmp rulează DOAR pe UPDATE, nu pe INSERT, iar câmpurile de conținut nu sunt păzite nici la UPDATE — tichet cu prioritate/aprobare prefabricate și rescriere după aprobare | `src/app/(app)/ticketing/actions.ts` |
| F10 | ridicat | Mentenanță: `maintenance:create=all` (dat pentru sesizări) deschide INSERT direct pe tot catalogul — intervenții, autorizații ISCIR, echipamente, planuri, contoare, PV în registrul oficial | `src/app/(app)/mentenanta/actions.ts` |
| F11 | ridicat | job_descriptions: angajatul își editează conținutul propriei fișe a postului și falsifică semnătura | `supabase/migrations/0005_hr_rls.sql` |
| F13 | ridicat | `app.can_path` tratează scope-ul `team` ca `all`: un manager citește direct din Storage TOATE documentele firmei (confidențiale, certificate medicale, importuri cu CNP/IBAN) | `supabase/migrations/0073_cale_storage_resurse.sql` |
| F14 | ridicat | Suprascriere și inserare directă în Storage ocolind acțiunile: angajatul rescrie documentul concediului deja aprobat, managerul rescrie orice film/PDF de curs, fără rate-limit și fără verificarea de semnătură | `supabase/migrations/0002_authz.sql` |
| F15 | ridicat | `renuntaLaIncarcare` și `salveazaVersiuneFisier` șterg cu service_role orice obiect de curs cu calea primită de la client: managerul distruge fizic fișierele versiunilor publicate, inclusiv ale materialelor în parcurgere | `src/app/(app)/cursuri/actions.ts` |
| F24 | ridicat | Înscrierea prin e-mail e deschisă pe producție, deși aplicația nu folosește signUp: oricine devine `authenticated` și poate ocupa adrese de e-mail | `supabase/config.toml` |
| F27 | ridicat | Limitele de rată din funcțiile anon citesc primul element din X-Forwarded-For (ales de client la apel direct); direct pe RPC, limita serverului nu se aplică deloc | `supabase/migrations/0002_authz.sql` |
| F29 | ridicat | HR (căruia i s-a scos aprobarea concediilor) aprobă direct cererile prin leave:update=all, ocolind fluxul de aprobare | `supabase/migrations/0056_concedii_hr_nu_aproba.sql` |
| F32 | ridicat | checklist_material_reads: predicat RLS tautologic (`ii.employee_id = ii.employee_id`) lasă HR/managerul să confirme „citirea” în locul angajatului | `supabase/migrations/0093_integrare_materiale.sql` |
| F47 | ridicat | holiday_compensation este scriitibilă de client (apărare în adâncime lipsă), deși aplicația o tratează drept „doar trigger” | `src/domain/payroll/etape/compensare-ore.ts` |

### Mediu

| F16 | mediu | Sesiunea Supabase (access_token + refresh_token) e citibilă de orice JS al originii (httpOnly:false), pe un motiv documentat aproape sigur fals: încărcarea pe URL semnat nu folosește sesiunea | `src/lib/supabase/optiuni-cookie.ts` |
| F17 | mediu | Cheia publishable ajunge în JS-ul de client prin 14 puncte de intrare (env.ts, nu doar browser.ts), transformând browserul într-un client PostgREST complet | `src/config/env.ts` |
| F18 | mediu | profiles.avatar_path se scrie direct prin PostgREST cu un URL extern: poza de profil devine pixel de urmărire încărcat în browserele colegilor | `src/lib/avatar/cale.ts` |
| F19 | mediu | Legătura cale↔rând se verifică doar în Server Action: angajatul trimite direct prin PostgREST o cerere de concediu cu documentul altuia sau cu o cale inventată; căile de fișier nu sunt constrânse în bază | `src/app/(app)/concedii/actions.ts` |
| F20 | mediu | gtag.js (GA4) încărcat pe marketing rămâne activ după navigarea soft în autentificare și în aplicație și trimite rutele aplicației (UUID-uri, perioade de salarizare, `?q=<nume>`) la Google, fără consimțământ | `src/app/(marketing)/_componente/analitice.tsx` |
| F21 | mediu | Deriva de GRANT-uri pe producție: privilegiile implicite Supabase dau anon ALL (inclusiv TRUNCATE) pe 24 de tabele public și authenticated TRUNCATE pe 132; bancul local nu reproduce asta | `supabase/migrations/0045_ticketing_it.sql` |
| F22 | mediu | Modulele neactivate nu sunt păzite în RLS: kpi__, employee_evaluations, evaluation_templates și tickets_ se scriu direct chiar dacă firma n-are modulul (ocolire de licențiere) | `supabase/migrations/0119_kpi_lunar.sql` |
| F23 | mediu | `public.log_audit_event` (EXECUTE pentru authenticated) lasă orice membru să fabrice intrări de audit în propria firmă: acțiune/entitate inventate, before/after nescrubbuite, IP falsificat, flood cu organization_id NULL | `supabase/migrations/0002_authz.sql` |
| F26 | mediu | hr, fără registru:update, scrie în registrul legal de documente cu conținut ales liber, prin rpc inregistreaza_document_generat | `supabase/migrations/0142_registru_doar_ce_cere_legea.sql` |
| F28 | mediu | is_manager_of(propriul_id)=true deschide auto-aprobarea propriilor rânduri (zi de pontaj, săptămână, reînvierea concediului respins) — segregare a sarcinilor lipsă doar la pontaj | `supabase/migrations/0143_seful_iese_din_departament.sql` |
| F30 | mediu | Angajatul depune/editează cereri de concediu direct, ocolind plafonul legal anual și interdicția de editare după trimitere | `src/app/(app)/concedii/actions.ts` |
| F31 | mediu | checklist_instance_items: angajatul își bifează pași cu dovadă obligatorie coborând tip_dovada și falsifică cine/când a bifat | `src/app/(app)/onboarding/actions.ts` |
| F33 | mediu | employees: FK către departament/funcție și șeful de departament nu sunt legate de firmă — scurgere de denumiri interne ale altei firme prin instantaneul de pontaj | `src/app/(app)/angajati/actions.ts` |
| F34 | mediu | employees.manager_path scriibil direct — falsifică ierarhia și vizibilitatea pe scope „team” | `supabase/migrations/0005_hr_rls.sql` |
| F35 | mediu | registru_documente: conținutul înregistrării (rezumat, emitent, nr./dată document) rămâne editabil, contrar intenției de imutabilitate | `supabase/migrations/0120_registru_documente.sql` |
| F36 | mediu | employment_contracts: reguli de business (contract încetat imutabil, salariu doar pe contractul activ, salariu ≥ minim) impuse doar în acțiune | `src/app/(app)/angajati/actions.ts` |
| F37 | mediu | Comentarii de tichet: autorul (`autor_employee_id`) se poate falsifica la INSERT — impersonare (aprobare falsă a managerului) în firul tichetului | `src/app/(app)/ticketing/actions.ts` |
| F38 | mediu | Notificări între firme: `notifications_insert` nu verifică apartenența destinatarului la organizația scrisă — injecție de notificare/push spre utilizatori din altă firmă | `src/app/(app)/anunturi/actions.ts` |
| F39 | mediu | Importul de angajați e rupt din 25.08.2026: pasul 1 urcă în `{org}/employees/{batch}/`, pasul 2 cere `{org}/import/{batch}/`, iar fișierul Excel cu CNP/IBAN rămâne definitiv în Storage | `src/app/(app)/angajati/import/actions.ts` |
| F43 | mediu | Obiectele orfane din Storage nu se curăță niciodată: niciun job, nicio politică DELETE, iar singura curățare (cursuri) e cea periculoasă din F15 | `src/app/(app)/concedii/incarcare-document.tsx` |
| F46 | mediu | O zi de pontaj neaprobată dintr-o lună BLOCATĂ poate fi mutată în altă lună schimbând `data` | `supabase/migrations/0013_attendance.sql` |
| F48 | mediu | Cursuri: un manager (courses:update=team) poate finaliza direct lecțiile de test/declarație ale subalternului, ocolind proba, și declanșează emiterea adeverinței imutabile | `src/app/(portal)/portal/cursurile-mele/actions.ts` |
| F49 | mediu | urmatoarea_marca și aloca_numar_tichet: orice membru consumă numere din contoare | `supabase/migrations/0083_fisa_de_angajat_pentru_patron.sql` |

### Scăzut și informativ

| F40 | scazut | CSP-ul e doar Report-Only cu 'unsafe-inline' și nu mai corespunde ieșirilor reale: img-src fără Supabase, connect-src cu Realtime nefolosit — nu apără nici de furtul sesiunii, nici de apelurile directe spre bază | `next.config.ts` |
| F41 | scazut | `getBrowserSupabase()` pornește reîmprospătarea automată de token din browser și rescrie cookie-urile sb-* fără `Secure`, ignorând OPTIUNI_COOKIE; portalul îl folosește, contrar documentației | `src/lib/supabase/browser.ts` |
| F42 | scazut | Nicio poartă automată nu oprește un fișier client să citească din bază: 3 module de citire nu sunt `server-only`, iar clientul de browser e compatibil ca tip cu ServerSupabase | `src/lib/queries/sabloane-documente.ts` |
| F44 | scazut | MIME-ul și mărimea sunt doar declarate: tokenul nu le fixează, concediile și onboarding-ul nu le verifică nici măcar declarat, iar numele și MIME-ul salvate vin de la client | `src/schemas/leave.ts` |
| F45 | scazut | Verificările „anti-traversal” sunt doar `startsWith(prefix)` și nu resping `..`; `fetch` normalizează căile, deci o cale salvată poate indica în afara prefixului | `src/app/(app)/cursuri/actions.ts` |
| F50 | scazut | Confirmarea citirii unui anunț (`announcement_reads.citit_la`) se poate antedata prin PostgREST | `src/app/(app)/anunturi/actions.ts` |
| F51 | scazut | Căutarea de tichete (`?cauta=`) intră nescăpată în `.or()`: o virgulă aruncă PGRST100 și pică pagina, o paranteză taie căutarea tăcut | `src/lib/queries/ticketing.ts` |
| F52 | scazut | Importul de angajați caută departamentul din Excel cu `.or()` nescăpat și ignoră eroarea: denumiri cu virgulă/paranteze dau refuz fals, iar `%`/`*`/`x,id.not.is.null` leagă angajatul de un departament arbitrar | `src/app/(app)/angajati/import/actions.ts` |
| F53 | info | Ocolirea prefetch-ului din proxy.ts e cod mort: Next elimină antetul Next-Router-Prefetch înainte ca proxy-ul să-l vadă, deci updateSession rulează și pe prefetch-uri | `src/proxy.ts` |
| F54 | info | Serverul de dezvoltare de pe :3000 folosește proiectul Supabase de PRODUCȚIE, iar .env.local conține cheia service_role a producției | `.env.local` |
| F55 | info | Cursorul foii colective de pontaj pune `id`-ul NEghilimelat în predicatul keyset: singurul predicat keyset care nu folosește cursor.ts | `src/lib/queries/attendance.ts` |
| F56 | info | Metacaracterele LIKE (`%`, `_` și `*`) nu sunt scăpate în căutări; căutarea de echipament rulează cu clientul admin și `q="%%"` întoarce 10 echipamente arbitrare ale firmei | `src/app/(app)/mentenanta/actions.ts` |

Două constatări ale criticului de completitudine nu sunt în tabel fiindcă au
apărut după verificarea adversarială:

| C6 | scăzut | `public.set_member_avatar` nu validează `p_avatar_path`: un `org_admin` poate pune un URL extern drept avatar, randat ca `<img>` în browserul colegilor | sursa funcției pe producție |
| C8 | info | patru ecrane deschid URL-uri semnate de descărcare cu `window.open` (TTL 60–120 s, fără acreditare) — trafic browser→Supabase care supraviețuiește remedierii | `cursuri`, `angajati`, `concedii`, `onboarding` |

O singură constatare a fost **respinsă** la verificare (F25, re-cheierea unei
invitații în așteptare): verificatorii n-au putut reproduce pasul decisiv.

### Loturi

1. ✅ **Izolare între firme** — `0144`, vezi mai sus.
2. ✅ **Poarta de la marginea platformei** — `0145`, vezi mai sus.
3. ✅ **Bani și timp** — `0146`, vezi mai sus (inclusiv F46: o zi dintr-o lună
   blocată nu mai poate fi mutată în alta).
4. **Documente cu valoare probatorie** — F04 (șabloane și acte emise), F11 (fișa
   postului și semnătura), F26/F35 (registrul legal), F31/F32/F48 (dovezi de
   instruire și integrare), F50 (confirmarea de citire).
5. **Restul** — câmpuri de conținut și derivate scriibile direct (F03, F09, F10,
   F19, F29, F30, F33–F37, F39, F49), plus igienă (F40–F45, F51–F56).

Fiecare lot se probează pe bancul local înainte, cu **probă pozitivă** obligatorie
(„cine are voie tot poate lucra"), nu doar negativă.

---

## 4. Ce nu s-a putut dovedi

- Dacă un străin poate obține azi un JWT de `authenticated` (înscrierea publică
  din tabloul de bord Supabase nu e sub control de versiune). De asta depinde cât
  de gravă e F01.
- Mutarea unui obiect între foldere prin endpoint-ul `/object/move` al Storage:
  dovedită la nivel de politică RLS pe banc, nu pe API-ul real.
- Descărcarea anonimă a unui avatar cunoscându-i calea: bucket-ul e `public=true`,
  dar n-am lovit endpointul de producție ca s-o confirm.

---

## 5. Fișierele atinse de remediere

```
nou:    src/lib/storage/urca-semnat.ts
nou:    src/config/cheie-supabase.ts
nou:    scripts/checks/cheie-in-bundle.mjs
șters:  src/lib/supabase/browser.ts
        src/lib/supabase/{optiuni-cookie,server,middleware}.ts
        src/config/env.ts · next.config.ts · eslint.config.mjs
        Dockerfile · .github/workflows/ci.yml · package.json
        7 ecrane de încărcare + 7 acțiuni de pregătire
        21 de module din src/lib/queries/ (server-only)
```

Lanțul de verificare: `pnpm typecheck && pnpm check:server && pnpm lint &&
pnpm format:check && pnpm test && pnpm build && pnpm check:bundle`.
