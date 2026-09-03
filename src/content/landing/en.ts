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
      "Daily working-time records as required by Romanian law, leave, personnel files and REGES-ONLINE reporting in one account. Built for companies with 5–50 employees.",
  },

  antet: {
    navigare: [
      { eticheta: "First steps", href: "/en/#pornire" },
      { eticheta: "Pricing", href: "/en/preturi" },
      { eticheta: "Security", href: "/en/#incredere" },
      { eticheta: "Contact", href: "/en/#contact" },
    ],
    autentificare: "Sign in",
    demo: "Book a walkthrough",
    meniu: "Menu",
    sariLaContinut: "Skip to main content",
  },

  hero: {
    // Vezi nota din `ro.ts`: titlul numește ce se rezolvă, supratitlul califică
    // dimensiunea firmei, iar a doua acțiune duce la preț, nu la limite.
    supratitlu: "For companies with 5–50 employees",
    titlu: "Attendance, leave and personnel files in one account",
    lead: "Daily working-time records, exactly as the Romanian Labour Code requires. Leave, every person's file and REGES-ONLINE reporting in the same place. No spreadsheets, no chat threads.",
    ctaPrimar: { eticheta: "Book a walkthrough", href: "/cere-demo" },
    ctaSecundar: { eticheta: "See pricing", href: "/en/#preturi" },
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
        nota: "The core, up to 20 employees. Final price — no VAT is added.",
      },
      {
        valoare: "0",
        eticheta: "RON to start",
        nota: "No implementation fee and no separately billed training.",
      },
      {
        valoare: "17",
        eticheta: "modules",
        nota: "You switch on only what you use. The rest appears neither in the menu nor on the invoice.",
      },
    ],
  },

  realitatea: {
    supratitlu: "Monday morning",
    titlu: "You are not missing procedures. You are missing the place they live in.",
    lead: "Companies of twenty to two hundred people already have rules. The trouble is that the rules live in three files, two phones and one person's head.",
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
    titlu: "Seventeen modules. You switch on only what you use.",
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
            text: "The request travels the approval chain, the balance recalculates itself, and half days at either end are counted correctly.",
            puncte: [
              "Eleven leave types, each with its legal basis noted",
              "Annual entitlement by seniority, working conditions, disability or age",
              "Team calendar, with a cap on simultaneous absences",
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
            puncte: ["Handover with a date", "Batch import from Excel"],
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
            puncte: ["In-app and e-mail notification"],
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
    titlu: "Four ways that work today. Four we do not have yet.",
    lead: "We draw them differently so you cannot confuse them. What is solid exists and can be shown in a walkthrough. What is hatched does not exist — not even as a column in the database.",
    livrateTitlu: "Works today",
    livrate: [
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
      "None of these four exists today, in any form. If one of them would change your decision, tell us — we build in the order the companies using us ask for.",
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
          { actor: "org_admin", text: "Opens the month" },
          { actor: "hr", text: "Fills in or imports the attendance sheet" },
          { actor: "manager", text: "Approves their own team's attendance" },
          { actor: "org_admin", text: "Locks the month" },
          { actor: "hr", text: "Runs payroll from the locked hours" },
          { actor: "employee", text: "Finds their payslip in the portal" },
        ],
      },
      {
        titlu: "From a leave request to the balance",
        pasi: [
          { actor: "employee", text: "Requests leave, with the days consumed shown up front" },
          { actor: "system", text: "Checks the balance, overlaps and the team cap" },
          { actor: "manager", text: "Approves or rejects, with a reason" },
          { actor: "system", text: "Deducts from the balance and writes the days onto the sheet" },
        ],
      },
      {
        titlu: "From a new hire to a complete file",
        pasi: [
          { actor: "hr", text: "Walks the six-step enrolment wizard" },
          { actor: "system", text: "Generates the contract and job description from templates" },
          { actor: "system", text: "Opens the REVISAL event, with its deadline" },
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
    titlu: "One company's data never reaches another. The rule lives in Postgres.",
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
        text: "Seventeen days: the fixed ones from the Labour Code and the movable ones derived from Orthodox Easter. The sheet at the top of this page is fed by that very function.",
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
        titlu: "We do not generate the official REVISAL file",
        text: "We keep the register of employment events and their deadlines, and we export the complete data. The official application's format is validated with the labour inspectorate, not assumed.",
      },
      {
        titlu: "The AI assistant shows you the way, it does not do the work",
        text: "It answers \u201cwhere do I do X?\u201d and takes you there. It files nothing, approves nothing, deletes nothing \u2014 you press. It gives no legal or tax advice. It can be wrong in an explanation, but it cannot send you to a screen you may not open. Your question goes to an external model provider (OpenRouter) to be answered; data from personnel records leaves only if you ask about it. The module can be switched off entirely, per company.",
      },
      {
        titlu: "Documents are saved as PDF from the browser",
        text: "We generate printable HTML with series numbering and a checksum. There is no PDF library in the stack, and we have not claimed there is.",
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
    titlu: "The same modules, in a different order of urgency",
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
        text: "Flexible schedules, leave with a cap on simultaneous absences, periodic reviews, internal announcements with read confirmation, and a portal where people find their own payslip.",
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

  pornire: {
    supratitlu: "First steps",
    titlu: "The first timesheet, the same day",
    lead: "Nothing gets installed on your computers and nothing has to be migrated. You create the account, upload the employee list from a file, and record the current month.",
    blocuri: [
      {
        titlu: "Clocking in, from the worker's phone",
        text: "You open an address in the browser and add it to the home screen. No app store, no updates to install, no phone that has run out of space.",
        legatura: { eticheta: "How clocking in works", href: "/pontaj-pe-telefon" },
      },
      {
        titlu: "Leave and due dates",
        text: "A request is approved once and becomes a leave day on the sheet. Safety briefings, vehicle inspections and occupational medicine visits land in the same list of deadlines, with a warning before expiry.",
        legatura: { eticheta: "See the modules", href: "/module" },
      },
      {
        titlu: "Who sees what",
        text: "Five roles, each with its own scope. A manager sees the team, an employee sees only their own file, and the rule is not in the menu — it is in the database.",
        legatura: { eticheta: "How we keep data separate", href: "/incredere" },
      },
    ],
    nota: "The same subscription also carries modules for REGES-ONLINE reporting, payroll, occupational safety, fleet, inventory, per diem, courses and onboarding.",
    legaturaModule: { eticheta: "The full module list", href: "/module" },
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
    pestePrag:
      "Above 20 employees the price rises in steps — ask for a quote and we will give you the figure for your headcount.",
    primaLuna:
      "The first month is free, for any configuration. No setup fee and no separately billed implementation.",
    nota: "The three middle packages are parallel axes over the same core, not rungs: you switch on only the axis you need. The struck-through figure is what the same modules would cost bought one by one.",
    legaturaPagina: { eticheta: "See the price of each module", href: "/preturi" },
  },

  implementare: {
    supratitlu: "How we start",
    titlu: "Five steps, in this order",
    lead: "It is the only real sequence on this page, which is why it is the only place we number anything.",
    pasi: [
      {
        actor: "you",
        titlu: "A half-hour conversation",
        text: "You tell us how you work now. We tell you what helps and what does not. No card, no account created for you.",
      },
      {
        actor: "us",
        titlu: "We configure your company",
        text: "Company details, activity codes, work sites, departments and positions. We switch on exactly the modules we discussed.",
      },
      {
        actor: "us",
        titlu: "We bring your people in",
        text: "From Excel, with column mapping and a report for the rows that fail validation. Nothing enters halfway.",
      },
      {
        actor: "you",
        titlu: "You invite your colleagues",
        text: "By e-mail, each with their role. They land directly in the modules that concern them and see nothing else.",
      },
      {
        actor: "both",
        titlu: "We close the first month together",
        text: "We walk the first attendance sheet and the first payroll run with you, step by step. After that you do it yourself.",
      },
    ],
  },

  intrebari: {
    supratitlu: "Frequently asked",
    titlu: "What people ask before they sign",
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
        a: "No. Managers carry an explicit refusal on payroll — not a missing right, a written refusal. If you want to grant it, that is one line of configuration for your company, with no new code release. The table showing who sees what is further up this page.",
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
        q: "Why is there no price on the site?",
        a: "Because it would be a false price. The distance between a ten-person company running attendance and a hundred-person one with a fleet, safety and payroll is too wide for a public grid to be honest. Ask for a quote and you get a figure we can stand behind.",
      },
    ],
  },

  clienti: {
    supratitlu: "Customers",
    titlu: "Their recommendations will go here",
    text: "We do not print testimonials we wrote ourselves, and we do not print logos of companies that do not use us. The first customers are in implementation; if you would like to speak to one of them before deciding, we will put you in touch by phone.",
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
    formularTitlu: "Or leave us your details",
  },

  subsol: {
    descriere:
      "Administrativo — attendance, leave, payroll, health and safety, fleet and inventory for companies in Romania. Every company has its own data space, its own roles, and only the modules it needs.",
    coloane: [
      {
        titlu: "Product",
        legaturi: [
          { eticheta: "First steps", href: "/en/#pornire" },
          { eticheta: "Pricing", href: "/en/preturi" },
          { eticheta: "Data isolation", href: "/en/#incredere" },
          { eticheta: "How we start", href: "/en/#implementare" },
        ],
      },
      {
        titlu: "In Romanian",
        legaturi: [
          { eticheta: "All modules", href: "/module" },
          { eticheta: "Clocking in by phone", href: "/pontaj-pe-telefon" },
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
  },

  // Vezi nota din `ro.ts`: antetele paginilor secundare, scrise pentru cineva
  // care aterizează direct pe ele.
  pagini: {
    module: {
      supratitlu: "What is inside",
      titlu: "Seventeen modules, switched on one at a time",
      lead: "A core that always comes along and sixteen modules that turn on and off separately. You pay for what you switched on; what you do not use appears neither in the menu nor on the invoice.",
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
    pontajTelefon: {
      supratitlu: "Clocking in by phone",
      titlu: "Clocking in from the browser, with nothing to install",
      lead: "The person on site opens an address, adds it to the home screen and clocks in. No App Store or Google Play account, no updates to install, no phone that has run out of space.",
    },
  },
};
