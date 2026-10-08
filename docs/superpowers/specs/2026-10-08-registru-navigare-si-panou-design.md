# Registrul de documente — navigare, panou de detaliu, filtre, sortare, grupare

**Data:** 2026-10-08
**Stare:** aprobat (plan aprobat de Miro în aceeași zi)
**Continuă:** `2026-09-10-registru-acoperire-totala-design.md`

Specificațiile din 3 și 10 septembrie au construit registrul și l-au conectat la
toate sursele. Asta îl face **folosibil**: azi `/registru` e o listă moartă — un tabel
brut fără clic pe rând, fără detaliu, fără legătură spre documentul-sursă sau spre
angajat, cu etichete-cod („Fisa eip"), stări brute (`aprobata`), căutare care sare peste
emitent, fără sortare, grupare sau filtru pe angajat, dosar ori stare, și înghesuit pe
telefon. Nomenclatorul și registrul nu se văd unul pe altul.

---

## 1. Decizii

- **Legătura spre angajat e o coloană, nu o deducție.** Registrul ține emitentul și
  destinatarul ca text (art. 9), iar numele e text liber: doi omonimi, un nume
  schimbat. `registru_documente.angajat_id` e scrisă de alocatorul SQL din aceeași
  coloană-sursă din care lua deja numele (`col_ang` din hartă, `employee_id` la
  documentele emise și contracte), cu backfill pe anii deschiși. Nu e rubrică a
  registrului: listarea pentru inspector n-o arată.
- **Detaliul e un panou lateral peste listă, deschis din URL** (`?doc=<id>`). Lista
  rămâne vizibilă, adresa se partajează, „înapoi" închide panoul. Nu o pagină proprie.
- **Gruparea nu se paginează.** Cu cursor, grupurile s-ar tăia la marginea paginii și
  angajații nu s-ar putea ordona după nume. Se citește tot anul filtrat (plafon
  explicit, marcat), se grupează în TypeScript. Volumele reale: sute pe an, nu mii.
- **Sortarea rămâne keyset**, cu `numar` ca departajator în direcția cheii principale,
  prin helperii comuni din `cursor.ts` extinși cu coloana de departajare.

## 2. Ce construiește

### 2.1 Baza — `0184_registru_angajat.sql`

Coloana `angajat_id` (FK `employees`, `on delete set null`, index neparțial
`(organization_id, an, angajat_id, numar)`); alocatorul `internal.inregistreaza_document`
cu al 14-lea parametru `p_angajat_id` (drop + recreate + revoke — capcana 41); scriitorul
generic transmite `col_ang`; cele două trigger-e dedicate transmit `new.employee_id`;
`public.inregistreaza_document_manual` primește `p_angajat_id` opțional, verificat că e
al firmei; backfill din hartă pe anii deschiși, cu `exists` pe `employees` ca un id orfan
să nu oprească totul; raport al rândurilor rămase în ani închiși. Garda din 0148 nu se
atinge. `inregistreaza_document_generat` nu se atinge.

### 2.2 Ecranul listei

- Etichete complete pentru toate tipurile (sursa textului: coloana `eticheta` din harta 0142) și pentru stările de rezolvare; test de drift care citește migrarea de pe disc.
- Tabelul partajat `Tabel`: sortare din URL pe număr, dată, tip, dosar; carduri pe
  telefon; rândul duce la `?doc=<id>` fără săritură (`scroll: false`, primă în proiect).
- Panoul: rubricile art. 9, dosarul (link spre nomenclator), conexările (ambele sensuri),
  sursa, anularea; „Deschide documentul" (harta pură `legaturi.ts`, cu părinte citit pe
  server pentru cele patru tipuri care îl cer; `null` pentru ce n-are ecran);
  „Angajat" → fișa; PDF inline **la cerere** pentru documentele emise.
- Filtre noi: angajat, dosar, stare (active / anulate / în lucru / rezolvate), sursă
  (automat / manual); căutarea include emitentul și scapă metacaracterele.
- Grupare pe tip / dosar / lună / angajat, prin rânduri de antet în `Tabel`
  (prop nou `grupare`), fără sortare pe antete cât e activă.
- Bandă de cifre pe an (total, intrări, ieșiri, uz intern, anulate, în lucru), fiecare
  un link care pune filtrul; dintr-o singură citire agregată în TypeScript
  (`citesteSumarAn`), care livrează și tipurile, dosarele și contoarele nomenclatorului.

### 2.3 Nomenclatorul și fișa angajatului

Contor „Documente în <an>" per dosar, link spre registrul filtrat; rândul țintit din
registru evidențiat; căutare; ordinea cifrelor romane corectă și de la IX în sus.
Fișa angajatului (tab-ul de documente): „Vezi în registru". Dialogul „Document primit":
câmp opțional „Angajat".

## 3. Ce NU face

- Nu schimbă listarea pentru inspector (`/registru/listare`), politicile RLS, harta
  surselor.
- Nu leagă fluturașul de angajat (`inregistreaza_document_generat` rămâne; pas următor).
- Nu sortează după emitent: coloana e pinuită de garda din 0148 și un `''` existent
  s-ar confunda cu marcajul de NULL al cursorului. Se verifică pe prod înainte.
- Nu aduce închiderea/redeschiderea exercițiului în interfață (acțiunile există fără
  buton — observat, nu cerut).

## 4. Verificare

Bancul local pe 0184 + `tests/rls/proba-registru-angajat.sql` + `izolare.sql`; lanțul
`typecheck · check:server · lint · test` (fără build); teste pe clientul fals pentru
filtre, cursor, sumar, legături, etichete; staging cu contul demo — desktop și 390 px,
`?doc=`, `?grup=tip`, sortare, filtru pe angajat, nomenclator ↔ registru, fișa
angajatului → registru; producția după confirmarea separată a migrării.
