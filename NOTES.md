# NOTES — decizii de arhitectură și valori de verificat

Acest fișier are două scopuri: să înregistreze deciziile care nu se citesc din
cod și să țină lista valorilor legale pe care **trebuie să le confirme un
contabil autorizat sau un jurist de dreptul muncii** înainte de a fi folosite
într-un calcul real.

Planul complet aprobat: [`docs/design/00-PLAN-APROBAT.md`](docs/design/00-PLAN-APROBAT.md).

---

## 1. De configurat înainte de a continua

| Ce                            | Stare                        | Acțiune                                                                                                          |
| ----------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Server MCP Supabase           | ✅ conectat și autentificat  | Proiect `nybmhorngsajoqaxjlbr`, regiune **aws-1-eu-west-1**.                                                     |
| Chei Supabase în `.env.local` | ⚠️ parțial                   | URL și cheia publicabilă sunt setate. `SUPABASE_SERVICE_ROLE_KEY` lipsește — Dashboard → Project Settings → API. |
| Proiect Supabase de test      | ⛔ neconfigurat              | Testele de izolare RLS își resetează baza; nu pot rula pe proiectul de dezvoltare.                               |
| DNS Resend                    | ⛔ amânat deliberat          | `EMAIL_MODE="test"` până la Faza 11.                                                                             |
| `HR_ENCRYPTION_KEYS`          | ⚠️ chei locale de dezvoltare | Cheile de producție se generează separat și **nu** trec prin repo. Vezi §4.                                      |

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
Postgres simplu este un singur proces, deja instalat, în care o migrare se aplică
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

### Tichete de masă · `payroll_settings`

⚠️ Valoarea maximă legală (se actualizează prin ordin) · regimul fiscal (ce
contribuții se aplică — schimbat de mai multe ori în ultimii ani) · plafonul
lunar cumulat al veniturilor neimpozabile și **ordinea de includere** în el.

### Timp de muncă · `attendance_settings`, `payroll_settings`

⚠️ Procent minim ore suplimentare · spor de noapte, interval nocturn, prag de ore
· spor weekend · **spor sărbătoare legală** și termenul zilei libere
compensatorii · durata maximă săptămânală cu ore suplimentare și perioada de
referință · repausul minim între zile și cel săptămânal · termenul de compensare
cu ore libere · interdicțiile de ore suplimentare (sub 18 ani, part-time) ·
pauza obligatorie.

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
cel catolic). Lista **s-a modificat prin lege** de mai multe ori: 6 și 7 ianuarie
au fost adăugate în 2016, Vinerea Mare în 2018. Se adaugă și zilele pentru
salariații aparținând altor culte religioase legale.

### Diurne · `per_diem_policies`, `per_diem_country_rates`

⚠️ Baremul intern pentru instituții publice și multiplul de plafonare · baremul
pe țări (structură HG 518/1995, **importat ca date, nu scris în cod**) · plafonul
raportat la salariile de bază · pragul de ore pentru zi întreagă sau jumătate de
zi (regulament intern) · tariful pe kilometru pentru autoturismul personal ·
regimul detașării transnaționale.

### SSM / PSI / ISCIR

⚠️ Periodicitatea instruirii SSM (introductivă, la locul de muncă, periodică) ·
periodicitatea instruirii PSI, **obligație separată de SSM** · intervalele de
verificare a stingătoarelor (verificare, reîncărcare, probă de presiune, per tip)
· periodicitatea examenelor de medicina muncii pe categorii de post · termenul de
comunicare a unui accident de muncă la ITM · pragul de salariați de la care CSSM
devine obligatoriu · pragul pentru cota de angajare a persoanelor cu handicap și
plata compensatorie · periodicitățile de verificare tehnică ISCIR · duratele de
utilizare a echipamentului individual de protecție.

### Retenție și arhivare · `retention_policies`

⚠️ Termenele de păstrare pentru statele de plată și documentele de vechime · pentru
documentele financiar-contabile · pentru documentele de instruire SSM · pentru
`audit_logs` · termenul de ștergere a IP-ului și user-agent-ului din lead-urile
respinse (minimizare GDPR).

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
