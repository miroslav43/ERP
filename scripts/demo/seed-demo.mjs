#!/usr/bin/env node
/**
 * Conturi și date de demonstrație.
 *
 * De ce prin API-ul de administrare și nu prin SQL: un `insert into auth.users`
 * produce un rând care ARATĂ ca un utilizator, dar cu care nu te poți autentifica
 * — GoTrue cere și un rând în `auth.identities`, plus o parolă cifrată în formatul
 * lui. Fixture-ul din `tests/rls/izolare.sql` inserează direct fiindcă acolo
 * autentificarea nu contează: testul își pune singur `request.jwt.claim.sub`.
 * Aici contează, deci trecem prin `auth.admin.createUser`.
 *
 * Restul datelor merge prin PostgREST cu cheia `service_role`, care ocolește RLS
 * exact ca un seed rulat de proprietarul bazei. Nu e nevoie de parola bazei.
 *
 * Scriptul este IDEMPOTENT: rulat de două ori nu duplică nimic și nu resetează
 * parolele deja schimbate. `--reset` șterge întâi tot ce a creat.
 *
 *   node scripts/demo/seed-demo.mjs
 *   node scripts/demo/seed-demo.mjs --reset
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ── mediu ───────────────────────────────────────────────────────────────────

function citesteEnvLocal() {
  let brut;
  try {
    brut = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
  } catch {
    throw new Error("Lipsește .env.local. Copiază .env.example și completează-l.");
  }
  const env = {};
  for (const linie of brut.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(linie);
    if (!m) continue;
    // Ultima definiție câștigă, ca în shell. Fișierul chiar are chei repetate.
    env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = citesteEnvLocal();
const URL_SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL;
const CHEIE_SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_SUPABASE || !CHEIE_SERVICE) {
  throw new Error("Lipsesc NEXT_PUBLIC_SUPABASE_URL sau SUPABASE_SERVICE_ROLE_KEY din .env.local.");
}

/*
 * `supabase-js` construiește un client de realtime în CONSTRUCTOR, iar acela
 * cere un `WebSocket` global. Node 20 nu-l are (a apărut în 22) și `ws` nu e
 * instalat, deci `createClient` arunca înainte de prima interogare — scriptul
 * nu mai pornea deloc. Nu se vedea la review și nu se vede la `pnpm verify`:
 * scripturile de seed nu sunt nici tipate, nici testate, nici rulate în CI.
 *
 * Ciotul e suficient fiindcă seed-ul nu deschide niciun canal; realtime-ul se
 * conectează abia la `.channel()`. Dacă totuși cineva îl cheamă vreodată,
 * constructorul aruncă explicit, în loc să eșueze tăcut.
 */
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class {
    constructor() {
      throw new Error("Seed-ul nu folosește realtime — nu deschide canale.");
    }
  };
}

const db = createClient(URL_SUPABASE, CHEIE_SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RESET = process.argv.includes("--reset");

// ── ce anume se creează ─────────────────────────────────────────────────────

const PAROLA = "12345678";

const ORG_DEMO = {
  slug: "demo",
  name: "Administrativo Demo SRL",
  legal_name: "ADMINISTRATIVO DEMO S.R.L.",
  cui: "RO40123456",
  judet: "Cluj",
  oras: "Cluj-Napoca",
  status: "active",
};

const ORG_BETA = {
  slug: "beta-demo",
  name: "Beta Demo SRL",
  legal_name: "BETA DEMO S.R.L.",
  cui: "RO40987654",
  judet: "Timiș",
  oras: "Timișoara",
  status: "active",
};

/**
 * `demo_admin` primește DOUĂ calități: administrator de platformă (ca să vadă
 * panoul Super-Admin) și `org_admin` în ambele organizații (ca să poată comuta
 * între ele din bara de sus). Celelalte patru conturi rămân „pure", cu un singur
 * rol, ca diferența dintre roluri să fie vizibilă comparându-le.
 */
const CONTURI = [
  {
    email: "demo_admin@gmail.com",
    nume: "Mihai Demo (administrator platformă)",
    platforma: true,
    membru: [
      { org: "demo", rol: "org_admin" },
      { org: "beta-demo", rol: "org_admin" },
    ],
  },
  {
    email: "demo_orgadmin@gmail.com",
    nume: "Ana Ionescu",
    platforma: false,
    membru: [{ org: "demo", rol: "org_admin" }],
    angajat: {
      marca: "DEMO-001",
      first_name: "Ana",
      last_name: "Ionescu",
      dep: "ADM",
      post: "DIR",
    },
  },
  {
    email: "demo_hr@gmail.com",
    nume: "Elena Marin",
    platforma: false,
    membru: [{ org: "demo", rol: "hr" }],
    angajat: {
      marca: "DEMO-002",
      first_name: "Elena",
      last_name: "Marin",
      dep: "ADM",
      post: "HR",
      seful: "DEMO-001",
    },
  },
  {
    email: "demo_manager@gmail.com",
    nume: "Radu Pop",
    platforma: false,
    membru: [{ org: "demo", rol: "manager" }],
    angajat: {
      marca: "DEMO-003",
      first_name: "Radu",
      last_name: "Pop",
      dep: "PROD",
      post: "SEF",
      seful: "DEMO-001",
    },
  },
  {
    email: "demo_employee@gmail.com",
    nume: "Ioana Georgescu",
    platforma: false,
    membru: [{ org: "demo", rol: "employee" }],
    angajat: {
      marca: "DEMO-004",
      first_name: "Ioana",
      last_name: "Georgescu",
      dep: "PROD",
      post: "OPR",
      seful: "DEMO-003",
    },
  },
];

const DEPARTAMENTE = [
  { cod: "ADM", denumire: "Administrativ" },
  { cod: "PROD", denumire: "Producție" },
  { cod: "VNZ", denumire: "Vânzări" },
  { cod: "ING", denumire: "Inginerie" },
];

const POSTURI = [
  { cod: "DIR", denumire: "Director general" },
  { cod: "HR", denumire: "Specialist resurse umane" },
  { cod: "SEF", denumire: "Șef de echipă" },
  { cod: "OPR", denumire: "Operator producție" },
  { cod: "AGV", denumire: "Agent de vânzări" },
];

/** Cifre ilustrative pentru contractele demo — NU cote sau salarii reale. */
const SALARIU_DUPA_POST = { DIR: 12000, HR: 6500, SEF: 5500, OPR: 4200, AGV: 4600 };

/** Colegi fără cont de autentificare, ca listele să nu arate a bază goală. */
const COLEGI = [
  {
    marca: "DEMO-005",
    first_name: "Andrei",
    last_name: "Dumitrescu",
    dep: "PROD",
    post: "OPR",
    seful: "DEMO-003",
  },
  {
    marca: "DEMO-006",
    first_name: "Cristina",
    last_name: "Stan",
    dep: "PROD",
    post: "OPR",
    seful: "DEMO-003",
  },
  {
    marca: "DEMO-007",
    first_name: "Vlad",
    last_name: "Nistor",
    dep: "VNZ",
    post: "AGV",
    seful: "DEMO-001",
  },
  {
    marca: "DEMO-008",
    first_name: "Alexandra",
    last_name: "Barbu",
    dep: "VNZ",
    post: "AGV",
    seful: "DEMO-001",
  },
];

/**
 * Module activate pe organizația demo — toate cele care au ecrane reale.
 * `announcements` rămâne afară: e Faza 11, fără nicio pagină încă, iar o
 * intrare de meniu care duce la 404 e un demo prost. Beta nu are niciun modul
 * opțional, ca diferența să se vadă vizibil la comutare.
 */
const MODULE_DEMO = [
  "attendance",
  "leave",
  "onboarding",
  "payroll",
  "per_diem",
  "fleet",
  "maintenance",
  "inventory",
  "ssm",
  "employee_portal",
  "announcements",
];

// ── utilitare ───────────────────────────────────────────────────────────────

function verifica(eticheta, { error }) {
  if (error) {
    throw new Error(`${eticheta}: ${error.message ?? JSON.stringify(error)}`);
  }
}

async function toticUtilizatorii() {
  const gasiti = new Map();
  for (let pagina = 1; ; pagina += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) gasiti.set(u.email?.toLowerCase(), u);
    if (data.users.length < 200) break;
  }
  return gasiti;
}

async function asiguraUtilizator(existenti, cont) {
  const gasit = existenti.get(cont.email.toLowerCase());
  if (gasit) {
    console.log(`  = ${cont.email} (există deja)`);
    return gasit.id;
  }
  const { data, error } = await db.auth.admin.createUser({
    email: cont.email,
    password: PAROLA,
    email_confirm: true,
    user_metadata: { full_name: cont.nume },
  });
  if (error) throw new Error(`createUser ${cont.email}: ${error.message}`);
  console.log(`  + ${cont.email}`);
  return data.user.id;
}

/**
 * Inserează sau actualizează un rând, căutându-l întâi.
 *
 * NU folosim `upsert`: toate cheile unice din proiect sunt indexuri PARȚIALE
 * (`where deleted_at is null`), iar unele sunt pe expresii (`lower(cod)`).
 * PostgREST nu poate ținti un index parțial prin `onConflict` și răspunde
 * „there is no unique or exclusion constraint matching the ON CONFLICT
 * specification" — un mesaj care sugerează că lipsește constrângerea, când de
 * fapt ea există și doar nu poate fi numită așa.
 */
async function asigura(tabela, cheie, rand) {
  let q = db.from(tabela).select("id");
  for (const [c, v] of Object.entries(cheie)) q = q.eq(c, v);
  const { data: gasit, error: eroareCautare } = await q.maybeSingle();
  verifica(`select ${tabela}`, { error: eroareCautare });

  if (gasit) {
    const { error } = await db.from(tabela).update(rand).eq("id", gasit.id);
    verifica(`update ${tabela}`, { error });
    return gasit.id;
  }
  const { data, error } = await db
    .from(tabela)
    .insert({ ...cheie, ...rand })
    .select("id")
    .single();
  verifica(`insert ${tabela}`, { error });
  return data.id;
}

async function asiguraOrganizatie(org) {
  const { data: existent } = await db
    .from("organizations")
    .select("id")
    .eq("slug", org.slug)
    .maybeSingle();
  if (existent) {
    console.log(`  = ${org.name}`);
    return existent.id;
  }
  const { data, error } = await db.from("organizations").insert(org).select("id").single();
  verifica(`insert organizations ${org.slug}`, { error });
  console.log(`  + ${org.name}`);
  return data.id;
}

// ── ștergere ────────────────────────────────────────────────────────────────

async function sterge() {
  console.log("── Șterg datele de demonstrație");
  const existenti = await toticUtilizatorii();

  const { data: orgs } = await db
    .from("organizations")
    .select("id, slug")
    .in("slug", [ORG_DEMO.slug, ORG_BETA.slug]);

  for (const org of orgs ?? []) {
    // `on delete cascade` de pe organization_id curăță membri, angajați,
    // departamente și restul. Organizația este rădăcina, deci e de ajuns.
    const { error } = await db.from("organizations").delete().eq("id", org.id);
    verifica(`delete organizations ${org.slug}`, { error });
    console.log(`  − organizația ${org.slug}`);
  }

  for (const cont of CONTURI) {
    const u = existenti.get(cont.email.toLowerCase());
    if (!u) continue;
    const { error } = await db.auth.admin.deleteUser(u.id);
    if (error) throw new Error(`deleteUser ${cont.email}: ${error.message}`);
    console.log(`  − ${cont.email}`);
  }
}

// ── creare ──────────────────────────────────────────────────────────────────

async function creeaza() {
  console.log("── Organizații");
  const idOrg = {
    demo: await asiguraOrganizatie(ORG_DEMO),
    "beta-demo": await asiguraOrganizatie(ORG_BETA),
  };

  console.log("── Conturi");
  const existenti = await toticUtilizatorii();
  const idUtilizator = {};
  for (const cont of CONTURI) {
    idUtilizator[cont.email] = await asiguraUtilizator(existenti, cont);
  }

  // Profilul e creat de triggerul `on_auth_user_created`, dar fără nume complet.
  for (const cont of CONTURI) {
    const { error } = await db
      .from("profiles")
      .update({ full_name: cont.nume })
      .eq("id", idUtilizator[cont.email]);
    verifica(`update profiles ${cont.email}`, { error });
  }

  console.log("── Apartenențe și roluri");
  for (const cont of CONTURI) {
    for (const m of cont.membru) {
      await asigura(
        "organization_members",
        { organization_id: idOrg[m.org], user_id: idUtilizator[cont.email] },
        { role: m.rol, status: "active", joined_at: new Date().toISOString(), deleted_at: null },
      );
      console.log(`  · ${cont.email} → ${m.org} (${m.rol})`);
    }
  }

  for (const c of CONTURI.filter((x) => x.platforma)) {
    await asigura("platform_admins", { user_id: idUtilizator[c.email] }, { revoked_at: null });
    console.log(`  · ${c.email} → administrator de platformă`);
  }

  console.log("── Module activate");

  /**
   * Modulele `is_core` NU sunt implicite nicăieri: `requireFeature()` verifică
   * apartenența la mulțimea rândurilor din `organization_features` și nu face
   * excepție pentru ele. Fără un rând `nucleu`, TOATE paginile de bază —
   * angajați, departamente, REVISAL, setări — dau 404, deși nu e vorba de niciun
   * modul contractat.
   *
   * Prima versiune a seed-ului a activat doar `leave` și `inventory` și exact
   * asta s-a întâmplat. Le citim acum din catalog, ca lista să nu rămână în urmă
   * dacă apare un al doilea modul de bază.
   */
  const { data: deBaza, error: eroareCore } = await db
    .from("features")
    .select("feature_key")
    .eq("is_core", true);
  verifica("select features is_core", { error: eroareCore });
  const CHEI_DE_BAZA = (deBaza ?? []).map((f) => f.feature_key);

  for (const org of ["demo", "beta-demo"]) {
    for (const cheie of CHEI_DE_BAZA) {
      await asigura(
        "organization_features",
        { organization_id: idOrg[org], feature_key: cheie },
        { enabled: true, deleted_at: null },
      );
    }
  }
  console.log(`  · ambele organizații: ${CHEI_DE_BAZA.join(", ")} (module de bază)`);

  for (const cheie of MODULE_DEMO) {
    await asigura(
      "organization_features",
      { organization_id: idOrg.demo, feature_key: cheie },
      { enabled: true, deleted_at: null },
    );
  }
  console.log(`  · ${ORG_DEMO.name}: ${MODULE_DEMO.join(", ")}`);
  console.log(`  · ${ORG_BETA.name}: niciun modul opțional, ca diferența să se vadă la comutare`);

  console.log("── Structură și angajați");
  for (const d of DEPARTAMENTE) {
    await asigura(
      "departments",
      { organization_id: idOrg.demo, cod: d.cod },
      { denumire: d.denumire, deleted_at: null },
    );
  }
  for (const p of POSTURI) {
    await asigura(
      "job_positions",
      { organization_id: idOrg.demo, cod: p.cod },
      { denumire: p.denumire, deleted_at: null },
    );
  }

  const { data: depuri } = await db
    .from("departments")
    .select("id, cod")
    .eq("organization_id", idOrg.demo);
  const { data: posturi } = await db
    .from("job_positions")
    .select("id, cod")
    .eq("organization_id", idOrg.demo);
  const idDep = Object.fromEntries((depuri ?? []).map((d) => [d.cod, d.id]));
  const idPost = Object.fromEntries((posturi ?? []).map((p) => [p.cod, p.id]));

  const toti = [
    ...CONTURI.filter((c) => c.angajat).map((c) => ({
      ...c.angajat,
      user_id: idUtilizator[c.email],
    })),
    ...COLEGI,
  ];

  // Două treceri: întâi toți fără șef, apoi legăturile ierarhice. Altfel un
  // angajat ar trimite către un rând care încă nu există.
  const idAngajat = {};
  for (const a of toti) {
    idAngajat[a.marca] = await asigura(
      "employees",
      { organization_id: idOrg.demo, marca: a.marca },
      {
        first_name: a.first_name,
        last_name: a.last_name,
        department_id: idDep[a.dep] ?? null,
        job_position_id: idPost[a.post] ?? null,
        user_id: a.user_id ?? null,
        hired_on: "2024-03-01",
        status: "activ",
        deleted_at: null,
      },
    );
  }

  for (const a of toti.filter((x) => x.seful)) {
    verifica(
      `update employees ${a.marca}`,
      await db
        .from("employees")
        .update({ manager_employee_id: idAngajat[a.seful] })
        .eq("id", idAngajat[a.marca]),
    );
  }
  console.log(`  · ${toti.length} angajați, ${DEPARTAMENTE.length} departamente`);

  /**
   * Fără contract, un angajat există doar cu numele — nici REVISAL, nici
   * salarizarea nu au ce calcula. `SALARIU_DUPA_POST` sunt cifre ilustrative,
   * NU cote reale (vezi avertismentul din modulul de salarizare).
   */
  for (const a of toti) {
    await asigura(
      "employment_contracts",
      { organization_id: idOrg.demo, employee_id: idAngajat[a.marca] },
      {
        numar: `CIM-${a.marca}`,
        data_contract: "2024-03-01",
        valabil_de_la: "2024-03-01",
        contract_duration: "nedeterminat",
        norma_ore_saptamana: 40,
        work_mode: "sediu",
        department_id: idDep[a.dep] ?? null,
        job_position_id: idPost[a.post] ?? null,
        salariu_baza: SALARIU_DUPA_POST[a.post] ?? 4000,
        moneda: "RON",
        status: "activ",
        deleted_at: null,
      },
    );
  }
  console.log(`  · ${toti.length} contracte individuale de muncă`);

  /**
   * Pontaj complet și blocat pentru perioada deschisă — fără el, salarizarea
   * n-are ce agrega (`internal.payroll_periods_tranzitie` refuză calculul peste
   * un pontaj nelocat) și modulul de pontaj arată gol la prima deschidere.
   *
   * Zilele de weekend se sar simplu, fără calendarul de sărbători al aplicației
   * (`app.este_zi_lucratoare`) — e pontaj de DEMONSTRAȚIE, nu sursa de adevăr
   * pentru numărătoarea de zile lucrătoare, pe care motorul de calcul o
   * recalculează oricum independent.
   */
  const { data: perioadePontaj, error: eroarePerioadePontaj } = await db
    .from("attendance_periods")
    .select("id, data_inceput, data_sfarsit, status")
    .eq("organization_id", idOrg.demo)
    .is("deleted_at", null);
  verifica("select attendance_periods", { error: eroarePerioadePontaj });

  for (const perioada of perioadePontaj ?? []) {
    let zileLucratoare = 0;
    for (const a of toti) {
      let curent = new Date(`${perioada.data_inceput}T00:00:00Z`);
      const limita = new Date(`${perioada.data_sfarsit}T00:00:00Z`);
      while (curent.getTime() <= limita.getTime()) {
        const ziIso = curent.toISOString().slice(0, 10);
        const ziSaptamana = curent.getUTCDay(); // 0 = duminică, 6 = sâmbătă
        if (ziSaptamana !== 0 && ziSaptamana !== 6) {
          await asigura(
            "attendance_entries",
            { organization_id: idOrg.demo, employee_id: idAngajat[a.marca], data: ziIso },
            {
              period_id: perioada.id,
              ore_lucrate: 8,
              tip_zi: "lucratoare",
              sursa: "manuala",
              approved_at: new Date().toISOString(),
              approved_by: idUtilizator["demo_admin@gmail.com"],
              deleted_at: null,
            },
          );
          zileLucratoare += 1;
        }
        curent = new Date(curent.getTime() + 24 * 60 * 60 * 1000);
      }
    }
    if (perioada.status !== "blocata") {
      verifica(
        // `blocata_la`/`blocata_de` nu se trimit: triggerul le rescrie, exact
        // ca în `blocheazaPerioada` din `pontaj/actions.ts`.
        `update attendance_periods ${perioada.id}`,
        await db.from("attendance_periods").update({ status: "blocata" }).eq("id", perioada.id),
      );
    }
    console.log(
      `  · pontaj ${perioada.data_inceput.slice(0, 7)}: ${zileLucratoare} zile lucrătoare pontate și blocate`,
    );
  }
}

// ── raport ──────────────────────────────────────────────────────────────────

function afiseazaCredentiale() {
  const lat = 26;
  console.log("\n┌─ Conturi de demonstrație " + "─".repeat(38) + "┐");
  console.log(`│ Parola pentru toate: ${PAROLA}`.padEnd(64) + " │");
  console.log("├" + "─".repeat(63) + "┤");
  for (const c of CONTURI) {
    const roluri = [
      c.platforma ? "platformă" : null,
      ...c.membru.map((m) => `${m.rol}@${m.org}`),
    ].filter(Boolean);
    console.log(`│ ${c.email.padEnd(lat)} ${roluri.join(", ")}`.padEnd(64) + " │");
  }
  console.log("└" + "─".repeat(63) + "┘");
  console.log(
    `\n${ORG_DEMO.name} are toate cele unsprezece module activate — vezi lista de mai sus.`,
  );
}

// ── ─────────────────────────────────────────────────────────────────────────

console.log(`Proiect: ${URL_SUPABASE}\n`);
if (RESET) await sterge();
await creeaza();
afiseazaCredentiale();
