# REGES-Online — la ce folosește modulul și cum funcționează

Documentul ăsta explică **ce face** modulul și **cum e construit**, pentru cine
îl citește prima dată. Pentru punerea lui în funcțiune la o firmă-client — chei
de test, pași de configurare, diagnostic — vezi
[`reges-online.md`](reges-online.md).

---

## 1. Scopul

REGES-Online (fost Revisal) e registrul general de evidență a salariaților ținut
de Inspecția Muncii. Orice angajator e obligat prin lege să raporteze acolo
angajările, modificările de contract, suspendările, detașările și încetările —
**în termene fixe**. Ratarea termenului e contravenție.

Termenele implicite, seedate în `reges_termene` (`0004_hr.sql:1028`):

| Eveniment                                     | Termen                                               |
| --------------------------------------------- | ---------------------------------------------------- |
| angajare                                      | ziua lucrătoare **anterioară** începerii activității |
| încetare                                      | cel târziu **în ziua** încetării                     |
| modificare salariu / funcție / normă / durată | 20 de zile lucrătoare de la eveniment                |
| suspendare / reluare activitate / detașare    | 20 de zile lucrătoare de la eveniment                |
| corecție                                      | fără termen distinct, la constatarea erorii          |

> ⚠ Valorile vin din H.G. 905/2017. Dacă mai sunt cele în vigoare sub norma
> REGES 2025 **nu am verificat** — sunt date, nu cod, deci se corectează fără
> deploy. `NOTES.md` le marchează deja.

Modulul face două lucruri:

1. **Ține evidența a ce trebuie raportat și până când** — calculează termenul din
   `reges_termene` plus calendarul sărbătorilor legale, și arată în ecran ce e
   întârziat, ce e pe azi, ce e în termen.
2. **Transmite efectiv, prin API-ul Inspecției Muncii.** De la 1 ianuarie 2026
   REGES are API, deci fișierul oficial `.rvs` — pe care un terț oricum nu-l
   putea scrie — nu mai e o fundătură. Până la migrarea `0087` modulul se oprea
   la un CSV de lucru.

---

## 2. Fluxul, cap-coadă

```
alt modul (angajări/contracte)
      │  genereazaEvenimenteReges()
      ▼
reges_evenimente ──► domain/reges/plan.ts ──► reges_mesaje (`de_transmis`)
   „ce s-a întâmplat      „ce mesaje cere,        coada, cu `depinde_de`
    și până când”          în ce ordine”
                                                        │
                            om: „Transmite” ────────────┤
                            sau ciclul de reconciliere ─┘
                                                        ▼
                                          lib/reges/compune.ts → API ITM
                                                        │
                                       recipisă (`asteapta_raspuns`)
                                                        ▼
                                       ciclul culege rezultatul asincron
                                                        ▼
                                    `reusit` + `referinta_id` copiată pe
                                 employees / employment_contracts
```

### Pas 1 — evenimentul se naște în alt modul

`angajati/nou/actions.ts` și `angajati/actions.ts` cheamă
`genereazaEvenimenteReges()` după ce salvează contractul.

Deliberat **nu** e trigger de bază de date. Motivele, în ordinea greutății
(antetul lui `src/lib/reges/genereaza-evenimente.ts`):

- termenul cere aritmetică de zile lucrătoare cu Paște ortodox mobil — un
  trigger PL/pgSQL ar reimplementa-o în SQL, fără teste și fără „ce s-ar
  întâmpla dacă” în UI;
- un eveniment de raportat are consecințe contravenționale, deci trebuie să fie
  **vizibil în rezultatul acțiunii**: „am creat contractul **și** ai termen până
  pe 29 mai”. Un trigger tăcut ascunde asta;
- `created_by` și antetele cererii nu sunt disponibile în DB, deci rândul de
  audit corect îl scrie acțiunea, cu `readRequestMeta`.

Funcția e **idempotentă** — deduplicare pe (angajat, tip, dată) — deci un import
reluat la jumătate nu dublează evenimentele.

### Pas 2 — evenimentul devine un plan de mesaje

`src/domain/reges/plan.ts` (modul **pur**, testat, care nu știe nimic despre
bază) traduce un eveniment legal în lista **ordonată** de mesaje.

Partea care se strică tăcut: o angajare nouă nu e un mesaj, ci **două** —
`InregistrareSalariat`, apoi `AdaugareContract`. Al doilea cere
`continut.referintaSalariat.id`, un UUID pe care îl aflăm abia din rezultatul
**asincron** al primului. Nu e o chestiune de ordine în coadă: al doilea mesaj nu
poate fi nici măcar _construit_ mai devreme.

Un cod care le trimite pe amândouă odată nu dă nicio eroare la noi. Primește două
recipise, iar al doilea mesaj e refuzat asincron cu „referință inexistentă” — la
ore după ce operatorul a plecat, pe un termen legal care curge. De aceea planul
întoarce `depindeDePrecedentul`, iar coada refuză să trimită un mesaj a cărui
dependență n-are încă `referinta_id`.

### Pas 3 — coada

`lib/reges/coada.ts` scrie rânduri în `reges_mesaje` cu starea `de_transmis`.
**Nu trimite nimic.**

Trimiterea e o apăsare de buton, decizie de om: o greșeală de tastare ajunsă în
registrul oficial se repară doar printr-o corecție transmisă tot prin API, iar
corecțiile rămân vizibile în istoricul de la ITM.

Stările unui mesaj:

```
de_transmis ──► in_curs ──► asteapta_raspuns ──► reusit
     │                              └──────────► esuat
     └──► anulat
```

`in_curs` există ca să nu trimită de două ori același mesaj un ciclu de
reconciliere care se suprapune cu apăsarea butonului.

### Pas 4 — compunerea, în clipa trimiterii

`lib/reges/compune.ts` construiește payload-ul din **starea curentă a bazei**, la
apăsarea butonului, și îl uită.

Corpul nu se persistă niciodată. `reges_mesaje.cerere_rezumat` e un rezumat
**fără date personale**; un CNP salvat acolo ar fi o a doua copie necriptată, în
afara `employee_sensitive_data` și a auditului ei.

Efectul lateral e corect: dacă operatorul repară o adresă lipsă între punerea în
coadă și apăsarea butonului, pleacă adresa reparată.

Împărțirea pe două funcții nu e estetică — `compuneSalariat` **cere** CNP-ul ca
argument și nu-l citește singură, ca decriptarea să rămână în Server Action, sub
permisiunile utilizatorului real, unde `hr_read_sensitive` scrie rândul de audit.

### Pas 5 — ciclul de reconciliere

`POST /api/reges/reconciliere`, chemat de un systemd timer de pe VM, la câteva
minute, cu `REGES_CRON_SECRET`.

- **Secret gol = ruta e oprită.** O instalare fără secret nu are ciclu deschis.
- Răspunde **404, nu 401**: o rută de serviciu n-are de ce să-și confirme
  existența unui apelant care n-are secretul.
- **De ce nu `pg_cron`**, deși proiectul îl are: ciclul trebuie să iasă pe HTTP
  către Inspecția Muncii, iar `pg_net` nu e activat pe instanța noastră.

Ciclul trimite ce e gata, culege rezultatele și copiază `Result.Ref` pe
`employees.reges_salariat_id` / `employment_contracts.reges_contract_id` — toate
operațiile ulterioare merg **prin referință**.

Citirea se face cu `ReadBatch` + `CommitReadBatch`, **nu** cu `PollMessage`:
acesta din urmă citește _și_ avansează într-un singur apel, deci o cădere între
citire și scrierea în baza noastră ar pierde definitiv rezultatul. Perechea
citește-apoi-confirmă dă „cel puțin o dată” în loc de „cel mult o dată”, iar
unicitatea pe `response_id` face reprocesarea inofensivă.

> ⚠ `CommitReadBatch` primește numărul **real** de mesaje întoarse, nu numărul
> cerut. Confirmarea a N mesaje când serverul a dat P < N sare peste mesajele
> necitite dintre ele.

**Ce nu face ciclul:** nu trimite mesaje de tip `salariat`. Acelea conțin CNP,
iar decriptarea trebuie să rămână pe drumul autorizat al utilizatorului. Un
contract nu conține date personale — pe acela îl poate compune și trimite ciclul.

### Pas 6 — închirierea, ca să nu ruleze două cicluri

Stack-ul are **două replici**, iar cozile REGES sunt _consumatoare_: fiecare
citire avansează cursorul angajatorului. Două cicluri concurente ar consuma
fiecare jumătate din mesaje și fiecare ar crede că le-a văzut pe toate —
pierdere **tăcută**, fără nicio eroare nicăieri.

Nu ruta decide, ci baza: `reges_ia_inchirierea()` face un
`insert … on conflict … where expira_la < now()` atomic, cu termen de 300s. A
doua replică — sau a doua apăsare de buton — primește `false` și un **409**, care
e o stare normală, nu o pană, deci timerul o poate ignora.

---

## 3. Piesele

### Tabele (`0087_reges_online.sql`)

| Tabelă                | Rol                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `reges_evenimente`    | registrul: ce s-a întâmplat, ce termen are, ce stare (fost `revisal_events`)                               |
| `reges_termene`       | termenele legale, implicite de platformă sau suprascrise per firmă (fost `revisal_config`)                 |
| `reges_credentiale`   | cheile OIDC ale fiecărei firme, criptate. Cheie primară = `organization_id`                                |
| `reges_mesaje`        | coada către API, cu `depinde_de`, recipise și rezultate asincrone                                          |
| `reges_nomenclatoare` | oglinda nomenclatoarelor naționale (COR, CAEN, județe, temeiuri legale…)                                   |
| `reges_propuneri`     | detașări și mutări, în **ambele** sensuri                                                                  |
| `contract_suspendari` | perioadele de suspendare, care nu existau ca entitate — contractul avea doar starea curentă, fără interval |
| `reges_apeluri`       | jurnalul apelurilor HTTP: metodă, cale, status, durată — **niciodată corpurile**                           |
| `reges_inchiriere`    | serializarea ciclului de reconciliere                                                                      |

Două detalii de schemă care se răzbună dacă se uită:

- **Ancorele de tenant.** `employment_contracts` și `reges_evenimente` au primit
  `unique (id, organization_id)` ca să existe chei străine **compuse**. Fără ele,
  un rând din `reges_mesaje` al firmei A ar putea trimite către un contract al
  firmei B: un FK simplu nu știe nimic despre organizație, iar RLS filtrează
  rânduri, nu referințe.
- **`reges_nomenclatoare` are index unic COMPLET**, nu parțial, și n-are deloc
  `deleted_at`. Motivul e mecanic: sincronizarea face `.upsert()`, iar PostgREST
  nu emite predicatul unui index parțial în `ON CONFLICT` (capcana 7 → `42P10`).
  O valoare dispărută din amonte devine `activ = false`, nu rând șters.

### Domeniu pur — `src/domain/reges/`

Fără I/O, fără importuri de infrastructură, cu teste alături:

| Fișier          | Ce face                                                       |
| --------------- | ------------------------------------------------------------- |
| `evenimente.ts` | termenele: tipuri de eveniment, repere, calculul zilei-limită |
| `plan.ts`       | eveniment → lista ordonată de mesaje, cu dependențe           |
| `operatii.ts`   | cele 23 de operații REGES                                     |
| `mapare.ts`     | datele noastre → forma cerută de schema REGES                 |
| `mesaj.ts`      | antetul mesajului și tipurile rezultatului                    |
| `validare.ts`   | ce se verifică înainte de trimitere                           |
| `formate.ts`    | date, momente, formatări cerute de API                        |
| `mascare.ts`    | ascunderea CNP-urilor și IBAN-urilor din texte                |
| `export.ts`     | CSV-ul de lucru (calea veche, păstrată)                       |

### Server, cu efecte — `src/lib/reges/`

`client.ts` (HTTP, cu termen explicit, care **nu aruncă niciodată**),
`jeton.ts` (OIDC), `credentiale.ts`, `coada.ts`, `compune.ts`,
`nomenclatoare.ts`, `genereaza-evenimente.ts`, `reconciliere.ts`.

Retry **doar pe ce are rost**: rețea căzută și 5xx da; `400` niciodată — un mesaj
respins de schemă va fi respins identic și a zecea oară; `401` exact o dată, după
reîmprospătarea jetonului.

### Ecrane — `src/app/(app)/reges/`

| Rută               | Ce conține                                     |
| ------------------ | ---------------------------------------------- |
| `/reges`           | registrul evenimentelor + coada de mesaje      |
| `/reges/[id]`      | un mesaj, cu clasificarea REGES a contractului |
| `/reges/propuneri` | detașări și mutări, trimise și primite         |
| `/reges/setari`    | cheile API ale firmei                          |

---

## 4. Detașările și mutările

Fluxul diferă de vechiul Revisal: nu se transmite o detașare, ci o **propunere**,
pe care angajatorul destinație o acceptă sau o respinge separat. Cele două
sensuri au cozi diferite în API (`Propuneri` și `PropuneriPrimite`), de unde
coloana `directie` (`trimisa` / `primita`).

Salariatul apare doar **mascat** — nume plus ultimele 4 cifre din CNP. O
propunere primită vine cu datele unui om care nu e (încă) angajatul nostru;
stocarea CNP-ului lui ar crea o fișă de date personale în afara
`employee_sensitive_data`, fără cheia și fără auditul ei.

---

## 5. Securitatea

**`reges_credentiale` e închisă complet.** Toate privilegiile revocate pentru
`authenticated`, **nicio politică RLS** — refuz total, deliberat. Accesul trece
exclusiv prin `reges_read_credentiale()` / `reges_write_credentiale()`, care
verifică `reges:configure = all` și scriu în `audit_logs` **numele** câmpurilor
atinse, niciodată valorile. Un `select` direct ar fi o cale care ocolește
auditul.

Tabela **nu** primește `internal.attach_audit`: garda R9 (`0002_authz.sql:495`)
ar refuza-o oricum cu `P0001`, fiindcă are coloane care se potrivesc cu
`%ciphertext%`, `%_iv%`, `%token%`, `%parol%`. Refuzul e corect — un rând de
audit care conține criptotextul ar fi o a doua copie a secretului.

`utilizator` rămâne în clar, deliberat: numele contului nu e secretul perechii,
iar ecranul de setări trebuie să arate **care** cont e configurat. Precedentul e
`employee_sensitive_data.banca`, lângă IBAN-ul criptat.

**Cheile de criptare sunt cele HR** (`HR_ENCRYPTION_KEYS`, AES-256-GCM). Un al
doilea set ar însemna un al doilea secret de rotit și de pierdut. Compromisul:
cine are cheia HR are și cheile REGES — dar cine are cheia HR are deja CNP-urile
tuturor angajaților, deci separarea n-ar apăra nimic în plus.

**Nu există o cheie a aplicației.** Autentificarea e OIDC prin Keycloak (realm
`API`), grant ROPC: `client_id` + `client_secret` + utilizator + parolă, toate
patru **ale angajatorului**, generate din portalul lui. De aceea tabela e per
organizație.

**Ruta de reconciliere ocolește complet RLS** — rulează fără niciun utilizator
autentificat, pe toate firmele deodată, deci nu există sesiune din care RLS să
deducă organizația. Izolarea o dau interogările din `lib/reges/*`, care filtrează
**explicit** pe `organization_id`, luat din lista de firme cu REGES activ.

### Permisiuni

Șase chei: `reges:read`, `create`, `update`, `transmit`, `configure`, `export`.

| Rol           | Ce are                                                                               |
| ------------- | ------------------------------------------------------------------------------------ |
| `super_admin` | toate șase                                                                           |
| `org_admin`   | toate șase                                                                           |
| `hr`          | toate șase, inclusiv `configure` — specialistul de personal obține cheile din portal |
| `manager`     | **nimic**                                                                            |
| `employee`    | **nimic**                                                                            |

`transmit` și `configure` nu sunt în produsul cartezian din `0002_authz.sql`,
deci nici `super_admin` nu le-ar fi primit automat — fiecare rând din seed e
necesar. Absența rândului e forma corectă a lui „nu”; un rând `none` decorativ ar
fi seedat și mort.

Strângerea lui `configure` la `org_admin` se face per firmă, din
`role_permissions`, **fără deploy**.

Modulul e activat pentru toate firmele existente: REGES nu e opțional prin lege,
orice angajator raportează acolo.

---

## 6. Ce nu e închis încă

1. **Baza API de producție** (`https://api.inspectiamuncii.ro`) e marcată
   `⚠ NEVERIFICATĂ` în `client.ts`. SSO-ul de producție l-am interogat direct și
   răspunde; API-ul nu. Se confirmă din portalul de producție înainte de
   go-live. Mediul de test e cel funcțional.
2. **Termenele legale** — vezi §1.
3. **Plafonul lotului de citire** nu e documentat de ITM. Pornim de la 20.
4. **Limitele de rată** nu sunt documentate. Ni le impunem singuri.

---

## 7. Unde te uiți când ceva nu merge

Tabelul de simptome, comanda de `journalctl` și pașii de obținere a cheilor sunt
în [`reges-online.md`](reges-online.md) §6. Pe scurt: `reges_apeluri` pentru
apeluri, coada de pe `/reges` pentru mesaje respinse,
`journalctl -u reges-reconciliere` pentru „coada nu se mișcă deloc”.
