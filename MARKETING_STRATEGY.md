# Administrativo — Strategie de Marketing și Vânzări

**Document de lucru GTM · versiunea 1.0 · 3 septembrie 2026**
Autor: analiză de piață + audit intern al produsului
Public țintă al documentului: fondator, viitorul om de vânzări, agenția de performance

---

## 0. Rezumat executiv (citește doar asta dacă ai 4 minute)

**Ce avem.** Un ERP/HR multi-tenant complet, în română, cu 22 de module și izolare
între firme-client făcută la nivel de bază de date (RLS FORCED), nu prin filtre de
aplicație. Include lucruri pe care concurența nu le are deloc: **transmitere REGES prin
API** (nu export de fișier), SSM/PSI complet, parc auto, mentenanță ISCIR, inventar în
primire, registru de înregistrare a documentelor conform OMFP 2634/2015, cursuri cu
adeverință, ticketing intern și un asistent AI read-only.

**Unde e piața.** România a trecut forțat la **REGES-ONLINE** (HG 295/2025). Neînrolarea
se sancționează cu **15.000–20.000 lei**, netransmiterea cu **3.000–8.000 lei**, iar
lipsa evidenței zilnice a orelor lucrate cu **1.500–3.000 lei** — cu escaladare la
**20.000 lei/persoană** dacă se reîncadrează ca muncă nedeclarată. Fiecare administrator
de IMM din România a fost obligat, în ultimele 12 luni, să se uite la cum ține evidența.
**Asta e fereastra de vânzare.** Nu se va redeschide.

**Cum câștigăm.** Nu pe „încă o aplicație de pontaj" — acolo iFlow și Papervee au deja
distribuție și preț mic. Câștigăm pe poziția **„singurul dosar administrativ complet al
firmei, într-un singur loc"**: firma de 15–150 de angajați nu are un om de HR, are un
administrator care ține pontajul în Excel, SSM-ul într-un biblioraft, ISCIR-ul în capul
lui și REGES-ul la contabil. Noi înlocuim toate cele patru, nu unul.

**Canalul cu cel mai bun raport efort/rezultat.** Firmele de contabilitate. Un contabil
mediu are 30–80 de clienți IMM, îi vede lunar, e crezut necondiționat și e deja plătit
ca să facă REGES-ul lor. Arhitectura noastră multi-tenant e literalmente construită
pentru consola lui. **Un singur contabil convertit = 5–15 conturi într-un an**, cu CAC
sub 10% din cel al canalului plătit.

**Ținta la 12 luni:** 120 de organizații plătitoare, ARR ≈ 1,2 mil. lei, din care 45%
prin canalul de contabilitate.

---

## 1. Auditul intern — ce vindem, de fapt

### 1.1 Arhitectura, tradusă în argumente de vânzare

| Fapt tehnic (verificat în cod)                                                                                              | Ce înseamnă pentru client                                                                    | Unde se folosește în vânzare                                                |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **RLS FORCED** — izolarea între firme e făcută de Postgres, nu de codul aplicației; test automat de izolare pe fiecare push | Datele firmei tale nu pot ajunge la altă firmă nici dacă un programator greșește un filtru   | Obiecția „datele mele în cloud"; **fundamentul canalului de contabilitate** |
| **CNP și IBAN criptate AES-256-GCM**, cu chei versionate; amprente HMAC separate pentru deduplicare                         | Datele cu risc GDPR maxim sunt cifrate la nivel de coloană, nu doar „criptate în tranzit"    | Obiecția GDPR; discuția cu DPO-ul firmelor de 100+                          |
| **5 roluri cu 4 niveluri de scope** (`none/own/team/all`), permisiuni în bază, suprascriabile per organizație               | Managerul de secție vede doar echipa lui. Fără deploy, fără „vă facem noi o versiune"        | Firme cu mai multe puncte de lucru / șantiere                               |
| **22 de module cu comutator per organizație** (feature flags)                                                               | Plătești ce folosești; pornești cu pontaj, adaugi SSM peste 3 luni                           | Structura de preț și upsell-ul                                              |
| **Portal angajat separat** (rute proprii, UI redus)                                                                         | Angajatul își vede singur soldul de concediu și fluturașul — nu mai întreabă administratorul | Argumentul „scad întreruperile"                                             |
| **Asistent AI read-only** (nu depune, nu aprobă, nu șterge)                                                                 | Adopție: omul care nu știe unde se face ceva întreabă în română și primește butonul          | Reducerea costului de onboarding, argument anti-„e prea complicat"          |
| **Next.js 16 / React 19 / Postgres 17**, românesc de la zero                                                                | Nu e o localizare a unui produs străin; ș/ț cu virgulă, nu cu sedilă                         | Diferențiere față de Personio/BambooHR/Factorial                            |

### 1.2 Cele 22 de module — grupate cum le cumpără clientul

| Grup                                     | Module                                                                                                                           | Ce durere omoară                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Conformitate (obligatoriu prin lege)** | REGES (API), Registru documente (OMFP 2634/2015), SSM și PSI, Documente (contracte, fișa postului, adeverințe), Mentenanță ISCIR | Amenda ITM. **Nu e „nice to have", e cheltuială de evitare a riscului** |
| **Personal (durerea zilnică)**           | Angajați, Pontaj, Concedii, Salarizare, Organigramă, Departamente, Puncte de lucru, Onboarding                                   | Excelul, telefoanele, „câte zile mai am?"                               |
| **Dezvoltare**                           | Evaluări, Cursuri (bibliotecă + test + adeverință), Anunțuri                                                                     | Retenția, instruirile obligatorii cu dovadă                             |
| **Operațiuni**                           | Parc auto (foi de parcurs, kilometraj), Inventar (predare-primire), Diurnă și deplasări, Ticketing IT                            | Ce nu intră în niciun soft de HR — și ce ține IMM-ul pe hârtie          |
| **Vizibilitate**                         | Panou, Rapoarte, Notificări, Profil, Setări, Asistent AI                                                                         | „Cât mă costă de fapt omul ăsta?"                                       |

> **Observația strategică cea mai importantă a acestui audit:** grupul _Operațiuni_ și
> jumătate din grupul _Conformitate_ **nu există la niciun concurent direct din segmentul
> de preț mic**. iFlow, Papervee și Creasoft sunt aplicații de pontaj cu module HR în
> jurul lor. Noi suntem administrarea completă a firmei. Asta trebuie să fie titlul de pe
> homepage, nu „aplicație de pontaj".

### 1.3 Ce NU avem încă (și cum vindem în ciuda acestui fapt)

| Lipsă                                                                          | Impact comercial                              | Contramăsură de mesaj                                                                                                                                                                   |
| ------------------------------------------------------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valorile legale de salarizare marcate „de confirmat de contabil" în `NOTES.md` | Nu putem promite „calcul de salarii garantat" | Poziționăm salarizarea ca **motor de calcul + fluturași**, iar D112 rămâne la contabil. **Asta e o forță în canalul de contabilitate, nu o slăbiciune** — nu-i luăm contabilului pâinea |
| Fără recrutare / ATS                                                           | Pierdem RFP-uri de companii 200+              | Nu ne batem acolo. ICP-ul nostru recrutează pe OLX și prin cunoștințe                                                                                                                   |
| Fără pontaj biometric / cititor RFID propriu                                   | Fabrici și producție cu poartă                | Roadmap trimestrul 2; până atunci import din terminal + pontaj pe telefon cu geolocație                                                                                                 |
| Zero teste pe acțiuni și pagini (datorie cunoscută)                            | Risc de incidente la scalare                  | Nu e argument de vânzare, e argument de a nu semna 40 de clienți în aceeași lună                                                                                                        |

---

## 2. Piața românească — dimensiune, context și fereastra de oportunitate

### 2.1 Dimensionare (TAM / SAM / SOM)

| Nivel          | Definiție                                                                                                                       | Estimare                                                                                          | Sursa / ipoteza                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TAM**        | Toate firmele active din România cu cel puțin 1 angajat                                                                         | ~450.000 firme; IMM-urile angajează ~2,57 mil. oameni, adică 64% din salariații din mediul privat | Analize IMM România 2025 (898.915 firme intrate în analiză), INS                                                                                   |
| **SAM**        | Firme cu **15–150 de angajați** — au destui oameni ca să doară administrarea, prea puțini ca să-și permită Charisma/colorful.hr | **~45.000–55.000 firme**                                                                          | Estimare pe distribuția claselor de mărime (10–49 și 50–249 angajați). ⚠️ De validat cu un extras Listăfirme/Termene înainte de a construi bugetul |
| **SOM (an 1)** | Ce putem atinge realist cu 1–2 oameni + canal de contabilitate                                                                  | **120 organizații** (≈0,25% din SAM)                                                              | Model de mai jos, §12                                                                                                                              |
| **SOM (an 3)** |                                                                                                                                 | 700–900 organizații                                                                               | Presupune canal de contabilitate matur (60+ parteneri activi)                                                                                      |

**Valoarea medie a unui cont (ARPA)** la 40 de angajați × 21 lei/angajat/lună ≈ **840
lei/lună ≈ 10.000 lei ARR**. Un client de 120 de angajați pe pachetul complet ≈ 3.500
lei/lună ≈ 42.000 lei ARR.

### 2.2 Fereastra legislativă — de ce ACUM și nu peste doi ani

Aceasta este cea mai importantă pagină din document. **Nu vindem software, vindem
evitarea unei amenzi cu dată de scadență.**

| Obligație                                                                                             | Termen                                                                      | Sancțiune                                                                   | Sursa                         |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------- |
| **Înrolarea în REGES-ONLINE**                                                                         | Obligatorie pentru **toți** angajatorii, indiferent de mărime (HG 295/2025) | **15.000–20.000 lei** pentru neînregistrare (de la 1 octombrie 2025)        | Inspecția Muncii              |
| **Transmiterea elementelor contractului**                                                             | Cel târziu în ziua anterioară începerii activității                         | **3.000–5.000 lei / caz**, până la 8.000 lei pentru netransmitere la termen | HG 295/2025                   |
| **Modificarea datelor de identificare**                                                               | 3 zile lucrătoare                                                           | **5.000–8.000 lei**                                                         | HG 295/2025                   |
| **Transferul salariatului**                                                                           | 5 zile lucrătoare                                                           | **5.000–8.000 lei / caz**                                                   | HG 295/2025                   |
| **Date incorecte sau incomplete în REGES**                                                            | —                                                                           | **3.000–6.000 lei**                                                         | HG 295/2025                   |
| **Evidența zilnică a orelor lucrate** (ora de început și de sfârșit, per salariat, la locul de muncă) | Permanentă                                                                  | **1.500–3.000 lei**                                                         | Codul muncii, art. 119        |
| **Ore lucrate în afara programului contractat, fără evidență**                                        | —                                                                           | Se poate reîncadra ca **muncă nedeclarată: 20.000 lei / persoană**          | Codul muncii, art. 260        |
| **Neregulile din fișa de pontaj**                                                                     | —                                                                           | Până la **10.000 lei pentru fiecare persoană** în cazurile agravate         | Practică ITM, presă economică |

**Trei consecințe directe pentru marketing:**

1. **REGES generează automat alerte de nerespectare a termenelor**, ceea ce ușurează
   controalele ITM. Controlul nu mai e o loterie — devine o listă de firme întârziate.
   Frica e reală și e nouă.
2. Fiecare articol de blog despre REGES, pontaj sau amenzi ITM are **intenție comercială
   ascunsă**: cine caută „amendă lipsă pontaj" are deja problema.
3. Concurența vinde „economisești timp". Noi putem vinde **„3.000 lei amendă evitată vs.
   840 lei/lună abonament"**. Un ROI care nu are nevoie de foaie de calcul.

### 2.3 Alte vânturi din spate

- **Digitalizarea prin fonduri** — programele de tip PNRR/Digitalizare IMM au normalizat
  ideea de „soft în cloud plătit lunar" în firme care înainte cumpărau licențe pe viață.
- **Consolidarea pieței** — Romanian Software (colorful.hr) a fost preluată de SD Worx.
  Consolidarea aduce creșteri de preț și scăderea atenției pentru clienții mici. **Fiecare
  achiziție internațională e o listă de clienți nemulțumiți disponibili.**
- **Salariul minim și presiunea pe costul muncii** — orice creștere face administratorul
  să se uite la costuri administrative. Calculatoarele noastre gratuite prind exact acel moment.

---

## 3. Analiza competitivă

### 3.1 Harta pieței — patru cadrane

```
                 SCUMP / ENTERPRISE
                        │
   colorful.hr (SD Worx)│ Charisma HCM (TotalSoft)
   UCMS by AROBS        │ Sincron HR
   (dp-Payroll, TrueHR) │ Smartree (MyStaff)
   ─────────────────────┼─────────────────────  LARG
   ÎNGUST               │
   (doar pontaj/HR)     │  ★ ADMINISTRATIVO ★
                        │  (HR + conformitate + operațiuni)
   iFlow / HRiFlow      │
   Papervee             │
   Creasoft             │
                 IEFTIN / SELF-SERVE
```

**Cadranul din dreapta-jos e gol.** Acolo intrăm: lățime de enterprise, preț și viteză
de self-serve.

### 3.2 Tabel comparativ — Administrativo vs. Top 3 concurenți direcți

| Criteriu                                                                   | **Administrativo**                                       | **iFlow / HRiFlow**                                                       | **Papervee**                                                           | **colorful.hr (SD Worx)**                                  |
| -------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Poziționare**                                                            | Dosarul administrativ complet al IMM-ului                | Cea mai vândută aplicație de pontaj & HR                                  | Aplicație HR modernă, mobile-first                                     | Suită HCM + servicii de salarizare externalizate           |
| **Preț public**                                                            | _(propunere)_ **12 / 21 / 29 lei / angajat / lună**      | de la ~9 lei/angajat; abonament în trepte de 10 angajați; de la ~5 €/lună | **12 lei** (Startup, min. 5) / **24 lei** (Business; 18 lei primul an) | La cerere; implementare + licențiere; campanii cu reduceri |
| **Perioadă de probă**                                                      | **30 zile, fără card** _(propunere)_                     | 30 zile                                                                   | 7 zile                                                                 | Demo la cerere                                             |
| **Pontaj**                                                                 | ✅ foaie colectivă, plan săptămânal, ore suplimentare    | ✅ (punctul lor forte)                                                    | ✅ + RFID pe planul Business                                           | ✅                                                         |
| **Concedii**                                                               | ✅ 11 tipuri statutare, sold per an, flux de aprobare    | ✅                                                                        | ✅                                                                     | ✅                                                         |
| **Salarizare**                                                             | ✅ motor de calcul + fluturași + popriri                 | ✅ modul separat                                                          | ⚠️ parțial                                                             | ✅ (nucleul lor)                                           |
| **REGES-ONLINE prin API**                                                  | ✅ **coadă de mesaje, recipise asincrone, reconciliere** | ⚠️ neconfirmat public                                                     | ⚠️ neconfirmat public                                                  | ✅ (așteptat, prin serviciu)                               |
| **SSM / PSI** (instruiri, fișe de aptitudine, EIP, stingătoare, accidente) | ✅ **complet**                                           | ❌                                                                        | ❌                                                                     | ⚠️ parțial                                                 |
| **Parc auto + foi de parcurs**                                             | ✅                                                       | ❌                                                                        | ❌                                                                     | ❌                                                         |
| **Mentenanță echipamente / ISCIR**                                         | ✅                                                       | ❌                                                                        | ❌                                                                     | ❌                                                         |
| **Inventar / predare-primire**                                             | ✅                                                       | ❌                                                                        | ❌                                                                     | ❌                                                         |
| **Diurnă și deplasări**                                                    | ✅ intern + extern                                       | ⚠️                                                                        | ⚠️                                                                     | ✅ modul travel                                            |
| **Registru documente (OMFP 2634/2015)**                                    | ✅                                                       | ❌                                                                        | ❌                                                                     | ❌                                                         |
| **Cursuri cu test și adeverință**                                          | ✅                                                       | ❌                                                                        | ❌                                                                     | ✅                                                         |
| **Ticketing intern**                                                       | ✅                                                       | ❌                                                                        | ❌                                                                     | ⚠️                                                         |
| **Portal angajat**                                                         | ✅                                                       | ✅                                                                        | ✅                                                                     | ✅                                                         |
| **Asistent AI în aplicație**                                               | ✅ read-only, în română                                  | ❌                                                                        | ❌                                                                     | ❌                                                         |
| **Izolare multi-tenant la nivel de bază de date**                          | ✅ RLS FORCED, testat automat                            | necunoscut                                                                | necunoscut                                                             | necunoscut                                                 |
| **Consolă multi-firmă pentru contabili**                                   | ✅ **prin arhitectură**                                  | ❌                                                                        | ❌                                                                     | ⚠️ prin servicii                                           |
| **Recrutare / ATS**                                                        | ❌                                                       | ⚠️                                                                        | ⚠️                                                                     | ✅                                                         |
| **Pontaj biometric / terminal propriu**                                    | ❌ (roadmap)                                             | ✅                                                                        | ✅ RFID                                                                | ✅                                                         |

_Prețurile concurenților sunt cele publicate public la data documentului. Cele marcate
„la cerere" nu au listă de prețuri — asta e, în sine, o slăbiciune exploatabilă._

### 3.3 Slăbiciunea fiecăruia — și cum o atacăm

| Concurent                                                               | Slăbiciunea reală                                                                                                                                                                                             | Atacul nostru (mesaj literal)                                                                                                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **iFlow / HRiFlow**                                                     | E o aplicație de **pontaj** care a crescut module în jur. Nu atinge SSM, ISCIR, flotă, inventar. Facturarea „în trepte de 10 angajați" înseamnă că firma cu 14 oameni plătește pentru 20.                     | „Ai rezolvat pontajul. Dar dosarul de SSM tot în biblioraft e, iar ISCIR-ul tot în capul tău. Noi le ținem pe toate — și nu te taxăm pentru 6 angajați pe care nu-i ai." |
| **Papervee**                                                            | Probă de **doar 7 zile** — prea puțin ca să treci printr-o lună de pontaj. Planul Startup e limitat la 5 angajați. Prețul de 24 lei/utilizator la Business e **peste** al nostru pentru un produs mai îngust. | „7 zile nu-ți ajung să vezi o lună de pontaj închisă. Îți dăm 30 și îți dăm și SSM-ul, flota și REGES-ul, la un preț mai mic decât planul lor Business."                 |
| **colorful.hr / SD Worx**                                               | Preț netransparent, implementare lungă, orientat spre 200+ angajați. După achiziție, IMM-ul mic devine client de nișă inferioară.                                                                             | „Nu vrei un proiect de implementare de 45 de zile și un contract cu preț la cerere. Vrei să intri azi și să ai pontajul pe luna asta gata vineri."                       |
| **SoftwareHR și licențele „pe viață"** (1.990 € până la 50 de angajați) | Cost inițial mare, fără actualizare legislativă garantată. Legislația muncii se schimbă de 3–4 ori pe an.                                                                                                     | „O licență pe viață nu-ți actualizează REGES-ul când se schimbă procedura. Abonamentul da — și costă mai puțin decât dobânda la 1.990 €."                                |
| **Creasoft (2 €/angajat)**                                              | Foarte îngust — pontaj și monitorizare PC. Monitorizarea activității pe PC e o problemă de imagine internă.                                                                                                   | „Angajații tăi nu vor să fie monitorizați pe calculator. Vor să știe câte zile de concediu mai au."                                                                      |
| **Excel + biblioraft** (**adevăratul concurent, 70% din piață**)        | Zero cost aparent, dar: fără evidență zilnică validă la control, fără istoric, fără dovadă a instruirii SSM.                                                                                                  | „Excelul nu e o probă în fața inspectorului. Registrul din aplicație e — și îl listezi în 10 secunde, în format cerut."                                                  |

> **Nota tactică:** cel mai mare concurent al nostru **nu e iFlow, e inerția**. 60–70% din
> bugetul de conținut trebuie să atace „de ce Excelul nu mai e suficient în 2026", nu „de
> ce noi în loc de iFlow".

---

## 4. Diferențiatorul central (poziționarea, într-o singură frază)

> **Administrativo e singurul loc în care încape tot dosarul administrativ al unei firme
> românești de 15–150 de angajați — de la pontaj și concedii până la SSM, ISCIR, flotă și
> REGES — construit în română, cu izolarea datelor făcută în baza de date, nu pe încredere.**

Cele trei piloane, în ordinea puterii de convingere:

1. **Lățimea** (_„un singur loc, nu patru softuri și un biblioraft"_) — argumentul de
   cumpărare.
2. **Conformitatea cu termen** (_„REGES prin API, registru listabil la control"_) —
   argumentul de urgență.
3. **Izolarea și criptarea** (_„RLS la nivel de bază, CNP și IBAN cifrate"_) —
   argumentul care închide obiecția și **deschide canalul de contabilitate**.

---

## 5. Profilul clientului ideal (ICP) și personele

### 5.1 ICP — criterii de calificare, în ordinea puterii de predicție

| Criteriu                   | Ideal                                                                                                                                                  | Acceptabil                     | Descalificat                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------- |
| **Număr de angajați**      | 25–80                                                                                                                                                  | 15–150                         | sub 12 (durerea e prea mică) sau peste 250 (vor RFP și integrare ERP)                         |
| **Domeniu**                | Producție ușoară, construcții, HoReCa cu mai multe locații, retail cu magazine, transport, service auto, curățenie/pază, clinici medicale, IT services | Distribuție, agricultură       | Firme cu 1 punct de lucru și toți oamenii la birou, cu program fix — durerea de pontaj e zero |
| **Puncte de lucru**        | 2+                                                                                                                                                     | 1 mare                         | —                                                                                             |
| **Cine ține evidența azi** | Administratorul + o persoană de HR/back-office suprasolicitată                                                                                         | Firma de contabilitate externă | Departament de HR de 4+ oameni cu soft deja implementat                                       |
| **Semne de conformitate**  | Are obligații ISCIR, EIP, autorizații nominale, flotă auto                                                                                             | Doar SSM standard              | —                                                                                             |
| **Declanșator recent**     | Control ITM în ultimele 12 luni, amendă, angajări masive, deschiderea unui punct de lucru nou, plecarea persoanei care „știa tot"                      | Trecerea la REGES              | —                                                                                             |
| **Tehnologie**             | Deja folosesc ceva în cloud (facturare, contabilitate online)                                                                                          | Doar Excel + WhatsApp          | Refuz declarat al cloudului                                                                   |

**Semnalele de cumpărare de urmărit** (pentru prospectare):

- Anunțuri de angajare multiple postate în ultimele 30 de zile (creștere = durere)
- Deschidere de punct de lucru nou (ONRC / Termene.ro)
- Apariția firmei în comunicatele ITM despre controale în domeniul lor
- Angajarea unui „Specialist Resurse Umane" — înseamnă că durerea a depășit pragul
- Firme care postează pe LinkedIn despre creșterea echipei

### 5.2 Persona A — „Administratorul-proprietar" (decidentul economic)

|                                    |                                                                                                                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nume de lucru**                  | Mihai, 44 de ani, patron al unei firme de construcții/producție cu 45 de angajați și 2 puncte de lucru                                                                                                                     |
| **Rolul real**                     | Semnează tot. Vinde, negociază, se ocupă de bănci. HR-ul e „ce mai rămâne"                                                                                                                                                 |
| **Cum arată ziua lui**             | E întrerupt de 6–10 ori pe zi cu întrebări administrative: „câte zile de concediu mai am?", „când expiră fișa de aptitudine la Gheorghe?", „unde e contractul lui Ionuț?"                                                  |
| **Ce îl doare (în cuvintele lui)** | „Nu știu ce am semnat." · „Dacă vine controlul mâine, nu sunt sigur că ies bine." · „Fata de la birou știe tot — dacă pleacă, am o problemă." · „Plătesc contabilitatea și tot eu fac jumătate din muncă."                 |
| **Ce îl motivează**                | Liniștea. Să nu fie luat prin surprindere. Să nu depindă de o singură persoană                                                                                                                                             |
| **Declanșatorii de cumpărare**     | ① Control ITM, la el sau la un cunoscut · ② Amenda REGES · ③ Plecarea persoanei-cheie de la back-office · ④ Al doilea punct de lucru · ⑤ Contabilul îi spune „ar trebui să ai asta"                                        |
| **Unde stă**                       | Grupuri de Facebook de antreprenori, LinkedIn (pasiv), evenimente de branșă, patronate (CNIPMMR), la contabil                                                                                                              |
| **Obiecțiile lui**                 | „Cât costă?" (prima întrebare, mereu) · „Oamenii mei nu-s cu telefonul, nu vor ști să-l folosească" · „Am mai încercat un program și nu l-a folosit nimeni" · „Datele mele unde stau?" · „Nu am timp de implementare acum" |
| **Cum îl închizi**                 | **Nu cu funcționalități.** Cu o simulare de control ITM de 10 minute în care nu poate scoate documentele cerute. Apoi cu prețul comparat cu o singură amendă                                                               |
| **Fraza care îl mișcă**            | „Câți dintre angajații tăi au fișa de aptitudine expirată chiar acum? Dacă răspunsul e «nu știu», asta te costă 3.000 de lei la primul control."                                                                           |

### 5.3 Persona B — „Omul care ține de fapt evidența" (utilizatorul și campionul intern)

|                                  |                                                                                                                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nume de lucru**                | Andreea, 33 de ani, „Responsabil Resurse Umane și Administrativ" — în realitate face HR, achiziții, secretariat și interfața cu contabilul                                                                 |
| **Rolul real**                   | Singura care știe unde e fiecare hârtie. Nu are buget, dar are veto informal                                                                                                                               |
| **Cum arată luna ei**            | Zilele 1–5: coșmarul închiderii pontajului. Adună pontaje pe WhatsApp și pe hârtie, le bate în Excel, le trimite contabilului, primește 3 corecții                                                         |
| **Ce o doare (în cuvintele ei)** | „Închid pontajul 3 zile pe lună, noaptea." · „Toată lumea mă întreabă pe mine câte zile mai are." · „Când vine ITM-ul, eu caut prin bibliorafturi." · „Am 4 fișiere Excel care nu se potrivesc între ele." |
| **Ce o motivează**               | Să nu mai fie sertarul cu hârtii al firmei. Să plece în concediu fără să se prăbușească nimic. Recunoașterea că munca ei e complexă                                                                        |
| **Declanșatorii ei**             | ① Închiderea de lună · ② Un audit sau un control · ③ Creșterea numărului de angajați peste ~30 (pragul la care Excelul cedează) · ④ O greșeală care a costat bani                                          |
| **Unde stă**                     | Grupuri de Facebook „Resurse Umane România" / „Legislația muncii", newslettere juridice (avocatnet, legislatiamuncii.manager.ro), cursuri de inspector resurse umane, LinkedIn (activ)                     |
| **Obiecțiile ei**                | „Cine introduce toate datele?" (frica de migrare — **cea mai mare obiecție reală**) · „Colegii de pe șantier nu vor ponta pe telefon" · „Șeful nu aprobă bugetul"                                          |
| **Cum o câștigi**                | **Migrare gratuită și făcută de noi.** Îi iei din spate munca de introducere. Apoi îi dai un raport pe care să-l ducă șefului și să pară ea eroul                                                          |
| **Fraza care o mișcă**           | „Îți importăm noi cei 45 de angajați din Excelul tău. Tu nu bați nimic. Vineri ai pontajul închis în 20 de minute, nu în 3 seri."                                                                          |

### 5.4 Persona C — „Contabilul" (canalul, nu clientul)

|                        |                                                                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nume de lucru**      | Doamna Carmen, expert contabil, firmă de contabilitate cu 4 angajați și 55 de clienți                                                                                         |
| **De ce contează**     | E cea mai credibilă voce din viața administratorului. Când ea spune „luați asta", se ia                                                                                       |
| **Ce o doare**         | Clienții îi trimit pontaje pe WhatsApp, în poze, cu o zi înainte de termen. Face REGES-ul manual pentru 55 de firme. Fiecare modificare de contract e un telefon și un e-mail |
| **Ce vrea**            | Mai puține telefoane. Date care vin curate și la timp. Un venit recurent în plus care nu-i cere ore                                                                           |
| **Ce NU vrea**         | Să pară că vinde ceva. Să-și piardă serviciul de salarizare. Să fie responsabilă când softul greșește                                                                         |
| **Oferta pentru ea**   | Consolă multi-firmă gratuită + **30% comision recurent** + poziționarea „îți dau un serviciu nou de vândut, nu-ți iau unul"                                                   |
| **Fraza care o mișcă** | „Nu-ți luăm salarizarea. Îți dăm pontajul curat, la timp, în format bun, pentru toate cele 55 de firme — și 30% din abonamentele lor."                                        |

---

## 6. Propunerea de valoare și arhitectura de mesaje

### 6.1 Sloganuri

**Principal (homepage, h1):**

> ### Toată administrarea firmei tale. Într-un singur loc.
>
> Pontaj, concedii, salarii, SSM, REGES, flotă și inventar — pentru firme românești de la
> 15 la 150 de angajați. Fără bibliorafturi. Fără patru Exceluri.

**Variante pe segment / campanie:**

| Context                            | Slogan                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------ |
| Campanie conformitate / REGES      | **„Când vine controlul, ai tot dosarul la un clic."**                    |
| Campanie pe durere operațională    | **„Închizi luna vineri la 16:00, nu duminică la 23:00."**                |
| Campanie pentru administrator      | **„Firma ta nu trebuie să depindă de un singur om și un singur Excel."** |
| Campanie pentru contabili          | **„Pontaje curate, la timp, de la toți clienții tăi."**                  |
| Semnătură de brand (tagline scurt) | **„Administrativul, administrat."**                                      |

### 6.2 Cele trei pitch-uri de lift

**① 15 secunde (la eveniment, în lift, la telefon):**

> „Administrativo e locul unde firma ta de 15–150 de angajați își ține tot dosarul
> administrativ: pontaj, concedii, salarii, SSM, REGES, flotă. În loc de patru Exceluri și
> un biblioraft. Costă cât o amendă ITM împărțită la doi ani."

**② 45 de secunde (întâlnire, primul minut):**

> „Firmele de mărimea voastră au aceleași obligații ca una de 500 de oameni, dar n-au
> departament de HR. Rezultatul: pontajul se ține în Excel, dosarele SSM în biblioraft,
> REGES-ul îl face contabilul cu întârziere, iar când vine ITM-ul, cineva caută trei ore
> prin sertare. Administrativo pune toate astea într-un singur loc, în română, construit pe
> legislația de aici — inclusiv transmiterea REGES direct prin API, nu prin fișiere.
> Angajatul își vede singur concediile pe telefon și nu mai întreabă pe nimeni.
> Vă import eu datele din Excel, și în două săptămâni închideți prima lună în aplicație."

**③ 2 minute (versiunea pentru contabil):**

> „Aveți, să zicem, 50 de clienți. La fiecare închidere de lună primiți pontaje pe
> WhatsApp, în poze, în ultima zi. Corectați, transcrieți, calculați. Iar de la REGES
> încoace, orice modificare de contract are termen de 3 sau 5 zile lucrătoare și amendă de
> 5.000–8.000 de lei dacă îl scapă cineva.
> Administrativo vă dă o consolă în care vedeți toate firmele-client, fiecare complet
> izolată de celelalte — izolarea e făcută în baza de date, nu prin filtre, și e testată
> automat. Clientul pontează la el, datele vin la voi curate și la timp, iar REGES-ul se
> transmite din aplicație cu recipisă.
> Nu vă luăm salarizarea — noi ne oprim la fluturaș, D112 rămâne la voi. Iar pentru fiecare
> client care intră prin voi, primiți 30% din abonament, recurent, cât timp rămâne client."

### 6.3 Matricea de mesaje — durere → dovadă → beneficiu cuantificat

| Durerea (cuvintele lor)                        | Ce arătăm                                                         | Beneficiul, în cifre                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| „Închid pontajul 3 zile pe lună"               | Foaia colectivă cu calculul automat al orelor suplimentare        | **~20 de ore/lună recuperate** = ~4.800 lei/an la un cost orar de 20 lei |
| „Nu știu cine are fișa de aptitudine expirată" | Modulul SSM + notificările de expirare                            | **Amendă de 1.500–3.000 lei evitată** per neconformitate                 |
| „REGES-ul îl face contabilul, uneori târziu"   | Coada de mesaje REGES + recipise                                  | **5.000–8.000 lei/caz** evitați la depășirea termenului de 5 zile        |
| „La control caut prin bibliorafturi"           | Registrul de documente, listabil instantaneu (OMFP 2634/2015)     | Controlul se închide în **o oră, nu într-o zi**                          |
| „Toată lumea mă întreabă câte zile mai are"    | Portalul angajatului                                              | **6–10 întreruperi/zi eliminate**                                        |
| „Nu știu cât mă costă de fapt un om"           | Rapoarte: venit, ore suplimentare, tichete, concediu, per angajat | Decizii de personal pe cifre, nu pe intuiție                             |
| „Am date personale, mi-e frică de GDPR"        | CNP și IBAN criptate AES-256-GCM la nivel de coloană              | Argument pentru DPO și pentru clauza din contract                        |
| „Am mai luat un soft și nu l-a folosit nimeni" | Asistentul AI + portal simplificat + migrare făcută de noi        | **Adopție peste 70%** în prima lună — o punem în contract                |

### 6.4 Ambalarea și prețul _(propunere de lansare)_

Prețul se face **per angajat activ, pe lună, minim 15 angajați**, ca să nu penalizăm firma
de 14 oameni (spre deosebire de facturarea în trepte de 10 a iFlow).

| Pachet          | Preț                        | Module incluse                                                                                             | Cui se vinde                                                       |
| --------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Conform**     | **12 lei / angajat / lună** | Nucleu, Angajați, Documente, **REGES**, Pontaj, Concedii, Registru documente, Portal angajat, Notificări   | Firma care cumpără liniștea la control. Ușa de intrare             |
| **Personal** ⭐ | **21 lei / angajat / lună** | Tot din _Conform_ + Salarizare, SSM și PSI, Onboarding, Cursuri, Evaluări, Anunțuri, Organigramă, Rapoarte | **Pachetul recomandat.** 80% din vânzări trebuie să aterizeze aici |
| **Operațiuni**  | **29 lei / angajat / lună** | Tot + Parc auto, Mentenanță/ISCIR, Inventar, Diurnă, Ticketing, Asistent AI, acces API                     | Producție, construcții, transport, service                         |

**Reguli comerciale:**

- **30 de zile probă, fără card** (vs. 7 zile la Papervee — folosește-l în comparație).
- **–20% la plata anuală**; blocarea prețului pe 24 de luni.
- **Migrare și import gratuite** sub 100 de angajați. E cel mai puternic instrument de
  închidere pe care îl avem; nu-l vinde, dăruiește-l.
- **Fără cost de implementare.** Poziționează asta explicit față de „1.990 € + 30 de zile
  de implementare".
- **Angajații inactivi nu se facturează** — importantă pentru HoReCa și construcții cu
  sezonalitate. Concurența nu spune asta clar.

---

## 7. Canale de achiziție (GTM)

Ordinea de prioritate a bugetului în primele 90 de zile:
**① Parteneriate cu contabili (40%) · ② Google Ads BOFU (30%) · ③ Conținut SEO (20%) ·
④ LinkedIn (10%).**

### 7.1 Bottom-of-Funnel: Google Ads

**Buget de start: 4.000–6.000 lei/lună.** Obiectiv: nu clicuri, ci **demonstrații
programate sub 350 lei**.

#### Structura de campanii

| Campanie                    | Tip                              | Strategie                          | Buget/lună |
| --------------------------- | -------------------------------- | ---------------------------------- | ---------- |
| **1. Intenție de soluție**  | Search, potrivire frază + exactă | Maximizare conversii, tCPA 300 lei | 1.800 lei  |
| **2. Conformitate / REGES** | Search                           | tCPA 250 lei                       | 1.200 lei  |
| **3. Concurență (brand)**   | Search, exactă                   | CPC manual plafonat                | 600 lei    |
| **4. Nișe operaționale**    | Search                           | tCPA 350 lei                       | 700 lei    |
| **5. Remarketing**          | Display + YouTube                | 30 zile, frecvență 3/săpt.         | 400 lei    |

#### Grupurile de cuvinte-cheie

**Campania 1 — Intenție de soluție (cea mai profitabilă):**

| Grup       | Cuvinte-cheie                                                                                                                                                                | Intenție |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Pontaj     | `program pontaj angajati`, `aplicatie pontaj online`, `software pontaj firma`, `program de pontaj electronic`, `condica de prezenta electronica`, `aplicatie pontaj telefon` | ★★★      |
| HR general | `soft resurse umane`, `program resurse umane firma`, `software hr imm`, `aplicatie administrare personal`, `program evidenta angajati`                                       | ★★★      |
| Concedii   | `program evidenta concedii`, `aplicatie cereri concediu online`, `software gestionare concedii angajati`                                                                     | ★★★      |
| Salarizare | `program salarizare imm`, `soft calcul salarii firma mica`, `program state de plata`                                                                                         | ★★☆      |

**Campania 2 — Conformitate / REGES (volum în creștere, concurență mică):**

`program reges online`, `aplicatie transmitere reges`, `software reges api`,
`transmitere reges automat`, `program registru salariati`, `reges online firma`,
`software conformitate itm`, `program dosar personal angajat`,
`registru intrari iesiri documente program`, `evidenta ore lucrate program obligatoriu`

**Campania 3 — Concurență (CPC mic, intenție maximă, volum mic):**

`iflow pret`, `iflow alternativa`, `hriflow preturi`, `papervee pret`,
`papervee alternativa`, `colorful hr pret`, `alternativa colorful hr`,
`dp payroll pret`, `creasoft pontaj pret`, `smartree mystaff pret`

> ⚠️ Pagini de destinație dedicate, comparative, oneste („Ce face iFlow mai bine decât
> noi"). Nu folosi marca lor în textul reclamei — doar în pagină. Onestitatea în
> comparație convertește mai bine decât superlativele și evită reclamațiile.

**Campania 4 — Nișe operaționale (volum mic, concurență zero, conversie mare):**

`program gestiune flota auto firma`, `aplicatie foi de parcurs`,
`program mentenanta echipamente`, `software iscir verificari`,
`program evidenta ssm angajati`, `aplicatie fise ssm`,
`program inventar obiecte de inventar angajati`, `aplicatie calcul diurna`

#### Cuvinte-cheie negative (obligatorii de la ziua 1)

`gratis`, `gratuit`, `free`, `model`, `formular`, `descarca`, `download`, `pdf`, `excel`,
`sablon`, `curs`, `cursuri`, `certificare`, `inspector resurse umane`, `job`, `angajare`,
`salarii medii`, `revisal descarcare`, `cod cor lista`, `wikipedia`, `forum`

#### Reguli pentru anunțuri

- Titlul 1 = cuvântul-cheie exact al grupului. Fără creativitate, doar potrivire.
- Titlul 2 = diferențiatorul: `Pontaj + SSM + REGES într-un loc`.
- Titlul 3 = oferta: `30 de zile gratuit, fără card`.
- Descrierea trebuie să conțină **o cifră legală**: „Amenda pentru lipsa evidenței orelor
  e 1.500–3.000 lei. Abonamentul începe de la 12 lei/angajat."
- Extensii: sitelink-uri pe module (Pontaj / SSM / REGES / Flotă), extensii de preț
  (transparența e diferențiator față de „la cerere"), extensii de apel.

#### Pagini de destinație — una per campanie, niciodată homepage-ul

Structură obligatorie: **titlu = cuvântul căutat** → captură de ecran reală (nu ilustrații
generice) → 3 beneficii cu cifre → cifra amenzii → tabel comparativ → mărturie → formular
de 4 câmpuri (nume, firmă, telefon, nr. angajați) → „30 de zile, fără card".

### 7.2 Top-of-Funnel: SEO și conținut („Pain-point SEO" pe legislația muncii)

**Teza:** în România, oamenii nu caută „HR software". Caută **întrebări despre lege**.
Fiecare astfel de întrebare are în spate un administrator cu o problemă. Câștigăm prin a
răspunde mai bine și mai precis decât portalurile juridice — și prin a atașa un
instrument gratuit la finalul fiecărui răspuns.

#### Cele 7 clustere de conținut

| #     | Cluster (pagină-pilon)                                   | Articole satelit (exemple)                                                                                                                                                                                                            | Instrumentul gratuit atașat                                               |
| ----- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **1** | **REGES-ONLINE: ghidul complet al angajatorului**        | „REGES vs. Revisal: ce s-a schimbat de fapt" · „Toate termenele REGES într-un tabel (1, 3, 5, 20 de zile)" · „Amenzile REGES în 2026, pe articole" · „Cum delegi accesul REGES către contabil" · „Ce faci dacă ai depășit termenul"   | **Calculator de risc REGES** — 8 întrebări → „ești expus la X lei amendă" |
| **2** | **Pontajul angajaților: ce cere legea, ce verifică ITM** | „Evidența zilnică a orelor — art. 119 pe înțelesul patronului" · „Cum se calculează corect orele suplimentare" · „Pontaj pentru muncă în ture / la șantier" · „Amenda pentru lipsa pontajului" · „Model fișă de pontaj 2026"          | **Generator de fișă de pontaj** (Excel + PDF, cu antetul firmei)          |
| **3** | **Concediile: toate cele 11 tipuri**                     | „Câte zile de concediu de odihnă am dreptul" · „Concediul neefectuat: se compensează sau se pierde?" · „Concediu fără plată: limite legale" · „Zile suplimentare pentru vechime" · „Concediu de îngrijitor"                           | **Calculator de sold de concediu** cu prorată la angajare/plecare         |
| **4** | **SSM și PSI pentru firma mică**                         | „La cât timp se face instruirea periodică, pe categorii" · „Fișa individuală de instruire: model și greșeli" · „Medicina muncii: obligațiile angajatorului" · „EIP: cine plătește și cum se justifică" · „Ce cere ITM la dosarul SSM" | **Checklist de audit SSM** (PDF, 40 de puncte)                            |
| **5** | **Salarizare și costul muncii**                          | „Calcul salariu brut–net" · „Tichete de masă: plafon și tratament fiscal" · „Cât costă de fapt un angajat pe firmă" · „Popriri pe salariu: cum se rețin corect"                                                                       | **Calculator brut–net** + **calculator cost total angajator**             |
| **6** | **Documente de personal**                                | „Model contract individual de muncă" · „Fișa postului: structură obligatorie" · „Adeverință de salariat: toate variantele" · „Decizie de încetare: model pe fiecare temei" · „Registrul de intrări-ieșiri conform OMFP 2634/2015"     | **Generator de documente** (3 gratuite, apoi cont)                        |
| **7** | **Operațiuni: flotă, ISCIR, inventar**                   | „Foaia de parcurs: ce trebuie să conțină" · „Periodicitatea verificărilor ISCIR" · „Proces-verbal de predare-primire obiecte de inventar" · „Deconturi de diurnă intern și extern"                                                    | **Calculator de diurnă** intern/extern                                    |

#### Ritm și distribuție

- **2 articole de fond pe săptămână** (1.500–2.500 de cuvinte, cu tabel de termene și
  articolul de lege citat), plus **1 actualizare** a unui articol vechi.
- Fiecare articol are: tabel cu termene/amenzi · citat exact din act normativ · secțiune
  „Cum arată asta în Administrativo" cu o captură de ecran · CTA către instrumentul gratuit.
- **Instrumentele gratuite sunt principalul motor de link-uri și de e-mailuri.** Un
  calculator bun de brut–net atrage linkuri de la bloguri de contabilitate fără să ceri.
- **Newsletter „Alerta legislativă"** — un e-mail lunar cu ce s-a schimbat în legislația
  muncii, în 5 puncte. Devine cel mai bun activ de nurturing: contabili și HR se abonează
  și rămân. Țintă: 2.500 de abonați în 12 luni.
- **YouTube / Reels scurte** (60–90 s): „Ce te întreabă ITM-ul la un control", câte un
  punct per clip. Reutilizabile în Ads și pe LinkedIn.

### 7.3 LinkedIn B2B — pilonii de conținut și tactica de contactare

**Contul care postează e al fondatorului, nu al firmei.** În B2B românesc, paginile de
companie au acoperire aproape zero; profilurile de oameni au. Pagina firmei servește doar
ca dovadă de existență și ca destinație pentru reclame.

#### Cei 5 piloni de conținut (ritm: 4 postări/săptămână)

| Pilon                            | Pondere | Format                           | Exemplu de deschidere                                                                                                                                                                           |
| -------------------------------- | ------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Legislația, tradusă**       | 30%     | Carusel sau text cu tabel        | „REGES are 4 termene diferite. Le confundă aproape toată lumea. Tabelul de care ai nevoie 👇"                                                                                                   |
| **2. Anatomia unui control ITM** | 25%     | Poveste + listă                  | „Un inspector ITM cere 7 documente. În ordinea asta. Dacă lipsește al treilea, nu mai contează celelalte."                                                                                      |
| **3. Construit în public**       | 20%     | Din culise, tehnic dar accesibil | „Am scris ERP-ul ăsta în română, cu ș și ț cu virgulă. Iată de ce contează, și de ce aproape nimeni n-o face." · „Cum garantezi că datele firmei A nu ajung la firma B: nu prin filtre în cod." |
| **4. Cifre și studii de caz**    | 15%     | Înainte/după, cu cifre reale     | „O firmă de construcții cu 62 de angajați închidea pontajul în 11 ore. Acum în 40 de minute. Ce am schimbat de fapt:"                                                                           |
| **5. Contabilul, erou**          | 10%     | Dedicat canalului de parteneri   | „Contabilii primesc pontaje pe WhatsApp, în poze, în ultima zi. Nu e vina lor și nu e vina clientului. E o problemă de format."                                                                 |

**Reguli de format:** primele 2 rânduri decid totul (ele apar înainte de „vezi mai mult").
Fără link în postare — linkul în primul comentariu. Un singur mesaj per postare. Întrebare
la final, ca să genereze comentarii.

#### Tactica de contactare pe LinkedIn (fără a fi „încă un vânzător")

**Regula de aur: 3 atingeri de valoare înainte de orice cerere.**

| Pas | Ziua                | Acțiune                                                                                                                                                                  |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | —                   | Construiește lista: `Sales Navigator` → România → 11–200 de angajați → funcții: Administrator, Director General, HR Manager, Responsabil Resurse Umane → industrii țintă |
| 1   | Z0                  | Vizitează profilul. Reacționează la o postare recentă (nu generic — comentariu de 2 rânduri, cu substanță)                                                               |
| 2   | Z2                  | **Cerere de conectare fără mesaj** (rata de acceptare e semnificativ mai mare decât cu pitch atașat)                                                                     |
| 3   | Z3 (după acceptare) | Mesaj **fără nicio cerere** — doar resursa: vezi șablonul §8.3                                                                                                           |
| 4   | Z8                  | Dacă a răspuns: întrebare de diagnostic. Dacă n-a răspuns: al doilea material, alt unghi                                                                                 |
| 5   | Z15                 | Cererea de întâlnire, formulată ca ofertă de diagnostic, nu de demo                                                                                                      |

**Reclame LinkedIn:** doar retargeting pe vizitatorii site-ului și **Document Ads** cu
ghidurile („Ghidul REGES pentru angajatori", „Checklist de audit SSM"). Buget mic,
500–800 lei/lună. Prospectarea rece plătită pe LinkedIn e prea scumpă pentru un ARPA de
840 lei/lună.

---

## 8. Motorul de vânzări și contactarea directă

### 8.1 Procesul de vânzare, pe etape

| Etapă | Denumire                                      | Criteriu de ieșire (obiectiv, verificabil)                         | Durată țintă |
| ----- | --------------------------------------------- | ------------------------------------------------------------------ | ------------ |
| 0     | **Listă**                                     | Firmă în ICP, cu persoană de contact identificată nominal          | —            |
| 1     | **Contact**                                   | A răspuns la e-mail/LinkedIn/telefon                               | 1–10 zile    |
| 2     | **Diagnostic** (15 min, telefon)              | Am confirmat: nr. angajați, cine ține evidența azi, un declanșator | 3 zile       |
| 3     | **Demonstrație** (35 min, video sau la sediu) | A văzut **propriile date**, nu date demo                           | 5 zile       |
| 4     | **Probă** (30 zile)                           | Are ≥1 lună de pontaj introdusă și ≥3 utilizatori activi           | 30 zile      |
| 5     | **Propunere**                                 | Ofertă scrisă, cu pachet și număr de angajați                      | 3 zile       |
| 6     | **Închidere**                                 | Contract semnat, prima factură                                     | 7 zile       |

**Ciclu total țintă: 45–60 de zile.** Sub 15 angajați se scurtează la 21 (autoservire
pură). Peste 100 se lungește la 90 (apar juristul și DPO-ul).

**Regula anti-pierdere de timp:** un cont care la ziua 10 de probă n-a introdus niciun
angajat **nu e o oportunitate, e o statistică**. Se trece automat pe nurturing prin
newsletter. Nu se mai sună.

### 8.2 Contactare rece prin e-mail — secvența de 5 atingeri

**Principii:** subiect scurt, cu literă mică, fără cuvinte de marketing (trece mai bine de
filtre și pare scris de om) · un singur mesaj per e-mail · fără atașamente la primul
contact · fără imagini · **cerere mică** (nu „demo de 45 de minute", ci „îți trimit?") ·
maximum 120 de cuvinte.

---

**E-mail 1 — Ziua 0. Unghiul: durerea specifică industriei**

> **Subiect:** pontajul la [Nume Firmă]
>
> Bună ziua, domnule/doamnă [Nume],
>
> Am văzut că [Nume Firmă] are [X] angajați și [două puncte de lucru / a mai deschis un
> punct de lucru anul acesta].
>
> La firmele de mărimea asta din construcții, pontajul ajunge de obicei la o singură
> persoană care îl adună de pe WhatsApp și îl bate în Excel în primele trei zile ale lunii.
> Iar dosarele de SSM stau separat, în biblioraft.
>
> Noi am construit Administrativo exact pentru situația asta — pontaj, concedii, SSM și
> REGES în același loc, în română.
>
> Vă interesează să vă trimit o captură cu cum arată închiderea de lună? Două minute de
> citit, fără întâlnire.
>
> [Semnătură]

---

**E-mail 2 — Ziua 4. Unghiul: cifra legală (cel mai bun randament din secvență)**

> **Subiect:** 3.000 lei / persoană
>
> Revin scurt, cu un singur lucru.
>
> Din octombrie 2025, lipsa înregistrării în REGES se sancționează cu 15.000–20.000 lei,
> iar netransmiterea la termen cu 3.000–8.000 lei de caz. Separat, lipsa evidenței zilnice
> a orelor lucrate: 1.500–3.000 lei.
>
> Cele mai multe firme cu care vorbim nu sunt neconforme din rea-voință — pur și simplu
> nimeni nu urmărește termenele de 3 și 5 zile lucrătoare.
>
> Am făcut un checklist de 8 întrebări care arată unde stă o firmă. Durează 3 minute:
> [link]
>
> Dacă iese verde, mă bucur și vă las în pace.

---

**E-mail 3 — Ziua 9. Unghiul: dovada socială din același județ / aceeași industrie**

> **Subiect:** o firmă ca a dumneavoastră
>
> [Firmă similară, din aceeași industrie și zonă] avea 62 de angajați pe 4 șantiere.
> Închideau pontajul în ~11 ore pe lună, cu trei corecții după ce ajungea la contabil.
>
> Acum durează 40 de minute, iar contabilul primește fișierul direct.
>
> Nu au schimbat oamenii, au schimbat locul unde se strâng datele.
>
> Vreți 20 de minute joi sau vineri să vă arăt exact ce am schimbat? Dacă nu se potrivește
> pentru dumneavoastră, vă spun eu primul.

---

**E-mail 4 — Ziua 16. Unghiul: rupere de tipar / întrebare directă**

> **Subiect:** închid subiectul?
>
> V-am scris de trei ori și n-am nimerit momentul — se întâmplă.
>
> Ca să nu vă mai ocup inboxul, un singur răspuns îmi e de ajuns:
>
> 1 — mă interesează, dar nu acum
> 2 — avem deja o soluție
> 3 — nu e o problemă la noi
>
> Orice cifră îmi scrieți, respect răspunsul.

---

**E-mail 5 — Ziua 45. Reactivare pe declanșator**

Se trimite **doar când există un eveniment**: un control ITM în industria lor, o
modificare legislativă, o angajare postată de ei.

> **Subiect:** s-a schimbat ceva la [subiect]
>
> [Una-două fraze despre schimbarea concretă și ce înseamnă practic pentru ei.]
>
> Am scris aici ce trebuie făcut, în ordine: [link]
>
> Fără altă solicitare. Dacă e util, e util.

**Cifre de referință realiste (B2B rece, România, listă bine țintită):**
deschidere 35–50% · răspuns **6–9%** · întâlniri programate 2–3% din contactele inițiate.
La 400 de e-mailuri/lună (100/săptămână) ⇒ **8–12 întâlniri/lună** din acest canal.

### 8.3 Scripturi LinkedIn

**Mesaj 1 — după acceptarea conexiunii (Z3). Zero cerere.**

> Mulțumesc de conectare, [Prenume].
>
> V-am văzut postarea despre [subiect concret] — de asta v-am scris.
>
> Lucrez cu firme de 20–150 de angajați pe partea de administrare de personal și tocmai am
> pus cap la cap toate termenele REGES într-un tabel de o pagină (1, 3, 5 și 20 de zile —
> se confundă des). Vi-l trimit? Fără nimic în schimb, e util și dacă nu vorbim niciodată.

**Mesaj 2 — după ce a acceptat resursa (Z8). Diagnostic, nu pitch.**

> Vi l-am trimis mai sus.
>
> Din curiozitate profesională: la [Firmă], cine urmărește termenele astea acum — cineva
> din firmă sau contabilul extern?
>
> Întreb pentru că la aproape toate firmele de mărimea asta răspunsul e „amândoi, parțial",
> și exact acolo se pierd termenele.

**Mesaj 3 — cererea de întâlnire (Z15). Vândută ca diagnostic, nu ca demo.**

> [Prenume], vă propun ceva concret.
>
> 20 de minute pe video, în care nu vă arăt nimic din produs în primele 10. Vă pun 6
> întrebări — aceleași pe care le pune un inspector ITM — și vă spun sincer unde stați.
>
> Dacă ieșiți bine, ne despărțim prieteni și aveți un audit gratuit. Dacă nu, vă arăt ce
> ar rezolva Administrativo și decideți dumneavoastră.
>
> Marți la 10 sau joi la 15?

**Mesaj pentru contabili (listă separată, alt ton):**

> Bună ziua, doamnă [Nume].
>
> Vă scriu ca la coleg de breaslă, nu ca vânzător: câte dintre firmele pe care le țineți vă
> trimit pontajele în ultima zi, în poze pe WhatsApp?
>
> Am construit o platformă în care clientul pontează la el, iar dumneavoastră primiți datele
> curate, în același format, de la toți. Aveți o consolă cu toate firmele, fiecare izolată
> complet de celelalte.
>
> Nu ne atingem de salarizare — ne oprim la fluturaș, D112 rămâne la dumneavoastră.
>
> Merită 20 de minute?

### 8.4 Telefonul rece (cel mai eficient canal pentru Persona A)

Administratorul de firmă românească răspunde la telefon. Deschiderea, cuvânt cu cuvânt:

> „Bună ziua, [Nume]? Sunt [X] de la Administrativo. Vă sun la rece, 30 de secunde și
> închid dacă nu e cazul — e ok?
>
> _(pauză, aștepți „da")_
>
> Lucrăm cu firme de [X] angajați din [industrie] și cel mai des auzim aceleași două lucruri:
> pontajul se ține în Excel și dosarul de SSM e prin bibliorafturi. La dumneavoastră cine se
> ocupă de partea asta acum?"

**Regula:** după întrebare, **taci**. Prima persoană care vorbește pierde. Obiectivul
apelului nu e vânzarea, e **ora întâlnirii**.

### 8.5 Demonstrația — structura de 35 de minute

Aceasta e cea mai importantă parte a vânzării. Se numește intern **„controlul ITM
simulat"** și **nu începe cu produsul**.

| Minut     | Ce se întâmplă                                                                                                                                                                                                                                                                                                                                                                                                                                                    | De ce                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **0–3**   | Agenda + permisiunea: „Vă pun întâi câteva întrebări, apoi vă arăt doar ce e relevant. Dacă la final nu se potrivește, vă spun eu."                                                                                                                                                                                                                                                                                                                               | Stabilește controlul și onestitatea                                    |
| **3–13**  | **Simularea controlului.** 6 întrebări, puse ca de inspector: ① Îmi arătați evidența orelor pentru [angajat X], ziua de 14 luna trecută? ② Când a fost ultima instruire SSM periodică la [angajat Y] și unde e semnătura? ③ Câte zile de concediu are neefectuate [angajat Z]? ④ Îmi listați registrul de intrări-ieșiri pe august? ⑤ Când expiră fișa de aptitudine la cel mai vechi angajat? ⑥ Îmi arătați recipisa REGES pentru ultima modificare de contract? | **Aici se vinde.** Clientul descoperă singur golurile. Nu i le spui tu |
| **13–15** | Tăcere + notarea răspunsurilor pe ecran, sub formă de listă. „Deci: 4 din 6 nu le putem scoate acum."                                                                                                                                                                                                                                                                                                                                                             | Cuantificarea durerii, cu cuvintele lui                                |
| **15–30** | **Demonstrație numai pe cele 4 goluri găsite.** Cu datele lui (cere lista de angajați în Excel înainte de întâlnire și importă-o)                                                                                                                                                                                                                                                                                                                                 | Nu turul produsului. Turul rezolvării                                  |
| **30–33** | Preț, direct și fără ezitare: „La [X] angajați, pachetul Personal = [sumă] lei/lună. Comparativ, o singură amendă pe evidența orelor e 3.000."                                                                                                                                                                                                                                                                                                                    | Prețul rostit clar semnalează încredere                                |
| **33–35** | **Pasul următor cu dată.** „Vă deschid contul astăzi, vă import angajații până mâine seară, și ne vedem 15 minute luni la 10 să vedem cum a mers prima zi."                                                                                                                                                                                                                                                                                                       | Fără „vă mai gândiți" — mereu o dată în calendar                       |

**Reguli:**

- **Cere lista de angajați în Excel ÎNAINTE de demonstrație** și importă-o. Diferența
  între o demonstrație pe date demo și una pe oamenii lui e diferența dintre 20% și 50%
  rată de închidere.
- Dacă la întâlnire vine doar Persona B (Andreea), obiectivul întâlnirii **nu e vânzarea**,
  ci **pregătirea ei să vândă intern**: îi dai un PDF de o pagină, cu cifrele, pe care
  să-l ducă la administrator.
- Niciodată mai mult de 3 module în demonstrație. Lățimea se povestește, nu se arată.

### 8.6 Întâlnirile fizice cu patronii locali

Contextul românesc: la 15–150 de angajați, decizia se ia des **la sediu, față în față**,
adesea după o cafea. Regulile specifice:

- **Mergi la sediul lui, nu-l chema.** Costul e o oră de drum, câștigul e că vezi
  bibliorafturile. Cere să le vezi: „Îmi arătați unde țineți dosarele de personal?" —
  imaginea aceea face jumătate din vânzare.
- **Adu ceva pe hârtie.** Paradoxal, dar funcționează: un dosar tipărit cu tabelul
  amenzilor, checklistul SSM și o pagină cu prețul. Rămâne pe birou după ce pleci.
- **Vorbește despre bani, nu despre funcționalități.** „Vă costă [sumă] pe lună. La 45 de
  angajați, dacă evitați o singură amendă, e plătit pe 4 luni."
- **Nu contrazice niciodată contabilul.** Dacă spune „mi-a zis contabilul că e ok cum
  facem", răspunsul e: „Are dreptate pe partea de salarizare — noi nu ne atingem de ea.
  Noi rezolvăm ce nu intră în fișa contabilului: pontajul zilnic, SSM-ul, ISCIR-ul.
  Vreți să vorbesc eu direct cu dânsul?" **Asta convertește contabilul în partener,
  chiar în timpul întâlnirii.**
- **Adu decizia la o singură întrebare:** „Vreți să începem cu tot, sau doar cu pontajul
  și SSM-ul, o lună, ca să vedem?" Ambele răspunsuri sunt „da".
- **Follow-up în aceeași zi**, până în ora 18: un e-mail de 5 rânduri cu ce s-a discutat și
  cu următorul pas. Rata de închidere scade la jumătate dacă trimiți a doua zi.

### 8.7 Obiecții — răspunsurile scrise

| Obiecția                                               | Răspunsul (spus, nu citit)                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **„E scump."**                                         | „Față de ce? Dacă e față de Excel, da, Excelul e gratis până la primul control. La [X] angajați sunteți la [sumă] pe lună — sub o amendă pe evidența orelor, care e 1.500–3.000 lei. Câte luni de abonament sunt într-o amendă?"                                                                                                              |
| **„Nu am timp de implementare."**                      | „De asta importăm noi datele. Îmi trimiteți Excelul cu angajații, îl încărcăm noi. Timpul dumneavoastră: 30 de minute, o dată."                                                                                                                                                                                                               |
| **„Oamenii mei nu vor ști să-l folosească."**          | „Angajatul face un singur lucru: își vede concediile și pontajul. Are și un asistent în aplicație care răspunde în română la «unde se face X». Iar dacă în prima lună nu-l folosesc măcar 70%, opriți plata."                                                                                                                                 |
| **„Am mai luat un soft și n-a mers."**                 | „Care? Și în ce lună a murit — la prima închidere de lună sau la a doua?" _(ascultă, apoi:)_ „Exact. Softurile mor la prima închidere de lună. De asta la noi primul obiectiv nu e să vă înregistrați, e să închideți o lună completă. Vă ajut eu la prima."                                                                                  |
| **„Datele mele unde stau? Nu am încredere în cloud."** | „În Uniunea Europeană, criptate. CNP-urile și IBAN-urile sunt cifrate separat, la nivel de coloană — nici administratorul de sistem nu le vede în clar. Iar izolarea între firme e făcută de baza de date, nu de programul nostru — și e testată automat la fiecare modificare. Vă dau descrierea tehnică pentru contabil sau pentru avocat." |
| **„Mă mai gândesc."**                                  | „Firește. Ca să nu vă mai sun degeaba: la ce vă gândiți, la preț sau la momentul potrivit?" _(sunt singurele două variante reale; oricare ar fi, ai acum obiecția adevărată)_                                                                                                                                                                 |
| **„Vorbesc cu contabilul întâi."**                     | „Perfect, e răspunsul corect. Vreți să vorbesc eu cu dânsul? Avem un program de parteneriat și e posibil să-l cunoaștem deja. În plus, dânsul câștigă din asta."                                                                                                                                                                              |
| **„Facem deja cu iFlow / Papervee."**                  | „Bine, deci pontajul e rezolvat. Atunci întrebarea mea e alta: dosarul de SSM unde stă? Și verificările ISCIR? Pentru că acolo nu vă ajută. Nu vă cer să schimbați pontajul — vă întreb dacă vreți să nu mai aveți trei locuri."                                                                                                              |

---

## 9. „Growth hack": modelul de parteneriat cu firmele de contabilitate

> **Aceasta este cea mai importantă secțiune a documentului.** Toate celelalte canale scalează
> liniar cu bugetul și cu numărul de oameni. Acesta scalează cu numărul de parteneri, iar
> fiecare partener aduce un portofoliu întreg.

### 9.1 De ce funcționează, mecanic

| Fapt                                                                                                                | Consecință comercială                                                  |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| O firmă de contabilitate medie are **30–80 de clienți IMM**, exact în ICP-ul nostru                                 | Un partener = un portofoliu, nu un client                              |
| Contabilul e **cel mai crezut sfătuitor** al administratorului, peste orice reclamă                                 | Costul convingerii scade aproape la zero                               |
| Contabilul **suferă direct** de datele murdare: pontaje pe WhatsApp, în ultima zi                                   | Vindem soluția durerii LUI, nu a clientului lui                        |
| REGES-ul e **deja treaba lui** la majoritatea firmelor mici, cu termene de 3 și 5 zile și amenzi de 5.000–8.000 lei | Riscul e al lui; instrumentul îl protejează                            |
| **Nu concurăm cu el:** ne oprim la fluturaș, D112 și declarațiile rămân ale lui                                     | Dispare obiecția existențială („îmi luați clientul?")                  |
| **Arhitectura multi-tenant cu RLS FORCED** face consola multi-firmă sigură prin construcție                         | Putem promite izolarea în scris, nu doar verbal — și e testată automat |

### 9.2 Oferta pentru partener — trei modele, la alegerea lui

| Model                            | Cum funcționează                                               | Comisionul                                      | Cui i se potrivește                                                        |
| -------------------------------- | -------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| **A. Recomandare**               | Ne trimite clientul, noi vindem și facturăm                    | **20% recurent**, cât timp clientul rămâne      | Contabilul prudent, care nu vrea implicare                                 |
| **B. Partener** ⭐               | Recomandă, participă la demonstrație, ajută la configurare     | **30% recurent** + consolă multi-firmă gratuită | **Modelul standard.** 70% din parteneri                                    |
| **C. Revânzare / marcă proprie** | Cumpără cu **–40%** și facturează el clientului, la prețul lui | Marja lui, integral                             | Firme de contabilitate mari, cu 100+ clienți, care vor un serviciu propriu |

**Ce primește partenerul, indiferent de model:**

1. **Consolă multi-firmă gratuită** — vede toate firmele-client, comută între ele într-un
   clic, fiecare izolată prin RLS.
2. **Abonament gratuit pentru propria firmă de contabilitate**, pe viață. Costă zero, e
   folosit zilnic și devine reflex.
3. **Materiale cu marca lui**: broșura, prezentarea și e-mailul către clienți, cu logoul
   firmei lui.
4. **Instruire de 2 ore** + un curs în platformă cu adeverință (folosim propriul modul de
   Cursuri — dovadă de produs în același timp).
5. **Un om dedicat la telefon**, nu un formular de suport.
6. **Prioritate pe roadmap:** ce cere un partener cu 15 clienți se implementează.

### 9.3 Cum recrutăm partenerii — mecanica, pas cu pas

**Lista țintă:** ~300 de firme de contabilitate cu 3–15 angajați din București,
Cluj, Timișoara, Iași, Brașov, Constanța, Craiova, Oradea. Sursa: CECCAR (tabloul
membrilor, public), Listăfirme/Termene pe cod CAEN 6920, grupurile de Facebook de
contabilitate, LinkedIn.

| Etapă               | Acțiune                                                                                                                                                                                                                           | Obiectiv                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **1. Ademenire**    | Publicăm un instrument gratuit făcut **pentru contabili, nu pentru clienții lor**: _„Panoul de termene REGES pentru portofoliul tău"_ — încarci lista de firme, primești calendarul termenelor. Gratuit, permanent, fără condiții | Colectare de e-mailuri de contabili + demonstrarea competenței |
| **2. Contact**      | Mesajul din §8.3, adaptat. 30 de contacte/săptămână, manual, personalizate                                                                                                                                                        | 5–8 conversații/săptămână                                      |
| **3. Conversație**  | 20 de minute. Întrebarea centrală: _„Câți dintre clienții tăi îți trimit pontajul în ultima zi?"_ Nu vindem, cuantificăm durerea LUI                                                                                              | Acord de test                                                  |
| **4. Testul pilot** | **Îi luăm 3 clienți la alegerea lui și îi implementăm noi, gratuit, cap-coadă.** El nu face nimic                                                                                                                                 | Dovada că merge, fără risc pentru el                           |
| **5. Activare**     | Semnăm parteneriatul. Îi scriem împreună e-mailul către portofoliu, cu semnătura lui                                                                                                                                              | 5–15 conturi în 12 luni                                        |
| **6. Întreținere**  | Raport lunar cu comisionul, alertă legislativă dedicată partenerilor, întâlnire trimestrială                                                                                                                                      | Retenție de partener > 85%                                     |

> **Elementul-cheie e etapa 4.** Un contabil nu-și riscă reputația pe un produs pe care
> nu l-a văzut funcționând la clienții LUI. Implementarea gratuită a 3 clienți costă ~6
> ore de muncă și deblochează un portofoliu de 50. Este cel mai bun raport
> investiție/rezultat din întreaga strategie.

### 9.4 Evenimentul care accelerează canalul

**„Cafeaua contabilului"** — webinar lunar de 45 de minute, gratuit, **fără vânzare în
primele 40 de minute**: o oră de legislație aplicată (REGES, termene, amenzi, spețe),
susținută împreună cu un consultant în legislația muncii. Ultimele 5 minute: „dacă vreți
instrumentul din spatele exemplelor, iată-l".

Se înregistrează, se taie în 8 clipuri scurte pentru LinkedIn, se transcrie în 3 articole
de blog. **Un efort, patru active.** Țintă: 60–120 de contabili înscriși per ediție.

### 9.5 Economia canalului

| Indicator                           | Canal direct    | **Canal contabilitate**                       |
| ----------------------------------- | --------------- | --------------------------------------------- |
| CAC per client                      | 2.500–3.500 lei | **400–700 lei**                               |
| Ciclu de vânzare                    | 45–60 zile      | **21–30 zile** (încrederea e împrumutată)     |
| Rată de închidere după demonstrație | 25–35%          | **50–65%**                                    |
| Retenție la 12 luni                 | 82%             | **91%** (contabilul devine suport de nivel 1) |
| Cost recurent                       | 0               | 20–30% din venit                              |
| **Marjă brută efectivă**            | ~85%            | **~60%**                                      |

Marja e mai mică, dar **CAC-ul de 5 ori mai mic și retenția mai bună fac raportul
LTV/CAC de aproximativ 3 ori mai bun.** Concluzia operațională: **canalul de contabilitate
primește prioritate la fiecare conflict de resurse.**

---

## 10. KPI — ce măsurăm și ce înseamnă cifrele

### 10.1 Indicatorii de nivel unu (tabloul săptămânal al fondatorului)

| Indicator                        | Formula                                     | Țintă luna 3 | Țintă luna 12    | De ce contează                                                    |
| -------------------------------- | ------------------------------------------- | ------------ | ---------------- | ----------------------------------------------------------------- |
| **MRR**                          | Suma abonamentelor lunare active            | 12.000 lei   | 100.000 lei      | Singura cifră care nu minte                                       |
| **Organizații plătitoare**       | —                                           | 15           | 120              | —                                                                 |
| **ARPA**                         | MRR / organizații                           | 800 lei      | 840 lei          | Dacă scade, vindem prea mult _Conform_ și prea puțin _Personal_   |
| **CAC**                          | (Marketing + salarii vânzări) / clienți noi | < 3.500 lei  | **< 2.200 lei**  | Trebuie să scadă pe măsură ce canalul de parteneri crește         |
| **LTV**                          | ARPA × marjă brută × (1 / churn lunar)      | —            | **> 40.000 lei** | La 84% marjă și 1,5% churn lunar: 840 × 0,84 × 67 ≈ 47.000 lei    |
| **LTV / CAC**                    | —                                           | > 3          | **> 5**          | Sub 3 = model neviabil. Peste 8 = investim prea puțin în creștere |
| **Perioada de recuperare a CAC** | CAC / (ARPA × marjă)                        | < 8 luni     | **< 5 luni**     | Constrângerea reală de flux de numerar la un startup nefinanțat   |
| **Churn lunar (venit)**          | Venit pierdut / venit inițial               | < 3%         | **< 1,5%**       | Peste 3% lunar, nicio achiziție nu compensează                    |
| **Rată de conversie a probei**   | Conturi plătitoare / probe începute         | 20%          | **30%**          | Cel mai bun indicator al potrivirii produs–piață                  |

### 10.2 Indicatorii de canal

| Canal                   | Indicator principal                         | Țintă                     |
| ----------------------- | ------------------------------------------- | ------------------------- |
| **Google Ads**          | Cost per demonstrație programată            | < 350 lei                 |
|                         | Rată de conversie a paginii de destinație   | > 6%                      |
| **SEO**                 | Sesiuni organice / lună                     | 1.000 (L3) → 15.000 (L12) |
|                         | Conversii din instrumente gratuite (e-mail) | > 8% din sesiuni          |
|                         | Cuvinte-cheie în top 3                      | 15 (L6) → 60 (L12)        |
| **E-mail rece**         | Rată de răspuns                             | > 6%                      |
|                         | Întâlniri / 100 de contacte                 | > 2,5                     |
| **LinkedIn**            | Acceptare conexiuni                         | > 35%                     |
|                         | Conversații începute / lună                 | > 40                      |
| **Parteneri contabili** | Parteneri activi (≥1 client adus)           | 5 (L3) → 35 (L12)         |
|                         | Clienți per partener activ / an             | > 4                       |
|                         | % din MRR prin canal                        | 25% (L3) → **45% (L12)**  |

### 10.3 Indicatorii de produs care prezic reînnoirea

Aceștia se urmăresc pentru că **anunță churnul cu 60 de zile înainte** — nu ca vanitate.

| Indicator                                               | Prag de sănătate          | Acțiune la depășire                                                           |
| ------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| **Luni de pontaj închise complet**                      | ≥ 1 în primele 30 de zile | Sub prag: apel de salvare la ziua 12                                          |
| **Utilizatori activi săptămânal / total angajați**      | > 40%                     | Sub prag: sesiune de reinstruire gratuită                                     |
| **Module active per organizație**                       | ≥ 4                       | Sub prag: campanie de activare a modulului 5 (predictor puternic de retenție) |
| **Zile de la ultima autentificare a administratorului** | < 7                       | Peste 14: alertă roșie, apel în aceeași zi                                    |
| **Angajați importați în primele 7 zile**                | 100%                      | Sub prag: importăm noi, nu așteptăm                                           |

> **Regula de aur a retenției pentru acest produs:** un client care a închis **două luni
> consecutive** de pontaj în aplicație are o probabilitate de peste 90% să rămână un an.
> Toată echipa de succes al clientului lucrează pentru acest singur indicator.

### 10.4 Repere financiare pentru primele 12 luni

| Lună | Organizații | MRR (lei) | ARR (lei)     | Observație                                  |
| ---- | ----------- | --------- | ------------- | ------------------------------------------- |
| 3    | 15          | 12.000    | 144.000       | Primii 5 parteneri contabili semnați        |
| 6    | 45          | 37.000    | 444.000       | SEO începe să aducă probe fără cost         |
| 9    | 80          | 66.000    | 792.000       | Canalul de parteneri = 35% din MRR          |
| 12   | 120         | 100.000   | **1.200.000** | Primul angajat de vânzări, plătit din canal |

---

## 11. Planul de execuție pe 90 de zile

**Principiul de prioritizare:** în primele 90 de zile **nu construim brand, construim
dovezi**. Fiecare săptămână trebuie să producă fie un client, fie un partener, fie un
activ reutilizabil (articol, calculator, studiu de caz).

### 11.1 Luna 1 — Fundația și primii 5 clienți (zilele 1–30)

**Obiectivul lunii: 5 organizații plătitoare și 15 studii de caz de durere reală.**

| Săpt.  | Marketing                                                                                                                                                         | Vânzări                                                                                                                        | Produs / operațional                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **S1** | ・ Site cu 3 pagini de destinație (Pontaj, REGES, SSM) ・ Instalare analitică + urmărirea conversiilor ・ Redactarea celor 8 mesaje de bază                       | ・ Construirea listei: 300 de firme în ICP + 300 de firme de contabilitate ・ Configurarea CRM (Pipedrive/HubSpot gratuit)     | ・ Import Excel de angajați testat cap-coadă ・ Materiale de demonstrație cu date realiste |
| **S2** | ・ Primul instrument gratuit: **Calculatorul de risc REGES** ・ Primele 4 articole (cluster REGES) ・ Deschiderea campaniilor Google Ads 1 și 2, buget 100 lei/zi | ・ **Primele 100 de e-mailuri reci** ・ 50 de conexiuni LinkedIn ・ 20 de apeluri telefonice                                   | ・ Fluxul de înregistrare cu probă de 30 de zile, fără card                                |
| **S3** | ・ Al doilea instrument: **Generator de fișă de pontaj** ・ 4 articole (cluster Pontaj) ・ Optimizarea Ads pe primele date                                        | ・ **Primele 8 demonstrații** ・ Începe recrutarea de parteneri: 30 de contabili contactați                                    | ・ Rezolvarea a tot ce blochează în timpul demonstrațiilor, în aceeași zi                  |
| **S4** | ・ Lansarea newsletterului „Alerta legislativă" ・ 4 articole (cluster Concedii) ・ Primul studiu de caz, chiar dacă e al unui client din probă                   | ・ **Închiderea primilor 5 clienți** ・ 3 conversații cu contabili ・ Ofertă de „primii 10 clienți": preț blocat pe 24 de luni | ・ Instrumentarea indicatorilor de produs din §10.3                                        |

**Livrabile obligatorii la ziua 30:** 5 clienți plătitori · 12 articole publicate · 2
instrumente gratuite live · 1 studiu de caz · 3 conversații avansate cu contabili · CAC
măsurat, chiar dacă e prost.

### 11.2 Luna 2 — Repetabilitate și deschiderea canalului (zilele 31–60)

**Obiectivul lunii: 15 clienți cumulat, 3 parteneri contabili semnați, un proces de
vânzare care nu depinde de improvizație.**

| Săpt.  | Marketing                                                                                                                                                    | Vânzări                                                                                                                          | Produs / operațional                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **S5** | ・ 4 articole (cluster SSM) ・ **Al treilea instrument: Checklist de audit SSM** ・ Pornirea campaniei 4 (nișe operaționale)                                 | ・ 100 de e-mailuri reci, cu mesajele câștigătoare din L1 ・ **Testul pilot cu primul contabil: 3 clienți implementați gratuit** | ・ Consola multi-firmă pentru contabili — versiune minimă utilizabilă     |
| **S6** | ・ Prima ediție **„Cafeaua contabilului"** (webinar) ・ Reutilizare: 8 clipuri scurte + 3 articole din webinar                                               | ・ 12 demonstrații ・ 30 de contabili noi contactați                                                                             | ・ Materiale de parteneriat cu marca partenerului                         |
| **S7** | ・ 4 articole (cluster Salarizare) ・ **Calculator brut–net** (cel mai mare atractor de linkuri) ・ Pornirea campaniei 3 (concurență) + paginile comparative | ・ **Semnarea primilor 2 parteneri** ・ 12 demonstrații                                                                          | ・ Automatizarea e-mailurilor de activare în probă (ziua 1, 3, 7, 14, 25) |
| **S8** | ・ Al doilea și al treilea studiu de caz, cu cifre ・ Audit Ads: oprim ce nu produce demonstrații                                                            | ・ **15 clienți cumulat** ・ Al treilea partener                                                                                 | ・ Rezolvarea celor mai des semnalate 5 fricțiuni din probe               |

**Livrabile obligatorii la ziua 60:** 15 clienți · 24 de articole · 4 instrumente
gratuite · 3 parteneri semnați · **manualul de vânzare scris** (întrebările de
diagnostic, structura demonstrației, cele 8 obiecții cu răspunsuri) · rata de conversie
a probei măsurată.

### 11.3 Luna 3 — Amplificare și pregătirea scalării (zilele 61–90)

**Obiectivul lunii: 30 de clienți cumulat, 6 parteneri, canale cu costuri cunoscute.**

| Săpt.   | Marketing                                                                                                                                                             | Vânzări                                                                      | Produs / operațional                                                    |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **S9**  | ・ 4 articole (cluster Documente) ・ Creșterea bugetului Ads pe campaniile cu CPA sub țintă, oprirea restului                                                         | ・ 15 demonstrații ・ Testul pilot cu partenerii 4 și 5                      | ・ Panoul intern de sănătate a conturilor (§10.3)                       |
| **S10** | ・ A doua ediție „Cafeaua contabilului" ・ Prima colaborare de conținut cu un blog de contabilitate                                                                   | ・ Campanie de reactivare pe toate probele neconvertite din L1–L2            | ・ Reducerea timpului până la prima lună închisă                        |
| **S11** | ・ 4 articole (cluster Operațiuni — flotă/ISCIR, zero concurență) ・ **Calculator de diurnă**                                                                         | ・ Prima ofertă de revânzare (modelul C) către o firmă de contabilitate mare | ・ Documentația tehnică de securitate (RLS, criptare) ca PDF de vânzare |
| **S12** | ・ **Raport de piață propriu:** „Starea conformității în IMM-urile românești" — pe baza datelor anonimizate din calculatorul de risc. Material de presă și de linkuri | ・ **30 de clienți cumulat** ・ Planificarea primei angajări în vânzări      | ・ Retrospectivă: ce module cer clienții și nu avem                     |

**Livrabile obligatorii la ziua 90:** 30 de clienți · MRR ≈ 24.000 lei · 36 de articole ·
6 instrumente gratuite · 6 parteneri activi · **CAC per canal cunoscut** · decizia
argumentată: unde punem 80% din bugetul următoarelor 90 de zile.

### 11.4 Bugetul primelor 90 de zile

| Poziție                                                          | Lunar           | Total 90 zile   |
| ---------------------------------------------------------------- | --------------- | --------------- |
| Google Ads                                                       | 4.500 lei       | 13.500 lei      |
| Redactare conținut (2 articole/săpt., colaborator)               | 3.000 lei       | 9.000 lei       |
| Instrumente (CRM, e-mail, Sales Navigator, analitică)            | 900 lei         | 2.700 lei       |
| Consultant legislația muncii (webinar + verificarea articolelor) | 1.500 lei       | 4.500 lei       |
| LinkedIn Ads (doar retargeting)                                  | 600 lei         | 1.800 lei       |
| Materiale tipărite, deplasări la clienți                         | 800 lei         | 2.400 lei       |
| Rezervă                                                          | —               | 4.000 lei       |
| **Total**                                                        | **~11.300 lei** | **~37.900 lei** |

La 30 de clienți și un ARPA de 800 lei ⇒ MRR de 24.000 lei la ziua 90.
**CAC mediu ≈ 1.260 lei** (fără costul timpului fondatorului). Recuperare sub 2 luni.

---

## 12. Riscuri și contramăsuri

| Risc                                                                                    | Probabilitate       | Impact                         | Contramăsură                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------- | ------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **iFlow sau Papervee adaugă SSM și REGES**                                              | Medie               | Mare                           | Adâncimea, nu lățimea: ISCIR, EIP, autorizații nominale, registrul OMFP nu se copiază în trei luni. Grăbim canalul de contabilitate, care se apără prin relație, nu prin funcționalități                   |
| **Valorile legale de salarizare neconfirmate produc un calcul greșit la un client**     | Medie               | **Foarte mare** (reputațional) | **Prioritate absolută pe produs:** validare cu un expert contabil ÎNAINTE de prima vânzare a pachetului _Personal_. Până atunci, salarizarea se vinde ca „pregătire pentru contabil", nu ca „calcul final" |
| **Datoria de testare (zero teste pe acțiuni și pagini) produce un incident la scalare** | Medie               | Mare                           | Plafonăm intenționat la ~15 conturi noi/lună în primele 6 luni. Creșterea prea rapidă e un risc, nu un succes                                                                                              |
| **Contabilii ne percep drept concurenți**                                               | Medie               | Mare                           | Mesaj invariabil, repetat în toate materialele: _„Ne oprim la fluturaș. D112 și declarațiile rămân ale dumneavoastră."_ Niciodată o campanie care sugerează înlocuirea contabilului                        |
| **Ciclu de vânzare mai lung decât estimat** (patronul român amână)                      | **Mare**            | Medie                          | Prețul mic al pachetului _Conform_ ca ușă de intrare; oferta de probă fără card; canalul de contabilitate scurtează ciclul cu 40%                                                                          |
| **Fereastra REGES se închide** (toată lumea se conformează, urgența dispare)            | Mare, în 12–18 luni | Medie                          | De aceea clusterele 2–7 de conținut nu depind de REGES. Durerea de pontaj și SSM e permanentă                                                                                                              |
| **Dependența de o singură persoană** (fondatorul face și produs, și vânzare)            | Mare                | Mare                           | Manualul de vânzare scris la ziua 60 e condiția prealabilă a primei angajări. Canalul de parteneri e singura formă de vânzare care nu cere timpul fondatorului                                             |

---

## 13. Anexă — răspunsuri gata scrise la cele 5 întrebări care se pun mereu

**„Cu ce sunteți diferiți de iFlow?"**

> „iFlow e o aplicație de pontaj foarte bună, cu module HR în jur. Noi suntem tot dosarul
> administrativ: pe lângă pontaj și concedii, avem SSM cu instruiri și fișe de aptitudine,
> verificări ISCIR, parc auto cu foi de parcurs, inventar în primire, registrul de documente
> și transmiterea REGES prin API. Dacă vă trebuie doar pontaj, luați iFlow, e onest ce spun.
> Dacă vă trebuie și restul, nu-l aveți acolo."

**„De ce să nu iau ceva internațional, Personio sau Factorial?"**

> „Pentru că REGES, ITM, ISCIR, diurna internă și registrul OMFP nu există în produsele
> alea și nu vor exista. Sunt bune la ce fac, dar nu vă apără la un control românesc."

**„Cine sunteți? Sunteți o firmă mică."**

> „Da. De asta răspund eu la telefon și de asta ce cereți intră în produs în săptămâni, nu
> în trimestre. Ce ar trebui să vă intereseze nu e mărimea noastră, ci ce se întâmplă cu
> datele dumneavoastră dacă dispărem — de asta le puteți exporta oricând, integral, în
> Excel și PDF, fără să ne cereți voie."

**„Cât durează implementarea?"**

> „Contul, 10 minute. Importul angajaților îl facem noi în 24 de ore de la primirea
> Excelului. Prima lună de pontaj închisă complet: două–trei săptămâni, pentru că trebuie să
> treacă o lună. Nu există cost de implementare și nu există proiect de implementare."

**„Ce se întâmplă dacă vreau să renunț?"**

> „Opriți abonamentul de la un buton, fără preaviz și fără penalizare. Vă exportați toate
> datele. Nu avem contracte pe 12 luni obligatorii — dacă produsul nu-și merită banii lunar,
> nu vreau să vă țin cu semnătura."

---

_Document generat pe baza auditului intern al depozitului de cod Administrativo
(22 de module, arhitectură multi-tenant cu RLS FORCED) și a cercetării de piață pe
concurenții și cadrul legislativ românesc, la 3 septembrie 2026. Prețurile concurenților
sunt cele publicate public la această dată. Valorile amenzilor sunt preluate din
HG 295/2025, Codul muncii și comunicatele Inspecției Muncii — **a se reconfirma cu un
jurist înainte de a fi folosite în materiale publicitare**._
