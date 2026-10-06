# Market & competition sources — ADMINISTRATIVO (VestVentures package)

_Researched 6 October 2026. Every number below carries its source URL and the
data year. Anything that could not be tied to a source is marked **UNVERIFIED**
and must not appear in an investor document as a fact. Derived numbers
(computed by us from sourced inputs) are marked **DERIVED** and show the formula.
Projections are marked **PROJECTION**. FX convention for every RON→EUR
conversion in this package: **5 RON = 1 EUR** (rounded; say so on every slide
that converts)._

---

## (a) Size of the market — companies, employers, employees, accountants

### a.1 Companies (stock)

| Metric | Value | Year of data | Source |
| --- | --- | --- | --- |
| Active enterprises, industry + construction + trade + market services (INS) | **693,447** (+2.1% y/y) | 2024 | INS release via News.ro, 24 Nov 2025 — https://www.news.ro/economic/ins-romania-active-693-447-intreprinderi-industrie-constructii-comert-servicii-piata-2024-crestere-2-1-cifra-afaceri-s-ridicat-2-68-miliarde-lei-numarul-mediu-salariati-scazut-2-fata-anul-2023-1922403124082025110922248696 |
| Average number of employees in those enterprises (INS) | **4,154,356** (−2% y/y) | 2024 | same INS release |
| Same INS series, previous year | 679,355 enterprises, 4.23 M employees | 2023 | https://www.news.ro/economic/ins-in-romania-erau-anul-trecut-679-355-intreprinderi-din-industrie-constructii-comert-si-servicii-de-piata-cu-afaceri-de-2-59-miliarde-lei-si-4-23-milioane-angajati-1922401422282024111021844463 |
| Companies registered in RECOM (trade register) | 1,297,596 | 31 Dec 2025 | ICAP CRIF analysis via Revista Progresiv, 23 Jul 2026 — https://revistaprogresiv.ro/stiri/management/analiza-numai-44-din-firmele-inregistrate-la-recom-aveau-salariati-in-2025/ |
| Companies that filed annual financial statements | ~900,000 | FY2025 | same |
| **Companies reporting ≥1 employee** in FY2025 statements | **~526,000**, with **3.88 M** employees in total | FY2025 (published Jul 2026) | ICAP CRIF via Curierul Național — https://curierulnational.ro/peste-jumatate-de-milion-de-firme-aveau-388-milioane-salariati-in-2025/ and Revista Progresiv (above) |
| "Active" companies per ONRC (third-party aggregator) | 1,289,849 active of 2,854,354 ever registered (7 Jul 2026) | 2026 | demoanaf.ro/statistica — **third-party, not ONRC itself; treat as indicative only** |
| New registrations | 100,744 new companies in 2025 (93,128 in 2024); 153,425 legal + natural persons | 2025 | AGERPRES, 25 Jan 2026 — https://agerpres.ro/economic/2026/01/25/onrc-153-425-de-persoane-fizice-si-juridice-inmatriculate-in-2025-numar-in-crestere-cu-22-8--1521822 |

**Use in the deck:** "≈526,000 Romanian companies employ at least one person
(ICAP CRIF, FY2025)". This is the cleanest "employer" count — every one of them
is legally obliged to keep a REGES-Online register and a daily timesheet.

Note on inconsistency: ICAP CRIF also quotes "570,000+ (44%) declared employees";
the 526,000 figure is the one tied to "at least one employee" and 3.88 M staff.
Use 526,000.

### a.2 Distribution by size class (Eurostat SBS)

Eurostat `sbs_sc_ovw`, Romania, total business economy (NACE B–S excl. O and
S94), **2023** (latest year available), queried through the Eurostat API on
6 Oct 2026:
https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sbs_sc_ovw?format=JSON&lang=EN&geo=RO&nace_r2=B-S_X_O_S94&time=2023
(browsable table: https://ec.europa.eu/eurostat/databrowser/view/sbs_sc_ovw/default/table)

| Size class (persons employed) | Enterprises | Share | Persons employed | Share |
| --- | ---: | ---: | ---: | ---: |
| 0–9 (micro, incl. firms with 0 employees) | 966,384 | 94.5% | 1,573,681 | 32.6% |
| 10–19 | 29,461 | 2.9% | 393,992 | 8.2% |
| 20–49 | 17,288 | 1.7% | 521,410 | 10.8% |
| 50–249 | 7,632 | 0.75% | 786,274 | 16.3% |
| 250+ | 1,666 | 0.16% | 1,556,561 | 32.2% |
| **Total** | **1,022,431** | 100% | **4,831,918** | 100% |

- **SMEs (0–249): 1,020,765 enterprises, 3,275,357 persons employed = 67.8%
  of business-economy employment** (DERIVED: total − 250+).
- **SMEs with 10–249 persons: 54,381** (DERIVED: 29,461 + 17,288 + 7,632).
- Employees (salaried, `SAL_NR`), all sizes: **4,352,725** (2023). The
  per-size-class employee split is confidential in Eurostat for Romania.
- 2022 for comparison: 974,969 enterprises, 4,698,672 persons employed.
- Eurostat counts differ from INS (1.02 M vs 693k) because SBS includes sole
  proprietors and more NACE sections; size classes are by *persons employed*
  (owners included), not by employees. Do not mix the two series in one ratio
  without saying so.
- Eurostat does not split 0–9 into "0 employees" vs "1–9"; the 0–1 and 2–9
  classes are confidential for Romania.

**DERIVED estimate of micro-employers (1–9 employees):**
526,000 (ICAP CRIF FY2025, ≥1 employee) − 54,381 (Eurostat 2023, 10–249) −
1,666 (250+) ≈ **470,000**. Mixes two sources and two years → present as "≈470k,
estimate".

Supporting press: micro + small firms employed 1.9 M people in 2024 vs 1.47 M in
large firms (Ziarul Financiar calculation on trade-register data, 27 Nov 2025 —
https://www.zf.ro/eveniment/arata-universul-angajatilor-mediul-privat-microintreprinderile-22960730).

### a.3 Employees nationally (all employers, REGES/Revisal register)

| Metric | Value | Date | Source |
| --- | --- | --- | --- |
| Active individual employment contracts | 6,477,997 | Dec 2025 | Ministry of Labour data via HotNews, 5 Jul 2026 — https://hotnews.ro/cati-angajati-sunt-oficial-in-romania-numarul-contractelor-de-munca-active-in-scadere-2292325 |
| Active employees | 5,586,187 (5,723,515 in Dec 2024) | Dec 2025 | same |

### a.4 Accountants (the distribution channel)

| Metric | Value | Date | Source |
| --- | --- | --- | --- |
| CECCAR members (total) | **48,108** | 31 Dec 2024 | CECCAR 2025 sectoral AML risk-assessment report — https://ceccar.ro/ro/wp-content/uploads/2025/08/PDF-Raport-CECCAR-2025-evaluare-risc-spalarea-banilor.pdf |
| — individual liberal-profession practitioners (Sections I/V) | **5,671** | 31 Dec 2024 | same |
| — accounting / accounting-expertise firms (Sections IV/VII) | **12,776** | 31 Dec 2024 | same |

**Verification status:** the three CECCAR numbers come from the search-engine
excerpt of that PDF; the PDF itself could not be opened from this machine
(ceccar.ro refused the connection on 6 Oct 2026). Open the PDF once by hand
before quoting. An older CECCAR statement gives ~45,000 members of which
~35,000 active (CECCAR Business Magazine —
https://www.ceccarbusinessmagazine.ro/corpul-expertilor-contabili-si-contabililor-autorizati-din-romania-implicare-activa-in-imbunatatirea-legislatiei-economico-financiare-a1632/,
undated in fetch).

**DERIVED:** accounting practices that can resell / recommend =
12,776 firms + 5,671 individuals ≈ **18,400 practices**. Each serves many SMEs
(the internal analysis assumes 30–80 client companies per accountant —
**UNVERIFIED**, internal assumption from `docs/comercial/analiza-investitor.md`).

---

## (b) Regulatory "why now"

### b.1 REGES-Online replaces REVISAL

| Fact | Source |
| --- | --- |
| **HG 295/2025** (Government Decision) on the general register of employees, REGES-ONLINE, replaces HG 905/2017 (REVISAL). In force 31 Mar 2025; sanction provisions 30 days after publication. | Portal Legislativ (procedure, 6 May 2025) — https://legislatie.just.ro/Public/DetaliiDocumentAfis/297883 ; FGO comparison HG 295/2025 vs HG 905/2017 — https://www.fgo.ro/blog/bi-07-2025-hg-295-2025-vs-hg-905-2017/ ; contabun.ro — https://www.contabun.ro/2025/04/01/hg-nr-2952025-privind-reges-online/ |
| Original deadline for **all employers** to enrol and re-transmit every active contract: 30 Sep 2025. | Manager.ro / InfoTVA — https://infotva.manager.ro/articole/legislatie/revisal-inlocuit-pana-pe-30-septembrie-2025-cu-sistemul-reges-online-8-noutati-importante-24033.html |
| **OUG 46/18.09.2025, art. IV** extended the deadlines (HG 295/2025 art. 11(1),(2) and art. 15) to **31 Dec 2025**. From **1 Jan 2026** REGES-Online is the only valid register; old REVISAL desktop app deactivated. | Portal Legislativ — https://legislatie.just.ro/Public/DetaliiDocumentAfis/302378 ; Inspecția Muncii note — https://www.inspectiamuncii.ro/documents/839035/839528/Prelungire+termen+Reges.pdf/8cfc53dc-ee07-447b-a0cc-05c2bd4658ff |
| At the time of the extension, **only 23% of employers** had completed the transition (Ministry of Labour figure as reported). | Avocatnet — https://www.avocatnet.ro/articol_70344/ (2025) |
| Underlying obligation is statutory, not only the HG: Labour Code (Legea 53/2003) art. 34 obliges every employer to keep a general employee register. | Labour Code on Portal Legislativ — https://legislatie.just.ro/Public/DetaliiDocument/41625 (text not re-fetched in this session; standard provision) |
| REGES-Online exposes an **API** for third-party software (vs. REVISAL's file upload): Nexus, SmartBill Conta, NextUp, SAGA advertise integrations. | Nexus doc — https://www.docs.nexuserp.ro/articol/conectare-nexus-salarii-la-platforma-reges-online/4833 ; SAGA — https://www.sagasoftware.ro/reges-online-in-saga/ ; Inspecția Muncii REGES page — https://www.inspectiamuncii.ro/en/reges |

Transmission deadlines (HG 295/2025, as summarised by Legislația Muncii 2026 —
https://legislatiamuncii.manager.ro/a/31372/termene-transmitere-reges-online.html):
new contract at the latest **the day before work starts**; salary changes within
20 working days; other changes within 3 working days; suspension / secondment the
day before; termination on the termination date.

### b.2 Fines

| Breach | Fine (RON) | ≈ EUR (÷5) | Source |
| --- | --- | --- | --- |
| Not enrolling in REGES-Online by the deadline | 15,000–20,000 | 3,000–4,000 | Digi24 — https://www.digi24.ro/stiri/economie/companii/angajatorii-trebuie-sa-treaca-la-reges-online-pana-la-31-decembrie-ce-risca-firmele-care-nu-respecta-termenul-3547235 ; avocatnet (above) |
| Late / missing transmission of contract data — **per person** | 3,000–8,000 | 600–1,600 | pontajangajati.ro (citing HG 295/2025 art. 9) — https://pontajangajati.ro/reges-online-termene-amenzi-pontaj/ ; universuljuridic.ro — https://www.universuljuridic.ro/registrul-reges-online/ |
| Incomplete / incorrect data | 3,000–6,000 | 600–1,200 | pontajangajati.ro (above) |
| No daily working-time record (Labour Code art. 119 → art. 260(1)) | 1,500–3,000 | 300–600 | lege5 art. 260 — https://lege5.ro/Gratuit/gi2tknjxgq/art-260-raspunderea-contraventionala-codul-muncii?dp=gu3dmmjzga3tg ; ITM Arad sanctions page — https://itmarad.ro/ro/activitatea-itm/relatii-de-munca/rm-sanctiuni/ |
| (Undeclared work — art. 260(1)(e) Labour Code, up to 20,000 RON per person) | **UNVERIFIED in this session** — do not quote without checking the current text | | |

Note: Legislația Muncii's 2026 guide expresses some fines in EUR
(€1,000–2,700); the HG text is in RON. **Quote the RON ranges above**, which are
consistent across three sources.

### b.3 Working-time record — Labour Code art. 119

- Art. 119(1), as amended by **OUG 53/2017** (approved by Legea 88/2018): the
  employer must keep, at the workplace, a record of the hours worked **daily**
  by each employee, **showing start and end times**, and present it to labour
  inspectors on request. Mobile / home-based staff: per written agreement.
  Sources: Legea 88/2018 — https://legeaz.net/monitorul-oficial-315-2018/lege-88-2018-aprobare-oug-modificare-codul-muncii ;
  Nexus blog — https://www.nexuserp.ro/blog/noutati-privind-evidenta-orelor-de-munca-prestate-de-salariati
- Format is free: paper, Excel or app are all accepted; there is **no general
  legal obligation of an electronic timesheet** as of Oct 2026 (only a
  parliamentary initiative for public-hospital staff). Sources:
  https://cssi.ro/blog/pontaj-electronic-obligatoriu-lege-amenzi-itm-brasov ;
  https://www.cuvantul-liber.ro/556946/sisteme-electronice-obligatorii/
- **Honest framing for the deck:** the daily start/end record is mandatory for
  every employer since 2017; *electronic* is not mandatory, but it is the only
  form that cannot be reconstructed after the fact. Do NOT write "electronic
  timesheet is mandatory".

### b.4 2025–2026 changes and open risks

| Item | Status | Source |
| --- | --- | --- |
| **HG 295/2025 annulled at first instance** — Constanța Court of Appeal, Decision 83/2026 of **2 Apr 2026**, annulled the whole HG (earlier, Bucharest Court of Appeal annulled only art. 8). **Not final**; the request to *suspend* the HG was rejected, so the HG and REGES-Online remain applicable pending recourse at the High Court (ÎCCJ). Action brought by UNELM (labour-law experts' union) with companies. | **RISK — must be disclosed** | StartupCafe — https://startupcafe.ro/trecerea-la-reges-online-hg-care-a-introdus-noul-sistem-in-locul-revisal-anulata-in-prima-instanta-ce-trebuie-sa-stie-angajatorii-100540 ; Juridice.ro — https://www.juridice.ro/831975/hg-nr-295-2025-privind-reges-anulata-in-prima-instanta-ce-trebuie-sa-stie-acum-angajatorii.html ; Profit.ro — https://www.profit.ro/perspective/schimbari-legislative-pentru-firme/anulare-reges-online-hg-introdus-platforma-locul-revisal-anulata-instanta-decizia-definitiva-unelm-modernizarea-necesara-conditii-legalitate-consultare-reala-angajatorii-22459340 ; Decriptat, 29 May 2026 — https://www.decriptat.ro/stiri/reges-online-sistemul-folosit-deja-de-angajatori-a-fost-anulat-in-prima-instanta/ |
| Outcome of the recourse | **UNVERIFIED** — no final ruling found as of 6 Oct 2026 | — |
| EU Pay Transparency Directive (EU) 2023/970 — transposition deadline 7 Jun 2026; Romania **missed it**; Ministry of Labour published a draft law on 30 Mar 2026, still in Parliament; no direct obligations on Romanian employers until transposed; pay-gap reporting targets employers with 100+ staff. | Tailwind, not yet law | Legislația Muncii — https://legislatiamuncii.manager.ro/a/31572/directiva-ue-2023_970-nu-instituie-in-acest-moment-obligatii-directe-in-sarcina-angajatorilor-din-romania-specialistii-explica.html ; Business24 — https://business24.ro/transparenta-salariala/intarziere-transpunere-directiva-transparenta-salariala-riscuri-juridice-angajatori-1670293 |
| Micro-enterprise tax regime requires ≥1 employee (90 days for firms created after 25 Feb 2026, previously 30 days) → keeps the number of tiny employers high. | Context | StartupCafe infographic / search summary — https://termene.ro/articole/conditia-angajatului-la-o-microintreprindere (details **UNVERIFIED** beyond the search excerpt) |

**How to phrase "why now" (risk-honest):** "Since 1 Jan 2026 every Romanian
employer must report hires, changes and terminations to the Labour Inspectorate
through REGES-Online — an API-based register that replaced the REVISAL
desktop tool. When the original deadline was extended (Sept 2025) only 23% of employers had
migrated. The HG is under legal challenge (annulled at first instance in April
2026, not final, still applicable); the statutory obligation to keep the register
(Labour Code art. 34) and the daily timesheet (art. 119) do not depend on that
case." REGES-Online is "the e-Factura moment for HR" only as **analogy** — no
source uses that phrase; do not attribute it.

---

## (c) Competition

### c.1 Romanian payroll / HR / REGES tools

| Product (vendor) | What it is | REGES-Online | Public price | Source |
| --- | --- | --- | --- | --- |
| **SmartBill Conta** (SmartBill / Visma group — group ownership **UNVERIFIED** in this session) | Cloud accounting **for accountants**, includes payroll module, D112, timesheet for payroll | Yes — payroll section manages REGES operations via API | Free €0 (2 payroll contracts); Conta S €2 + VAT/CIF/month (10 contracts); Conta M €79 + VAT/CIF/month (20 contracts); accounting firms +€25/month; extra contract €0.5 + VAT | https://www.smartbill.ro/preturi/contabilitate (fetched 6 Oct 2026); payroll module — https://blog.smartbill.ro/modulul-de-salarizare/ |
| SmartBill Facturare / Gestiune | Invoicing / stock | **No** payroll, REGES or timesheet | from €5.84/month | https://www.smartbill.ro/preturi |
| **SAGA C / SAGA Web** (Saga Software) | Desktop accounting + payroll used by accountants | Yes since v3.0.598 (XML import + credentials); web version pending | Program free; licence/support SAGA Web 3 = 600 RON/yr … SAGA Web 50 = 2,500 RON/yr (VAT incl.) — **third-party summary** | https://www.sagasoftware.ro/reges-online-in-saga/ ; prices via https://salariile.ro/saga (verify on https://www.sagasoft.ro/preturi.php) |
| **Nexus Salarii** (Nexus ERP) | Payroll, desktop/online | Yes, via API | Not public (a reseller lists 4,933.02 RON, period unclear) | https://www.docs.nexuserp.ro/articol/conectare-nexus-salarii-la-platforma-reges-online/4833 ; https://www.nexy.ro/nexus-salarii/pd/2345001 |
| **Charisma HCM** (**TotalSoft** — not Senior Software) | Enterprise HR + payroll; 600+ organisations, 735,000+ employees | **Not confirmed** in sources | Not public | https://www.charisma.ro/sisteme-software/charisma-nivel-1/charisma-hcm-resurse-umane |
| **colorful.hr** (SD Worx Romania, ex-Romanian Software; acquisition closed 29 Apr 2024) | HR/payroll, ~750 clients / 200,000 employees at acquisition | **Not confirmed** in sources | Not public | https://www.sdworx.ro/ro-ro/romanian-software-colorful-hr-sd-worx ; https://economedia.ro/sd-worx-a-achizitionat-romanian-software-companie-din-domeniul-solutiilor-de-salarizare-si-hr.html |
| **NextUp Salarii** (NextUp Management Solutions) | Cloud payroll | Yes — automatic transmission | Per employee, not public; 7-day trial | https://nextup.ro/soft-salarizare/ |
| **HRiFlow** | HR, timesheet (with devices), payroll, D112 | Yes (type not specified) | Not public on fetched page | https://hriflow.ro/program-salarizare/ |
| **qPlus** (Ember Software SRL, Iași) | HR documents, timesheet, REGES operations | Yes (core proposition) | Tiered; 187.50 RON shown for one tier; −15%/−25% for 6/12 months | https://qplus.ro/ |
| **IMFS One — HR** (IMFS) | Leave, timesheet, payroll, REGES, recruitment | Yes | Not stated | https://imfs.ro/ro/top/software-hr-salarizare-romania-2026/ (vendor's own comparison) |
| WizOne HR / WizSalary (Wizrom), True HR + dp-Payroll (AROBS), Clarvision Payroll (NTT DATA), TeamSal (TeamFirst), SCRIB | Mid/enterprise payroll & HR | Not confirmed | Not public | IMFS comparison (above); https://www.wizrom.ro/en/wizsalary_1/ ; https://clarvision.ro/payroll-salarizare-hr |

### c.2 Point solutions — time tracking only (public prices)

| Product | Price | REGES | Source |
| --- | --- | --- | --- |
| Pontajj (FAMC) | flat per company: €9/month (5 emp.) … €49/month (100+) | imports REGES exports; does not transmit | https://pontajj.ro/ |
| PontajAngajati | €1.99 → €1.39 per user/month (annual) | no | https://pontajangajati.ro/premium/ (via search excerpt) |
| epontez | 10–12 RON per employee/month | no | https://www.epontez.ro/ (via search excerpt) |
| EasyHours | US$10 per user/month | no | https://easyhours.ro/pontaj-angajati (via search excerpt) |
| Foaiedepontaj.ro | from 10 RON/month (annual) | no | https://foaiedepontaj.ro/ (via search excerpt) |

### c.3 International HR suites

| Product | Price (third-party unless stated) | Romanian payroll / REGES | Source |
| --- | --- | --- | --- |
| Factorial | from US$8/user/month | Localised payroll for ES, FR, IT, DACH, UK; **no REGES found** | https://www.softwareadvice.com/hr/factorial-profile/ ; https://faqtic.co/blog/how-factorial-compare-other-hr-software-straight-talking-gui |
| Personio | quote-only; ~€5–8/employee/month core (third-party estimate) | payroll limited to some EU countries; **no REGES found** | https://costbench.com/software/hr/personio/ ; https://www.erpresearch.com/erp-add-ons/hcm-extensions/personio |
| BambooHR | US$10.25 / 17.50 / 25 per employee/month; flat $250/$425/$650 per month for ≤25 employees | native payroll US-only; **no REGES** | https://www.bamboohr.com/pricing/ (vendor) ; https://peoplemanagingpeople.com/tools/bamboohr-pricing/ |
| Deel HR | HRIS now ~US$5/employee/month (was free ≤200 emp.); Romania EOR from US$599/month | EOR/global payroll, **no REGES integration found** | https://www.techrepublic.com/article/deel-review/ ; https://www.deel.com/hiring/employees/romania/ |

"No REGES found" = no public evidence on 6 Oct 2026, not proof of absence.

### c.4 Names from the brief that could NOT be verified

- **Bizzi** (as Romanian HR/payroll software) — not found. **UNVERIFIED — omit.**
- **Raptor** (as Romanian HR/payroll software) — not found. **UNVERIFIED — omit.**
- **Prohr**, **HR-Expert** — not found as products. **UNVERIFIED — omit.**
- **Ceres** — not searched specifically / not found. **UNVERIFIED — omit.**
- **Senior Software** exists as an ERP vendor (SeniorERP) but **Charisma HCM is
  TotalSoft**, not Senior Software. Correct this anywhere it appears.

### c.5 Positioning implications (analysis, not sourced fact)

1. Payroll + REGES is **crowded and accountant-owned** (SmartBill Conta, SAGA,
   Nexus): the accountant already transmits REGES for the client. ADMINISTRATIVO
   should not pitch itself as "another payroll"; payroll is "built, undergoing
   accountant validation".
2. Time-tracking apps are **cheap point tools** (€9–49/month flat, ~€1.5–2/user)
   without REGES or HR file.
3. Enterprise suites (Charisma, colorful.hr/SD Worx, WizOne) do not publish
   prices and target 100+ employee firms.
4. International suites have no Romanian payroll/REGES.
5. **Gap claimed by ADMINISTRATIVO:** one SaaS for the *employer side* of a
   5–250-person firm (phone clock-in, leave, HR file, SSM, fleet, inventory,
   onboarding, REGES via API) that the accountant can see too — at a flat price
   per company (Nucleu 149 RON/month up to 20 employees; full suite 499 RON/month;
   source: `docs/comercial/prezentare-comerciala.tex` lines 778–850). **Price
   above 20 employees is not defined in the commercial deck — [TO CONFIRM].**

---

## (d) SaaS and funding benchmarks

### d.1 SMB SaaS retention / efficiency

| Metric | Benchmark | Source |
| --- | --- | --- |
| Median monthly customer churn, ARPA < US$25/month | **6.1%** | ChartMogul — https://chartmogul.com/blog/good-customer-churn-rate/ ; SaaS Retention Report — https://chartmogul.com/reports/saas-retention-report/ |
| Products < US$10 ARPA | 6–7% monthly churn | ChartMogul (same) |
| Self-serve SMB monthly churn | 3–7% (31–58% annual) | B2B SaaS benchmarks 2026 — https://www.data-mania.com/blog/b2b-saas-benchmarks-2026-annual-report/ (secondary aggregator) |
| SMB CAC payback | median ~11 months, healthy 6–14; < US$5k ACV → 3–9 months practical | Aleph — https://www.getaleph.com/answers/cac-payback-period-saas-2026 (secondary) |
| ADMINISTRATIVO ARPA for reference | 149–499 RON ≈ €30–100 ≈ US$32–108/month | DERIVED (own price list ÷ 5) — sits in ChartMogul's US$50–249 band, where retention is materially better than < US$25 |

Recommended model inputs (PROJECTION assumptions, justify in the model):
monthly logo churn 3% base / 5% downside; CAC payback target ≤ 9 months; accountant
channel commission 20–30% recurring (internal assumption, `analiza-investitor.md`).

### d.2 Funding environment — Romania / CEE / US reference

| Metric | Value | Year | Source |
| --- | --- | --- | --- |
| Romanian startups — total VC raised | **€103 M** in **40 deals** (−20% y/y); €55 M early-stage | 2025 | How to Web & Underline Ventures, *Venture in Eastern Europe 2025* — https://www.romania-insider.com/romanian-startups-funding-2025 ; https://comunic.ro/news/raport-how-to-web-underline-ventures-startup-urile-romanesti-au-atras-finantari-de-103-mil-euro-in-2025-cu-20-mai-putin-decat-in-anul-anterior-romania-a-coborat-pe-locul-11-in-europa-de-est-iar/ |
| **Average pre-seed round, Romania** | **€526,000** | 2025 | same report (via search excerpt; Romania-Insider page rate-limited on fetch) |
| Average seed round, Romania | €1.5 M | 2025 | same |
| CEE early-stage VC (pre-seed + seed + Series A) | €764 M of €2.3 B total | 2024 | Dealroom CEE report 2025 via Vestbee — https://www.vestbee.com/insights/articles/dealroom-report-on-cee-2025 |
| Sparking Capital ticket | up to €300k, pre-seed/seed | current | search excerpt; fund page https://www.openvc.app/fund/Sparking%20Capital |
| GapMinder ticket | €100k–1.5M | current | https://www.eu-startups.com/investor/gapminder-vc/ (via search excerpt) |
| US reference: median post-money SAFE cap, US$1–2.5M pre-seed rounds | ~US$15 M; median dilution ~19–20% | 2025 | Carta *State of Pre-Seed: 2025 in Review* — https://carta.com/data/state-of-pre-seed-2025/ (page 403 on fetch; numbers from search excerpts) — **US, AI-skewed, not comparable to RO** |
| Romanian / CEE **pre-seed valuation** (pre-revenue B2B SaaS) | **UNVERIFIED** — no source found | — | — |
| CEE pre-seed median deal €0.7M (Dealroom/PitchBook) | **UNVERIFIED** — appeared only in an aggregated search summary | — | — |

**DERIVED valuation logic (not a benchmark):** a €150–300k round at a typical
10–20% dilution implies a **€0.75 M–3 M post-money**. With zero revenue and two
student founders, the defensible range is the lower half; the financial model
must state its own number and why.

**Positioning of the ask:** €150–300k is **below** the 2025 Romanian average
pre-seed (€526k) and within Sparking Capital's / GapMinder's lower ticket range
— a small, milestone-bound round.

---

## (e) TAM / SAM / SOM — suggested computation

All in **RON per year**, converted at **5 RON = 1 EUR**. Prices are
ADMINISTRATIVO's own list prices (Nucleu 149 RON/month ≤ 20 employees; Nucleu +
HR Extins = 398 RON; full suite 499 RON/month). Counts from §a. Everything here is
**DERIVED / PROJECTION**, not a market-research figure.

### TAM — every Romanian employer, core HR only

```
TAM = employers with ≥1 employee × Nucleu price × 12
    = 526,000 × 149 RON × 12
    = 940,488,000 RON/yr  ≈  €188 M/yr
```
Assumption: every employer needs at least the register + timesheet + leave + HR
file (legal obligations in §b). Upper bound if every employer bought the full
suite (499 RON): 526,000 × 5,988 = 3.15 bn RON ≈ €630 M — **do not headline; not
realistic for 1–2-person firms.**

### SAM — firms with 10–249 persons, where a manager/HR person exists

```
SAM = 29,461 (10–19) × 398 RON × 12
    + (17,288 + 7,632) (20–249) × 499 RON × 12
    = 140,705,736 + 149,220,960
    = 289,926,696 RON/yr  ≈  €58 M/yr
```
Assumptions: 10–19 buy Nucleu + one bundle; 20–249 buy the full suite at the
current 499 RON list (floor: pricing above 20 employees is [TO CONFIRM], so SAM
is understated if larger firms pay more). Firm counts: Eurostat 2023.

Optional **SAM extension through accountants** (micro-employers 1–9):
```
≈470,000 micro-employers × 10% reachable via accountant channel × 149 × 12
  = 46,995 × 1,788 = 84,027,060 RON/yr  ≈  €16.8 M/yr
```
The 10% is an **assumption** (no source); show separately, never added silently.

### SOM — 36-month obtainable target (PROJECTION)

```
SOM = paying companies at month 36 × blended ARPA × 12
    = 600 × 250 RON × 12 = 1,800,000 RON ARR  ≈  €360 k ARR
```
- 600 companies = 0.11% of employers, ~1.1% of SAM firms.
- Blended ARPA 250 RON assumes a mix of Nucleu-only micro clients and bundle
  buyers. Sensitivity: 300 firms → €180 k ARR; 1,000 firms → €600 k ARR.
- Channel sanity check: 1% of ~18,400 accounting practices (≈185) bringing
  3–4 client companies each ≈ 550–740 companies.
- Starting point is **zero paying customers** (6 Oct 2026); the financial model
  must build this bottom-up from pilots → paid conversion, not top-down.

---

## Summary of what is solid vs. weak

**Solid (primary or multiple sources):** INS 693,447 active enterprises (2024);
Eurostat size distribution (2023); ~526k employers with ≥1 employee (ICAP CRIF,
FY2025); 5.59 M active employees (Dec 2025); HG 295/2025 + OUG 46/2025 dates;
fines 15–20k / 3–8k / 1.5–3k RON; art. 119; first-instance annulment (not final);
SmartBill Conta prices; Romania pre-seed avg €526k (2025).

**Weaker (single secondary source / excerpt only):** CECCAR 48,108 / 12,776 /
5,671 (PDF not opened); SMB churn and CAC payback aggregators; Personio/Deel
prices; SAGA prices; Carta US caps.

**UNVERIFIED (do not use as fact):** RO/CEE pre-seed valuations; CEE median
pre-seed €0.7M; Bizzi, Raptor, Prohr, HR-Expert, Ceres; outcome of the REGES
recourse; accountants' client counts (30–80); undeclared-work fine level;
REGES support in Charisma / colorful.hr.
