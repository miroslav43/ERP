# NOTES — decizii de arhitectură și valori de verificat

Acest fișier are două scopuri: să înregistreze deciziile care nu se citesc din
cod și să țină lista valorilor legale pe care **trebuie să le confirme un
contabil autorizat sau un jurist de dreptul muncii** înainte de a fi folosite
într-un calcul real.

Planul complet aprobat: [`docs/design/00-PLAN-APROBAT.md`](docs/design/00-PLAN-APROBAT.md).

---

## 1. De configurat înainte de a continua

| Ce                            | Stare                        | Acțiune                                                                                                                                                                                                                                              |
| ----------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server MCP Supabase           | ⚠️ per stație                | Proiect `nybmhorngsajoqaxjlbr`, regiune **aws-1-eu-west-1**. Autorizarea OAuth NU se moștenește între mașini: pe una nouă serverul expune doar `authenticate`, iar `execute_sql`/`get_advisors` lipsesc până la parcurgerea fluxului.                |
| Chei Supabase în `.env.local` | ✅ complet                   | URL, cheia publicabilă, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`. Opționale, încă nesetate: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL_ASISTENT`, `REGES_CRON_SECRET`, `RESEND_WEBHOOK_SECRET`.                                              |
| Proiect Supabase de test      | ⛔ neconfigurat              | Testele de izolare RLS își resetează baza; nu pot rula pe proiectul de dezvoltare.                                                                                                                                                                   |
| DNS Resend                    | ⛔ amânat deliberat          | `EMAIL_MODE="test"` până la Faza 11.                                                                                                                                                                                                                 |
| `HR_ENCRYPTION_KEYS`          | ⚠️ chei locale de dezvoltare | Cheile de producție se generează separat și **nu** trec prin repo. Vezi §4.                                                                                                                                                                          |
| Client `psql`                 | ⚠️ per stație                | Singura cale permisă de aplicare a migrărilor. `aplica-cloud.sh` îl caută în PATH, apoi în Postgres.app și `libpq` (macOS) și în `C:\PostgreSQL` (Windows); calea exactă se poate impune cu `ADMINISTRATIVO_PSQL`.                                   |
| `gh` + token GitHub           | ⚠️ per stație                | Fără `gh` nu se poate verifica CI (`gh run list --workflow=documentatie.yml`). Serverul MCP GitHub citește `GITHUB_PERSONAL_ACCESS_TOKEN` din mediu; nesetat, antetul pleacă gol și serverul răspunde 400 „Authorization header is badly formatted". |

### Conexiunea directă la baza din cloud

Regiunea proiectului este **aws-1-eu-west-1**, nu cea implicită. Găsirea ei a
cerut încercarea mai multor endpoint-uri; `db.<ref>.supabase.co` nu rezolvă
deloc (proiectele noi nu mai au IPv4 direct), deci se folosește pooler-ul:

```bash
export PGPASSWORD='<parola bazei>'
psql -h aws-1-eu-west-1.pooler.supabase.com -p 5432 \
     -U postgres.nybmhorngsajoqaxjlbr -d postgres -f supabase/migrations/0001_kernel.sql
```

Migrările se aplică prin `psql`, nu prin MCP: `apply_migration` cere ca SQL-ul
să treacă prin model ca text, iar 104 KB de DDL retranscris este exact locul în
care apare o eroare subtilă imposibil de observat. `psql` trimite fișierul
byte-exact. MCP-ul rămâne util pentru inspecție, advisors și interogări.

**Verificarea că transferul a fost fidel:** tipurile generate din cloud sunt
byte-identice cu cele generate din schema locală.

### Fără Supabase local — decizie a clientului

**Nu se rulează `supabase start` și nu se folosește Docker.** Toate bazele de
date reale (dezvoltare, test, producție) trăiesc în cloud.

Postgres nativ local rămâne însă, ca simplu banc de probă pentru DDL. Distincția
contează: Supabase local înseamnă un stack întreg în Docker (Postgres + GoTrue +
PostgREST + Storage + Studio), pe care clientul nu îl vrea și nu îi este necesar.
Postgres simplu este un singur proces, instalat pe stația pe care s-a scris nota
asta — **nu presupune că există și pe a ta**; pe macOS vine din Postgres.app sau
din `libpq`, ambele în afara PATH-ului implicit. În el o migrare se aplică
în câteva secunde:

```bash
createdb administrativo_check
for f in supabase/migrations/*.sql; do psql -d administrativo_check -v ON_ERROR_STOP=1 -f "$f" || break; done
for b in scripts/checks/*.sql; do psql -d administrativo_check -v ON_ERROR_STOP=1 -f "$b"; done
dropdb administrativo_check
```

Aici se prinde sintaxa greșită, ordinea greșită a obiectelor, un `CHECK` cu
funcție care nu e `IMMUTABLE` — înainte ca migrarea să atingă cloud-ul. Nu se
verifică nimic ce ține de Auth, Storage sau PostgREST; acelea se testează pe
proiectul de test din cloud.

**Versiunea locală este 14, Supabase rulează 17.** Diferența contează pentru
`security_invoker` pe view-uri (cere 15+) și `NULLS NOT DISTINCT` (cere 15+).
Pentru sintaxa de bază este suficientă, iar **CI-ul rulează Postgres 17**, deci
verificarea autoritară există oricum. Dacă vrei să se potrivească:

```bash
brew install postgresql@17 && brew services stop postgresql@14 && brew services start postgresql@17
```

Reguli obligatorii, pentru că plasa locală acoperă doar DDL-ul:

1. **Migrări forward-only.** Nu se editează niciodată o migrare deja aplicată pe
   un proiect din cloud; se scrie una nouă.
2. **Zero modificări din Supabase Studio.** Orice schimbare de schemă trece
   printr-un fișier din `supabase/migrations/`. Verificat prin `supabase db diff`
   în CI: dacă apare o diferență, cineva a modificat din interfață.
3. **Niciun push direct pe `main`.** CI-ul este singura barieră rămasă înaintea
   cloud-ului, deci trebuie să ruleze pe fiecare PR.

---

## 2. Decizii de arhitectură

**Next.js 16, nu 15.** Specificația cerea „Next.js 15+"; `create-next-app@latest`
instalează 16.3.1, versiunea curentă. App Router, RSC și Server Actions sunt
identice. React 19.2 cu React Compiler activ implicit.

**Zod 4.** API-ul de erori diferă de Zod 3: `z.prettifyError()` și
`z.flattenError()` în loc de `error.format()`.

**Cookie-ul de organizație este un _hint neîncrezut_.** Organizația activă nu e
mecanism de securitate, ci filtru de prezentare. Politicile RLS verifică
apartenența direct în `organization_members`, deci un cookie falsificat produce
zero rânduri, nu scurgere. Semnătura HMAC există ca să putem _detecta și
înregistra_ încercarea, nu ca să ne bazăm pe ea.

**`search_path = ''`, nu `= public`.** Verificat empiric la Faza 0: Postgres
stochează `search_path=public`, iar `pg_temp` rămâne căutat înaintea lui — deci
un utilizator autentificat poate umbri un obiect folosit de o funcție
privilegiată. Prima versiune a barierei 1 accepta ambele forme și a fost
corectată abia după ce am construit deliberat funcția vulnerabilă și am
constatat că trece.

**`security_invoker=true` pe fiecare view.** O view obișnuită rulează cu
drepturile creatorului și poate ocoli RLS-ul tabelelor sursă. Opțiunea cere
Postgres 15+; Supabase o are. View-urile rămân însă interzise în orice cale de
securitate — nu se poate atașa `CREATE POLICY` unei view, iar o tabelă sursă
adăugată ulterior fără RLS o găurește tăcut.

**Fără politici `DELETE`.** Soft delete peste tot ⇒ absența politicii plus
`REVOKE DELETE` _este_ regula corectă, nu o omisiune.

**`plpgsql_check` este opțional.** Nu e garantat pe Supabase; bariera 2 îl
folosește dacă există și îl sare altfel, fără să blocheze.

**De verificat la prima migrare:** dacă `pg_partman` este disponibil
(`select * from pg_available_extensions where name = 'pg_partman'`). Partiționarea
`audit_logs` e oricum amânată, deci nu blochează nimic.

---

## 3. Valori legale de confirmat

> Niciuna nu apare hardcodată în cod. Toate trăiesc în tabele de configurare cu
> `valabil_de_la` și istoric. **Marcajul ⚠️ înseamnă: nu folosi în producție
> până nu confirmă contabilul sau juristul.**

### Fiscal — salarizare · `payroll_settings`

⚠️ Cote CAS (inclusiv majorate pentru condiții deosebite/speciale), CASS, impozit
pe venit, CAM angajator · salariu minim brut garantat și minimele sectoriale
(construcții, agroalimentar) · cotă Pilon II și opțiunea de participare · reguli
de rotunjire per contribuție · plafonul legal cumulat al reținerilor din net și
ordinea de prioritate a creanțelor · facilitățile sectoriale (condiții, plafoane,
contribuții scutite — se schimbă frecvent, uneori retroactiv).

### Deducere personală · `payroll_personal_deduction_brackets`

⚠️ Salariul minim de referință · pragurile de venit × număr de persoane în
întreținere · procentele pe fiecare prag și intervalul de degresivitate.

**Întrebări pentru contabil, din calculatorul public** (`/unelte/calculator-salariu`,
auditul din 8 oct 2026). Codul nu se schimbă fără răspuns, iar testele din
`src/lib/unelte/salariu.test.ts` marcate „⚠” fixează comportamentul de azi:

- ⚠️ **Deducerea care cade exact pe 50 de bani.** `grilaDeducerePersonala` și
  `valoareDeducereSub26` rotunjesc ,50 în SUS: 18% × 4.325 = 778,50 → 779;
  15% × 4.050 = 607,50 → 608. Art. 66 Cod fiscal („Stabilirea sumelor fixe”)
  neglijează fracțiunile „de până la 50 de bani inclusiv” → 778, respectiv 607.
  N-am găsit text care să spună dacă art. 66 se aplică unei deduceri calculate
  procentual. Exemplu: brut 4.476–4.525, fără persoane.
- ⚠️ **„Cu vârsta de până la 26 de ani” (art. 77 alin. (10) lit. a)).** Textul nu
  spune dacă luna în care omul împlinește 26 de ani mai intră. Calculatorul nu
  decide: bifa citează legea, iar omul alege. De confirmat cu contabilul ce lună
  e ultima cu deducerea suplimentară.
- ⚠️ **CAS și CASS rotunjite sau nu în baza de impozit.** `calculatePayrollEntry`
  (`src/domain/payroll/calc.ts`, `bazaImpozit`) scade CAS și CASS NErotunjite.
  Brut 4.453: (4.453 − 1.113,25 − 445,30 − 800) × 10% = 209,445 → 209. Cu
  contribuțiile rotunjite întâi (1.113 și 445, cum le declară D112) iese 209,5 →
  210, sau 209 dacă art. 66 se aplică și impozitului. Art. 78 alin. (2) lit. a)
  scade „contribuțiile … datorate”, iar OUG 59/2005 art. 1 rotunjește la leu
  sumele datorate. Diferența e de 1 leu la ~3% din bruturi. Răspunsul mută și
  statele de plată din aplicație, nu doar calculatorul.
- ⚠️ **Timp parțial: diferența până la baza minimă și impozitul angajatului.**
  Calculatorul reține angajatului CAS și CASS pe brutul real, iar diferența până
  la baza minimă (4.125 lei în iulie–decembrie 2026) o pune în costul firmei
  (art. 146 alin. (5^9): „se suportă de către angajator … în numele
  angajatului”). Baza de impozit a angajatului scade doar contribuțiile reținute,
  iar diferența nu e tratată ca venit al lui. De confirmat ambele: 4 ore, brut
  2.163 → impozit 54, net 1.352, firma plătește 490 + 197.

### Tichete de masă · `payroll_settings`

⚠️ Valoarea maximă legală (se actualizează prin ordin) · regimul fiscal (ce
contribuții se aplică — schimbat de mai multe ori în ultimii ani) · plafonul
lunar cumulat al veniturilor neimpozabile și **ordinea de includere** în el.

Din calculatorul public (8 oct 2026; sursele reverificate pe 9 oct 2026):

- ⚠️ **Tichetele în „venitul brut lunar” al grilei art. 77 alin. (4).**
  Calculatorul public le include: art. 76 alin. (3) lit. h) le face venit
  salarial, iar OUG 89/2025 art. III alin. (1) lit. b) le scoate explicit doar
  din plafonul facilității, semn că implicit intră. Motorul produsului
  (`cautaPragDeducere(…, brut)` în `src/domain/payroll/calc.ts`) NU le include.
  Brut 5.000 + 20 × 45 lei: grila pe 5.900 dă 173 lei, pe 5.000 ar da 562 — 39 de
  lei de impozit diferență. După răspuns, cele două se aliniază.
- ⚠️ **Valoarea maximă după septembrie 2026.** Legea 165/2018 art. 14 spune 45 de
  lei; art. II din Legea 201/2025 o ține până în septembrie 2026, apoi art. 32
  permite indexarea prin ordin comun. N-am găsit ordinul pe legislatie.just.ro
  pe 9 oct 2026 (forma consolidată tot din 01.12.2025). Calculatorul avertizează peste 45, nu refuză
  (`TICHET_MASA_VALOARE_MAXIMA`).

### Timp de muncă · `attendance_settings`, `payroll_settings`

⚠️ Procent minim ore suplimentare · spor de noapte, interval nocturn, prag de ore
· spor weekend · **spor sărbătoare legală** și termenul zilei libere
compensatorii · durata maximă săptămânală cu ore suplimentare și perioada de
referință · repausul minim între zile și cel săptămânal · termenul de compensare
cu ore libere · interdicțiile de ore suplimentare (sub 18 ani, part-time) ·
pauza obligatorie.

### Arhivarea pontajului · `pontaj_arhive_lunare`

⚠️ **Termenul de păstrare a foilor colective de prezență.** Aplicația desenează
azi o fereastră de **5 ani** (`ANI_PASTRARE` din `src/lib/queries/pontaj-arhiva.ts`),
la cererea utilizatorului. Nomenclatorul de dosare din `0135` scrie însă **10 ani**
pentru rândul „Foi colective de prezență", după anexa nr. 1 la Ordinul 217/1996.
Cele două trebuie împăcate de jurist: fereastra ecranului e o constantă într-un
singur loc, iar arhiva nu șterge nimic — deci mărirea ferestrei nu pierde date.

⚠️ De confirmat și denumirea documentului („foaie colectivă de prezență") și dacă
forma cerută la un control ITM are coloane obligatorii pe care instantaneul nu le
poartă. Instantaneul NU conține CNP, deliberat.

### Concedii · `leave_types`, `leave_entitlement_rules`, `medical_leave_codes`

⚠️ Minimul de zile CO/an și zilele suplimentare pe categorii (condiții deosebite,
nevăzători, sub 18 ani) · zilele pentru evenimente familiale (căsătorie, naștere,
deces, donator de sânge, îngrijitor, paternal) · durata concediului de
maternitate și de creștere a copilului, în zile **calendaristice** · termenul și
modul de reportare · codurile de indemnizație CM (procent, zile suportate de
angajator, plătitor, luni pentru baza de calcul, plafon) · baza de calcul a
indemnizației de concediu de odihnă.

**Fără regulă legală:** modul de rotunjire a acumulării proporționale nu este
stabilit de lege — se ia din CCM sau din regulamentul intern al fiecărei firme.
Este configurabil tocmai de aceea.

### Sărbători legale · `public_holidays`

⚠️ Lista zilelor fixe și a celor mobile (offset față de **Paștele ortodox**, nu
cel catolic). Lista **s-a modificat prin lege** de mai multe ori. Datele din
mențiunile formei consolidate a Codului muncii (legislatie.just.ro, consolidarea
din 27.04.2026, citită pe 8 oct 2026): 24 ianuarie de la 16.10.2016 (Legea
176/2016, care rescrie alin. (1)), 1 iunie de la 21.11.2016 (Legea 220/2016),
Vinerea Mare de la 16.03.2018 (Legea 64/2018), 6 și 7 ianuarie de la 09.03.2023
(Legea 52/2023, MO 186/06.03.2023). `src/domain/calendar/sarbatori.ts` și
`src/domain/reges/evenimente.ts` aplică aceste date; seed-ul `public_holidays`
începe în 2024, deci nu e atins. Comentariul tabelei din `0009_leave.sql` („6 și
7 ianuarie … din 2016”) e greșit și rămâne așa: migrarea e aplicată. Se adaugă și
zilele pentru salariații aparținând altor culte religioase legale.

### Unealta publică „Cerere de concediu” · `unelte/cerere-concediu-de-odihna/variante.ts`

⚠️ Valorile scrise în documentul generat, verificate pe 8 oct 2026 pe formele
consolidate de pe legislatie.just.ro, de confirmat de jurist: concediul paternal
de 10 zile lucrătoare + 5 cu atestatul de puericultură, în primele 8 săptămâni
de la naștere (Legea 210/1999 art. 2 și 4, documentul 20488, ultima modificare
OUG 117/2022, aprobată prin Legea 196/2024) · concediul de îngrijitor de 5 zile
lucrătoare pe an (art. 152¹ CM) · concediul plătit pentru formare de până la 10
zile lucrătoare sau 80 de ore (art. 157 CM) · fracțiunea de 10 zile lucrătoare
neîntrerupte (art. 148 alin. (5) CM) · zilele pentru evenimente din HG 250/1992
art. 24 (5/3/3), afișate doar ca REPER pentru bugetari.

**Confirmat de jurist (9 oct 2026):** interpretarea art. 139 alin. (2¹) și (3¹)
din Codul muncii (documentul 128647 pe legislatie.just.ro): salariatul de alt cult
creștin primește Vinerea Mare, Paștele și Rusaliile la datele cultului, ÎN LOCUL
celor ortodoxe, deci unealta numără datele ortodoxe ca zile lucrătoare pentru el
(`src/domain/calendar/sarbatori-cult.ts`). Temeiul rămâne citat pe pagină.

**Fără regulă legală:** proporția „drept ÷ 12 × lunile lucrate” din
`/unelte/calculator-zile-concediu` — practică, nu articol (ca la `leave_types`).

### Diurne · `per_diem_policies`, `per_diem_country_rates`

⚠️ Baremul intern pentru instituții publice și multiplul de plafonare · baremul
pe țări (structură HG 518/1995, **importat ca date, nu scris în cod**) · plafonul
raportat la salariile de bază · pragul de ore pentru zi întreagă sau jumătate de
zi (regulament intern) · tariful pe kilometru pentru autoturismul personal ·
regimul detașării transnaționale.

Din `0147_diurna_valori_legale.sql`, nivelul pentru instituții publice, multiplul
de plafonare (2,5) și plafonul lunar (3 salarii de bază) NU mai sunt alese de
firmă: stau în `per_diem_valori_legale` (global, versionat, scris doar de
platformă) și un trigger le copiază în fiecare versiune de politică. Seed:
20 lei de la 01.07.2018 (HG 714/2018), 23 lei de la 01.04.2023 (Ordinul
1235/2023). Când se schimbă legea, se adaugă un rând — nu se editează.

⚠️ **De confirmat de contabil, cu prioritate — plafonul lunar al diurnei are două
citiri în cod** (găsit pe 23 sept 2026, NEreparat, fiindcă decizia e juridică):

- Salarizarea trimite `per_diem_valori_legale.plafon_salarii_baza_luna` (= **3**,
  un NUMĂR de salarii) în `fractiePlafonLunar` (`src/lib/queries/payroll.ts:1527`
  → `src/app/(app)/salarizare/actions.ts:537`), iar
  `src/domain/payroll/etape/diurna-plafoane.ts:316` calculează
  `plafonLunar = salariuBaza × 3` pentru TOATĂ luna, fără proratare.
- Tipul și comentariile funcției descriu o FRACȚIE („ex. 0.33") — plafonul comun
  de 33% din art. 76 alin. (4^1), Legea 72/2022, împărțit între diurnă,
  telemuncă, abonamente, Pilonul III.
- Ghidul public (`src/content/legal/diurna.ts:98-100`) citează regula ca 3 salarii
  de bază **÷ zilele lucrătoare ale lunii × zilele de delegare**, calculată distinct
  pe lună. După citirea asta, o delegare de 5 zile într-o lună cu 21 de zile
  lucrătoare are plafonul ≈ 0,71 × salariul, iar codul admite 3 × salariul —
  diurnă neimpozabilă mai mare decât cea legală, adică impozit și contribuții
  reținute în minus.

Întrebările pentru contabil: care e textul în vigoare pentru plafonul lunar (3
salarii proratate pe zilele de delegare, 33% comun, sau amândouă, pe articole
diferite)? Se prorează? Până la răspuns, calculul rămâne cum e.

### SSM / PSI / ISCIR

⚠️ Periodicitatea instruirii SSM (introductivă, la locul de muncă, periodică) ·
periodicitatea instruirii PSI, **obligație separată de SSM** · intervalele de
verificare a stingătoarelor (verificare, reîncărcare, probă de presiune, per tip)
· periodicitatea examenelor de medicina muncii pe categorii de post · termenul de
comunicare a unui accident de muncă la ITM · pragul de salariați de la care CSSM
devine obligatoriu · pragul pentru cota de angajare a persoanelor cu handicap și
plata compensatorie · periodicitățile de verificare tehnică ISCIR · duratele de
utilizare a echipamentului individual de protecție.

### Foaia de parcurs · unealta publică `/unelte/foaie-de-parcurs`

Fără tabelă: unealta nu citește și nu scrie în bază. Verificat pe 8 oct 2026 pe
formele consolidate de pe legislatie.just.ro, descărcate cu `curl`:

- Codul fiscal (`DetaliiDocument/171282`, consolidat la 08.08.2026): art. 25
  alin. (3) lit. l) pct. 1–5 (50% la impozitul pe profit, ≤ 3.500 kg, ≤ 9 scaune,
  fără amortizare) și art. 298 alin. (1)–(3) (50% la TVA, aceleași excepții, plus
  închirierea și leasingul la lit. e)).
- Normele HG 1/2016 (`DetaliiDocument/212504`, consolidat la 31.03.2026): titlul
  II pct. 16 alin. (2) și titlul VII pct. 68 alin. (2) cer în foaia de parcurs
  „cel puțin … categoria de vehicul utilizat, scopul și locul deplasării,
  kilometrii parcurși, norma proprie de consum carburant pe kilometru parcurs”;
  pct. 68 alin. (4): la deducerea de 50% nu se cere foaia; alin. (8): încadrarea
  o face firma.
- OMFP 2634/2015 (`DetaliiDocument/173682`, consolidat la 01.08.2024): fără model
  de foaie de parcurs; anexa 1 pct. 2–3 cere numărul, data și CIF-ul pe orice
  document justificativ.

⚠️ **„Categoria de vehicul”** nu e definită în norme. Unealta scrie tipul
vehiculului (lista din modulul Flotă) și, separat, utilizarea cu temeiul din
art. 25/298. De confirmat cu contabilul dacă ANAF se așteaptă la categoria
omologată (M1, N1) sau la categoria de utilizare.

⚠️ Dacă lipsa unui singur element duce, singură, la pierderea deducerii: nicio
soluție ANAF sau jurisprudență verificată.

⚠️ Transportul rutier profesional (tahograf, FAZ, actele Ministerului
Transporturilor): neverificat pe sursă primară; pagina spune doar că modelul nu
le acoperă. Anexele OMFP au fost citite prin `DetaliiDocumentAfis`, care poate
servi o formă veche (memoria `portal-legislativ-consolidari`).

### Flotă — fiscal · `vehicle_fiscal_regimes`, `vehicle_consumption_norms`, `organizations.regim_impozitare`

Migrarea `0202_flota_fiscal.sql`. Verificat pe 12 oct 2026 pe formele consolidate
de pe legislatie.just.ro, descărcate cu `curl` și citite ca text (memoria
`portal-legislativ-consolidari`: `DetaliiDocumentAfis` poate servi o formă veche):
Codul fiscal `DetaliiDocument/312601` (consolidarea din 08.08.2026) și HG 1/2016
`DetaliiDocument/307847` (consolidarea din 31.03.2026).

| Valoare / regulă din aplicație                                                              | Temei verificat                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 50% din cheltuieli, ≤ 3.500 kg, ≤ 9 scaune cu șoferul                                       | Codul fiscal art. 25 alin. (3) lit. l); la TVA art. 298 alin. (1)–(2)                                                                                                                                           |
| Cele cinci excepții (`vehicle_exceptie_fiscala`)                                            | art. 25 alin. (3) lit. l) pct. 1–5: urgență/pază/curierat; agenți de vânzări și de achiziții; transport de persoane cu plată; servicii cu plată (închiriere, școli de șoferi); vehicule-marfă în scop comercial |
| Foaia de parcurs cerută doar la deducerea integrală                                         | HG 1/2016 titlul II pct. 16 alin. (2) (impozit pe profit); titlul VII pct. 68 alin. (2) (TVA, vehicul exclusiv economic); pct. 68 alin. (4): cine aplică 50% nu face dovada cu foaia                            |
| Încadrarea o face firma                                                                     | HG 1/2016 titlul VII pct. 68 alin. (8)                                                                                                                                                                          |
| Folosința personală: neimpozabilă la 50%                                                    | Codul fiscal art. 76 alin. (4) lit. ț); HG 1/2016 titlul IV pct. 12 alin. (6) lit. a) teza finală                                                                                                               |
| Folosința personală: neimpozabilă la micro / specific                                       | Codul fiscal art. 76 alin. (4) lit. ț^1) (vehiculele „prevăzute la art. 25 alin. (3) lit. l) care nu sunt utilizate exclusiv în scopul activității economice”)                                                  |
| Avantajul în natură: 1,7% pe lună din valoarea de intrare, sau chiria vehiculului închiriat | HG 1/2016 titlul IV pct. 12 alin. (5) lit. a) (folosirea NUMAI în scop personal); alin. (6) lit. a): la folosința mixtă, proporțional cu kilometrii personali din total                                         |
| Folosința personală a unui bun din patrimoniu e avantaj                                     | Codul fiscal art. 76 alin. (3) lit. a)                                                                                                                                                                          |

**Unde stau valorile.** Spre deosebire de restul acestei secțiuni, trei valori legale
sunt scrise în cod, cu temei în comentariu, nu în tabele cu `valabil_de_la`: 1,7%
(`PROCENT_AVANTAJ_LUNAR`), pragurile de 3.500 kg și 9 locuri (`src/domain/fleet/fiscal.ts`
și triggerul `internal.flota_fiscal_inainte`). Sunt text de lege stabil, nu cuantumuri
indexate; o modificare a legii cere o editare de cod și o migrare nouă.

**Ce NU face aplicația.** Avantajul în natură e doar SUGESTIE pe fișa angajatului
(`payroll:read = all`): nimic nu se scrie pe statul de plată, iar componenta
`beneficiu_natura` se adaugă de mână. Încadrarea vehiculului în regim o alege omul;
baza refuză doar „peste 3.500 kg” pe un vehicul pe care îl știe ușor (fișa are masa
și locurile), restul sunt avertismente.

⚠️ **„Categoria vehiculului” de pe foaia de parcurs** (HG 1/2016 pct. 16 alin. (2):
„categoria de vehicul utilizat”) nu e definită în norme. Foaia fixează la trimitere
`vehicles.categorie` (tipul din fișă: autoturism, autoutilitară…). **Nu s-a decis**
dacă ANAF se așteaptă la categoria omologată (M1, N1) sau la categoria de utilizare;
nu există setare pentru asta. De confirmat cu contabilul, ca și la unealta publică de
mai sus; dacă răspunsul e „omologată”, se adaugă o coloană pe `vehicles`.

⚠️ **Regimul de impozitare al firmei** (micro / profit / specific) decide dacă se
sugerează avantajul; coloana e opțională, iar nestabilită dă „incomplet”, nu un calcul.
Rămâne de confirmat cu contabilul cum se tratează o firmă care trece de la micro la
profit în mijlocul lunii: regimul firmei e cel curent, nu o serie istorică (spre deosebire de
regimul vehiculului, care e pe perioade).

⚠️ **Vehicul peste 3.500 kg / 9 locuri la o firmă micro sau pe impozit specific.** Planul
cere „firmă non-micro” pentru sugestie, iar aplicația îl respectă (nicio sumă). Textul
lit. ț^1) privește însă doar vehiculele „prevăzute la art. 25 alin. (3) lit. l)”, adică
cele de până la 3.500 kg și 9 scaune: la un vehicul mai mare, scutirea nu rezultă
literal. Ecranul spune asta lângă motiv; de confirmat cu contabilul.

⚠️ **Lună parțială.** Norma dă 1,7% „pentru fiecare lună”, fără regulă pe zile. Sugestia
e pe lună întreagă și ecranul arată intervalul alocării; proporționarea pe zile (sau pe
kilometri personali, care nu se înregistrează nicăieri) se stabilește cu contabilul.
Același text spune: alin. (5) privește folosirea NUMAI în scop personal, alin. (6)
folosința mixtă (proporțional cu kilometrii personali).

⚠️ **Leasingul operațional** se evaluează ca închiriere, la nivelul chiriei lunare
completate de om (rata lunară); textul nu pomenește leasingul, deci e interpretare.

⚠️ **Mașina personală folosită în interes de serviciu** (`comodat` sau
`chirie_persoana_fizica`): aplicația reține proprietarul, chiria și contractul și NU
sugerează avantaj (mașina nu e un bun al firmei pus la dispoziția angajatului). Tratamentul
fiscal al decontului pe baza foii de parcurs (cheltuială deductibilă, regimul chiriei,
impozitarea la persoana fizică) nu e verificat pe sursă primară.

⚠️ **Foaia pentru vehiculele exceptate.** La TVA, pct. 68 alin. (7) cere foaia doar pentru
art. 298 alin. (3) lit. a) (urgență, pază, curierat); pentru celelalte excepții admite „orice
alte dovezi”. La impozitul pe profit, pct. 16 alin. (2) o cere general pentru deducerea
integrală. Aplicația cere foaia pentru orice regim diferit de 50% (verdictul „fără foi”).
La firma micro, impozitul nu depinde de deductibilitate, deci foaia contează doar la TVA.
De confirmat cu contabilul cât de dur să fie verdictul.

⚠️ **Verdictul lunii numără foile pe luna întreagă, nu pe zile.** `flota_fiscal_luna`
numără zilele cu deducere integrală după regimul fiecărei zile, dar foile aprobate și
neaprobate pe toată luna: „Fără foi” înseamnă nicio foaie în lună. La o lună mixtă (50%, apoi
integral), o foaie din zilele de 50% acoperă în verdict și zilele cu deducere integrală. E un
semnal de control, nu o dovadă zi cu zi; dacă contabilul cere acoperirea pe zile, foile se
leagă de regimul zilei lor (schimbare în funcția SQL, cu tipuri regenerate).

⚠️ **Regimul „exclusiv în scopul activității economice”** (art. 298 alin. (1) și pct. 68
alin. (2)) cere ca vehiculul să nu aibă deloc folosință personală; aplicația îl acceptă
alături de o alocare cu folosință personală, dar cu avertisment („deducerea integrală e
expusă”). Dacă firma dovedește folosirea exclusivă, regimul rămâne al ei.

### Flotă — amenzi și daune · `vehicle_fines`, `vehicle_incidents`

Migrarea `0203_flota_amenzi_daune.sql`. Verificat pe 12 oct 2026 pe formele consolidate
de pe legislatie.just.ro, descărcate cu `curl` și citite ca text (memoria
`portal-legislativ-consolidari`): OUG 195/2002 `DetaliiDocument/311629` (consolidarea din
01.07.2026, id luat din lista „istoric consolidări” a `DetaliiDocument/74028`) și Codul
muncii `DetaliiDocument/304539` (consolidarea din 18.12.2025).

| Valoare / regulă din aplicație                                                          | Temei verificat                                                                                                                                                                      |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Firma comunică datele șoferului „în termenul indicat în cuprinsul solicitării”          | OUG 195/2002 art. 39 alin. (1) (proprietarul sau deținătorul mandatat, la solicitarea poliției rutiere sau locale); aplicația NU are termen implicit: `termen_raspuns` îl scrie omul |
| Conținutul comunicării: nume, prenume, CNP, domiciliu sau reședință, serie și număr act | art. 39 alin. (2) (pașaport și datele de eliberare pentru străini); scrisoarea de răspuns le cere                                                                                    |
| Necomunicarea este contravenție                                                         | art. 105 pct. 10 (persoane juridice, clasa a V-a de sancțiuni); art. 102 alin. (1) pct. 14 (persoane fizice, clasa a IV-a)                                                           |
| Reținerea din salariu cu titlu de daune: doar cu hotărâre definitivă și irevocabilă     | Codul muncii art. 169 alin. (2); alin. (4): reținerile cumulate nu depășesc lunar jumătate din salariul net                                                                          |
| Răspunderea patrimonială; recuperarea prin acordul părților                             | art. 254 alin. (1)–(4): notă de constatare și evaluare, termen de cel puțin 30 de zile de la comunicare, cel mult 5 salarii minime brute pe economie                                 |

**Ce NU face aplicația.** Nu recuperează nimic de la șofer, nu reține nimic din salariu, nu
calculează plafonul de 5 salarii minime și nu ține nota de constatare. Pagina amenzilor și a
incidentelor o spune pe ecran (`NOTA_RECUPERARE`, `src/domain/fleet/amenzi.ts`). Scrisoarea de
răspuns se generează, dar o trimite omul, iar „răspuns trimis” îl marchează tot omul.

⚠️ **Solicitarea electronică.** Art. 39 alin. (4): solicitarea comunicată prin mijloc
electronic se consideră comunicată în 5 zile de la punerea la dispoziție. Aplicația NU
calculează termenul din regula asta; omul copiază termenul din document. De confirmat cu
juristul dacă firma primește solicitări prin platforme electronice și de când curge termenul.

⚠️ **Nota din portal la art. 39 alin. (1).** Portalul pomenește o decizie de respingere
(`HP nr. 374/2025`, Monitorul Oficial nr. 34 din 19 ianuarie 2026) legată de alineat. Nu am
citit-o și nu schimbă textul consolidat folosit aici; de confirmat cu juristul dacă
interpretarea alineatului s-a mișcat.

⚠️ **Contestarea procesului-verbal.** Stadiul „contestată” e doar un marcaj. Termenele
plângerii și ale plății la jumătatea minimului (OG 2/2001) NU au fost verificate pe sursă și
nu sunt calculate nicăieri. De confirmat cu juristul înainte de a promite o scadență pentru ele.

⚠️ **Cine poate fi desemnat.** Aplicația nu verifică la desemnare permisul, avizul medical sau
contractul șoferului (le arată doar pe foaia de parcurs, ca avertismente). Sugestia din foaie
sau alocare e sugestie: omul care semnează scrisoarea răspunde de exactitatea ei.

⚠️ **Tratamentul fiscal** al amenzii plătite de firmă (deductibilitate, impozitarea unei
eventuale sume refuzate șoferului) NU e verificat. Aplicația nu înregistrează nicio plată.

⚠️ **Datele personale din scrisoare.** CNP-ul se citește prin `hr_read_sensitive` (audit la
fiecare apel). Scrisoarea invocă pe document art. 6 alin. (1) lit. c) din Regulamentul (UE)
2016/679 (obligație legală) ca bază de comunicare; formularea e a aplicației, nu a unui jurist.
De confirmat cu DPO-ul sau juristul firmei.

⚠️ **Dauna și asigurările.** Termenele de notificare a asigurătorului (RCA, CASCO), franșizele
și regresul asigurătorului NU sunt implementate și nu au fost verificate. Incidentul ține doar
stadiile, costul estimat și final, despăgubirea primită, asigurătorul și numărul dosarului.

### Retenție și arhivare · `retention_policies`

⚠️ Termenele de păstrare pentru statele de plată și documentele de vechime · pentru
documentele financiar-contabile · pentru documentele de instruire SSM · pentru
`audit_logs` · termenul de ștergere a IP-ului și user-agent-ului din lead-urile
respinse (minimizare GDPR).

### Nomenclatorul dosarelor · `nomenclator_dosare`

Ordinul de zi 217/1996 art. 10-11 cere ca fiecare firmă să întocmească un
nomenclator al dosarelor, după modelul din anexa nr. 1, și să-l supună confirmării
Arhivelor Naționale sau direcției județene. Indicativul dosarului — cifră romană
pentru compartiment, literă majusculă pentru subdiviziune, cifră arabă pentru dosar
— se trece în registrul de intrare-ieșire ȘI pe fiecare document în parte.

Migrarea `0135` livrează un nomenclator IMPLICIT, generat din modulele aplicației:
șapte compartimente, 38 de dosare, fiecare cu tipurile de document care se clasează
în el. Firma îl adaptează din `/registru/nomenclator`.

⚠️ **Termenele de păstrare din nomenclatorul implicit sunt un punct de plecare, nu
un aviz.** Sursele folosite la scriere:

- OMFP 2634/2015 pct. 38-40 — statele de salarii **50 de ani**; registrele și
  celelalte documente financiar-contabile **10 ani** de la încheierea exercițiului
  în cursul căruia au fost întocmite; documentele din anexa 4, **5 ani**;
- HG 1425/2006 — fișa de instruire individuală se păstrează „de la angajare până la
  încetarea raportului de muncă", trecută în nomenclator ca `CS` (când se schimbă).

De confirmat de contabil sau jurist, ÎNAINTE de a preda nomenclatorul spre avizare:
termenul pentru contractele individuale de muncă și dosarele de personal (seed-ul
folosește 75 de ani) · termenul pentru evaluările de riscuri și dosarele de accident
(seed-ul folosește „permanent") · dacă structura de compartimente corespunde schemei
de organizare a firmei, fiindcă art. 11 cere ordinea din schema de organizare.

### Registrul de documente · `registru_documente`

⚠️ Cele patru **registre unice de evidență** din HG 1425/2006 art. 141 — accidentați
în muncă (anexa 15), incidente periculoase (anexa 16), accidente ușoare (anexa 17),
accidentați cu incapacitate peste 3 zile (anexa 18) — **NU sunt construite**. Sunt o
obligație distinctă de registrul de intrare-ieșire, cu modele proprii de formular.
Tabelele sursă există în modulul SSM; registrele în forma cerută, nu.

⚠️ **Fluxul de demisie nu există în aplicație.** Codul muncii art. 81 obligă
angajatorul s-o înregistreze, iar refuzul dă salariatului dreptul s-o dovedească
prin orice mijloc de probă. Până se construiește, demisia se înregistrează manual,
din `/registru`.

**Numărarea preavizului la demisie în unealta publică `/unelte/cerere-demisie`.**
Preavizul curge din ziua următoare înregistrării și se împlinește în a N-a zi
lucrătoare (sâmbetele, duminicile și sărbătorile din art. 139 scăzute). Regula e
cea din RIL nr. 8/2024 (ÎCCJ, MO 573/19.06.2024), dată pentru preavizul la
CONCEDIERE (art. 75 și art. 278 Codul muncii); pentru demisie (art. 81) o aplicăm
prin analogie, iar pagina o spune. Analogia e confirmată de jurist (9 oct 2026),
deci pagina se publică fără marcaj. Rămâne deschis, pentru fluxul din aplicație
(nu pentru unealtă): dacă „ultima zi de preaviz” coincide cu data încetării
înscrisă în REGES-ONLINE.

### Unelte publice — fișa de evaluare · `src/app/(marketing)/unelte/fisa-evaluare/lege.ts`

Confirmat de jurist (9 oct 2026): rezumatul pașilor concedierii pentru necorespundere
profesională de pe `/unelte/fisa-evaluare` — art. 61 lit. d), 62 alin. (1) și (3),
63 alin. (2), 64, 75, 76, 78 și 268 alin. (1) lit. a) din Codul muncii, forma
consolidată la 27.04.2026. Se publică fără marcaj de jurist; temeiurile rămân citate pe
pagină și se reverifică la orice modificare a codului. Scala 1–5, media ponderată și
pragurile calificativelor (4,50 / 3,50 / 2,50) sunt convenția din practică, nu lege;
pagina și fișierul o spun.

### REVISAL · `revisal_config`

⚠️ Termenele de transmitere a elementelor CIM și a modificărilor · codurile de
temei pentru încetare și suspendare · **structura fișierului de export se
validează cu Inspecția Muncii, nu se presupune.**

---

## 4. Custodia cheilor de criptare

`HR_ENCRYPTION_KEYS` protejează CNP-urile și IBAN-urile tuturor angajaților din
toate organizațiile. Pierderea cheii înseamnă pierderea definitivă a datelor;
scurgerea ei înseamnă expunerea lor.

Cheile din `.env.local` sunt **exclusiv pentru dezvoltare**. Înainte de primul
tenant real trebuie stabilit în scris:

1. cine deține cheia de producție și unde este păstrată în afara furnizorului de hosting;
2. cine o poate roti și după ce procedură;
3. cum se restaurează dintr-un backup dacă mediul de rulare este pierdut complet.

Fără acest proces documentat, criptarea este teatru: cheia va sta în variabila de
mediu a unui singur furnizor, alături de datele pe care le protejează.

Rotația este posibilă fără re-criptarea bazei: fiecare rând reține `key_version`
cu care a fost scris, iar `HR_ENCRYPTION_ACTIVE_KEY` indică doar cheia folosită
la scrierile noi. **O cheie nu se elimină niciodată din `HR_ENCRYPTION_KEYS` cât
timp există măcar un rând scris cu ea.**
