---
tip: modul
titlu: Mentenanță — ciclul de viață al echipamentului
aliases: [echipamente-ciclu, casare echipament, contoare, etichete QR, responsabil echipament]
cai:
  - "src/app/(app)/mentenanta/echipamente/**"
  - "src/app/(app)/mentenanta/contoare/**"
  - "src/app/api/export/mentenanta/**"
  - "src/app/(portal)/portal/sesizari/echipamentele-mele.tsx"
  - "src/app/(portal)/portal/sesizari/dialog-citire-rapida.tsx"
  - "supabase/migrations/0182_echipamente_ciclu.sql"
  - "tests/rls/proba-echipamente-ciclu.sql"
  - "supabase/migrations/0232_mentenanta_costuri_echipament.sql"
tabele:
  [
    equipment,
    equipment_costuri,
    equipment_meters,
    maintenance_plans,
    iscir_authorizations,
    maintenance_attachments,
    maintenance_settings,
    puncte_lucru,
    fault_reports,
    expirables,
  ]
permisiuni:
  [
    maintenance:read,
    maintenance:create,
    maintenance:update,
    maintenance:delete,
    maintenance:export,
    departments:read,
    employees:read,
    ssm:read,
    audit:read,
  ]
feature: maintenance
capcane: [17, 34, 35, 48, 52, 57]
neverificat:
  - "/mentenanta/echipamente/nou — rută ȘTEARSĂ, citată anume ca să nu fie recreată"
citeste_daca:
  - "casarea sau ștergerea unui utilaj e refuzată → „Ce refuză baza tăcut”"
  - "un responsabil-angajat nu-și vede utilajul sau nu poate citi contorul → „Responsabilul”"
  - "o parte din citirile în lot intră și restul nu → „Server Actions”"
scris_pe: b7a0575f273fdf672d77aa3420bcc140317ea9b9
scris_la: 2026-10-23
tags: [modul, operations]
---

# Mentenanță — ciclul de viață al echipamentului

Extrasă din [[modul/mentenanta]]. Din `0182`, un echipament are categorie, punct de lucru
(FK compusă pe firmă), garanție cu scadență proprie, service de garanție, părinte
(componente), casare cu motiv, marcaj CE, risc specific, folosire în afara sediului și
observații. Stările: `in_functiune`, `in_reparatie`, `in_conservare`, `casat`.

## Rute

| Rută                                                                             | Poartă                                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `/mentenanta/echipamente` (filtre categorie, punct de lucru, ISCIR, responsabil) | `maintenance:read` team; caseta și copierea `update` team                |
| `/mentenanta/echipamente/[id]`                                                   | `maintenance:read` team; scrierile `update` team; ștergerea `delete` all |
| `/mentenanta/echipamente/[id]/eticheta`, `/mentenanta/echipamente/etichete`      | `maintenance:read` team                                                  |
| `/mentenanta/contoare`                                                           | `maintenance:read` team; formularul de lot `update` team                 |
| `/api/export/mentenanta/echipamente`                                             | `maintenance:export` team                                                |
| `/portal/sesizari` → „Echipamentele în grija mea”                                | responsabilul (RLS), citire prin `inregistreazaContor`                   |

Pe cardul din portal, lângă citirea rapidă, „Raportează o defecțiune” duce la caseta de
pe aceeași pagină cu utilajul precompletat — doar cu `maintenance:create` own
(`poateRaporta`, calculat în pagină, implicit `false` în componentă).

Ruta `/mentenanta/echipamente/nou` **nu mai există**: echipamentul nou e caseta de pe
listă (`?echipament=nou`), iar „Adaugă unul la fel” o deschide precompletată din altă
fișă (`?model=<id>`, fără cod, serie, părinte și stare). `FormData` → încărcătură trece
prin `valoriEchipament()`, testată separat, nu prin componentă.

Pe fișa unui utilaj `casat` toate formularele dispar (`poateScrie && !casat`): rămân
datele, istoricul, documentele și eticheta. Se redeschide doar cu „Schimbă starea”.

Drumurile dinspre fișă se decid PER RÂND, nu pe pagină. Numele celui care a citit
contorul, al executantului și al responsabilului de plan devin link prin
`hrefFisaDinHarta`: absența din harta `angajatiDupaId` înseamnă rând ascuns de RLS, deci
nume fără link. Punctul de lucru duce la `/puncte-lucru` și la celelalte echipamente ale
locației doar cu `departments:read`, tipul de autorizare ISCIR la `/ssm/autorizatii` doar
cu modulul `ssm` și `ssm:read` team, iar „Istoricul modificărilor”
(`src/components/audit/istoric-modificari.tsx`) nu randează nimic fără poarta lui
`/setari/audit` — fiecare prin `poateDeschide()`, nu prin booleeni scriși aici. Banda de
file e cea a modulului, nu un `nav-mentenanta` cu booleeni proprii: [[modul/mentenanta]].

Intervențiile și sesizările legate sunt citite cu `limita: 50`, deci au fiecare un „vezi
toate” spre lista proprie filtrată pe utilaj (`?echipament=<id>`). „Sesizare nouă” pe
antetul fișei cere `maintenance:create` own. Planul nou salvat deschide fișa lui
(`laReusita` → `/mentenanta/planuri/[id]`), ca echipamentul nou.

Eticheta QR codifică `/mentenanta/sesizari/noua?echipament=<id>` — forma autocolantelor
deja lipite, păstrată ca redirect. Pe utilajele „folosite în afara sediului” eticheta
poartă ultima verificare legală și scadența (planul `verificare_legala`), fără nume de
persoane: HG 1146 cere dovada, nu identitatea. Tipărirea în lot ia lista filtrată sau o
selecție explicită (`?ids=a,b,c`); peste `MAXIM_ETICHETE` spune că a tăiat, iar din lista
filtrată scoate casatele (din `?ids=` nu).

`/mentenanta/contoare` listează doar ce are cel puțin o citire, restanțele primele, după
`prag_contor_necitit_zile` din `maintenance_settings`; utilajele fără nicio citire stau
separat, cu linkul spre fișă — prima citire fixează punctul de pornire al planurilor pe
contor. Codul fiecărui rând duce la secțiunea `contoare` a fișei (ancora `#contoare`), în
lista read-only și în formularul de lot la fel.

Secțiunea „Documente” a fișei ține cartea tehnică, certificatul CE și manualul în
`maintenance_attachments` (bucket privat, URL-uri semnate scurt de `urlSemnate`);
încărcarea și ștergerea cer `update` team.

## Server Actions

`src/app/(app)/mentenanta/echipamente/actions.ts` (numele exact `actions.ts`, singurul
admis de ESLint pentru clientul admin — folosit doar la punctele de lucru):

| Funcție                                                                              | Permisiune / minScope                  |
| ------------------------------------------------------------------------------------ | -------------------------------------- |
| `schimbaStareEchipament`, `corecteazaCitire`, `anuleazaCitire`, `optiuniPuncteLucru` | `maintenance:update` / team            |
| `stergeEchipament` (codul tastat)                                                    | `maintenance:delete` / all             |
| `inregistreazaCitiri` (lot)                                                          | `maintenance:read` / own — decide baza |

`inregistreazaContor` (în `mentenanta/actions.ts`) a coborât la `read`/own: o face și
responsabilul utilajului, din portal (`dialog-citire-rapida.tsx`, cu `resetare_contor`
fixat pe `false`); cine poate pe ce utilaj decide politica de INSERT.
`optiuniPuncteLucru` trece prin clientul admin fiindcă `puncte_lucru_select` cere
`departments:read`, pe care un responsabil de mentenanță poate să nu-l aibă — altfel
selectorul era tăcut gol (capcana #34 pentru limitele ESLint).

`inregistreazaCitiri` **nu e o tranzacție** (PostgREST nu oferă una peste mai multe
cereri): fiecare rând e un INSERT judecat separat de politică și de gardă, iar acțiunea
întoarce un `RezultatCitireLot` pe rând, cu mesajul gărzii. O valoare greșită nu le
pierde pe celelalte, iar formularul repune în câmp doar refuzatele. Poarta ecranului e
mai strânsă decât a acțiunii (`update` team ca să vezi formularul, `read`/own în
acțiune): la lot decide politica de INSERT, nu harta de permisiuni.

## Ce refuză baza tăcut

- **Casarea cere motiv (≥ 5 caractere) și refuză cât există sesizări deschise**, cu
  numărul lor în mesaj; completează `casat_la` cu azi; dezactivează planurile. Repunerea
  din `casat` curăță data și motivul, dar planurile rămân inactive — se repornesc explicit.
- **Ștergerea logică refuză la fel**, apoi șterge logic planurile și contoarele și
  dezleagă componentele (rămân în evidență, fără părinte). `equipment_select` nu
  filtrează `deleted_at`, deci UPDATE-ul pe `deleted_at` întoarce rândul (capcana #48 nu
  mușcă aici).
- **Părintele**: aceeași firmă, nu el însuși, fără cicluri, cel mult 5 niveluri cu tot cu
  componentele lui — P0001 cu explicația, indiferent cine scrie (integritate, și în context
  de serviciu). Aceeași clasă: responsabilul și departamentul ales sunt ale firmei.
- **Conservarea scoate planurile din `expirables`; casarea scoate și autorizațiile
  ISCIR** (`maintenance_plan_exp` și `iscir_autorizatie_exp` se uită la echipament; planul
  rămâne în scadențe doar pe `in_functiune` și `in_reparatie`). Conservarea NU scoate
  autorizația: expiră oricum, iar repunerea în funcțiune cere una valabilă. Repunerea le
  readuce prin triggerul `equipment_dupa_stare`. Garanția e un rând `equipment`/`garantie`
  (`equipment_exp`), retras când data dispare — și la casare sau ștergere.
- **Resetarea contorului păstrează restul până la țintă**: `equipment_meters_resetare`
  mută `ultima_citire_contor` a planurilor pe acel tip cu diferența, iar `ssm_plan_calc`
  recalculează ținta. Verificat: 1000 → 1500, contor nou de la 20 → țintă 520. Anularea
  sau corectarea unei resetări **desface** mutarea (delta inversă), deci ținta revine la
  1500 — altfel planurile rămâneau pe o referință inventată de o citire ștearsă.
- **Responsabilul** (fișa lui pe `responsabil_employee_id`) vede rândul utilajului VIU și
  citirile lui și poate insera o citire OBIȘNUITĂ — nu o resetare, care mută țintele
  planurilor. Politica de INSERT pe contoare cere `update ≥ team` (din 0150) sau
  responsabilul; pentru toți, utilajul trebuie să fie al firmei și necasat. Un angajat
  oarecare primește 42501 direct prin PostgREST.
- **Resincronizarea scadențelor la schimbarea stării se face direct prin `sync_expirable`**
  (`plan_exp_sync`, `iscir_exp_sync`), nu prin UPDATE pe planuri, iar `ssm_plan_calc`
  recalculează doar când i se schimbă intrările: o scadență restantă nu se mută în viitor
  când utilajul intră în reparație. — capcana #52
- **Punctul de lucru se citea doar prin lista de opțiuni**, iar aceea cere
  `maintenance:update`: fișa arăta „Setat” în loc de nume cuiva care doar citește. Numele
  vine acum din `numelePunctuluiDeLucru` — o citire pe `puncte_lucru`, filtrată pe firmă
  și pe rândul neșters — făcută doar când lista lipsește. Pentru cine n-are
  `departments:read` rezultatul e `null`, fără eroare, iar fișa rămâne la „Setat”. —
  capcana #57
- **Linkul spre sesizarea unei opriri apare doar dacă sesizarea a venit prin RLS**:
  oprirea se vede la scope `team`, sesizarea nu, când raportorul e din afara echipei — se
  verifică în rândurile deja citite, altfel linkul ducea într-un refuz. Același test pe
  caseta „Utilajul nu funcționează” și în istoricul opririlor.
- **Ștergerea logică cere `maintenance:delete = all` în gardă** (nu doar în acțiune), iar
  un echipament șters nu se restaurează din aplicație.
- **Valoarea de achiziție NU stă pe rândul echipamentului** (0232, Y1): îl văd și
  responsabilul și tehnicianul atribuit, iar RLS-ul nu taie coloane. Stă în
  `equipment_costuri` (1:1, fără `deleted_at`, unic total — `on_conflict`), citită de
  `app.poate_vedea_valoarea_echipamentelor`: `maintenance:update = all` sau `read >= team`
  (cheia costurilor intervențiilor). Responsabilul și tehnicianul primesc embed-ul `null`,
  fără eroare. O scrie doar `update = all`: gestionarul pe `team` nu primește câmpul, iar o
  valoare trimisă totuși de el e INTERZIS în acțiune, 42501 în bază. Coloana veche e
  goală, cu CHECK `is null`; o valoare nenulă scrisă în ea se mută (trigger BEFORE), fără
  defectul de upsert al lui 0225 (`[[modul/flota/service-si-costuri]]`). `ec_inainte`
  pune garda de firmă PRIMA: un rând pe firma altcuiva ia 42501 orice id ar purta, fără
  sondă „există echipamentul X acolo?”. Probele: `proba-costuri-compatibilitate.sql` (2),
  `proba-migrari-pe-date.sql` (12).
- **Exportul CSV** e un eveniment de audit (`log_audit_event`, `equipment`), plafonat la
  `MAX_RANDURI` din lista filtrată — iar faptul că a tăiat intră în audit ca `trunchiat`,
  fiindcă în fișier nu se vede.

## Când NU e suficientă pagina asta

- Textul fiecărei verificări: `tests/rls/proba-echipamente-ciclu.sql`.
- Contractul acțiunilor: `echipamente/actions.test.ts`, `actions-echipamente.test.ts`.
- Maparea `FormData` → coloane (bife lipsă, `Number("")`): `valori-echipament.test.ts`.
- Sesizarea ca flux (tehnician, opriri): [[modul/mentenanta/sesizari]].
