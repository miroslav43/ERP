# Arhiva lunară a pontajului

Data: 2026-09-10
Stare: IMPLEMENTAT. Secțiunile de mai jos descriu ce e în arbore, nu ce s-a plănuit.

## Problema

Pontajul lunilor trecute nu se arhivează în niciun fel. Rândurile rămân în
`attendance_entries` la nesfârșit, iar închiderea lunii e doar o stare pe
`attendance_periods` (`deschisa` → `in_aprobare` → `blocata`), reversibilă prin
`redeschidePerioada`. Nu există niciun document înghețat, niciun fișier
descărcabil și niciun ecran care să arate ce luni sunt acoperite.

La un control ITM se cere foaia colectivă de prezență pe ultimii ani. Astăzi
singurul răspuns e „intrați în aplicație și uitați-vă lună cu lună", ceea ce
nu e un document și nu dovedește că datele n-au fost atinse după închidere.

⚠️ Termenul de păstrare de 5 ani și denumirea documentului („foaie colectivă de
prezență") sunt de confirmat de jurist înainte de a fi scrise ca text de
interfață. Vezi `NOTES.md`.

## Ce se construiește

O tabelă de arhivă care ține instantaneul lunii ca `jsonb`, cu amprentă
SHA-256 și număr din registrul de documente. Instantaneul se produce automat,
din bază, la două momente. Din el se generează fișiere Excel, la cerere. Un
ecran nou arată lunile ultimilor cinci ani și găurile dintre ele.

Nu se construiește: PDF, ștergere după expirarea termenului, semnătură
electronică, arhivare a săptămânilor planificate.

## 1. Tabela

`public.pontaj_arhive_lunare`, migrarea `0134_pontaj_arhiva_lunara.sql`.

Coloane, în ordinea fixă a proiectului: `id`, `organization_id`, `period_id`
(nullable, `on delete restrict`), `an`, `luna`, `versiune`, `motiv`,
`status_perioada`, `continut jsonb`, `checksum text`, `numar_angajati`,
`total_ore`, `total_ore_suplimentare`, `total_ore_noapte`, `inlocuita_de`
(auto-referință), `generat_la`, `generat_de`, apoi coada standard
`created_at`/`created_by`/`updated_at`/`updated_by`/`deleted_at`.

Enum nou: `public.pontaj_arhiva_motiv` cu `blocare`, `matura_lunara`.

Indexuri **parțiale** `where deleted_at is null`:

- unic pe `(organization_id, an, luna, versiune)`
- pe `(organization_id, an desc, luna desc)` pentru listare
- pe `(organization_id, an, luna) where inlocuita_de is null` — versiunea în
  vigoare a lunii, una singură

`period_id` e `on delete restrict`, nu `cascade`: o arhivă e un document, iar
ștergerea perioadei nu are voie s-o ia cu ea.

### Forma lui `continut`

```json
{
  "versiune_format": 1,
  "firma": { "denumire": "...", "cui": "...", "reg_com": "..." },
  "perioada": { "an": 2026, "luna": 8, "zile_in_luna": 31 },
  "angajati": [
    {
      "marca": "0042",
      "nume": "...",
      "functie": "...",
      "departament": "...",
      "zile": [{ "z": 1, "t": "lucratoare", "i": "08:00", "s": "16:30", "o": 8, "sup": 0, "n": 0 }],
      "total": { "ore": 168, "sup": 4, "noapte": 0, "zile_lucrate": 21 }
    }
  ],
  "total_general": { "ore": 7328, "sup": 96, "noapte": 0, "angajati": 46 }
}
```

**CNP-ul și IBAN-ul nu intră**, nici măcar trunchiate. Foaia colectivă nu le
cere, iar `hr_read_sensitive` le păzește exact ca să nu ajungă în fișiere pe
care le duce cineva la un control. `versiune_format` există pentru ca un
generator viitor să știe ce citește fără să ghicească.

Orele nu se recalculează la arhivare: `attendance_entries` le ține deja pe
rând (`ore_lucrate`, `ore_suplimentare`, `ore_noapte`), deci instantaneul e o
agregare, nu o repetare a logicii din `src/domain/attendance/`.

### Amprenta

`checksum` e SHA-256 hex peste textul canonic al lui `continut`, calculat în
aceeași tranzacție cu inserarea. Mecanica e cea de la
`hr_issued_documents.continut_checksum` și `registru_exercitii.amprenta`.

## 2. Cine scrie arhiva

Două intrări, o singură funcție:
`internal.pontaj_arhiveaza_luna(p_organization_id, p_an, p_luna, p_motiv)`,
`security definer`, `search_path = ''`.

- **Trigger `zz_attendance_periods_arhiveaza`** pe `attendance_periods`, `after update`,
  când `new.status = 'blocata'` și `old.status <> 'blocata'`.
- **Job `pg_cron` „pontaj-arhivare-lunara"**, pe 15 ale lunii la 02:00 UTC,
  prin `internal.pontaj_arhiveaza_luni_incheiate()`: pentru fiecare firmă cu
  modulul `attendance` activ, orice lună încheiată din ultimii cinci ani care
  are intrări de pontaj și n-are arhivă în vigoare.

Consecințe deliberate:

- `blocheazaPerioada` **nu se modifică**. Nicio Server Action nouă, niciun
  ecran care poate uita să arhiveze. E argumentul scris în `0120` pentru care
  înregistrarea în registru stă în trigger.
- Prima rulare a jobului recuperează retroactiv istoricul existent.
- O lună fără nicio intrare de pontaj nu produce arhivă. O arhivă goală ar
  spune „am muncit zero ore", ceea ce e o afirmație, nu o absență.
- Ziua 15 e aleasă ca să lase două săptămâni de corecții după încheierea
  lunii. Data e o constantă în migrare, nu o setare de firmă.

Garda pentru `pg_cron` e cea din `0008`, `0042` și `0103`: migrarea rulează și
pe un Postgres gol în CI, unde extensia nu există, iar fără gardă lanțul de
migrări se oprește acolo.

### Versionarea

O lună redeschisă și rearhivată produce un rând nou cu `versiune + 1`. Rândul
vechi primește `inlocuita_de` și rămâne. Nimic nu se suprascrie și nimic nu se
șterge. Fiecare versiune e un document distinct, cu numărul ei de registru.

## 3. Numărul de registru

Funcția de arhivare cheamă `internal.inregistreaza_document` cu
`sens = 'intern'`, `tip_document = 'foaie_colectiva_prezenta'`,
`entitate_tip = 'pontaj_arhive_lunare'`, `entitate_id = <id-ul rândului>`.
Alocatorul e idempotent pe entitate, iar fiecare versiune e un rând propriu,
deci v2 primește număr nou fără să-l atingă pe al lui v1.

Pontajul devine astfel al treilea punct de conectare la registru, după
documentele de personal și contracte.

Numărul nu se copiază în `pontaj_arhive_lunare`: se citește prin join pe
`registru_documente (entitate_tip, entitate_id)`, care are deja index unic.

## 4. Politicile

`enable` + `force row level security`, ca peste tot.

O singură politică: `pontaj_arhive_lunare_select`, pentru `authenticated`, cu
`app.is_platform_admin()` sau apartenență la firmă plus
`app.can(organization_id, 'attendance', 'export', 'all')`.

**Fără politică INSERT și fără UPDATE.** Abatere deliberată de la trioul din
`0013_attendance.sql`, scrisă ca atare în migrare: singurul care scrie e
funcția `security definer`, iar o politică INSERT ar deschide o cale prin care
interfața poate fabrica un document de arhivă. Granturile din bucla `do $$`
dau `select`, nu `insert`/`update`.

Cine ajunge: `org_admin` (are tot, din blocul cross join al lui `0002`) și
`hr` (`('hr','attendance','all','{read,create,update,delete,approve,export}')`).
`manager` are pe `attendance` doar `{read, approve}` la scope `team`, deci nu
vede arhiva. `employee` are scope `own` și nici acțiunea `export`.

`attendance:export` era seedată în bază din `0002`, dar LIPSEA din uniunea
`PERMISSION_KEYS` (`src/config/permissions.ts`) — adică nicio pagină n-o putea
cere fără să pice `tsc`. A fost adăugată aici; poarta care a prins lipsa e
`src/config/docs.test.ts`, care compară cheile folosite în `can()` cu uniunea.

## 5. Ecranul

`/pontaj/arhiva`, preambulul obișnuit: `requireTenant` → `requireFeature` →
`getPermissionMap` → `can(permisiuni, "attendance:export", "all")` →
`AccesRestrictionat`. Filă nouă în banda pontajului, prin `file-pontaj.ts`
(`poateVedeaArhiva`), fiindcă acolo s-a mutat înadins calculul booleenilor.

Conținut: un rând pe lună, ultimii cinci ani, cel mai recent sus. Coloane:
luna, numărul de registru, data arhivării, câți angajați, total ore, un semn
pentru arhivele produse fără blocare și unul pentru lunile fără arhivă.
Butonul de descărcare pe fiecare rând cu arhivă.

Sus, alegerea unui interval și un buton care produce registrul de lucru comasat.

Lunile fără arhivă apar ca rânduri, nu lipsesc din listă. O gaură care nu se
vede e o gaură pe care o găsește inspectorul.

## 6. Fișierele Excel

`src/lib/excel/foaie-colectiva.ts`, cu ExcelJS, care e deja în proiect.
Construiește **numai** din `continut`, niciodată din `attendance_entries`
recitite. O arhivă recompusă din date vii n-ar fi o arhivă.

Două rute, după tiparul din `src/app/api/export/salarizare/`:

- `GET /api/export/pontaj/arhiva?id=<uuid>` — o lună, o filă.
- `GET /api/export/pontaj/arhiva/dosar?de_la=2022-01&pana_la=2026-08` — un
  registru de lucru cu filă de cuprins (luni, numere de registru, amprente) și
  câte o filă pe lună.

Ambele cer `attendance:export` scope `all` și `requireFeature("attendance")`.
Dosarul e plafonat la 60 de luni.

Foaia: un rând pe angajat, o coloană pe zi, plus coloanele de total. Antetul
poartă denumirea firmei, CUI-ul, luna, numărul de registru și amprenta.

## 6bis. Ce a ieșit altfel decât în plan

- **Cheia străină `inlocuita_de` e `deferrable initially deferred`.** Indexul
  unic parțial care lasă o singură versiune în vigoare impune ordinea
  „marchează versiunea veche, apoi inserează noua", iar în clipa acelui UPDATE
  rândul-țintă încă nu există. O cheie străină imediată respinge exact pasul
  care face versionarea posibilă. Găsit de probă la prima rulare; scris în
  `docs/design/ecrane/capcane.md` ca al 40-lea caz.
- **`CODURI_TIP_ZI` a ieșit din `src/app/(app)/pontaj/etichete.ts`** în
  `src/domain/attendance/coduri-zi.ts`. Generatorul de Excel are nevoie de
  aceleași coduri, iar `src/lib/` n-are voie să importe din arborele de rute.
  `etichete.ts` le reexportă, deci niciun consumator existent nu s-a schimbat.
- **Auditul generic NU se atașează pe tabelă.** `internal.audit_trigger` copiază
  rândul întreg în `audit_logs`, iar rândul poartă `continut` — foaia colectivă
  a lunii. Auditul ar fi dublat, lună de lună și firmă de firmă, exact datele pe
  care tabela le păstrează imuabil. Motivul e scris în migrare.

## 7. Testare

- `src/lib/excel/foaie-colectiva.test.ts` — construcția din instantaneu fix:
  numărul de coloane pentru o lună de 28, 30 și 31 de zile, totalurile,
  diacriticele, o lună cu zero angajați.
- `tests/rls/proba-arhiva-pontaj.sql` — paisprezece verificări, rulate de
  `banc-migrare.sh`: cele două porți pozitive (`org_admin` și `hr` CHIAR văd
  arhiva), refuzurile (`manager`, `employee`, cealaltă firmă), triggerul la
  blocare, numărul de registru, versionarea la redeschidere plus reblocare, o
  singură versiune în vigoare, imposibilitatea inserării directe, absența CNP-ului
  din instantaneu și mătura lunară.
- `tests/rls/izolare.sql` — fixture-ul populează tabela prin MOTORUL REAL
  (aceeași funcție pe care o cheamă triggerul), ca verificarea (c) să aibă ce
  compara între cele două firme.

## 8. Fișiere atinse

| Fișier                                              | Ce                             |
| --------------------------------------------------- | ------------------------------ |
| `supabase/migrations/0134_pontaj_arhiva_lunara.sql` | tabelă, funcții, trigger, cron |
| `src/types/database.ts`                             | tipuri regenerate              |
| `src/lib/queries/pontaj-arhiva.ts`                  | citirile                       |
| `src/lib/excel/foaie-colectiva.ts` + testul         | generatorul XLSX               |
| `src/app/api/export/pontaj/arhiva/route.ts`         | o lună                         |
| `src/app/api/export/pontaj/arhiva/dosar/route.ts`   | intervalul                     |
| `src/app/(app)/pontaj/arhiva/page.tsx`              | ecranul                        |
| `src/app/(app)/pontaj/file-pontaj.ts`               | fila nouă                      |
| `NOTES.md`                                          | termenul de 5 ani, cu ⚠️       |
