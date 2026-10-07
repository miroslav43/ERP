# ADMINISTRATIVO — investor application answers (Vest Ventures / Pynn form)

Ready-to-paste English answers for the fields a startup investor application
usually asks for. Every field has a **Short** version (at most 300 characters)
and a **Long** version (at most 1,000 characters). The comment line above each
answer gives its exact length as a web form counts it; it is written by
`python3 tools/count_chars.py`, not by eye. After editing any answer, run that
script again (or `--check` to only verify). Before pasting, run it with
`--final`: it also fails while any `[TO CONFIRM]` marker is left.

Rules behind the text:

- Every number comes from `_surse/cifre.json` (financial model and cap table,
  recalculated 7 Oct 2026) or from the sourced files `_surse/fapte.md` and
  `_surse/piata.md`. Anything dated after 6 Oct 2026 is a **projection**.
- Zero paying customers today. Nothing here implies revenue, customers,
  partnerships or logos.
- Currency: EUR, with RON converted at 5 RON = 1 EUR.
- `[TO CONFIRM]` marks text a founder must check or replace **before pasting**.
  Each marker counts towards the length; re-run the counter after replacing it.

---

## 1. Company name

**Short** (max 300)
<!-- 133 chars -->
ADMINISTRATIVO (administrativo.ro). Legal entity: WISELEARNING S.R.L. (CUI 50321210, J35/2618/2024), Timișoara, Romania [TO CONFIRM].

**Long** (max 1000)
<!-- 403 chars -->
ADMINISTRATIVO is the product and brand, live at administrativo.ro. Legal entity: WISELEARNING S.R.L., fiscal code (CUI) 50321210, trade register number J35/2618/2024, registered office Str. Metalurgiei nr. 2, Timișoara, Timiș county, Romania. The company is a Romanian SRL (limited-liability company) owned 51% by Miroslav Maletici and 49% by Răzvan Pervulescu, with no other shareholders [TO CONFIRM].

## 2. Website

**Short** (max 300)
<!-- 102 chars -->
https://administrativo.ro (product site in Romanian; English overview at https://administrativo.ro/en)

**Long** (max 1000)
<!-- 583 chars -->
Main site: https://administrativo.ro (Romanian, the language of our customers). English overview: https://administrativo.ro/en and English pricing: https://administrativo.ro/en/preturi. Offer for accounting practices (our sales channel): https://administrativo.ro/pentru-contabili. Security and data-handling page: https://administrativo.ro/incredere. Module pages: https://administrativo.ro/module. Company page on LinkedIn: https://www.linkedin.com/company/144846087/. The application itself runs on the same domain; companies can sign up on their own and get the first month free.

## 3. Founded / date of incorporation

**Short** (max 300)
<!-- 152 chars -->
Product development started on 17 Aug 2026; live in production since early Sep 2026. The legal entity is a Romanian SRL registered in 2024 [TO CONFIRM].

**Long** (max 1000)
<!-- 429 chars -->
The first line of ADMINISTRATIVO's code was committed on 17 Aug 2026 and the product has been live in production at administrativo.ro since early Sep 2026. The legal entity, WISELEARNING S.R.L., was registered in 2024 (trade register number J35/2618/2024) [TO CONFIRM: incorporation date and activity before Aug 2026]. The two co-founders, Miroslav Maletici and Răzvan Pervulescu, have built the product together since the start.

## 4. Location / headquarters

**Short** (max 300)
<!-- 101 chars -->
Timișoara, Timiș county, Romania (West Region). Registered office: Str. Metalurgiei nr. 2, Timișoara.

**Long** (max 1000)
<!-- 496 chars -->
Timișoara, Timiș county, in Romania's West Region. The registered office is Str. Metalurgiei nr. 2, Timișoara, as published on administrativo.ro. Both co-founders study at the Politehnica University of Timișoara and run the company from Timișoara, so operating decisions are taken in the region [TO CONFIRM that both founders live and work in Timișoara]. Our first target customers are Romanian SMEs, starting with the accounting practices and companies we can reach in person in Western Romania.

## 5. Stage

**Short** (max 300)
<!-- 166 chars -->
Pre-seed. The product is live in production, with zero paying customers so far and free pilots running. We are applying to the Vest Ventures Accelerator, not to Seed.

**Long** (max 1000)
<!-- 507 chars -->
Pre-seed. The product is built and live in production at administrativo.ro (since early Sep 2026), with 19 modules that each company switches on or off. We have zero paying customers today: the product is used by demo companies and free pilots, and an accountant pilot program opened on 6 Oct 2026 (free for pilot companies until 31 Mar 2027). We are applying to the Vest Ventures Accelerator rather than Seed because Seed expects first invoices, which we do not have yet. The round we are raising is €150k.

## 6. Industry / sector tags

**Short** (max 300)
<!-- 106 chars -->
B2B SaaS, HR tech, payroll, RegTech and compliance, SME software, workforce management, Romania, CEE, ICT.

**Long** (max 1000)
<!-- 504 chars -->
B2B SaaS, HR tech, payroll, RegTech and labour-law compliance, workforce management (time and attendance), occupational health and safety software, SME software, vertical SaaS for Romania with CEE expansion as a later hypothesis. Within the West Region smart-specialisation areas (RIS3) the project fits ICT. Business activity code (CAEN): [TO CONFIRM CAEN code, Rev.2 and Rev.3, against VV's eligible list; likely 5829 software publishing or 6201 custom software development, renumbered 62.10 in Rev.3].

## 7. Elevator pitch / one-liner

**Short** (max 300)
<!-- 175 chars -->
HR and payroll for Romanian SMEs in one app: staff clock in from their phone, leave and payroll calculate themselves, and REGES filings go straight to the labour inspectorate.

**Long** (max 1000)
<!-- 835 chars -->
HR and payroll for Romanian SMEs in one app: staff clock in from their phone, leave and payroll calculate themselves, and REGES filings go straight to the labour inspectorate. REGES-Online is the electronic employee register that every Romanian employer must keep with the Labour Inspectorate (ITM); we file to it over its official API. ADMINISTRATIVO costs one flat monthly price per company, from 149 RON (about €30) up to 20 employees, and also covers health and safety (SSM), onboarding, courses, fleet, inventory and an employee portal. Accountants log in to all their client companies with one account. The product has been live since early Sep 2026; payroll is built and is undergoing validation by an accountant. Two co-founders in Timișoara built it, and we have just opened a free pilot for accounting practices (6 Oct 2026).

## 8. Problem

**Short** (max 300)
<!-- 275 chars -->
Every Romanian employer must log each employee's daily start and end time and report every hire, pay change and exit to the labour inspectorate. Late REGES filings are fined 3,000–8,000 RON per person. Small firms juggle paper, Excel and e-mails to their accountant to do it.

**Long** (max 1000)
<!-- 832 chars -->
About 526,000 Romanian companies employ at least one person (ICAP CRIF, FY2025). Each must record every employee's daily start and end time (Labour Code art. 119) and report hires, salary changes, suspensions and terminations to the Labour Inspectorate (ITM) through REGES-Online, the electronic register that has replaced the old REVISAL tool since 1 Jan 2026. Late or missing filings are fined 3,000–8,000 RON (€600–1,600) per person. When the migration deadline was extended in Sept 2025, only 23% of employers had moved over. In a 5–50 person firm this work is spread across paper timesheets, Excel leave sheets, health and safety (SSM) binders and e-mails to the external accountant, who re-types the data for payroll. Enterprise HR suites are built and priced for large companies, and time-tracking apps stop at the timesheet.

## 9. Solution

**Short** (max 300)
<!-- 273 chars -->
One web app for the employer side of HR: phone clock-in (also by scanning a QR poster), leave with automatic balances, personnel files, REGES-Online filing over the official API, health and safety, onboarding, payroll exports for the accountant. One flat price per company.

**Long** (max 1000)
<!-- 977 chars -->
ADMINISTRATIVO replaces the paper and Excel trail with one system. Employees clock in from their phone, including by scanning a QR poster at the work location; managers approve the monthly timesheet and the administrator locks the month. Leave requests go through a configurable approval chain and balances update themselves. Personnel files feed REGES-Online: hires, pay changes, suspensions and terminations are filed over the official API and the receipt lands back on the employee record. Health and safety (SSM) shows a matrix of briefings due, with a traffic light. Payroll calculates gross to net and produces the accounting note, the D112 tax return file, the payroll register and a SEPA bank file for the accountant (built, undergoing accountant validation). Each company switches on only the modules it needs, out of 19. An accountant uses one login for all client companies. Tenant data is isolated inside the database and national ID and IBAN numbers are encrypted.

## 10. Product status

**Short** (max 300)
<!-- 246 chars -->
Live in production at administrativo.ro since early Sep 2026: 19 modules, self-service sign-up, REGES-Online filing over the API working in production. Payroll is built and undergoing accountant validation. Android app built, in internal testing.

**Long** (max 1000)
<!-- 848 chars -->
Live in production since early Sep 2026, after development started on 17 Aug 2026. Built so far (as of 6 Oct 2026): 19 modules, 811 commits (34 of them automated), 162 database migrations, 164 database tables, all with row-level security, and 5,610 automated test cases. REGES-Online filing over the Labour Inspectorate's API was confirmed working in production on 17 Sep 2026. Payroll is built end to end but its legal values (tax rates, minimum wage, deductions) are being validated by an accountant before we sell it. Employees use the product from a browser or as an installable web app; an Android app is built and in internal testing, not yet in Google Play, and there is no iOS app. Still missing: online payment and automated billing (invoicing is manual), a self-service data export, and an English user interface (the app is in Romanian).

## 11. Business model and pricing

**Short** (max 300)
<!-- 259 chars -->
Monthly SaaS subscription per company, not per employee: HR core 149 RON (about €30) for up to 20 employees, packages 219–249 RON, the whole app 499 RON (about €100). First month free, no setup fee. Accountants earn 20% of referred subscriptions for 6 months.

**Long** (max 1000)
<!-- 842 chars -->
Flat monthly subscription per company for up to 20 employees. HR core (attendance, leave, personnel files, employee portal) costs 149 RON (about €30). Three packages sit on top of the core: Finance 219 RON, Operations 229 RON and Extended HR 249 RON, which adds REGES-Online, onboarding, courses, health and safety, evaluations and KPIs. The whole application costs 499 RON (about €100). Single add-on modules cost 15–69 RON. The first month is free, there is no setup fee, and prices are final because the seller is not VAT-registered. Above 20 employees we quote on request. Accounting practices earn 20% of each referred company's subscription for its first 6 paid months. The financial model projects an average of €49.98 a month per company in year 2 (2028) and a 95% contribution margin per customer. These are projections, not results.

## 12. Target market and market size

**Short** (max 300)
<!-- 234 chars -->
Romanian SMEs with employees, bought by the owner or office manager and often recommended by the accountant. TAM about €188M a year, SAM about €58M a year (both derived from official firm counts and our list prices, at 5 RON = 1 EUR).

**Long** (max 1000)
<!-- 821 chars -->
Buyer: the owner or office manager of a Romanian company with 5–250 people, usually advised by an external accountant. TAM: about 526,000 companies with at least one employee (ICAP CRIF, FY2025) times our 149 RON core price times 12, about €188M a year. SAM: the 54,381 companies with 10–249 people (Eurostat 2023), at 398 RON a month for 10–19 people and 499 RON for 20–249, about €58M a year; this is understated because we publish no price above 20 employees. Reaching micro-employers through accountants could add about €16.8M a year, an estimate that assumes 10% of them are reachable; we show it separately. SOM: the base case of our financial model reaches 284 paying companies and €179k ARR in Dec 2029 (month 36), which is 0.054% of employers. TAM and SAM are derived by us at 5 RON = 1 EUR; SOM is a projection.

## 13. Competition and differentiation

**Short** (max 300)
<!-- 286 chars -->
Accountants' payroll software (SmartBill Conta, SAGA, Nexus) and SME HR tools such as qPlus and HRiFlow already file to REGES; time-tracking apps stop at the timesheet; enterprise suites target large firms. We cover the whole employer side, clock-in to SSM and fleet, at one flat price.

**Long** (max 1000)
<!-- 904 chars -->
Five groups. Accountants' payroll software with REGES-Online support (SmartBill Conta, SAGA, Nexus Salarii, NextUp): used by the accountant, not by the employer's staff. SME HR tools with timesheet and REGES, such as qPlus, HRiFlow and IMFS One: the closest to us. Time-tracking apps such as Pontajj (€9–49 a month per company): no REGES filing, no personnel file. Enterprise suites such as Charisma HCM (TotalSoft) and colorful.hr (SD Worx): no public prices, aimed at large companies. International suites (Factorial, Personio, BambooHR): no public evidence of Romanian payroll or REGES support. Against the closest group we compete on breadth (health and safety, fleet, inventory, onboarding and courses in the same product), one flat price per company, one accountant login across all client companies, and tenant isolation enforced inside the database. We work with the accountant, not against them.

## 14. Traction and KPIs

**Short** (max 300)
<!-- 246 chars -->
Pre-revenue: zero paying customers, €0 MRR. Live in production since early Sep 2026, used by demo companies and free pilots; accountant pilot opened 6 Oct 2026. Web: pre-launch, SEO just starting (201 Google impressions and 3 clicks since 2 Sep).

**Long** (max 1000)
<!-- 928 chars -->
Zero paying customers and €0 MRR. The product has been live since early Sep 2026, used by demo companies and free pilots [TO CONFIRM: companies signed up and demo requests since Sep 2026; qualified conversations with accounting practices; LOIs signed]. On 6 Oct 2026 we opened an accountant pilot with places for 10 accounting practices (sign-up until 15 Nov 2026), each bringing 1–3 client companies free until 31 Mar 2027; none had joined on opening day [TO CONFIRM latest count]. Web traffic is pre-launch and SEO is just starting: about 7 genuine external visitors from Romania in the month to 6 Oct (Umami), 201 Google impressions and 3 clicks since 2 Sep, average position up from about 50 to 5–20 by end of September. Execution speed: 811 commits (34 automated) in 51 days, 19 modules, live REGES-Online filing over the API. Pilot KPIs: active companies, weekly clock-ins, REGES filings, conversion to paid from Apr 2027.

## 15. Current revenue / MRR

**Short** (max 300)
<!-- 129 chars -->
€0 from ADMINISTRATIVO. No paying customers yet. Pilot companies convert to paid after the free pilot period ends on 31 Mar 2027.

**Long** (max 1000)
<!-- 501 chars -->
€0 revenue from ADMINISTRATIVO and €0 MRR to date; we have no paying customers [TO CONFIRM: SRL turnover FY2024/FY2025]. Self-service sign-ups get the first month free, and accountant pilot companies use the product free until 31 Mar 2027. The plan is for pilot companies to start paying list price from April 2027 (model month 4). The base case of our financial model, which is a projection, reaches 47 paying companies and €2,254 MRR in Dec 2027, and 139 paying companies and €6,941 MRR in Dec 2028.

## 16. Go-to-market

**Short** (max 300)
<!-- 286 chars -->
Accountants first: they already keep the books of SMEs and often file to REGES for them. Pilot open to 10 practices, free until 31 Mar 2027, then 20% commission for 6 months. Plus SEO (7 free tools, 8 legal guides), LinkedIn and direct demos. Partner manager hired half time in month 3.

**Long** (max 1000)
<!-- 982 chars -->
Channel one is accounting practices. Romanian SMEs typically keep their books with an external accountant, who often also files to REGES-Online and runs payroll for them, working from timesheets and leave sent by e-mail. Our pilot has places for 10 practices, each bringing 1–3 client companies free until 31 Mar 2027; we import employees and configure the company with the accountant; after the pilot the accountant earns 20% of each referred subscription for 6 months. Channel two is search: 7 free tools without an account (salary calculator, timesheet, leave form and others) and 8 legal guides on administrativo.ro, plus our LinkedIn page. Channel three is direct demos to SMEs in Western Romania. With the round we hire a partner and sales manager for the accountant channel in month 3 (half time, full time from month 13) and a half-time onboarding specialist in month 7. Projected year-2 fully loaded acquisition cost (CAC) is €497 per customer, with payback in 10.5 months.

## 17. Team

**Short** (max 300)
<!-- 279 chars -->
Two co-founders who both write code: Miroslav Maletici (CEO, 51%) and Răzvan Pervulescu (CTO, 49%), students at the Politehnica University of Timișoara. They took the product from first commit to production in about three weeks. The plan has both full time once the round closes.

**Long** (max 1000)
<!-- 953 chars -->
Miroslav Maletici, co-founder and CEO (51%), leads product and sales. Răzvan Pervulescu, co-founder and CTO (49%), leads engineering. Both are students at the Politehnica University of Timișoara (UPT) and both commit code. Together they built ADMINISTRATIVO from the first commit on 17 Aug 2026 to production in early September: 811 commits (34 of them automated), 19 modules and a live REGES-Online integration by 6 Oct 2026. We use AI coding tools openly, with automated tests and nightly AI code review, which is how two people ship at this pace. Both founders go full time when the round closes, on a lean €1,000 gross salary each [TO CONFIRM: how studies fit with full-time work]. Planned hires from the round: a partner and sales manager for the accountant channel (month 3, half time until month 13) and a half-time onboarding and support specialist (month 7). A full-stack developer follows after the seed. There are no other team members today.

## 18. Cap table

**Short** (max 300)
<!-- 212 chars -->
Today: Miroslav Maletici 51%, Răzvan Pervulescu 49%. No investors, no options issued. After the proposed round (fully diluted): founders 79.29% (40.44% and 38.85%), investors 10.71%, new employee option pool 10%.

**Long** (max 1000)
<!-- 662 chars -->
Today the SRL is owned 51% by Miroslav Maletici and 49% by Răzvan Pervulescu. There are no other shareholders, no investors and no options. After the proposed €150k round at €1.25M pre-money, fully diluted: Miroslav Maletici 40.44%, Răzvan Pervulescu 38.85%, Vest Ventures 9.64%, independent angels 1.07% and an employee option pool of 10%. The pool is created before the round, so it dilutes only the founders. While the company is an SRL, the pool would be a virtual (phantom) scheme [TO CONFIRM with a lawyer]. Illustration only, not a plan: after a later €1M seed at €4M pre-money the founders would hold 63.43% together. The full table is in cap-table.xlsx.

## 19. Funding raised to date

**Short** (max 300)
<!-- 192 chars -->
€0 external funding for ADMINISTRATIVO: no investors, no third-party loans; the two co-founders bootstrapped the product. No grants or de minimis State aid [TO CONFIRM for the SRL since 2024].

**Long** (max 1000)
<!-- 507 chars -->
None for ADMINISTRATIVO. We have raised €0 from investors, received no grants and taken no third-party loans for it; the two co-founders have bootstrapped the product since August 2026 [TO CONFIRM: any grants, loans or State aid the SRL received in FY2024/FY2025]. To our knowledge the company has received no de minimis State aid in the last three years, so the full de minimis ceiling is available for the Vest Ventures ticket [TO CONFIRM against the company's records before signing the compliance form].

## 20. Amount raising, instrument and valuation

**Short** (max 300)
<!-- 244 chars -->
€150k pre-seed: a €135k Vest Ventures Accelerator ticket plus €15k from independent angels (not yet identified). €1.25M pre-money (founders' proposal), €1.4M post-money, 10.71% to investors. Instrument: a CLA or SHA on Vest Ventures' templates.

**Long** (max 1000)
<!-- 973 chars -->
We are raising €150k: a €135k Vest Ventures Accelerator ticket plus €15k from independent business angels, whom we have not identified yet. The €15k is 10% of the round and 11% of the ticket, so it meets the rule of at least 10% private co-investment on either basis [TO CONFIRM with Vest Ventures]. The size follows a lean plan: both founders on €1,000 gross, the first two hires half time, and a developer only after the seed. It pays every planned cost for 16 months with zero revenue and lasts 24 months on the base plan, past the seed trigger of 100 paying customers in Aug 2028. We propose €1.25M pre-money (€1.4M post-money), so investors would own 10.71%. We found no sourced Romanian pre-seed valuation benchmark; this is our proposal, in the lower half of the €0.75–3M post-money range implied by 10–20% dilution. Instrument: a convertible loan (CLA) or shareholders' agreement (SHA) on Vest Ventures' templates; under a CLA the €1.25M would be the valuation cap.

## 21. Use of funds

**Short** (max 300)
<!-- 234 chars -->
Product and engineering 23.6%, marketing 19.9%, accountant channel and sales 17.4%, legal, payroll validation, compliance and security 16.8%, operations and contingency 9.3%, infrastructure and tools 7.8%, onboarding and support 5.2%.

**Long** (max 1000)
<!-- 815 chars -->
The €150k is split by each category's share of planned spending over the first 16 months. Product and engineering, €35,345 (23.6%): both co-founders full time on €1,000 gross each; the developer is hired only after the seed. Marketing, €29,873 (19.9%): content, SEO and performance ads. Accountant channel and sales, €26,149 (17.4%): a partner and sales manager (half time until month 13), travel and accountant commissions. Legal, payroll validation, compliance and security, €25,178 (16.8%): validation of payroll legal values by an accountant, an accessibility audit (EN 301 549), an external penetration test and legal documents. Operations and contingency, €13,971 (9.3%). Infrastructure and tools, €11,695 (7.8%). Customer onboarding and support, €7,789 (5.2%): a half-time onboarding specialist from month 7.

## 22. Runway and burn

**Short** (max 300)
<!-- 217 chars -->
16 months with zero revenue, 24 months on the base plan. We start the seed raise at 100 paying customers, planned for month 20 (Aug 2028), about 4 months before cash runs out. Planned costs: €102,029 in year 1 (2027).

**Long** (max 1000)
<!-- 956 chars -->
Current monthly burn: [TO CONFIRM amount]. After the round closes (assumed Jan 2027), planned costs are €102,029 in 2027, €117,399 in 2028 and €185,606 in 2029, when the post-seed developer joins. With zero revenue, €150k pays every planned cost for 16 months; on the base revenue plan cash lasts 24 months, to Dec 2028. The base case reaches 100 paying customers, our seed trigger, in month 20 (Aug 2028) with about €15k in cash, so the seed raise must start promptly and conversations begin before then. Other round sizes: the €135k ticket alone gives 15 months with zero revenue (20 on plan), €220k gives 24 (over 36) and €300k gives 29 (over 36). The base case is not default-alive: in month 36 monthly cash flow is still about −€1.1k, and without a seed the shortfall by then is about €51k. In the conservative case cash lasts 18 months on plan; if the pilot tracks it, we cut paid ads [TO CONFIRM]. The upside case breaks even in month 22 (Oct 2028).

## 23. Milestones

**Short** (max 300)
<!-- 244 chars -->
Plan, not fact: Jan 2027 round closes, founders full time; Apr 2027 pilot companies start paying; May 2027 payroll validated; Aug 2027 30 paying firms; Aug 2028 100 paying firms, start of the seed raise; Jan 2029 developer hired after the seed.

**Long** (max 1000)
<!-- 898 chars -->
All dates are plans from our financial model, counted from an assumed close in Jan 2027 (month 1), when both co-founders go full time. Month 3 (Mar 2027): partner and sales manager hired for the accountant channel, half time. Month 4 (Apr 2027): the free accountant pilot ends and pilot companies convert to paid; the founders onboard them. Month 5 (May 2027): payroll legal values validated by an accountant, so payroll becomes sellable. Month 6 (Jun 2027): accessibility audit (EN 301 549) completed. Month 7 (Jul 2027): onboarding and support specialist hired, half time. Month 8 (Aug 2027): 30 paying companies. Month 12 (Dec 2027): external penetration test. Month 13 (Jan 2028): partner manager full time. Month 20 (Aug 2028): 100 paying companies, when we start the seed raise, including Vest Ventures Seed. Month 25 (Jan 2029), after the seed: developer hired, support specialist full time.

## 24. Financial projections (summary)

**Short** (max 300)
<!-- 227 chars -->
Projection, base case: 47 paying companies at month 12, 139 at month 24, 284 at month 36, with €179k ARR in Dec 2029. Revenue €14.3k in 2027, €56.6k in 2028, €135.5k in 2029. No break-even within 36 months without a seed round.

**Long** (max 1000)
<!-- 912 chars -->
Three scenarios, built bottom-up from the accountant pilot, new accountant partners and organic trials, starting from zero paying customers. Base: 47, 139 and 284 paying companies at months 12, 24 and 36; MRR €14,881 at month 36 (€179k ARR); revenue €14,275 in 2027, €56,648 in 2028 and €135,468 in 2029; no break-even within 36 months. Conservative: 15, 39 and 74 companies; MRR €3,533 at month 36. Upside: 103, 313 and 682 companies; MRR €37,888 at month 36 and break-even in month 22. Base-case monthly churn is an assumed 3%, to be validated in the pilot (ChartMogul median for ARPA under US$25: 6.1%; our ~€50 ARPA sits in a band with better retention). Year-2 unit economics (base): €49.98 average monthly revenue per company, 95% contribution margin, €497 fully loaded CAC, €1,583 lifetime value, LTV/CAC 3.2x, 10.5 months payback. The financial model is a live-formula XLSX with assumptions on one sheet.

## 25. Technology and IP

**Short** (max 300)
<!-- 244 chars -->
Next.js and Supabase Postgres. Tenant isolation is enforced inside the database (forced row-level security on 160 of 164 tables), national ID and IBAN numbers are encrypted (AES-256-GCM), and the audit log is append-only. 5,610 automated tests.

**Long** (max 1000)
<!-- 907 chars -->
Web application on Next.js 16 and React 19, with a Supabase Postgres 17 database hosted in the EU (Ireland region). Separation between client companies is enforced by the database itself, not by application filters: all 164 tables have row-level security, forced on 160 of them, with 443 access policies, and SQL tests check isolation and per-role write access. National ID (CNP) and IBAN numbers are encrypted with AES-256-GCM, and decrypting them for an export leaves an audit record. The audit log is append-only. Five roles with scoped permissions. Legal values (tax rates, minimum wage, per diem) are dated settings, not hard-coded. 5,610 automated test cases and continuous integration on every change. The REGES-Online client uses each employer's own API credentials, stored encrypted. The code was written by the two co-founders [TO CONFIRM: written IP assignment from both founders to the company].

## 26. International ambition

**Short** (max 300)
<!-- 216 chars -->
Romania first: depth in Romanian labour compliance is what we sell. Expanding to neighbouring markets (Serbia, Hungary, Moldova, Bulgaria) is a hypothesis we will test after 100 paying customers, not a current claim.

**Long** (max 1000)
<!-- 758 chars -->
Romania first, on purpose: REGES-Online, Romanian payroll and labour-law rules are where we are hard to copy, and about 526,000 Romanian employers are enough to build a business on. Expanding to neighbouring markets such as Serbia, Hungary, Moldova and Bulgaria is a hypothesis, not a claim. We will test it after we reach 100 paying customers in Romania. Two things make it realistic. Legal values in the product are already dated settings rather than code. The employer-side modules (attendance, leave, health and safety, fleet, inventory, onboarding) depend far less on one country's rules than payroll does. Each new country would still need its own payroll rules, government filings and a translated interface; today the application is in Romanian only.

## 27. Why Vest Ventures

**Short** (max 300)
<!-- 262 chars -->
You are the pre-seed fund of our own region: based in Timișoara, focused on B2B tech, an accelerator built inside a VC fund, with B2B SaaS and relationship-led sales mentors. Our first target market is Western Romanian SMEs, and your Seed stage is our next step.

**Long** (max 1000)
<!-- 779 chars -->
We are a Timișoara company selling to Romanian SMEs, and Vest Ventures is the pre-seed fund built for exactly that region, focused on B2B tech. Our round is sized around your accelerator ticket: €135k plus the private co-investment you require. What we need most is not code but go-to-market, and your accelerator mentors cover our gap: B2B SaaS growth, relationship-led B2B sales and value-based selling, which is how the accountant channel is won. Your programme also asks for things already in our plan: digital accessibility to EN 301 549, with an audit planned for month 6. Your Seed stage is a natural follow-on when we reach 100 paying customers, and Western Romanian companies are our first target market. The project fits the West Region's ICT smart-specialisation area.

## 28. Key risks and mitigations

**Short** (max 300)
<!-- 258 chars -->
No revenue yet; the government decision behind REGES-Online was annulled at first instance (not final, still in force); payroll values await accountant validation; incumbents own the accountant relationship; Romania-only today; a two-person team of students.

**Long** (max 1000)
<!-- 961 chars -->
Demand is unproven: we have zero paying customers, so the accountant pilot and the April 2027 conversion are the test. Regulatory: HG 295/2025, the government decision behind REGES-Online, was annulled at first instance in April 2026. The ruling is not final and the register still applies. The duty to keep an employee register and a daily timesheet comes from the Labour Code, so our core does not depend on that case. Payroll: legal values are being validated by an accountant before we sell payroll. Competition: accountants' software (SmartBill, SAGA, Nexus) already files to REGES, so we position as the employer-side tool that feeds the accountant, not a rival. Team: two student founders; the round pays both full time and adds two half-time hires, and a developer follows after the seed. Security: an external penetration test is planned for month 12. Funding: the base case needs a seed round within about four months of reaching 100 paying customers.

## 29. Contact person

**Short** (max 300)
<!-- 67 chars -->
Miroslav Maletici, CEO, contact@administrativo.ro, +40 767 991 625.

**Long** (max 1000)
<!-- 228 chars -->
Main contact: Miroslav Maletici, co-founder and CEO. Company e-mail: contact@administrativo.ro. Phone: +40 767 991 625. Second co-founder: Răzvan Pervulescu, CTO. Both are based in Timișoara and available for in-person meetings.

## 30. Links (website, data room, media)

**Short** (max 300)
<!-- 173 chars -->
Website https://administrativo.ro, English https://administrativo.ro/en, LinkedIn https://www.linkedin.com/company/144846087/, data room [TO CONFIRM URL]. No demo video yet.

**Long** (max 1000)
<!-- 667 chars -->
Website: https://administrativo.ro (English overview: https://administrativo.ro/en). Pricing: https://administrativo.ro/en/preturi. Offer for accountants: https://administrativo.ro/pentru-contabili. Security and data handling: https://administrativo.ro/incredere. Terms of service with the GDPR data processing annex: https://administrativo.ro/legal/termeni. Privacy policy: https://administrativo.ro/legal/confidentialitate. LinkedIn: https://www.linkedin.com/company/144846087/. Data room: [TO CONFIRM URL, see data-room/HOSTING.md]. Demo video: none yet, recording planned from media/demo-video-script.md. A live walkthrough of the product is available on request.
