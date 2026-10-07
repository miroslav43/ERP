import type { ContinutLanding } from "./tipuri";

/**
 * English content.
 *
 * Not a literal translation: the Romanian original speaks to someone who has
 * lived through an ITM inspection, and that voice does not survive word for
 * word. What is kept exactly is the substance — every claim here maps to the
 * same code as the Romanian page, and the honesty section loses nothing.
 *
 * Romanian institutions keep their names (REVISAL, ITM, CAEN, SSM), with a
 * short gloss the first time each appears. Renaming them would make the page
 * vaguer, not clearer: a foreign owner running a Romanian company will hear
 * those exact words from their accountant.
 */
export const EN: ContinutLanding = {
  limba: "en",
  cealaltaLimba: { eticheta: "RO", href: "/" },

  meta: {
    // Vezi nota din `ro.ts`: sub 60 de caractere, marca scoasă din față, termenul
    // căutat și dimensiunea firmei în locul ei.
    titlu: "Time tracking and HR for companies with 5–50 employees",
    descriere:
      "Clocking in by phone, leave, personnel files and REGES-ONLINE reporting in one account. 149 lei a month for up to 20 employees, first month free.",
  },

  antet: {
    navigare: [
      { eticheta: "What it does", href: "/en/#produs" },
      { eticheta: "Who it is for", href: "/en/#pentru-cine" },
      { eticheta: "Pricing", href: "/en/preturi" },
      { eticheta: "Security", href: "/en/#siguranta" },
      { eticheta: "Contact", href: "/en/#contact" },
    ],
    autentificare: "Sign in",
    demo: "Create an account",
    meniu: "Menu",
    sariLaContinut: "Skip to main content",
  },

  hero: {
    // Vezi nota din `ro.ts` (6 oct 2026): titlul spune ce se schimbă pentru cele
    // două capete ale lunii, iar a doua acțiune duce la un om, nu la preț.
    supratitlu: "Time tracking and HR · for companies with 5–50 employees",
    titlu: "Your people clock in from their phones. You\u00a0close the month without spreadsheets.",
    lead: "Start and end times land on the monthly attendance sheet by themselves, approved leave comes off the balance, and contracts go to REGES-ONLINE, the Labour Inspectorate's register, straight from the app. The daily working-time record Romanian law requires, kept up to date in one account.",
    ctaPrimar: { eticheta: "Create an account · first month free", href: "/inregistrare" },
    ctaSecundar: { eticheta: "Book a demo", href: "/cere-demo" },
    asigurari: ["No card to sign up", "No setup fee", "Nothing to install"],
    suna: "A person answers at",
    video: { opreste: "Pause video", porneste: "Play video" },
    punteFoaie:
      "This is what the month looks like at the end: what people clocked on their phones, gathered on the monthly attendance sheet. Leave and public holidays are already on it, and the totals add up across the rows and down the columns.",
  },

  foaie: {
    eticheta: "Monthly attendance sheet",
    subtitlu: "Sample. The names are invented, the month is real.",
    capAngajat: "Employee",
    capOre: "HRS",
    capSuplimentare: "OT",
    capNoapte: "NGT",
    randTotal: "TOTAL",
    legendaTitlu: "Legend",
    notaCodConcediu:
      "0 CO means a day of annual leave: zero hours worked, because leave is paid as an allowance rather than from hours. The cell still shows the figure, so the column adds up.",
    notaSubset:
      "OT and NGT are of which, not on top — hours worked already include them. The same rule is written as a constraint in the database.",
    notaNorma:
      "Twenty working days × eight hours = 160 contract hours. Good Friday and Easter Monday are public holidays; Orthodox Easter falls on a Sunday in 2026, so it adds no day off. The movable dates come from the Easter calculation, not from a hand-written list.",
    monumentEticheta: "hours worked in April 2026",
    monumentNota:
      "Added down the eight rows or across the thirty columns — the same figure. That is what closing a month means.",
    monumentStatic: "It doesn't change. You added the same hours by another route.",
    ferestreEticheta: "Show",
    descriereTabel:
      "Monthly attendance sheet for April 2026, eight employees across thirty days, with row and column totals.",
    anuntColoana: "April {zi}: {ore} h, across {persoane} people.",
    anuntRand: "{nume}: {ore} h in April.",
  },

  dovada: {
    // Vezi nota din `ro.ts`: banda poartă riscul asumat de noi, nu inventarul.
    randuri: [
      {
        valoare: "1",
        eticheta: "free month",
        nota: "For any configuration. No card asked for at sign-up.",
      },
      {
        valoare: "149",
        eticheta: "RON a month",
        nota: "The core, for the whole company up to 20 employees — not per person. Final price, no VAT.",
      },
      {
        valoare: "0",
        eticheta: "RON to start",
        nota: "No implementation fee and no separately billed training.",
      },
      {
        valoare: "19",
        eticheta: "modules",
        nota: "You switch on only what you use. The rest appears neither in the menu nor on the invoice.",
      },
    ],
  },

  realitatea: {
    supratitlu: "Monday morning",
    titlu: "You are not missing procedures. You are missing the place they live in.",
    lead: "Companies of five to fifty people already have rules. The trouble is that the rules live in three files, two phones and one person's head.",
    scene: [
      {
        titlu: "Attendance is a file called timesheet_final_v3_ok",
        text: "Someone fills it in, someone else corrects it, and by the end of the month nobody knows which version went to accounting. When the row totals disagree with the column totals, the error is hunted by eye.",
      },
      {
        titlu: "Leave requests are in a chat thread",
        text: "Approval is an “ok” typed at nine in the evening. Eight months later, when the employee asks how many days are left, the answer is reconstructed from memory and from messages that deleted themselves.",
      },
      {
        titlu: "Deadlines surface during an inspection",
        text: "Safety briefing records, occupational medicine, vehicle inspection, fire extinguisher checks. Each has a due date, none has a place that warns you. You find out it expired from the inspector.",
      },
    ],
  },

  platforma: {
    supratitlu: "How it connects",
    titlu: "The modules are not separate apps placed side by side.",
    lead: "What goes in once is never retyped. The links below exist in the code, under the names printed here — this is not a presentation diagram.",
    noduri: [
      { cheie: "angajati", eticheta: "People" },
      { cheie: "concedii", eticheta: "Leave" },
      { cheie: "pontaj", eticheta: "Attendance" },
      { cheie: "salarizare", eticheta: "Payroll" },
      { cheie: "diurna", eticheta: "Travel" },
      { cheie: "scadente", eticheta: "Due dates" },
      { cheie: "audit", eticheta: "Audit log" },
    ],
    legaturi: [
      {
        de: "concedii",
        la: "pontaj",
        eticheta: "sincronizare_concedii",
        text: "Approved leave becomes a leave day on the sheet. The operation is idempotent: run ten times, it has the same effect as running once.",
      },
      {
        de: "pontaj",
        la: "salarizare",
        eticheta: "aggregation in SQL",
        text: "Hours from a closed month feed payroll. The aggregation moved out of the application and into the database after two silent defects that discarded weekend and holiday days.",
      },
      {
        de: "angajati",
        la: "scadente",
        eticheta: "expirables",
        text: "Contracts, permits, safety briefings, vehicle documents — all reach the same deadline engine, with a warning before expiry.",
      },
      {
        de: "diurna",
        la: "salarizare",
        eticheta: "tax-free ceiling",
        text: "The ceiling splits the amount, it does not block it: whatever exceeds it becomes salary-assimilated income.",
      },
      {
        de: "angajati",
        la: "audit",
        eticheta: "audit trigger",
        text: "Every write records who, when, from which address, and what changed.",
      },
      {
        de: "scadente",
        la: "audit",
        eticheta: "append-only",
        text: "The log is appended to. There is no delete policy anywhere in the product.",
      },
    ],
    nota: "The names on the arrows are the real function and table names. Ask to see them during the walkthrough.",
  },

  module: {
    supratitlu: "Modules",
    titlu: "Nineteen modules. You switch on only what you use.",
    lead: "What is not enabled does not appear in the menu, does not appear in search, and cannot be opened by typing the address. Modules are toggled per company.",
    grupuri: [
      {
        cheie: "core",
        titlu: "Core",
        module: [
          {
            cheie: "nucleu",
            titlu: "Organisation, roles and audit",
            text: "The company, its members, e-mail invitations, and a trace of every change. One person can work for several companies and switch between them without signing out.",
            puncte: [
              "Accounts are created by invitation only",
              "Five roles, each with its own scope",
              "A log that is appended to, never rewritten",
            ],
          },
          {
            cheie: "asistent",
            titlu: "AI assistant",
            text: "An assistant that answers \u201cwhere do I do X?\u201d and hands you the button that takes you there. It cannot point you at a screen you may not open: its list of destinations is filtered by your own permissions.",
            puncte: [
              "It tells you the click path, then shortens it to one button",
              "It answers with real figures too: leave balance, what awaits approval",
              "It executes nothing \u2014 it explains and takes you there; you press",
            ],
          },
        ],
      },
      {
        cheie: "hr",
        titlu: "People",
        module: [
          {
            cheie: "attendance",
            titlu: "Attendance",
            text: "The monthly sheet and the week plan. The month locks when it is done, and after that it cannot be edited, not even by accident.",
            puncte: [
              "Overtime and night hours, as subsets of hours worked",
              "Approval per department or per week",
              "Holiday compensation: a day off or a premium, with a deadline",
            ],
          },
          {
            cheie: "leave",
            titlu: "Leave",
            text: "The request travels the approval chain, the balance recalculates itself, and non-working days and public holidays drop out of the count automatically.",
            puncte: [
              "Eleven leave types, each with its legal basis noted",
              "Annual entitlement by seniority, working conditions, disability or age",
              "Team calendar: who is away, and when",
            ],
          },
          {
            cheie: "onboarding",
            titlu: "Onboarding",
            text: "An onboarding path for new hires and a checklist for leavers, with steps that require a tick, a document or a signature.",
            puncte: ["Templates with reorderable steps", "A printable record of completion"],
          },
          {
            cheie: "courses",
            titlu: "Courses",
            text: "A library of PDF and video material, taken inside the app. Each item sets how strong its own proof is: a tick, a measured percentage watched, or a signed declaration.",
            puncte: [
              "Videos and documents are viewed in the ERP, and never leave it",
              "Recertification on schedule, reappearing in the person's list on its own",
            ],
          },
          {
            cheie: "reges",
            titlu: "REGES-Online (formerly Revisal)",
            text: "Contracts and employees are filed with the Labour Inspectorate straight from the ERP, over the REGES API. No hand-carried import file, no second typing of the same data.",
            puncte: [
              "Each event's legal deadline, counted in working days",
              "The Inspectorate's answer lands back on the employee record, with the rejection reason in plain words",
            ],
          },
          {
            cheie: "evaluations",
            titlu: "Reviews",
            text: "Templates built from your own criteria. A review opens from the person's file and stays in it.",
            puncte: ["Criteria you define", "History per employee"],
          },
          {
            cheie: "kpi",
            titlu: "KPIs",
            text: "Performance indicators per employee and per team, with monthly targets. The employee sees the same figure their manager does.",
            puncte: [
              "Reusable indicator sets, defined once per company",
              "A closed month can no longer be rewritten",
              "The employee sees their indicator in the portal, target next to result",
            ],
          },
        ],
      },
      {
        cheie: "operations",
        titlu: "Operations",
        module: [
          {
            cheie: "ssm",
            titlu: "Health and safety",
            text: "A matrix of employee × briefing type, with a traffic light on due dates. “Never done” is a state distinct from “expired” — and a more serious one.",
            puncte: [
              "Countdown for reporting an accident to the labour inspectorate",
              "Fire extinguishers: inspection, refill, pressure test",
              "Protective equipment and fitness certificates, with durations",
            ],
          },
          {
            cheie: "fleet",
            titlu: "Fleet",
            text: "Vehicles with inspection, insurance and road-tax deadlines, trip sheets with odometer readings and fuel entries.",
            puncte: [
              "Odometer going backwards: physically impossible, so it is blocked",
              "A jump over the threshold: possible, so it is flagged",
            ],
          },
          {
            cheie: "maintenance",
            titlu: "Maintenance",
            text: "Equipment, planned servicing and fault reports, triaged by urgency.",
            puncte: [
              "Due by days AND by counter — hours, kilometres, cycles",
              "The final state is the more serious of the two",
              "ISCIR authorisations for regulated equipment",
            ],
          },
          {
            cheie: "inventory",
            titlu: "Inventory",
            text: "Items, categories and allocations. The employee confirms for themselves what they received.",
            puncte: ["Handover with a date", "The employee confirms receipt themselves"],
          },
          {
            cheie: "ticketing",
            titlu: "IT ticketing",
            text: "Requests to IT: software, hardware, faults on inventory items, and bugs reported from inside the application. A ticket enters a queue, not a chat thread.",
            puncte: [
              "Linked to the inventory item that broke",
              "A triaged queue, not a shared mailbox",
              "Employees see their own tickets",
            ],
          },
        ],
      },
      {
        cheie: "finance",
        titlu: "Finance",
        module: [
          {
            cheie: "payroll",
            titlu: "Payroll",
            text: "The calculation runs step by step, with a breakdown and warnings. The rates are yours, versioned with the date they take effect — none of them is written into the code.",
            puncte: [
              "Reusable premiums and bonuses, defined once",
              "Deductions capped as a percentage of net pay",
              "Meal vouchers never enter the social contribution base",
            ],
          },
          {
            cheie: "per_diem",
            titlu: "Travel and per diem",
            text: "Travel orders, legs across countries, and expense claims. The 24-hour windows run from departure, not from midnight.",
            puncte: [
              "A border-crossing day is paid once, to one country",
              "Country rates and the exchange rate on the departure date",
              "A printable expense report",
            ],
          },
          {
            cheie: "rapoarte",
            titlu: "Reports",
            text: "Income, leave and meal vouchers, aggregated across the organisation. The aggregation runs in SQL, not in the application — the same decision as for attendance.",
            puncte: [
              "An owner-level threshold, not a manager one: it needs the „all” scope",
              "Excel export, with the same figures as on screen",
            ],
          },
        ],
      },
      {
        cheie: "communication",
        titlu: "Communication",
        module: [
          {
            cheie: "announcements",
            titlu: "Announcements",
            text: "Internal notices with read confirmation. You see who has read, against the number of active employees.",
            puncte: ["Notification in the app and in the employee portal"],
          },
        ],
      },
      {
        cheie: "portal",
        titlu: "Portal",
        module: [
          {
            cheie: "employee_portal",
            titlu: "Employee portal",
            text: "Their leave balance, their requests, their attendance, their payslip and their documents. Nothing else.",
            puncte: [
              "In the browser, on a phone",
              "No account created without the person's consent",
            ],
          },
        ],
      },
    ],
  },

  ecrane: {
    supratitlu: "And there is more",
    titlu: "What else you will find inside",
    lead: "Screens that are not separate modules, but without which the modules would be of no use.",
    randuri: [
      {
        cod: "ORG",
        titlu: "Org chart",
        text: "The reporting tree, visible even to someone whose rights cover only their own branch.",
      },
      {
        cod: "XLS",
        titlu: "Employee import from Excel",
        text: "Column mapping, row-by-row validation, batch application, and a CSV report listing every rejected row with its reason.",
      },
      {
        cod: "DOC",
        titlu: "Documents from templates",
        text: "Employment contract, job description and three certificates, with series numbering, a checksum and a verification code.",
      },
      {
        cod: "CAEN",
        titlu: "Activity codes and tax-ID validation",
        text: "The tax identification number is checked against its control digit. Secondary activity codes respect the limits of the legal form.",
      },
      {
        cod: "REV",
        titlu: "REVISAL event register",
        text: "Ten event types, each with a deadline computed from your configuration and a state of on time / today / overdue.",
      },
      {
        cod: "RPT",
        titlu: "Annual reports",
        text: "Leave days, sick days, gross and net income, meal vouchers and overtime, per employee and per company.",
      },
      {
        cod: "SITE",
        titlu: "Work sites and departments",
        text: "The shape of the company, with positions and occupational codes on each one.",
      },
      {
        cod: "AUD",
        titlu: "Audit log, with export",
        text: "Who, when, from which address, what changed. Exportable to CSV, with protection against formula injection.",
      },
    ],
  },

  pontaj: {
    supratitlu: "How hours reach the system",
    titlu: "Six ways that work today. Four we do not have yet.",
    lead: "We draw them differently so you cannot confuse them. What is solid exists and can be shown in a walkthrough. What is hatched does not exist — not even as a column in the database.",
    livrateTitlu: "Works today",
    livrate: [
      {
        titlu: "One-tap clock-in from the phone",
        text: "From the employee portal, in the browser: one button that confirms the usual day, or two — “I'm in” and “I'm out”. The time recorded is the server's, not the phone's.",
        detaliu: "The company picks the mode: confirm, clock, or both",
      },
      {
        titlu: "A QR poster at the work point",
        text: "Each work point has a poster printed from the application. The employee scans the code with the phone's camera and clocks in at that point; the company can require the scan before clocking in.",
        detaliu: "The code stays the same until an administrator changes it",
      },
      {
        titlu: "The monthly sheet",
        text: "A day × employee grid. You enter start and end times, and the hours are computed as an editable suggestion.",
        detaliu: "One row per day per person, uniqueness enforced in the database",
      },
      {
        titlu: "The week plan",
        text: "The employee declares next week's schedule, with a presence mode: office, remote, travel, secondment.",
        detaliu: "Submitted and approved individually, per week",
      },
      {
        titlu: "Sync from leave",
        text: "Approved leave becomes a leave day on the sheet, without anyone retyping anything.",
        detaliu: "Idempotent: ten runs have the effect of one",
      },
      {
        titlu: "Import and lock",
        text: "The period opens, is filled in, is approved per department, and locks. After locking, nothing can be written.",
        detaliu: "Three states: open, in approval, locked",
      },
    ],
    granita:
      "From here down I am no longer describing what we have. I am describing what I want to build, and I am telling you before you ask.",
    viitoareTitlu: "On the roadmap",
    viitoare: [
      {
        titlu: "Rotating QR code",
        text: "A code displayed at the work site that changes every few dozen seconds, so it cannot be photographed and forwarded.",
      },
      {
        titlu: "NFC tag or access card",
        text: "Clocking in by tapping a card against a reader or against the team leader's phone.",
      },
      {
        titlu: "Geolocation tied to the work site",
        text: "Clock-ins accepted only within range of the declared work site, with a configurable tolerance.",
      },
      {
        titlu: "Face recognition at a kiosk",
        text: "Verification at a fixed terminal. Face descriptors are biometric data: they require explicit consent, an impact assessment and encryption.",
      },
    ],
    notaViitoare:
      "None of these four exists today. The QR poster above carries a fixed code that an administrator changes; the code that changes on its own every few tens of seconds is the one listed here. If one of them would change your decision, tell us — we build in the order the companies using us ask for.",
    buton: { eticheta: "I need this", href: "/cere-demo" },
  },

  fluxuri: {
    supratitlu: "Three routes",
    titlu: "What a month looks like, end to end",
    lead: "Every step has a role that performs it. If the role lacks the right, the step does not happen — not from the interface, and not from anywhere else.",
    fluxuri: [
      {
        titlu: "From a day worked to the payslip",
        pasi: [
          { actor: "admin", text: "Opens the month" },
          { actor: "hr", text: "Fills in or imports the attendance sheet" },
          { actor: "manager", text: "Approves their own team's attendance" },
          { actor: "admin", text: "Locks the month" },
          { actor: "hr", text: "Runs payroll from the locked hours" },
          { actor: "employee", text: "Finds their payslip in the portal" },
        ],
      },
      {
        titlu: "From a leave request to the balance",
        pasi: [
          { actor: "employee", text: "Requests leave, with the days consumed shown up front" },
          { actor: "automatic", text: "Checks the balance and overlaps with other requests" },
          { actor: "manager", text: "Approves or rejects, with a reason" },
          {
            actor: "automatic",
            text: "Deducts from the balance and writes the days onto the sheet",
          },
        ],
      },
      {
        titlu: "From a new hire to a complete file",
        pasi: [
          { actor: "hr", text: "Walks the six-step enrolment wizard" },
          { actor: "automatic", text: "Generates the contract and job description from templates" },
          { actor: "automatic", text: "Opens the REVISAL event, with its deadline" },
          { actor: "hr", text: "Starts the onboarding checklist" },
          { actor: "employee", text: "Confirms the equipment they received" },
        ],
      },
    ],
  },

  roluri: {
    supratitlu: "Who sees what",
    titlu: "Rights are data, not code. And you can read them.",
    lead: "The table below is each role's read scope, exactly as it is seeded in the database. A test in continuous integration compares every cell against that source: if the database changes, the page fails before it can lie.",
    capResursa: "Resource",
    note: [
      "The employee has “—” on personnel files. They cannot see even their own file in the personnel module: their data lives in the portal, which is a different route with different rules.",
      "A manager approves their team's attendance but cannot create it. In practice the sheet is read-only for them.",
      "A manager has an EXPLICIT refusal on payroll, not a missing row. An administrator can grant the right for their own company, without a new release.",
      "HR fully administers health and safety, but has no right over compliance due dates: the list comes back empty, with no error at all. It is a real limit, and we would rather you learned it here.",
    ],
    notaPlatforma:
      "There is also a platform administrator role, ours, used for enrolment and support. It is not a member of your organisation, and everything it does leaves a trace in the same log you can read.",
  },

  izolare: {
    supratitlu: "The barrier",
    titlu: "How the barrier is built, layer by layer",
    lead: "Three of the layers below are convenience: they help people avoid locked doors. Only the fourth is a barrier — and it is the only one that answers the question “what happens if someone gets the code wrong?”.",
    straturi: [
      {
        nume: "The menu",
        rol: "convenience",
        text: "Hides what is not yours. A hidden button is not a security measure.",
        bariera: false,
      },
      {
        nume: "The page",
        rol: "convenience",
        text: "Checks the permission before rendering. But a page does not protect a server action: they are separate entry points.",
        bariera: false,
      },
      {
        nume: "The action",
        rol: "convenience",
        text: "Every write declares its module, permission and scope, and checks them again at execution time.",
        bariera: false,
      },
      {
        nume: "Postgres",
        rol: "barrier",
        text: "Row-level policies, forced even for the table owner. Company membership is recomputed on every request, from data, not from a cookie. A suspended company drops out of the list and access ends immediately.",
        bariera: true,
      },
    ],
    vinieta: {
      titlu: "Attendance — the same page, seen by a manager",
      politica: "attendance_select",
      contor: "{ascunse} of {total} rows are not shown",
      nota: "The missing rows are not hidden by the interface. The database never sent them. Same page, different person, different rows.",
      randuri: ["Popa I.", "Ilie M.", "Radu A.", "Marin D.", "Vlad C.", "Toma S."],
      ascunse: 4,
    },
    legaturaPagina: { eticheta: "How we keep data separate", href: "/incredere" },
  },

  conformitate: {
    supratitlu: "Romania, not “localisation”",
    titlu: "Local rules are in the product, not in a translation file",
    lead: "An international ERP translated into Romanian asks you to adapt. What follows is written for how a company here actually operates.",
    carduri: [
      {
        titlu: "Public holidays, computed",
        text: "Seventeen days: the fixed ones from the Labour Code and the movable ones derived from Orthodox Easter. The timesheet on the home page is fed by that very function.",
        temei: "Labour Code, art. 139",
      },
      {
        titlu: "CAEN Rev. 3, complete",
        text: "Six hundred and fifty-one activity classes, checked against the official list. Composition rules differ by legal form: a sole trader may hold at most four secondary codes, others more, and a start-up SRL-D has forbidden domains.",
        temei: "Law 31/1990, GEO 44/2008",
      },
      {
        titlu: "Tax ID with a control digit",
        text: "The company tax number is validated with the official weights, not merely by length. A typo is caught on entry, not at the first filing.",
        temei: "",
      },
      {
        titlu: "Per diem in 24-hour windows",
        text: "Windows run from the hour of departure, not from midnight, and a border-crossing day is paid once, to one country. The tax-free ceiling splits the amount rather than blocking it.",
        temei: "Structure of GD 518/1995, loaded as data",
      },
      {
        titlu: "Safety, with a legal basis on every deadline",
        text: "The frequency of briefings, occupational medicine, extinguisher checks and regulated-equipment authorisations — each with its statute noted beside it and the date it takes effect.",
        temei: "Law 319/2006, Law 307/2006, GD 1425/2006",
      },
      {
        titlu: "Personal data encrypted",
        text: "National ID numbers and bank accounts are written encrypted and read only through a path that leaves an audit row on every disclosure. The key can be rotated without re-encrypting the database.",
        temei: "AES-256-GCM",
      },
    ],
    retentieTitlu: "Data retention",
    retentie: [
      { ce: "Personnel file", regula: "Term configured per company, with automatic purging" },
      { ce: "Audit log", regula: "Appended to, never deleted; no delete policy exists" },
      { ce: "Walkthrough requests", regula: "Used only to contact you about that request" },
      { ce: "Sensitive data", regula: "Encrypted, with a trace on every read" },
      {
        ce: "When an employee leaves",
        regula: "Logical deletion, trace preserved; nothing disappears silently",
      },
    ],
    retentieNota:
      "The exact terms are agreed with you and your lawyer, and written as a policy for your company. We do not put figures here, because they are not ours to set.",
  },

  onestitate: {
    supratitlu: "What we don't do",
    titlu: "The list others only bring up at the third meeting",
    lead: "We would rather lose a customer at the start than disappoint one at implementation.",
    randuri: [
      {
        titlu: "Payroll is not certified software",
        text: "It is an internal calculation and record-keeping tool. It does not replace the official payroll register, the monthly tax return, or your accountant's sign-off. The application says so on every payroll screen.",
      },
      {
        titlu: "No integration with the tax authority or e-invoicing",
        text: "Zero lines of code. The data structure is ready for a future transmission, but the transmission does not exist.",
      },
      {
        titlu: "Data carrying a national ID does not reach REGES without a person",
        text: "Filing with REGES-ONLINE happens over the API, from the application, using the access your company obtains from the Labour Inspectorate portal. Messages are prepared from the employee record and wait in a queue until someone with the right to file sends them — nothing leaves in the background, unnoticed, and every read of a national ID number is logged. We do not generate a REVISAL file: REGES-ONLINE replaced it.",
      },
      {
        titlu: "The AI assistant shows you the way, it does not do the work",
        text: "It answers \u201cwhere do I do X?\u201d and takes you there. It files nothing, approves nothing, deletes nothing \u2014 you press. It gives no legal or tax advice. It can be wrong in an explanation, but it cannot send you to a screen you may not open. Your question goes to an external model provider (OpenRouter) to be answered; data from personnel records leaves only if you ask about it. The module can be switched off entirely, per company.",
      },
      {
        titlu: "The PDF is a rendering of the issued document, not a second document",
        text: "The document of record is the row in the database: it carries the number allocated on its series, the SHA-256 fingerprint and the verification code. The PDF is composed from it, on the server. A PDF built separately from the same data would be a second source of truth — two papers with the same number, whose agreement nobody guarantees.",
      },
      {
        titlu: "Tax rates must be confirmed by your accountant",
        text: "No rate, threshold or allowance is written into the code. All of them are configured for your company, with the date they take effect, and all are marked “to be verified” until someone accountable confirms them.",
      },
      {
        titlu: "There is no native mobile app in the app stores",
        text: "The employee portal runs in the browser, on a phone. That is all.",
      },
    ],
    incheiere:
      "If any of these is a blocker for you, say so in the first conversation. It is cheaper for both of us.",
  },

  verticale: {
    supratitlu: "Verticals",
    titlu: "What matters first, industry by industry",
    lead: "We do not sell four products. We sell the same product, switched on in the order that hurts most at your company.",
    domenii: [
      {
        titlu: "Construction and installations",
        text: "Crews across sites and work points, safety briefings and protective equipment that expire, and a labour inspection that arrives unannounced. The sector minimum wage is a configured rate, not an exception to be coded.",
        module: ["Health and safety", "Attendance", "Fleet", "Inventory", "Travel"],
      },
      {
        titlu: "Manufacturing",
        text: "Shifts and rotations, a night premium with its own interval, equipment servicing due by date and by counter, personal authorisations for regulated equipment.",
        module: ["Attendance", "Maintenance", "Health and safety", "Payroll", "Inventory"],
      },
      {
        titlu: "Transport and logistics",
        text: "Vehicle inspection, insurance and road tax with deadlines, trip sheets with verified odometer readings, foreign per diem by country with 24-hour windows and a tax-free ceiling.",
        module: ["Fleet", "Travel and per diem", "Attendance", "Maintenance"],
      },
      {
        titlu: "Services, offices and retail",
        text: "Flexible schedules, leave approved along the reporting line and seen on a team calendar, periodic reviews, internal announcements with read confirmation, and a portal where people find their own payslip.",
        module: ["Leave", "Attendance", "Reviews", "Announcements", "Employee portal"],
      },
    ],
    nota: "Your field is not listed? The modules are the same. Tell us what hurts and we will say honestly whether we help.",
  },

  comparatie: {
    supratitlu: "The difference",
    titlu: "How it is done today, and how it is done with us",
    lead: "These columns are not two products. They are the same month, kept in two ways.",
    capAzi: "Today",
    capNoi: "With Administrativo",
    perechi: [
      {
        azi: "Attendance is a file that circulates by e-mail",
        noi: "One sheet, with totals that reconcile and a month that locks",
      },
      {
        azi: "Leave requests live in a chat thread",
        noi: "Request, approval up the reporting line, balance recalculated automatically",
      },
      {
        azi: "The leave balance is reconstructed from memory",
        noi: "Annual entitlement computed from seniority, conditions and disability status",
      },
      {
        azi: "The accountant receives retyped hours",
        noi: "The locked month feeds payroll directly",
      },
      {
        azi: "Safety deadlines surface during an inspection",
        noi: "A traffic light that warns ahead of every deadline",
      },
      {
        azi: "Contracts are typed over a 2019 template",
        noi: "Generated from a template, numbered by series, with a checksum",
      },
      {
        azi: "Who changed this? Nobody knows any more",
        noi: "Who, when, from which address, what changed",
      },
      {
        azi: "Everyone sees the whole file",
        noi: "Each role has its own scope, enforced in the database",
      },
    ],
  },

  // Vezi nota din `ro.ts` pentru benzile noi ale paginii de start (6 oct 2026).
  // Legăturile duc spre pagini în română: modulele, uneltele și ghidurile există
  // doar acolo, iar eticheta o spune, ca cititorul să nu fie surprins.
  produs: {
    supratitlu: "What it does",
    titlu: "Five things you stop doing by hand",
    lead: "The screenshots come from the real application, on an invented company. What you see here you also see in a demo, moving.",
    randuri: [
      {
        captura: "telefon",
        descriereCaptura:
          "The employee portal on a phone, in Romanian: this month's pay, the clock-in button and a to-do list.",
        eticheta: "Time tracking · Labour Code art. 119",
        titlu: "Clocking in happens on the phone, with no app to install",
        text: "People open an address in the browser and tap “clock in” and “clock out”. The time recorded is the server's, not the phone's. You can put a QR poster, printed from the app, at every work site, and require a scan before clocking in.",
        puncte: [
          "The monthly attendance sheet fills itself from the clock-ins",
          "Overtime and night hours, counted separately",
          "The manager approves, then the month locks",
        ],
        legatura: { eticheta: "How clocking in works (in Romanian)", href: "/pontaj-pe-telefon" },
      },
      {
        captura: "leave",
        descriereCaptura: "A team's leave calendar for one month, in Administrativo.",
        eticheta: "Leave",
        titlu: "Leave requests are approved in one click, and the balance works itself out",
        text: "Employees request leave from their phone and see up front how many working days it uses. The manager approves or rejects with a reason, public holidays come off automatically, and approved days land on the attendance sheet without anyone copying them over.",
        puncte: [
          "Eleven leave types, each with its legal basis noted",
          "Annual entitlement, worked out from seniority and working conditions",
          "The team calendar: who is away, and when",
        ],
        legatura: { eticheta: "The leave module (in Romanian)", href: "/module/concedii" },
        demo: { eticheta: "Try the screen, no account", href: "/vitrina/leave" },
      },
      {
        captura: null,
        descriereCaptura: "",
        eticheta: "REGES-ONLINE · formerly Revisal",
        titlu: "Contracts go to REGES-ONLINE straight from the app",
        text: "Since 2026 the employee register is kept only in REGES-ONLINE, the Labour Inspectorate's system. Administrativo prepares the messages from each employee's file and sends them through the REGES API, with the legal deadline of every event counted in working days. The inspectorate's answer comes back to the person's file.",
        puncte: [
          "No import file carried around by hand",
          "Data with a personal ID number leaves only when a person with sending rights sends it",
          "A rejection by the inspectorate, explained in plain words",
        ],
        legatura: { eticheta: "REGES-ONLINE deadlines (in Romanian)", href: "/reges-online" },
        panou: {
          titlu: "Some REGES-ONLINE deadlines",
          randuri: [
            { ce: "New contract", termen: "at the latest the day before work starts" },
            { ce: "Contract termination", termen: "at the latest on the termination date" },
            { ce: "Transfer", termen: "5 working days" },
            { ce: "Salary change", termen: "20 working days" },
          ],
          sursa:
            "Government Decision 295/2025, art. 5. Every deadline, with the fines, is on the REGES-ONLINE page.",
        },
      },
      {
        captura: "payroll",
        descriereCaptura: "An approved payroll period with its documents, in Administrativo.",
        eticheta: "Payroll",
        titlu: "The closed month goes straight into payroll",
        text: "Hours locked on the attendance sheet reach the month's payroll without anyone retyping them. Every person sees their payslip in the portal, and the accountant receives the calculation, not a table of hours. Filings and responsibility stay with them.",
        puncte: [
          "A step-by-step breakdown of the calculation, for every person",
          "Bonuses and deductions defined once, used every month",
          "Your accountant confirms the tax rates before the first real run",
        ],
        legatura: { eticheta: "Payroll (in Romanian)", href: "/module/salarizare" },
      },
      {
        captura: "ssm",
        descriereCaptura:
          "The safety-training matrix by employee, with the status of each training, in Administrativo.",
        eticheta: "Deadlines · safety, medical checks, vehicles",
        titlu: "What expires shows up before the inspection, not during it",
        text: "Safety briefings, fitness-for-work certificates, protective equipment, vehicle inspections and insurance, fire extinguisher checks: all of them land in the same list of deadlines, with a warning before they expire.",
        puncte: [
          "“Never done” is a separate status from “expired”",
          "The individual training record, per Annex 11 to Government Decision 1425/2006",
          "Fleet: inspections, insurance, road vignette and trip logs",
        ],
        legatura: { eticheta: "Health and safety (in Romanian)", href: "/module/ssm" },
      },
    ],
    restTitlu: "All nineteen modules, each with its own page (in Romanian)",
    legaturaModule: { eticheta: "All modules on one page", href: "/module" },
    notaCaptura: "A screenshot of the real application. The company and its people are invented.",
    mareste: "tap to enlarge",
    inchide: "Close",
  },

  pentruCine: {
    supratitlu: "Who it is for",
    titlu: "One account for the whole company. Everyone sees only what concerns them.",
    lead: "Five roles, each with its own rights. A manager sees their team, an employee sees only what is theirs, and the rule lives in the database, not in a hidden menu.",
    roluri: [
      {
        cine: "The owner",
        text: "See at a glance who is at work, who is on leave and which deadlines expire this month. Approve requests in one click and know at any moment what an inspector would find.",
        legatura: { eticheta: "Your industry (in Romanian)", href: "/domenii" },
      },
      {
        cine: "The HR person",
        text: "Files, contracts, leave, training and REGES-ONLINE in one place. Employees come in from Excel once, and the contract and job description are generated from their data.",
        legatura: { eticheta: "What the law requires (in Romanian)", href: "/ghid" },
      },
      {
        cine: "The external accountant",
        text: "Every company you look after, in one account, with a menu to switch between them. You receive the closed month, not hours retyped into an e-mail.",
        legatura: { eticheta: "For accountants (in Romanian)", href: "/pentru-contabili" },
      },
      {
        cine: "The employee",
        text: "Clocks in, requests leave and checks their balance, payslip and documents from their phone, without having to ask anyone.",
        legatura: { eticheta: "The employee portal (in Romanian)", href: "/module/portal-angajat" },
      },
    ],
  },

  unelteGratuite: {
    supratitlu: "Free, no account",
    titlu: "Tools and templates you can use right now",
    lead: "The salary calculator and the templates inspectors ask for, ready to fill in and download — in Romanian, the language the paperwork is kept in. No account, and no e-mail address asked in return.",
    unelte: [
      {
        titlu: "Net and gross salary calculator",
        text: "Enter the gross and get the net, or the other way round, with the July 2026 figures: minimum wage, personal deduction, contributions, income tax and the total cost to the company.",
        formate: "Online",
        href: "/unelte/calculator-salariu",
      },
      {
        titlu: "Monthly timesheet",
        text: "Pick the month and type the names; weekends and public holidays are marked for you.",
        formate: "PDF · Word · Excel",
        href: "/unelte/foaie-de-pontaj",
      },
      {
        titlu: "Attendance register",
        text: "Every working day, with arrival time, departure time and signature.",
        formate: "PDF · Word · Excel",
        href: "/unelte/condica-de-prezenta",
      },
      {
        titlu: "Annual leave request",
        text: "With the working days counted, plus unpaid and family-event versions.",
        formate: "PDF · Word",
        href: "/unelte/cerere-concediu-de-odihna",
      },
      {
        titlu: "Vehicle trip log",
        text: "Vehicle, driver and month: the route, the purpose of each trip and the kilometres.",
        formate: "PDF · Word · Excel",
        href: "/unelte/foaie-de-parcurs",
      },
      {
        titlu: "Safety training record",
        text: "The individual record per Annex 11 to Government Decision 1425/2006, with the worker's details filled in.",
        formate: "PDF · Word",
        href: "/unelte/fisa-instruire-ssm",
      },
      {
        titlu: "Employee review form",
        text: "The company's own criteria, each with a weight and a score, plus the signatures.",
        formate: "PDF · Word · Excel",
        href: "/unelte/fisa-evaluare",
      },
    ],
    ghiduriTitlu: "Guides, with the article of law next to every statement (in Romanian)",
    ghiduri: [
      { eticheta: "Minimum wage", href: "/ghid/salariu-minim-pe-economie" },
      { eticheta: "Working-time records", href: "/evidenta-orelor-de-munca" },
      { eticheta: "REGES-ONLINE: deadlines and fines", href: "/reges-online" },
      { eticheta: "Overtime", href: "/ghid/ore-suplimentare" },
      { eticheta: "Night-work premium", href: "/ghid/spor-de-noapte" },
      { eticheta: "Annual leave", href: "/ghid/concediu-de-odihna" },
      { eticheta: "Per diem abroad, by country", href: "/ghid/diurna-externa" },
      { eticheta: "Per diem in Romania", href: "/ghid/diurna" },
      { eticheta: "Labour inspections", href: "/ghid/control-itm" },
    ],
    legaturaToate: { eticheta: "All free tools", href: "/unelte" },
  },

  promisiuni: {
    supratitlu: "We are just starting",
    titlu: "No recommendations yet. Promises instead.",
    lead: "We do not print testimonials we wrote ourselves, nor logos of companies that do not use us. Here, instead, is what we commit to with every company that starts now — each one can be checked from the first phone call.",
    puncte: [
      {
        titlu: "You talk to the people who build it",
        text: "No call centre answers the phone. What you ask for goes straight to the people building the application.",
      },
      {
        titlu: "Your data stays yours",
        text: "If you leave, we export everything we hold about your company in an open format. We do not hold data as a bargaining chip.",
      },
      {
        titlu: "You learn the limits before, not after",
        text: "What the application does not do is written on the site, on the “What we don't do” page — not discovered after signing.",
      },
      {
        titlu: "We build in the order you ask",
        text: "New features come in the order the companies working with us request them. If something is missing for you, tell us in the first conversation.",
      },
    ],
  },

  preturi: {
    supratitlu: "Pricing",
    titlu: "149 RON a month, up to 20 employees",
    lead: "A core that always comes along and modules you switch on separately. The first month is free, setup is not billed, and the amounts below are final — no VAT is added.",
    planuri: [
      {
        cheie: "nucleu",
        nume: "HR core",
        pentru: "The starting point: attendance, leave, personnel files and the employee portal",
      },
      {
        cheie: "hr_extins",
        nume: "Extended HR",
        pentru: "On top of the core: REGES-ONLINE, onboarding, courses, safety and reviews",
      },
      {
        cheie: "operational",
        nume: "Operations",
        pentru: "On top of the core: fleet, maintenance, inventory, announcements and tickets",
      },
      {
        cheie: "financiar",
        nume: "Finance",
        pentru: "On top of the core: payroll, per diem and travel",
      },
      {
        cheie: "tot",
        nume: "The whole application",
        pentru:
          "Everything that exists today, plus the assistant. New modules are included automatically.",
      },
    ],
    capModul: "Module",
    inLocDe: "instead of",
    pesteNucleu: "Everything in the HR core, plus:",
    mentiuneTva: "Final price. We are not registered for VAT, so nothing is added on top.",
    pestePrag: {
      text: "Above 20 employees the price rises in steps.",
      legatura: { eticheta: "Ask for a quote for your headcount", href: "/cere-demo" },
    },
    primaLuna:
      "The first month is free, for any configuration. No setup fee and no separately billed implementation.",
    nota: "The three middle packages are parallel axes over the same core, not rungs: you switch on only the axis you need. The struck-through figure is what the same modules would cost bought one by one.",
    legaturaPagina: { eticheta: "See the price of each module", href: "/preturi" },
  },

  siguranta: {
    supratitlu: "Your people's data",
    titlu: "ID numbers, salaries, sick leave. We treat them accordingly.",
    lead: "An HR system holds a company's most sensitive data. In short, here is how we keep it — the long version, with the whole mechanism, is on the data isolation page.",
    puncte: [
      {
        titlu: "Separated by company, in the database",
        text: "Not by a filter in the application: the database returns nothing from another company, not even to a query we got wrong.",
      },
      {
        titlu: "ID numbers and IBANs encrypted",
        text: "Written encrypted and read only through a path that leaves a trace: who saw them, and when.",
      },
      {
        titlu: "Every change, with a name and a time",
        text: "Who changed what, and when. The log is appended to, never rewritten — not even by us.",
      },
      {
        titlu: "In the European Union",
        text: "The database and files are in Ireland, and the application server is in Germany.",
      },
    ],
    legatura: { eticheta: "How we keep data separate (in Romanian)", href: "/incredere" },
  },

  incepe: {
    supratitlu: "How to start",
    titlu: "The first timesheet, the same day",
    lead: "Nothing to install and nothing to migrate. You create the account, upload the employee list from an Excel file and record the current month.",
    pasi: [
      {
        titlu: "Create your account",
        text: "A few minutes, no card and no setup fee. The first month is free.",
      },
      {
        titlu: "Bring your people in from Excel",
        text: "Columns are matched by their headers. Good rows go in; bad ones come back to you with the reason.",
      },
      {
        titlu: "Invite your team",
        text: "By e-mail, each with their role. They clock in from their phone's browser, with nothing to install.",
      },
      {
        titlu: "We close the first month together",
        text: "The first attendance sheet and the first payroll run, walked through with you on the phone. After that you do it yourself.",
      },
    ],
    alternativa: {
      text: "Would you rather see it first? A half-hour conversation about the modules you care about — not a sales pitch.",
      legatura: { eticheta: "Book a demo", href: "/cere-demo" },
    },
  },
  intrebari: {
    supratitlu: "Frequently asked",
    titlu: "The answers, in short",
    lead: "If your question is not here, call. We answer the awkward ones too.",
    intrebari: [
      {
        q: "What do I do with the spreadsheet I have now?",
        a: "You upload it. You choose which of your columns means which of our fields, and validation runs row by row: the good ones go in, the broken ones come back in a file with the reason for each rejection. Nothing imports halfway and nothing is lost silently.",
      },
      {
        q: "Can our data reach another company on the platform?",
        a: "No, and the mechanism is not an application filter. Every query passes through row-level policies in Postgres, forced even for the table owner. Your membership is recomputed on each request from real data, not from a cookie. The check runs automatically on every code release.",
      },
      {
        q: "My accountant sees everyone's salary. Can a manager?",
        a: "No. Managers carry an explicit refusal on payroll — not a missing right, a written refusal. If you want to grant it, that is one line of configuration for your company, with no new code release. The table showing who sees what is on the modules page.",
      },
      {
        q: "What happens when an employee leaves?",
        a: "Nothing is physically deleted. The file closes, the trace remains, and the data is purged at the term set in your company's retention policy. There is no delete policy anywhere in the database.",
      },
      {
        q: "Does it replace the accountant?",
        a: "No, and you should not want it to. We calculate and keep records; the filings and the liability stay with your accountant. They confirm the rates, and the application marks that explicitly until they do.",
      },
      {
        q: "Does it work on a phone?",
        a: "Yes, in the browser. The employee portal is built for a small screen: leave balance, requests, attendance, payslip, documents. There is no app in the app stores.",
      },
      {
        q: "What do I show during a labour inspection?",
        a: "Briefing records with dates and signatures, occupational medicine records, protective equipment with its duration, the month's attendance sheet, and the log showing who changed what. All from one place, with deadlines visible before they expire.",
      },
      {
        q: "Who on your side can see our data?",
        a: "A platform administrator role, used for enrolment and support. It is not a member of your company, and everything it does leaves a trace in the same log you can read. National ID numbers and bank accounts are encrypted, and every disclosure writes an audit row.",
      },
      {
        q: "Can we change a role's rights?",
        a: "Yes. The permission matrix is data, not code: your company's row overrides the global rule, including when you want to forbid something that is allowed by default. It does not require a new version of the application.",
      },
      {
        q: "How long until we are actually working in it?",
        a: "It depends on how many people you have and how many modules we switch on. The long part is not configuration, it is cleaning the data you bring. We give an estimate after we look at your files, not before.",
      },
      {
        q: "What happens to our data if we leave?",
        a: "You take it. We export what we hold about you in an open format, and what remains with us is purged at the agreed term. We do not hold data as a negotiating position.",
      },
      {
        q: "How much does it cost?",
        a: "The core — attendance, leave, personnel files and the employee portal — is 149 RON a month for up to 20 employees, and the first month is free. Each extra module has its own price, listed on the pricing page, and every amount is final: no VAT is added. Above 20 employees the price rises in steps — ask for a quote and we will give you the figure for your headcount.",
      },
    ],
  },

  intrebariScurte: {
    supratitlu: "Questions",
    titlu: "What people ask before the first click",
    intrebari: [
      {
        q: "How much does it cost?",
        a: "The core — attendance, leave, personnel files and the employee portal — costs 149 lei a month for the whole company, up to 20 employees. Extra modules each have their own price. The first month is free, and the amounts are final: no VAT is added.",
        legatura: { eticheta: "The price of every module", href: "/en/preturi" },
      },
      {
        q: "Do I need to install anything?",
        a: "No. Administrativo works in the browser, on a computer and on a phone. Employees add the address to their phone's home screen and open it like an app, with no app store and no updates to install.",
      },
      {
        q: "What do I show at a labour inspection?",
        a: "Working-time records with the start and end time of every day, as article 119 of the Labour Code requires, safety training records, occupational medicine records and the change log — pulled from the app, not hunted for in binders.",
        legatura: {
          eticheta: "What the inspector checks (in Romanian)",
          href: "/ghid/control-itm",
        },
      },
      {
        q: "Does it work with my accountant?",
        a: "Yes. Your accountant gets access to your company's account with their own role, and if they look after several companies, they see all of them from a single account. Filings and responsibility stay with them.",
        legatura: { eticheta: "The page for accountants (in Romanian)", href: "/pentru-contabili" },
      },
      {
        q: "What do I do with my current spreadsheet?",
        a: "You upload it. Columns are matched by their headers however they are written, good rows go in, and the bad ones come back to you in a file, each with its reason. Nothing is imported halfway.",
      },
      {
        q: "What doesn't Administrativo do?",
        a: "It does not file returns with ANAF, the tax authority, does not issue e-invoices and does not keep the books. It is not in the app stores either: the employee portal runs in the browser. The full list is written out in the open.",
        legatura: { eticheta: "What we don't do, in full (in Romanian)", href: "/de-ce-nu" },
      },
    ],
    legatura: {
      eticheta: "All questions, with the long answers (in Romanian)",
      href: "/intrebari",
    },
  },
  contact: {
    supratitlu: "Let's talk",
    titlu: "Tell us how you work now",
    lead: "A half-hour conversation, not a sales pitch. We show you exactly the modules you care about and we tell you plainly what is not ready.",
    telefonEticheta: "Phone",
    emailEticheta: "E-mail",
    programEticheta: "Hours",
    program: "Monday–Friday, 9–18 (Romania)",
    notaReferinte:
      "The first customers are in implementation. If you would like to speak to one of them before deciding, we will put you in touch.",
    cine: "Administrativo is made in {oras} by {firma}. The phone is answered by someone from the team that builds the application.",
    formularTitlu: "Or leave us your details",
  },

  subsol: {
    descriere:
      "Administrativo — attendance, leave, payroll, health and safety, fleet and inventory for companies in Romania. Every company has its own data space, its own roles, and only the modules it needs.",
    coloane: [
      {
        titlu: "Product",
        legaturi: [
          { eticheta: "What it does", href: "/en/#produs" },
          { eticheta: "Free tools", href: "/en/#unelte" },
          { eticheta: "Pricing", href: "/en/preturi" },
          { eticheta: "Data security", href: "/en/#siguranta" },
          { eticheta: "How to start", href: "/en/#incepe" },
        ],
      },
      {
        titlu: "In Romanian",
        legaturi: [
          { eticheta: "All modules", href: "/module" },
          { eticheta: "Clocking in by phone", href: "/pontaj-pe-telefon" },
          { eticheta: "For accountants", href: "/pentru-contabili" },
          // Paginile de lege rămân doar în română, și e corect așa: sunt despre
          // obligații din dreptul muncii românesc, iar o traducere le-ar face
          // citabile în locul textului oficial, care e tot în română.
          { eticheta: "Working-time records", href: "/evidenta-orelor-de-munca" },
          { eticheta: "REGES-ONLINE deadlines", href: "/reges-online" },
          { eticheta: "All guides", href: "/ghid" },
          { eticheta: "What we don't do", href: "/de-ce-nu" },
          { eticheta: "Frequently asked", href: "/intrebari" },
        ],
      },
      {
        titlu: "Legal",
        legaturi: [
          { eticheta: "Terms of service", href: "/legal/termeni" },
          { eticheta: "Privacy policy", href: "/legal/confidentialitate" },
        ],
      },
    ],
    contactTitlu: "Contact",
    copyright: "All rights reserved.",
    notaDiacritice:
      "We write Romanian ș and ț with a comma below, not a cedilla. It is the correct form, and it is checked automatically on every release.",
    creditVideo:
      "Homepage video: “Office Stock Footage” from the Free Stock Footage 4K YouTube channel, Creative Commons Attribution licence.",
  },

  // Vezi nota din `ro.ts`: antetele paginilor secundare, scrise pentru cineva
  // care aterizează direct pe ele.
  pagini: {
    module: {
      supratitlu: "What is inside",
      titlu: "Nineteen modules, switched on one at a time",
      lead: "Four modules come with the core, and fifteen turn on and off separately. You pay for what you switched on; what you do not use appears neither in the menu nor on the invoice.",
    },
    incredere: {
      supratitlu: "Where the barrier sits",
      titlu: "One company's data never reaches another. The rule lives in Postgres.",
      lead: "Not in the menu, not in an application filter. Below: where the barrier actually sits, what happens when a write breaks it, and how long we keep each kind of data.",
    },
    deCeNu: {
      supratitlu: "Before you ask",
      titlu: "What we do not do, written before the third meeting",
      lead: "The limits other vendors mention after you have signed. They are here because it is cheaper for both of us that you find out now, alongside an honest comparison with how you work today.",
    },
    intrebari: {
      supratitlu: "Questions",
      titlu: "What people ask before they sign",
      lead: "The answers we give on the phone anyway, written down once. If your question is not here, call — the number is in the footer and a person answers.",
    },
    domenii: {
      supratitlu: "By industry",
      titlu: "The same modules, a different order of importance",
      lead: "We do not sell different versions per industry. Only what you switch on first and what lands on the first screen changes, and below is exactly what that means for four kinds of company.",
    },
    pentruContabili: {
      supratitlu: "For accountants",
      titlu: "One account, every company you keep",
      lead: "An accountant is not one more user of one company, but the same person in ten companies at once. The application is built on memberships, not on separate accounts: you sign in once and switch between clients from a menu.",
    },
    pontajTelefon: {
      supratitlu: "Clocking in by phone",
      titlu: "Clocking in from the browser, with nothing to install",
      lead: "The person on site opens an address, adds it to the home screen and clocks in. No App Store or Google Play account, no updates to install, no phone that has run out of space.",
    },
    ghid: {
      supratitlu: "Guides",
      titlu: "What the law requires, with the article next to every claim",
      lead: "Working-time records, REGES-ONLINE, annual leave, per-diem allowances and labour inspections, written for whoever answers for them in a small company. Each page also says what cannot be stated with certainty.",
    },
    unelte: {
      supratitlu: "Tools",
      titlu: "Free tools, no account",
      lead: "Things you can use on the spot: no account, no email address handed over, no trial that expires.",
    },
    comparatie: {
      supratitlu: "Comparisons",
      titlu: "When switching is worth it, and when it is not",
      lead: "Comparisons with the way work gets done today, including the cases where the right answer is to keep what you have.",
    },
  },
};
