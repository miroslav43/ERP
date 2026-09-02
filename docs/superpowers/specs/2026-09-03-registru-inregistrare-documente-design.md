# Registrul de înregistrare a documentelor

**Data:** 2026-09-03
**Stare:** aprobat, gata de plan de implementare

Orice document pe care îl produce aplicația primește un număr de înregistrare în
formatul `număr/data` — `437/02.09.2026` — dintr-un registru unic per firmă, cu
contor care se resetează la 1 ianuarie. Registrul e vizibil într-o pagină proprie,
listabilă la un control ITM sau ANAF, și se închide la sfârșitul exercițiului
financiar.

---

## 1. Temeiul legal

Două regimuri se compun. Nu sunt alternative: OMFP 2634/2015 pct. 42 trimite el
însuși la Legea Arhivelor pentru registrul de evidență.

### 1.1 Legea Arhivelor Naționale nr. 16/1996, art. 7

> „Creatorii și deținătorii de documente sunt obligați să înregistreze și să țină
> evidența **tuturor documentelor intrate**, a celor **întocmite pentru uz intern**,
> precum și a celor **ieșite**, potrivit legii."

De aici vine acoperirea pe toate cele trei sensuri, nu doar pe ce emite aplicația.

### 1.2 Instrucțiunile Arhivelor Naționale (Ordin 217/1996), art. 8–9

Art. 8 repetă obligația. Art. 9 dă mecanica, și e sursa listei de coloane:

> „înregistrarea documentelor se face la registratura generală, fie într-un singur
> registru de intrare-ieșire, fie, concomitent, în mai multe, **fără ca numerele de
> înregistrare date documentelor să se repete**."
>
> „Înregistrarea documentelor **începe de la 1 ianuarie și se încheie la 31
> decembrie** ale fiecărui an."
>
> „Înregistrarea documentelor se efectuează **cronologic, în ordinea primirii lor**."
>
> „La înregistrarea documentelor se vor preciza următoarele elemente: numărul de
> înregistrare, data înregistrării, **numărul și data documentului date de emitent**,
> numărul filelor documentului, numărul anexelor, emitentul, conținutul documentului
> în rezumat, compartimentul căruia i s-a repartizat, data expedierii, modul
> rezolvării, destinatarul, **numărul de înregistrare al documentului la care se
> conexează**."
>
> „Documentele care se referă la aceeași problemă **se conexează la primul document
> înregistrat**."
>
> „În cazul documentelor expediate ca răspuns, acestea vor primi numărul de
> înregistrare al documentului la care se răspunde."

### 1.3 OMFP nr. 2634/2015, Anexa 1, pct. 24 — regimul intern de numerotare

> „Entitățile vor asigura un **regim intern de numerotare** a documentelor
> financiar-contabile, astfel:
>
> - persoanele care răspund de organizarea și conducerea contabilității vor desemna,
>   **prin decizie internă scrisă**, o persoană sau mai multe, după caz, care să aibă
>   atribuții privind alocarea și gestionarea numerelor aferente;
> - fiecare document va avea **un număr de ordine sau o serie**, după caz, număr sau
>   serie ce trebuie să fie **secvențial(ă)**, stabilit(ă) de entitate. În alocarea
>   numerelor se va ține cont de **structura organizatorică, respectiv gestiuni,
>   puncte de lucru, sucursale** etc.;
> - entitățile vor emite **proceduri proprii** de stabilire și/sau alocare de numere
>   ori serii, după caz, prin care se va menționa, **pentru fiecare exercițiu
>   financiar, care este numărul sau seria de la care se emite primul document**."

### 1.4 OMFP 2634/2015 pct. 2 și 58 — obligații directe asupra programului

Pct. 2 cere pe fiecare document justificativ, între altele, „**numărul documentului
și data întocmirii acestuia**".

Pct. 58 enumeră criteriile minimale ale programului informatic. Patru dintre ele
sunt constrângeri de implementare, nu recomandări:

| Literă | Text | Ce impune în cod |
| ------ | ---- | ---------------- |
| **d)** | liste „**numerotate în ordine cronologică**, interzicându-se **inserări, intercalări**, precum și orice **eliminări sau adăugări ulterioare**" | registrul e append-only: fără `deleted_at`, fără politică DELETE, fără modificarea numărului sau a datei |
| **h)** | „să nu permită inserări, modificări sau eliminări de date **pentru o perioadă închisă**" | închiderea exercițiului blochează anul (§7) |
| **k)** | listări cu antet care conține: tipul documentului · denumirea entității · perioada · datarea listării · paginarea cronologică · **precizarea programului informatic și a versiunii utilizate** | antetul vederii de tipar (§9) |
| **o)** | să nu permită „**editarea a două sau a mai multor documente de același tip, cu același număr și conținut diferit** de informații **în cadrul aceluiași exercițiu financiar**" | unicitate `(organization_id, an, numar)` |

Pct. 56: „Programele informatice utilizate în activitatea financiar-contabilă trebuie
să asigure **listarea în orice moment** a documentelor financiar-contabile solicitate
de organele de control." — pagina de arhivă e obligatorie, nu opțională.

### 1.5 Codul muncii, art. 81

Angajatorul e obligat să **înregistreze demisia** salariatului; refuzul dă
salariatului dreptul de a o dovedi prin orice mijloc de probă. De aici vine sensul
`intrare` din registru: cererile și demisiile intră și ele.

### 1.6 Termene de păstrare — OMFP 2634/2015 pct. 38–40

- **statele de salarii: 50 de ani**;
- registrele și celelalte documente financiar-contabile: **10 ani** de la încheierea
  exercițiului în cursul căruia au fost întocmite;
- documentele din anexa 4: 5 ani.

Registrul însuși intră la 10 ani. Politicile din `retention_policies` trebuie
verificate să nu-l șteargă mai devreme — vezi §12.

---

## 2. Deciziile luate și de ce

| Decizie | Alegerea | Motivul |
| ------- | -------- | ------- |
| Resetarea contorului | **anuală**, 1 ianuarie | trei surse independente: Ordin 217 art. 9, OMFP pct. 24 („pentru fiecare exercițiu financiar"), OMFP pct. 58 lit. o). Resetarea zilnică ar produce „nr. 1" de ~250 de ori pe an, adică exact ce interzice lit. o) |
| Raportul cu numerele existente | **registru unic PESTE ele** | art. 9 cere în registru **două** coloane distincte: „numărul de înregistrare" și „numărul și data documentului date de emitent". Aplicația are deja al doilea (patru mecanisme); îi lipsea primul. Contractele deja emise rămân valide |
| Acoperirea | **ieșiri + uz intern + intrări** | art. 7 din L16/1996 enumeră toate trei; art. 81 Codul muncii obligă la înregistrarea demisiei |
| Documentele anterioare | **backfill cronologic, o dată, la migrare** | un registru pe 2026 care începe în septembrie e un registru incomplet. Rândurile poartă `inregistrat_retroactiv = true`, ca inspectorul să vadă singur unde se termină hârtia și începe evidența |
| Cine vede arhiva | cheie nouă **`registru:read`** — `org_admin` + `hr` | `hr` **nu are** `compliance:read` în seed. Păzită cu ea, pagina i-ar întoarce zero rânduri fără nicio eroare — chiar omului care emite documentele. Capcana e enumerată în `CLAUDE.md` |
| Închiderea exercițiului | **da**, cu redeschidere posibilă pentru `org_admin`, cu motiv și cicatrice permanentă | pct. 58 lit. h). Varianta „imposibil de redeschis" se rezolvă în practică prin cineva care umblă direct în bază, unde nu se mai vede nimic |

---

## 3. Schema

Migrarea următoare liberă la data scrierii e **0120**. Repo-ul e lucrat de sesiuni
concurente: dacă numele e ocupat la momentul aplicării, **se redenumește migrarea
proprie**, nu cealaltă.

### 3.1 Enum-uri

```sql
create type public.registru_sens as enum ('intrare', 'iesire', 'intern');
create type public.registru_stare_exercitiu as enum ('deschis', 'inchis');
```

### 3.2 `public.registru_documente`

Coloanele în ordinea fixă a proiectului. Cele marcate `← art. 9` există fiindcă le
cere lista din Ordinul 217/1996, nu fiindcă ne trebuie nouă.

```
id                      uuid pk
organization_id         uuid not null → organizations
an                      integer not null            -- exercițiul; parte din cheia unică
numar                   integer not null            -- secvențial, resetat anual
numar_afisat            text not null               -- „437/02.09.2026”, precalculat
data_inregistrare       date not null default app.azi_local()
sens                    public.registru_sens not null
tip_document            text not null
continut_rezumat        text not null               ← art. 9
numar_document_emitent  text                        ← art. 9
data_document_emitent   date                        ← art. 9
emitent                 text                        ← art. 9
destinatar              text                        ← art. 9
numar_file              integer                     ← art. 9
numar_anexe             integer                     ← art. 9
compartiment            text                        ← art. 9
data_expedierii         date                        ← art. 9
mod_rezolvare           text                        ← art. 9
conexat_la              uuid → registru_documente   ← art. 9
entitate_tip            text not null               -- 'hr_issued_documents', …
entitate_id             uuid
punct_lucru_id          uuid → puncte_lucru         ← OMFP pct. 24
inregistrat_retroactiv  boolean not null default false
anulat_la               timestamptz
motiv_anulare           text
created_at/by · updated_at/by
```

**Fără `deleted_at`** — abatere deliberată de la tiparul proiectului. Pct. 58 lit. d)
interzice „eliminări"; un rând de registru se **anulează**, nu se șterge. Consecință
directă: indexurile **nu** sunt parțiale `where deleted_at is null`, spre deosebire
de restul schemei.

**Indexuri:**

```sql
create unique index registru_org_an_numar_uniq
  on public.registru_documente (organization_id, an, numar);

-- Apărarea contra dublei înregistrări. `emiteDocumenteLipsa` e PROIECTAT să fie
-- rulat de două ori (a doua oară nu face nimic); fără indexul ăsta, a doua rulare
-- ar arde numere din registru. La fel, un stat de plată descărcat de trei ori.
--
-- `tip_document` E ÎN CHEIE, și trebuie să fie: din ACEEAȘI `payroll_periods.id`
-- ies patru documente diferite — statul de plată, D112, nota contabilă și ordinul
-- bancar. Fără el, al doilea ar fi respins tăcut ca duplicat al primului și n-ar
-- primi niciodată număr.
create unique index registru_entitate_uniq
  on public.registru_documente (organization_id, tip_document, entitate_tip, entitate_id)
  where entitate_id is not null;

create index registru_org_an_data_idx
  on public.registru_documente (organization_id, an, data_inregistrare desc, numar desc);
create index registru_org_tip_idx
  on public.registru_documente (organization_id, an, tip_document);
```

Indexul unic pe `(organization_id, an, numar)` satisface direct pct. 58 lit. o):
registrul fiind unic pe firmă, nu pot exista două documente „de același tip cu
același număr" în același exercițiu.

### 3.3 `public.registru_exercitii`

```
id · organization_id → organizations · an integer not null
stare                   public.registru_stare_exercitiu not null default 'deschis'
numar_de_pornire        integer not null default 1        ← OMFP pct. 24
inchis_la timestamptz · inchis_de uuid → auth.users
total_inregistrari      integer                            -- fotografie la închidere
amprenta                text                               -- SHA-256 peste registrul anului
redeschis_la timestamptz · redeschis_de uuid · motiv_redeschidere text
created_at/by · updated_at/by
unique (organization_id, an)
```

- `numar_de_pornire` e cerut literal de pct. 24 („numărul de la care se emite primul
  document", per exercițiu). Implicit 1; o firmă migrată din alt sistem pornește de
  la valoarea ei și registrul rămâne continuu.
- `amprenta` face detectabile „adăugările ulterioare" pe care lit. d) le interzice.
  Mecanica nu e nouă: `hr_issued_documents.continut_checksum` face deja asta pentru
  un singur document.

### 3.4 Politici RLS

Trio-ul canonic `_select` / `_insert` / `_update`, **fără politică DELETE**, ca peste
tot în proiect — aici din motiv legal, nu doar de convenție.

- `registru_documente_select` — `app.can(organization_id, 'registru', 'read', 'all')`
- `registru_documente_insert` — numai context de serviciu / definer; interfața nu
  inserează direct (vezi §4)
- `registru_documente_update` — `registru:update`, iar coloanele de numerotare sunt
  înghețate de trigger

### 3.5 Triggerul care îngheață numerotarea

`internal.guard_registru_documente()`, `BEFORE UPDATE`, pe tiparul lui
`internal.guard_notifications()` din `0002_authz.sql`: rescrie din `old` coloanele
care n-au voie să se schimbe — `organization_id`, `an`, `numar`, `numar_afisat`,
`data_inregistrare`, `entitate_tip`, `entitate_id`, `inregistrat_retroactiv`.
Modificabile rămân doar `mod_rezolvare`, `data_expedierii`, `destinatar`,
`compartiment`, `conexat_la`, `anulat_la`, `motiv_anulare`.

Al doilea trigger, `BEFORE INSERT OR UPDATE`, ridică `P0001` dacă anul rândului e
`inchis` (§7).

### 3.6 Bucla `do $$` de final

Per tabelă nouă, exact ca în `0119_kpi_lunar.sql`: `trg_*_actor` (BEFORE INSERT OR
UPDATE, `internal.set_actor()`), `trg_*_updated` (BEFORE UPDATE,
`app.set_updated_at()`), `internal.attach_audit(...)`, apoi
`revoke all … from public, anon`, `grant select, insert, update … to authenticated`,
`revoke delete … from authenticated`.

---

## 4. Alocatorul

### 4.1 Contorul

Refolosește `public.document_sequences` cu `document_type = 'registru_general'` — al
patrulea consumator, după `aloca_numar_inventar` (0010), `aloca_numar_tichet` (0047)
și `aloca_numar_contract` (0098). Un contor nou ar fi a cincea mecanică pentru
aceeași nevoie.

**Anul e în cheia unică `(organization_id, document_type, year)`, deci resetarea pe 1
ianuarie vine din construcție, nu dintr-un job.**

Un singur `insert … on conflict do update … returning`, ca în 0098: fără fereastră
între citire și scriere, deci fără două emiteri simultane cu același număr.

**Capcana `lpad`, preluată din 0098 și obligatorie și aici:** pe ramura fără prefix
**nu se cheamă `lpad`**. În PostgreSQL `lpad` *taie* când șirul e mai lung decât
lungimea cerută — `lpad('10', 1, '0')` întoarce `'1'`. Cu `padding = 1`, de la al
zecelea document al anului numerele s-ar trunchia la prima cifră, ar coliziona pe
indexul unic, iar reîncercările ar arde numere la fiecare apăsare până la epuizare.
Formatul se compune direct: `v_numar::text || '/' || to_char(v_data, 'DD.MM.YYYY')`.

La prima alocare a unui an, contorul pornește de la
`registru_exercitii.numar_de_pornire` dacă rândul există, altfel de la 1.

### 4.2 De ce prin trigger, nu prin apel din interfață

Un `employee` care depune o cerere de concediu produce o **intrare** în registru.
Deci alocatorul nu poate fi păzit de `registru:*` — angajatul nu are și nu trebuie
să aibă cheia aia.

> **Înregistrarea se face din trigger `AFTER INSERT` pe tabela sursă.** Dreptul care
> contează e dreptul de a scrie *documentul*, verificat deja de RLS-ul acelei tabele.
> `internal.inregistreaza_document(...)` e `security definer` și **revocată complet
> de la `authenticated`** — nu se poate chema din TypeScript.

Consecința care contează: **niciun ecran nu poate „uita" să înregistreze.** Cerința
„orice document are număr" devine structurală, nu o disciplină de programator.

### 4.3 Al doilea drum, pentru ce nu e rând în bază

Fluturașul, statul de plată, D112, nota contabilă, ordinul bancar și afișul de punct
de lucru se generează la cerere; nu există INSERT pe care să punem trigger.

**Adeverința de absolvire NU e printre ele.** Verificat în cod: e susținută de
`course_completion_records`, tabelă imutabilă scrisă de trigger la finalizarea
cursului — deci merge pe drumul cu trigger, ca restul. Cu cât mai puține excepții,
cu atât mai puține locuri care pot uita.

`public.inregistreaza_document_generat(p_organization_id, p_tip_document, …)` —
schema `public`, fiindcă `.rpc()` nu ajunge la schema `app` (PostgREST expune doar
`public`; capcana e documentată în `0047`, care există exact ca să repare greșeala
asta din `0045`).

Poarta ei nu e `registru:*`, ci **permisiunea modulului**, dedusă din `p_tip_document`
printr-un `case` explicit, cu scope-ul verificat în cod pe fiecare pagină azi:

| `tip_document` | Poartă | Sursa |
| -------------- | ------ | ----- |
| `fluturas`, `stat_plata`, `d112`, `nota_contabila`, `ordin_bancar` | `payroll:export` all | `api/export/salarizare/*` |
| `afis_punct_lucru` | `departments:update` all | poarta reală a paginii, verificată în `puncte-lucru/[id]/afis/page.tsx:51` — **nu** `organizations:read` |

Un tip necunoscut ridică `P0001`, nu alocă tăcut.

**Regenerarea nu arde numere.** Indexul de idempotență din §3.2 face ca al doilea
apel pe aceeași entitate și același tip să întoarcă rândul existent. Un stat de plată
descărcat de zece ori are un singur număr de înregistrare. Când un document chiar
trebuie reemis, se folosește fluxul care există deja pentru documentele de personal —
anulare + emitere nouă — iar cea nouă primește număr nou.

### 4.4 Idempotența

Ambele drumuri fac `on conflict on constraint registru_entitate_uniq do nothing` și
întorc rândul existent. A doua înregistrare a aceluiași document nu arde număr.

**Golurile sunt permise, repetările nu** — aceeași regulă ca la marcă (0033),
tichete (0047) și contracte (0098). Numărul se consumă chiar dacă operațiunea eșuează
după alocare.

---

## 5. Punctele de conectare

| Sens | Sursă | Tip document | Drum |
| ---- | ----- | ------------ | ---- |
| ieșire | `hr_issued_documents` | `contract_munca`, `fisa_postului`, `nda`, `anexa_proprietate_intelectuala`, `act_aditional_telemunca` | trigger |
| ieșire | `employment_contracts` | `contract_munca` | trigger |
| ieșire | `course_completion_records` → adeverință absolvire | `adeverinta_curs` | trigger |
| ieșire | afiș punct de lucru | `afis_punct_lucru` | RPC din `(app)/puncte-lucru/[id]/afis/page.tsx` |
| ieșire | comunicare ITM accident | `comunicare_itm` | trigger |
| intern | `inventory_allocations` | `pv_predare_primire` | trigger |
| intern | `per_diem_calculations` | `decont_deplasare` | trigger |
| intern | export salarizare | `fluturas`, `stat_plata`, `ordin_bancar`, `nota_contabila`, `d112` | RPC din `api/export/salarizare/*` |
| intern | fișe instruire SSM, autorizații, PV stingătoare | `fisa_instruire`, `autorizatie`, `pv_verificare` | trigger |
| **intrare** | `leave_requests` | `cerere_concediu` | trigger |
| **intrare** | demisii | `demisie` | trigger |

`punct_lucru_id` se completează unde sursa îl are (pontaj, puncte de lucru, inventar);
unde nu, rămâne `null` — pct. 24 cere să se „țină cont" de structura organizatorică,
nu ca fiecare document să aparțină unui punct de lucru.

---

## 6. Backfill

Secțiune proprie în migrare, rulată o singură dată, sub rolul migrării (deci peste
RLS), **per firmă**:

1. adună din toate tabelele din §5 documentele emise în anul curent, cu data lor;
2. le parcurge **în ordine cronologică** — art. 9: „cronologic, în ordinea primirii";
3. alocă 1, 2, 3… pornind de la `numar_de_pornire`, cu `inregistrat_retroactiv = true`;
4. poziționează `document_sequences.next_number` pe `max(numar) + 1`, ca prima
   alocare reală să continue firesc.

Ordinea între documente cu aceeași dată se stabilește după `created_at`, apoi după
`id` — determinist, ca o re-rulare pe bancul local să dea același registru.

Rândurile retroactive se disting vizual în arhivă. Motivul e cel asumat la decizie:
un CIM tipărit și semnat în ianuarie primește acum un număr care nu e pe hârtie;
registrul trebuie să spună asta singur.

---

## 7. Închiderea exercițiului

Acoperă pct. 58 lit. h).

### 7.1 Ce face

`public.inchide_exercitiu_registru(p_organization_id, p_an)` — `security definer`,
schema `public`, poartă `app.can(…, 'registru', 'update', 'all')`:

1. verifică **`p_an < extract(year from app.azi_local())`**;
2. numără înregistrările anului, calculează `amprenta` = SHA-256 peste concatenarea
   ordonată a `(numar, data_inregistrare, tip_document, numar_document_emitent,
   continut_rezumat)`;
3. scrie `stare = 'inchis'`, `inchis_la`, `inchis_de`, `total_inregistrari`, `amprenta`.

**Garda de la pasul 1 ține aplicația în viață.** Fără ea, cineva închide 2026 în
septembrie și din clipa aia nu se mai poate emite niciun contract, nicio adeverință
și niciun stat de plată în toată firma — un buton care oprește aplicația. Refuzul e
`P0001` cu mesaj explicit, nu tăcut.

### 7.2 Ce blochează

`internal.registru_verifica_exercitiu()`, `BEFORE INSERT OR UPDATE` pe
`registru_documente`, ridică `P0001` dacă anul rândului e `inchis`. Blochează și
**anularea** unui rând dintr-un an închis: un document anulat după închidere ar
schimba un registru deja listat la control.

### 7.3 Redeschiderea

`public.redeschide_exercitiu_registru(p_organization_id, p_an, p_motiv)` — aceeași
poartă `registru:update` (deci `org_admin`, nu `hr`), motiv obligatoriu (3–500 de
caractere). Scrie `redeschis_la`, `redeschis_de`, `motiv_redeschidere` și readuce
`stare = 'deschis'`.

**Cicatricea e permanentă:** câmpurile de redeschidere nu se golesc niciodată, iar
arhiva afișează de-acum înainte, pe anul respectiv, „redeschis la … de … motiv …".
O închidere ulterioară le păstrează.

---

## 8. Notificări

Mecanica existentă: funcții `internal.*` `security definer`, revocate de la
`public, anon, authenticated`, care inserează în `public.notifications`.
**Deduplicare prin interogarea notificărilor recente**, ca în `0042` și `0103` — fără
tabelă nouă de „ce am trimis deja", care ar trebui curățată, migrată și explicată.

| Când | Cui | `kind` | Conținut |
| ---- | --- | ------ | -------- |
| job `pg_cron` zilnic, activ **din 15 ianuarie**, cât timp anul precedent e `deschis` | `org_admin` + `hr` activi | `reminder` | „Registrul de documente pe 2026 nu e închis. 1.247 înregistrări." → `/registru?an=2026` |
| `AFTER UPDATE` la închidere | `org_admin` + `hr` | `success` | „Registrul pe 2026 a fost închis de …. 1.247 înregistrări, amprentă `a3f1…`." |
| `AFTER UPDATE` la redeschidere | `org_admin` + `hr` | `warning` | „Registrul pe 2026 a fost **redeschis** de …. Motiv: …" |

Destinatarii se aleg ca în `0056_concedii_hr_nu_aproba.sql`: din
`organization_members` cu `status = 'active'`, `deleted_at is null`,
`user_id is not null`, filtrat pe rol.

**Pe 15 ianuarie, nu pe 1** — oglinda raționamentului din `0103` („pe 25 ale lunii,
nu pe 1: cine primește mementoul în prima zi îl primește deja în întârziere"). Pe 1
ianuarie contabilitatea anului trecut nu e închisă nici la contabil; mementoul ar fi
zgomot. Se repetă săptămânal până când anul e închis.

`pg_cron` se programează sub garda din `0103`:

```sql
if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
  ...
else
  raise warning 'pg_cron nu este disponibil (Postgres gol / CI). Jobul … NU a fost programat.';
end if;
```

Fără ea, `create extension` oprește toată migrarea în CI, unde extensia nu există.

---

## 9. Pagina de arhivă — `/registru`

Modul nou: `src/app/(app)/registru/`.

Preambulul canonic, în ordine: `requireTenant` → `requireFeature(…, "nucleu")` →
`getPermissionMap` → `can(permisiuni, "registru:read", "all")` → `AccesRestrictionat`.
Registrul nu are feature flag propriu — e nucleu, mereu activ.

**Citirile** în `src/lib/queries/registru.ts`: funcții libere, `organizationId` primul
argument, tipuri `readonly`, `.returns<T[]>()`, **cursor keyset base64url pe
`(an, numar)`, nu `.range()`** — cu `max_rows = 1000` care trunchiază tăcut, un
registru de 3000 de rânduri ar arăta complet și n-ar fi.

**Filtre:** an (implicit anul curent) · sens · tip document · interval de date ·
căutare în rezumat și în numărul emitentului.

**Antetul anului:** starea (`Deschis` / `Închis la … de …` / `Redeschis la … de …,
motiv …`), totalul, amprenta, și butonul de închidere — vizibil doar cu
`registru:update`, activ doar pentru un an încheiat, cu confirmare.

**Vederea de tipar** poartă toate cele șase elemente cerute de pct. 58 lit. k):

1. tipul situației — „Registru de intrare-ieșire a documentelor";
2. denumirea entității;
3. perioada la care se referă;
4. data listării;
5. paginare cronologică;
6. **„Administrativo v0.1.0"** — „precizarea programului informatic și a versiunii
   utilizate". Versiunea nu e expusă azi nicăieri în UI; se ia din `package.json` la
   build și se pune într-o constantă de configurare.

**Export** CSV + PDF, păzit de `registru:export`.

**Rândurile anulate rămân vizibile**, tăiate, cu motivul — niciodată ascunse.

---

## 10. Permisiuni

Resursă nouă `registru`, trei acțiuni. Adăugate **în două locuri**: uniunea literală
din `src/config/permissions.ts` **și** seed-ul din migrarea nouă — `0002_authz.sql`
e forward-only și nu se editează, iar sursa de adevăr pentru RLS sunt rândurile din
`role_permissions`, nu tipul din TypeScript. O cheie declarată doar în cod întoarce
`none`, adică refuz tăcut.

| Cheie | `super_admin` | `org_admin` | `hr` | `manager` | `employee` |
| ----- | ------------- | ----------- | ---- | --------- | ---------- |
| `registru:read` | all | all | all | — | — |
| `registru:export` | all | all | all | — | — |
| `registru:update` | all | all | — | — | — |

Absența rândului = refuz.

---

## 11. Verificare

Nimic nu se declară gata fără ieșirea comenzilor.

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — **cu `build`**, care e
   singurul ce prinde granița server/client (`pnpm verify` nu-l include).
2. **Proba reală de scriere per rol** (skill-ul `administrativo-proba`), în tranzacții
   derulate înapoi: că `hr` chiar *poate* deschide registrul și *nu poate* închide
   anul; că `employee` produce o intrare când depune o cerere; că `manager` nu vede
   registrul. Poarta pozitivă e cea care lipsea în Faza 2, când `org_admin` nu putea
   insera un angajat și toate porțile negative treceau.
3. Teste pe alocator:
   - două emiteri simultane nu produc același număr;
   - de la al zecelea document numărul **nu** se trunchiază (regresia `lpad`);
   - `emiteDocumenteLipsa` rulat de două ori nu arde numere;
   - backfill-ul e determinist la re-rulare;
   - un INSERT într-un an închis ridică `P0001`, nu trece tăcut;
   - un UPDATE pe `numar` e ignorat, nu aplicat.
4. `erp-santinela-tenant` înainte de commit — migrarea atinge RLS.
5. Banca locală: `bash .claude/skills/administrativo/scripts/banc-migrare.sh`.
6. Aplicarea pe producție prin **`psql`, byte-exact** (`NOTES.md` §1), cu confirmarea
   explicită a utilizatorului. Nici `supabase db push`, nici
   `mcp__supabase__apply_migration`.

---

## 12. Ce NU face specificația asta

- **Nu generează decizia internă scrisă** cerută de pct. 24, care desemnează nominal
  persoana cu atribuții de alocare a numerelor. Rămâne obligație a firmei, în afara
  aplicației. E un modul mic în sine, pentru o livrare separată.
- **Nu renumerotează** documentele emise înainte de anul curent. Backfill-ul acoperă
  doar exercițiul în curs.
- **Nu schimbă** cele patru numerotări existente (`aloca_numar_contract`,
  `aloca_numar_tichet`, `aloca_numar_inventar`, `generator.ts`). Ele produc „numărul
  documentului dat de emitent" din art. 9; registrul îl consemnează, nu îl înlocuiește.
- **Nu conexează automat** documentele care se referă la aceeași problemă (art. 9,
  „se conexează la primul document înregistrat"). Coloana `conexat_la` există și se
  poate completa manual din arhivă; deducerea automată a legăturii cere o regulă per
  tip de document și n-are o citire evidentă.
- **Nu atinge `retention_policies`.** De verificat separat că nicio politică nu șterge
  registrul înainte de cei 10 ani ai pct. 38 — și că statele de plată nu cad sub cei
  50 de ani. Notat ca risc, nu rezolvat aici.

---

## 13. Riscuri

| Risc | Ce se întâmplă | Cum îl țin în frâu |
| ---- | -------------- | ------------------ |
| `lpad` trunchiază | de la al zecelea document, numerele coliziază și registrul se blochează pentru tot restul anului | ramura fără prefix concatenează direct; test de regresie explicit |
| Închiderea anului curent | nu se mai poate emite niciun document în toată firma | gardă `an < anul curent`, cu `P0001` explicit |
| Un ecran nou uită să înregistreze | document fără număr, exact ce cerea feature-ul să nu existe | înregistrarea e în trigger, nu în cod de interfață; cele șase excepții de la §4.3 sunt enumerate una câte una și testate |
| Dubla înregistrare | numere arse la fiecare re-rulare | index unic pe `(organization_id, entitate_tip, entitate_id)` |
| `registru:read` declarată doar în TypeScript | pagina întoarce zero rânduri fără eroare | seed-ul în migrare e obligatoriu, verificat de proba reală |
| Coliziune de nume de migrare cu altă sesiune | migrarea nu se aplică | `git fetch origin main` înainte; se redenumește **propria** migrare |
| `max_rows = 1000` | registrul mare arată complet și nu e | cursor keyset, nu `.range()` |
