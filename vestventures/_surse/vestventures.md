# VestVentures: investor research

Researched 6 Oct 2026. Every claim has its source URL. "Inference" marks our own reasoning, which is not a fact from a source.
Raw page captures used for this note were saved to the session scratchpad and are not part of the package.

---

## 1. Which "Vest Ventures"? (the name is ambiguous)

| Candidate | Evidence | Match? |
|---|---|---|
| **Vest Ventures (vestventures.vc)**: pre-seed fund and accelerator in Western Romania, based in Timișoara | It takes applications through **Pynn AI** (`vestventures.pynn.ai`), whose tagline is *"The first fully automated, Gen-AI powered, early stage startup evaluation, assessment and reporting tool"*. That is the sample elevator pitch shown in our form. The upload fields in the form (pitch deck, financial model, data room, other files, media URLs) also look like a Pynn form. | **YES, almost certainly this one** |
| VEST Her Ventures (Oklahoma City, US) | Seed fund that invests only in women-led startups ([PEI](https://www.privateequityinternational.com/institution-profiles/vest-her-ventures.html)) | No |
| "Vest Ventures Fund I" (New York, US) | Listed as a 2026 pre-seed fund for SaaS, fintech and consumer ([venturecapitalarchive](https://venturecapitalarchive.com/venture-funds/vest-ventures-vestventures-vc)). The URL slug points to vestventures.vc, so the listing may simply be wrong. | Unclear / likely a data error |
| Vest Ventures (vestventures.com, North America) | Small-cap PE firm, venture builder and angel syndicate ([vestventures.com/aboutus](https://vestventures.com/aboutus/)) | No |

How the match was checked:
- `https://vestventures.vc/en/applications/accelerator` and `/applications/seed-investment` both redirect to `https://vestventures.pynn.ai/auth/choose-role`. The Pynn tenant serves the Vest Ventures logo.
- The accelerator page links to `https://vestventures.pynn.ai/auth/signup/startup` ([stages-accelerator](https://vestventures.vc/en/stages-accelerator)).
- The Pre-Accelerator uses a separate Fillout form, `forms.fillout.com/t/mv37g527uKus` (redirect from `/en/applications/pre-accelerator`).
- Pynn's own site carries the same tagline: [pynnai.com](https://pynnai.com/) ("Pynn AI - Gen-AI powered startup assessment and reporting tool").

---

## 2. Who they are

- **Legal vehicle.** *Usaldusfond Wise Guys Romania Fund 1*, which trades as Vest Ventures. It is an Estonian investment fund (code 17329661, A. Lauteri 3, Tallinn), represented by its General Partner, Wise Guys Ventures OÜ ([Participation regulations, §1](https://vestventures.vc/en/programs-terms)).
- **Management consortium ("Wise Grow Collective").** Wise Guys Ventures OÜ (lead, fund administrator), Wise Guys Holding OÜ, Growceanu Angel Investment SRL, Cowork Timișoara SRL and Iceberg Plus SRL ([programs-terms §1](https://vestventures.vc/en/programs-terms)). Press coverage calls it "Startup Wise Guys, Cowork Timișoara, Growceanu and Iceberg Plus" ([ADR Vest press release, 5 Feb 2026](https://adrvest.ro/vest-ventures-primul-fond-regional-de-investitii-de-capital-de-risc-din-vestul-romaniei-s-a-lansat-cu-un-buget-de-166-milioane-de-euro/)).
- **Money.** European Regional Development Fund plus the Romanian state budget, through the **West Regional Programme 2021–2027** (PR Vest), Policy Objective 1, SMIS 358941. **ADR Vest** (West Regional Development Agency) is the **anchor LP** ([programs-terms](https://vestventures.vc/en/programs-terms), [investor-relations](https://vestventures.vc/en/investor-relations)).
- **Fund size.** Sources disagree:
  - €16.6M ([ADR Vest](https://adrvest.ro/vest-ventures-primul-fond-regional-de-investitii-de-capital-de-risc-din-vestul-romaniei-s-a-lansat-cu-un-buget-de-166-milioane-de-euro/), [StartupCafe](https://startupcafe.ro/finantari-2026-milioane-euro-antreprenori-lansat-vest-ventures-fond-regional-investitii-capital-risc-romania-94080))
  - €16.5M, "dedicated to **B2B pre-seed tech startups**" ([team page](https://vestventures.vc/en/team))
  - €6M for accelerator investments plus €8M for seed investments ([homepage](https://vestventures.vc/en))
  - "~€7M direct investments, ~€6M acceleration" ([start-up.ro, 4 Feb 2026](https://start-up.ro/cum-va-investi-vest-ventures-6-milioane-de-euro-investitii-directe-4-programe-de-accelerare-dar-si-educatie))
  - In the deck, quote only "a €16.6M regional fund", if we mention the size at all.
- **Launch.** 4 Feb 2026 at the Romania Startup Summit in Timișoara ([StartupCafe](https://startupcafe.ro/finantari-2026-milioane-euro-antreprenori-lansat-vest-ventures-fond-regional-investitii-capital-risc-romania-94080), [events](https://vestventures.vc/en/events)).
- **How they describe themselves.** "Romania's only accelerator built inside a venture capital fund" ([stages-accelerator](https://vestventures.vc/en/stages-accelerator)). Also "a feeder fund" with "a sister VC West fund focused on Series A" ([investor-relations](https://vestventures.vc/en/investor-relations)).
- **Team** ([team](https://vestventures.vc/en/team)):
  - Cristobal Alonso, GP: serial entrepreneur, investor in 450+ startups, focused on cyber security, **SaaS** and XR
  - Ciprian Man, GP: co-founder and CIO of Growceanu
  - Răzvan Suta, COO & MD
  - Andrei Cosmin Munteanu, Programs MD: CEO of Cowork Timișoara
  - Loredana Gavrilescu, VC Principal & Compliance Officer: ex-Iceberg Plus
  - Others work on communications and the pre-acceleration program
- **Relevant accelerator mentors** ([accelerator-mentors](https://vestventures.vc/en/accelerator-mentors)):
  - Gilles De Clerck, "B2B SaaS Growth Expert"
  - Patrick Collins, B2B relationship-led sales
  - A GTM/revenue mentor teaching MEDDPIC and value-based sales
  - The accelerator methodology was developed with Startup Wise Guys ([stages-accelerator](https://vestventures.vc/en/stages-accelerator)).
- **Contact.** hello@vestventures.vc

## 3. Thesis, sectors and geography

- **Sectors.** "Industry-agnostic", tech or tech-enabled ([apply-now](https://vestventures.vc/en/apply-now), [FAQ](https://vestventures.vc/en/faq)). The project must fit the **West Region smart-specialisation areas (RIS3)**, e.g. **ICT**, automotive, advanced manufacturing, health and sustainable tourism ([programs-terms §2B](https://vestventures.vc/en/programs-terms)). A third-party profile lists agri-food, manufacturing, automotive, energy efficiency, construction, ICT, health, tourism and AI ([superscout](https://superscout.co/investor/vest-ventures-vc), not official).
  - A full list of eligible CAEN codes is in the "Investment Execution Rules" annex, p. 95+ ([Google Doc linked from legal-documents](https://docs.google.com/document/d/1Oon0ME7kMO03ba4Qkpp0rat-egADNQs7/edit)). The text export does not include that table. **[TO CHECK]**: our CAEN code (likely 5829/6201) is on the list.
- **Geography.**
  - For the Accelerator and Seed, the company must be an **SME** with its **registered office or an active operational place of business in Arad, Caraș-Severin, Hunedoara or Timiș**, at the latest when the investment contract is signed ([programs-terms §2A](https://vestventures.vc/en/programs-terms)).
  - Operating decisions must be taken in the region, and at least one director must actually work there. On-site checks by ADR Vest and MIPE are possible ([programs-terms §6](https://vestventures.vc/en/programs-terms)).
  - Applications are open to teams from Romania, Serbia, Hungary, Moldova, Bulgaria, the Western Balkans, SEE/CEE "and beyond" ([investor-relations](https://vestventures.vc/en/investor-relations)).
- **Academic links.** Their sourcing includes "collaboration with the academic environment" ([programs-terms §4A](https://vestventures.vc/en/programs-terms)). Pre-acceleration events were held at Aurel Vlaicu University and UVVG in Arad, the UBB University Centre in Reșița, the University of Petroșani and the Faculty of Engineering Hunedoara ([events](https://vestventures.vc/en/events)). We found **no published formal partnership with UPT** (Politehnica University of Timișoara). We should not claim one.

## 4. Stages, tickets and instruments

| Stage | Who it is for (their words) | Money | Source |
|---|---|---|---|
| **Pre-Accelerator** | Individuals and teams from idea to MVP. Free. No capital. 4 weeks, ≥80% attendance. **Cohort 3: 13 Nov – 5 Dec 2026**, ending in a Demo Day | None | [stages-pre-accelerator](https://vestventures.vc/en/stages-pre-accelerator), [FAQ](https://vestventures.vc/en/faq) |
| **Accelerator** | "Working MVP; at least 2 co-founders, full-time or core team; initial customer traction such as early revenues, MRR, **signed pilots, or Letters of Intent**; first invoices or validated market need; incorporated and open to relocating to Western Romania; international ambition". 16 weeks, hybrid, ≥90% attendance. Free. "Teams accepted into the Accelerator will receive investment." | **€10k–€200k** per startup, equity or quasi-equity under the **de minimis** regime, with **≥10% private co-investment from independent sources**. The press reported about **€100k per startup**, up to 15 startups per cohort, 4 cohorts | [stages-accelerator](https://vestventures.vc/en/stages-accelerator), [programs-terms §3A, §5](https://vestventures.vc/en/programs-terms), [start-up.ro](https://start-up.ro/cum-va-investi-vest-ventures-6-milioane-de-euro-investitii-directe-4-programe-de-accelerare-dar-si-educatie) |
| **Seed Investment** | "Proven traction, such as first invoices"; paying customers or strong commercial traction. FAQ: revenue is needed "in most cases". Pillars: PMF, a repeatable GTM that works in other markets, data-driven sales, **commitment from other VCs**, proper governance. Can be entered directly | **€200k–€1M** under risk-finance State aid (GBER Art. 21). Required private co-financing: **10%** if the company has not operated in any market, **20%** if it has operated for under 10 years | [stages-seed-investments](https://vestventures.vc/en/stages-seed-investments), [FAQ VI](https://vestventures.vc/en/faq), [programs-terms §3B](https://vestventures.vc/en/programs-terms) |

- **Instruments.** Term sheet, then a convertible loan agreement (CLA) or SHA, plus a service agreement. The fund's templates are the default ([programs-terms §3, §4C](https://vestventures.vc/en/programs-terms)).
- **Co-investment.** Vest Ventures co-invests with angels and VCs. It may lead, case by case. Follow-on is possible ([FAQ VI](https://vestventures.vc/en/faq)). When the private share is not otherwise covered, it is raised from independent private investors such as business angels ([programs-terms §3](https://vestventures.vc/en/programs-terms)).
- **De minimis.** The cap counts all de minimis aid over 3 years ([programs-terms §3A](https://vestventures.vc/en/programs-terms)). Under Regulation (EU) 2023/2831 the ceiling is €300k per single undertaking over 3 years ([EUR-Lex](https://eur-lex.europa.eu/eli/reg/2023/2831/oj)). Any earlier grant or de minimis aid must be disclosed in the second form ([FAQ II.7](https://vestventures.vc/en/faq)).
- **Portfolio so far.** Accelerator Cohort 1: about 100 applications, **9 selected**, 14 weeks, a trip to Latitude59 in Tallinn, and a Demo Day in Timișoara on 7 Jul 2026 ([blog](https://vestventures.vc/en/blog/inside-the-first-vest-ventures-cohort), [events](https://vestventures.vc/en/events/demo-day-the-next-chapter)). The nine:
  - Revelio Medical
  - Ixaria
  - Data Sweep
  - Elvo (B2B EV-charging management)
  - Fiora5
  - Caut Curier
  - WakeZ
  - Harmonia Technologies
  - Outpost Chess

  No HR or payroll SaaS is among them, so there is no direct portfolio conflict. (Inference.)

## 5. Process, deadlines and what they ask for

- **Single entry point.** The Pynn platform is "the only way to apply". Applicants create a profile and upload materials ([programs-terms §4A](https://vestventures.vc/en/programs-terms)).
- **Complete data set required.** "Only applications with a complete data set (**financial data, pitch deck, team profile**) are admitted to the assessment stage" ([programs-terms §4B](https://vestventures.vc/en/programs-terms)).
- **Five selection levels** ([programs-terms §4C](https://vestventures.vc/en/programs-terms)):
  1. Human review of the founders' identity (anti-bot), the quality of the information and the "ability to present their idea and objectives". This is **complemented by an automatic scoring evaluation, "with a strictly indicative role"**.
  2. Compliance and conflict-of-interest form, legal check, de minimis history and risk report, then a first meeting. At this point they may **redirect** the applicant, e.g. to acceleration without investment or to pre-acceleration.
  3. Interviews with the team, then the decision.
  4. Due diligence, including AML and KYC.
  5. A bring-down check if signing comes more than 30 days after due diligence.
- **Due-diligence documents** ([programs-terms §4D](https://vestventures.vc/en/programs-terms)), each issued no more than 30 days earlier:
  - certificat constatator (trade register certificate with full history)
  - CUI (registration certificate)
  - articles of association, in every version
  - IDs of the administrator and associates
  - beneficial-owner statement
  - **balance sheets for the last two fiscal years**
  - ANAF and local fiscal certificates
  - company tax-record certificate
  - criminal record of the administrator
- **Deadlines (as of 6 Oct 2026):**
  - Accelerator **Cohort 2: applications closed 1 Oct 2026; the cohort starts 2 Nov 2026** ([event](https://vestventures.vc/en/events/cohort-2-applications-open)).
  - Four cohorts are planned over two years. Cohort 1 started at the end of March 2026 ([blog](https://vestventures.vc/en/blog/inside-the-first-vest-ventures-cohort), [event](https://vestventures.vc/en/events/accelerator-co-hort-1)). The Cohort 3 date is **not published**.
  - The blog says "Applications are open on a rolling basis" ([blog](https://vestventures.vc/en/blog/inside-the-first-vest-ventures-cohort)).
  - **PROWpeller** (a pitch competition at PROW Timișoara, with a €150k investment as the prize and a fast track into the accelerator) closed applications on 25 Sep. Pitch Day is 30 Oct ([prowpeller](https://vestventures.vc/en/prowpeller)).
  - Next open touchpoint: **"Founder Playground – Ask us Anything", 7 Oct 2026, 10:00–12:00, online, every 2 weeks** ([events](https://vestventures.vc/en/events)).
- **Conditions after investment** ([programs-terms §6–§8](https://vestventures.vc/en/programs-terms)):
  - The beneficiary's name, idea, location and the amount received are published in RegAS and on vestventures.vc.
  - An EU co-financing poster must be displayed.
  - DNSH (do no significant harm to the environment) applies.
  - Software built or promoted within the program must meet **digital accessibility per EN 301 549**.
  - Discrimination gets zero tolerance.
  - Funds are reclaimed if data turns out to be false.

## 6. The AI screener (Pynn): what it is and what it likely reads

- **Who Pynn is.** A Spanish company from Mallorca. Its CEO is David Franzen, and the team is about 5 people. It "evaluates startups automatically, tailoring the assessment to each investor's thesis" and produces "structured reports covering **team, product, market, and risk**" ([Built in Europe, 1 Mar 2026](https://builtineurope.substack.com/p/matching-innovation-with-investors-pynn)). It also stores data rooms, cap tables and financials. Pynn's site says it gives "AI-powered assessments, individual investment theses" ([pynn.ai](https://pynn.ai/)).
- **Six scoring dimensions (unverified).** A search-engine summary of pynnai.com listed six: market potential, team strength, product & tech, traction, business model, investment fit. It also mentioned "investment thesis setup (green/yellow/red flags)". **We could not confirm this on a fetched page**: pynnai.com shows only a login, and Pynn's brochure PDF has no extractable text. Treat it as **likely, not confirmed**.
- **Pynn's deck advice** ([Pynn Journal, 16 Sep 2026](https://pynn.ai/blog/what-investors-read-in-your-deck-and-how-long-you-have)):
  - Readers give a deck about **2.5 minutes**. Aim for **about 16 slides at pre-seed, not 20**.
  - The purpose slide must be "survivable in twenty seconds".
  - **Team** gets the most attention, then business model, then product.
  - Long dwell time on product or financials signals **confusion**, not interest.
  - Most deals come through referrals, not cold decks.
- **Weight of the AI score.** Vest Ventures says the automatic score is "strictly indicative". Humans decide at every level ([programs-terms §4](https://vestventures.vc/en/programs-terms)).
- **What an LLM screener needs** (inference, from how text-extraction scoring works):
  - The PDF needs a real text layer (not slide images).
  - Each slide title should state the claim.
  - Numbers should be written as labelled values with units, dates and sources.
  - Deck, financial model and data room should use **identical figures**.
  - The ask must be explicit (amount, instrument, use of funds, runway, milestones).
  - The team needs a named section (who does what, relevant evidence).
  - Traction and projections should be clearly separated.
  - No contradictions: an AI flags inconsistencies faster than a human does.

---

## 7. Implications for our application

1. **Apply for the Accelerator, not Seed.**
   - Seed (€200k–€1M) expects first invoices or revenue "in most cases". We have **zero paying customers**, so a Seed application would most likely be redirected at Level 2.
   - The Accelerator explicitly accepts no-revenue startups if they show **"another form of validation": pilots, LOIs, active users, usage data, customer interviews, waitlists** ([FAQ V.5](https://vestventures.vc/en/faq)).
   - Our live product, our two co-founders and the accountant pilot program (started 6 Oct 2026) fit this definition, provided we document them.
2. **Frame the €150k–€300k pre-seed round around their instrument.**
   - Their accelerator ticket is €10k–€200k (press: about €100k), de minimis, with **≥10% independent private co-investment**. Above €200k we are in Seed territory.
   - Recommendation for the financial model (inference):
     - Name a round size that a **Vest Ventures accelerator ticket (≤€200k) plus independent angels (≥10% of the VV ticket, e.g. via Growceanu-style angel networks)** can fill.
     - Show scenario A (VV ticket only) and scenario B (VV ticket plus angels up to the target).
     - Show the dilution under a CLA (convertible loan agreement).
3. **The highest-value action before submitting is to turn pilots into evidence.** Signed pilot agreements or LOIs from accountants and SMEs, plus usage data from demo and pilot tenants, are what they count as traction ([FAQ V.4](https://vestventures.vc/en/faq)). A count of "B2B conversations with qualified prospects" counts too. Report web analytics honestly as "pre-launch, SEO just starting". Do not present them as traction.
4. **Timing.**
   - Cohort 2 closed on 1 Oct and starts on 2 Nov.
   - Join the **Founder Playground AMA (7 Oct, online)**. Ask (a) whether a late or rolling application can still enter Cohort 2, and (b) when Cohort 3 opens.
   - Submit through Pynn anyway: applications are rolling, and an early profile gets reminders and history.
5. **A complete data set is a hard gate.** Upload the pitch deck, the financial model (XLSX) and a full team profile, and fill the second compliance form (prior grants: none; de minimis: none, **[TO CONFIRM]**). A missing item blocks assessment ([programs-terms §4B](https://vestventures.vc/en/programs-terms)).
6. **Deck length and order.**
   - About **12–16 slides** in the main deck (Pynn: about 16 at pre-seed), with the appendix behind it, as a text-layer PDF under 10 MB, in English.
   - Order: problem, product (screens), why now (REGES-Online, the mandatory electronic employee register reported to ITM, the Labour Inspectorate), **team early**, business model and pricing, traction/validation (honest), market (sourced), competition, GTM (accountants as a channel), roadmap, financials summary, **the ask**.
7. **Metrics to show** (their own words): first invoices or MRR (none yet, say so), signed pilots, LOIs, active users and usage, retention, qualified B2B conversations, plus the evidence of execution speed:
   - Development started 17 Aug 2026; in production since early Sep.
   - The breadth of the 22 modules.
   - Live API integration with REGES-Online.

   For Seed later, they look for a repeatable GTM that works in other markets and commitment from other VCs.
8. **Team section, which matters most** (Pynn and their FAQ on founders):
   - Two co-founders, both committing code, with a clean 51/49 cap table and no prior investors. A "compatible cap table" is a Seed criterion.
   - State the **full-time commitment** explicitly. Both founders are UPT students, and the FAQ asks whether founders can commit given other obligations ([FAQ V.13](https://vestventures.vc/en/faq)).
   - Roles and bios: **[TO CONFIRM]**.
9. **Regional fit is part of their mandate.**
   - Emphasise Timișoara, the UPT roots (as a fact about the founders, not as a partnership), and a West Region registered office **[TO CONFIRM SRL address in Arad, Caraș-Severin, Hunedoara or Timiș]**.
   - Our product helps regional SMEs digitise HR compliance. RIS3 fit: ICT.
10. **International ambition is an explicit criterion and our weak spot.** REGES-Online is specific to Romania. Present expansion to neighbouring CEE markets (they name Serbia, Hungary, Moldova and Bulgaria) as a **hypothesis or roadmap**, not as a claim. The defensible core is Romanian compliance depth.
11. **Compliance items to have ready:**
    - Accessibility (EN 301 549): state the current status honestly.
    - GDPR/DPA for HR data.
    - Multi-tenant isolation through forced row-level security, as a security differentiator.
    - Payroll described as **"built, undergoing accountant validation"**.
    - Never repeat the unbacked claims listed in `docs/comercial/README.md`.
12. **Data room (the form's URL field).** Structure:
    - company docs (certificat constatator, articles, cap table)
    - financial model
    - product (screenshots, demo video link)
    - security/architecture note
    - pilot evidence
    - roadmap

    This mirrors their due-diligence list, so Level 4 goes faster.
