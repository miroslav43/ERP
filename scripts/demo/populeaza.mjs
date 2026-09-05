#!/usr/bin/env node
/**
 * Populează firma de demonstrație cu date care arată a produs real.
 *
 * Tovarășul lui `seed-demo.mjs`: acela creează conturile, structura și angajații;
 * ăsta umple MODULELE, ca ecranele lor să poată fi fotografiate pentru paginile
 * publice de prezentare (`scripts/capturi/capturi.mjs`).
 *
 *   node scripts/demo/populeaza.mjs            # tot
 *   node scripts/demo/populeaza.mjs curatenie  # doar etapele numite
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * Firma demo avea nouă angajați și, pentru paisprezece module, zero rânduri.
 * Ecranele lor arătau „0 / 0" și „Niciun element înregistrat", iar o captură a
 * unei stări goale vinde mai prost decât nicio captură. Câteva module aveau, mai
 * rău, resturi de test — un obiect numit „Laptop Dell Latitude 5540 VERIFICARE",
 * o deplasare cu scopul „Verificare adversa - audit" — care ar fi ajuns pe o
 * pagină publică arătând ca o scăpare.
 *
 * ── REGULILE PE CARE LE RESPECTĂ ──────────────────────────────────────────
 * 1. Scrie EXCLUSIV în organizația demo. Fiecare interogare filtrează pe
 *    `ORG`; nu există nicio scriere fără acel filtru.
 * 2. Nu ȘTERGE nimic. Ce e urât se redenumește, iar ce n-are ce căuta se
 *    dezactivează cu `deleted_at` — reversibil printr-un singur UPDATE.
 * 3. E IDEMPOTENT. Rulat de două ori nu dublează nimic: totul trece prin
 *    `asigura()`, care caută după o cheie naturală înainte să insereze.
 * 4. Merge prin `service_role`, care ocolește RLS — la fel ca `seed-demo.mjs`,
 *    și din același motiv: e un seed rulat de proprietarul bazei, nu o cerere
 *    de aplicație.
 *
 * ── ATENȚIE ───────────────────────────────────────────────────────────────
 * Baza de dezvoltare și cea de producție sunt ACELAȘI proiect Supabase. Nu
 * există mediu de probă: fiecare scriere de aici e live.
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
    env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = citesteEnvLocal();
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Lipsesc NEXT_PUBLIC_SUPABASE_URL sau SUPABASE_SERVICE_ROLE_KEY din .env.local.");
}

/*
 * `supabase-js` construiește un client de realtime în constructor, iar acela
 * cere un `WebSocket` global. Node 20 nu-l are (a apărut în 22), iar `ws` nu e
 * instalat — deci `createClient` aruncă înainte de prima interogare. Nu e
 * ipoteză: `scripts/demo/seed-demo.mjs` cade azi identic, din același motiv.
 *
 * Ciotul de mai jos e suficient fiindcă nu deschidem niciun canal: realtime-ul
 * se inițializează leneș și nu se conectează decât la `.channel()`. Dacă
 * vreodată se conectează totuși, constructorul aruncă explicit, în loc să
 * eșueze tăcut într-o stare pe jumătate.
 */
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class {
    constructor() {
      throw new Error("Scriptul de populare nu folosește realtime — nu deschide canale.");
    }
  };
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** „Administrativo Demo SRL". Singura organizație în care scrie fișierul ăsta. */
const ORG = "774fb27a-98e7-4224-927c-49613223e00d";

// ── unelte ──────────────────────────────────────────────────────────────────

function verifica(eticheta, { error }) {
  if (error) {
    console.error(`  ✗ ${eticheta}: ${error.message}`);
    throw new Error(eticheta);
  }
}

/**
 * Inserează sau actualizează, după o cheie naturală, printr-un client dat.
 *
 * Aproape peste tot clientul e cel de serviciu; `asiguraPe` există fiindcă
 * `checklist_template_items` NU se poate scrie prin `service_role` (vezi
 * `dbCaOrgAdmin`).
 */
async function asiguraPe(client, tabela, cheie, rand) {
  let q = client.from(tabela).select("id");
  for (const [c, v] of Object.entries(cheie)) q = q.eq(c, v);
  const { data: gasit, error: eroareCautare } = await q.maybeSingle();
  verifica(`select ${tabela}`, { error: eroareCautare });

  if (gasit) {
    const { error } = await client.from(tabela).update(rand).eq("id", gasit.id);
    verifica(`update ${tabela}`, { error });
    return gasit.id;
  }
  const { data, error } = await client
    .from(tabela)
    .insert({ ...cheie, ...rand })
    .select("id")
    .single();
  verifica(`insert ${tabela}`, { error });
  return data.id;
}

/**
 * Inserează sau actualizează, după o cheie naturală. Copiat ca tipar din
 * `seed-demo.mjs`, ca cele două scripturi să se comporte la fel.
 */
async function asigura(tabela, cheie, rand) {
  return asiguraPe(db, tabela, cheie, rand);
}

/** Contul org_admin al firmei demo — aceleași credențiale ca `scripts/capturi/capturi.mjs`. */
const CONT_DEMO = {
  email: process.env["CONT_DEMO"] ?? "demo_orgadmin@gmail.com",
  parola: process.env["PAROLA_DEMO"] ?? "12345678",
};

let clientOrgAdmin = null;

/**
 * Un al doilea client, autentificat ca `org_admin` al firmei demo.
 *
 * Există pentru O SINGURĂ tabelă. `checklist_template_items` are coloana
 * GENERATĂ `fel`, calculată de `app.checklist_fel_derivat`, iar funcția aceea e
 * grantată doar lui `postgres` și lui `authenticated` — NU și lui
 * `service_role`. Postgres verifică dreptul de execuție la evaluarea coloanei
 * generate, deci un INSERT prin cheia de serviciu cade cu 42501,
 * „permission denied for function checklist_fel_derivat", ÎNAINTE de orice
 * politică RLS. Nu e o problemă de RLS și nu se poate ocoli din client: e un
 * GRANT lipsă în schemă (de reparat într-o migrare separată).
 *
 * Consecință de reținut: prin clientul ăsta se aplică RLS ȘI `internal.set_actor`
 * completează singur `created_by`/`updated_by` cu utilizatorul conectat, deci
 * pașii de șablon apar creați de Ionescu Ana, nu de Marin Elena.
 */
async function dbCaOrgAdmin() {
  if (clientOrgAdmin !== null) return clientOrgAdmin;
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Lipsește NEXT_PUBLIC_SUPABASE_ANON_KEY din .env.local.");
  }
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: CONT_DEMO.email,
    password: CONT_DEMO.parola,
  });
  verifica(`autentificare ${CONT_DEMO.email}`, { error });
  clientOrgAdmin = client;
  return client;
}

/**
 * Ca `asigura()`, dar NU actualizează rândul existent — dacă îl găsește, nu-l
 * atinge deloc.
 *
 * Există pentru tabelele unde o simplă rescriere cu ACELEAȘI valori nu e
 * inofensivă, fiindcă declanșează un trigger care are nevoie de drepturi pe
 * care `service_role` nu le are (vezi `inventory_allocations` mai jos). Pentru
 * date de demonstrație, care nu se schimbă după ce au fost puse o dată,
 * diferența față de `asigura()` e nulă.
 */
async function asiguraDacaLipsestePe(client, tabela, cheie, rand) {
  let q = client.from(tabela).select("id");
  for (const [c, v] of Object.entries(cheie)) q = q.eq(c, v);
  const { data: gasit, error: eroareCautare } = await q.maybeSingle();
  verifica(`select ${tabela}`, { error: eroareCautare });
  if (gasit) return gasit.id;

  const { data, error } = await client
    .from(tabela)
    .insert({ ...cheie, ...rand })
    .select("id")
    .single();
  verifica(`insert ${tabela}`, { error });
  return data.id;
}

async function asiguraDacaLipseste(tabela, cheie, rand) {
  return asiguraDacaLipsestePe(db, tabela, cheie, rand);
}

/** Redenumește un rând identificat printr-un text vechi. Tăcut dacă nu-l găsește. */
async function redenumeste(tabela, coloana, vechi, nou, extra = {}) {
  const { data, error } = await db
    .from(tabela)
    .update({ [coloana]: nou, ...extra })
    .eq("organization_id", ORG)
    .eq(coloana, vechi)
    .select("id");
  verifica(`redenumire ${tabela}.${coloana}`, { error });
  if ((data ?? []).length > 0) console.log(`  · ${tabela}: „${vechi}" → „${nou}"`);
  return (data ?? []).length;
}

// ── etape ───────────────────────────────────────────────────────────────────

/**
 * Curățenia resturilor de test.
 *
 * Toate rândurile de aici au fost verificate individual înainte de a fi atinse.
 * Cel mai important: fișa „Mihai Demo (administrator platformă)" n-are NICIO
 * dependență — zero pontaje, zero contracte, zero concedii, zero instruiri,
 * zero alocări de inventar. E o fișă suspendată în gol, care apărea în capul
 * fiecărei liste de angajați cu „—" la funcție și „Fără contract". O
 * dezactivez în loc s-o redenumesc: n-are rost să inventez o identitate pentru
 * contul de administrator al platformei.
 */
async function curatenie() {
  console.log("── Curățenie");

  await redenumeste("departments", "denumire", "Departament Test Editat", "Logistică");
  await redenumeste(
    "inventory_items",
    "denumire",
    "Laptop Dell Latitude 5540 VERIFICARE",
    "Laptop Dell Latitude 5540",
  );
  await redenumeste(
    "business_trips",
    "scop",
    "Verificare adversa - audit",
    "Instalare linie de ambalare la clientul din Arad",
  );
  await redenumeste("course_materials", "titlu", "ddsa", "Ghid GDPR pentru angajați");
  await redenumeste(
    "checklist_templates",
    "denumire",
    "Sablon complet toate campurile",
    "Integrare angajat nou",
  );

  // Cursul există, dar e nepublicat și fără lecții. Îl transform în ceva real;
  // lecțiile le adaugă etapa `cursuri`.
  await redenumeste("courses", "denumire", "Administrativ", "Protecția datelor personale (GDPR)");

  const { data: fisaGoala, error } = await db
    .from("employees")
    .update({ deleted_at: new Date().toISOString() })
    .eq("organization_id", ORG)
    .like("full_name", "Mihai Demo%")
    .is("deleted_at", null)
    .select("id");
  verifica("dezactivare fișă fără dependențe", { error });
  if ((fisaGoala ?? []).length > 0) {
    console.log("  · employees: fișa „Mihai Demo” dezactivată (deleted_at)");
  }
}

// ── identificatorii firmei demo ─────────────────────────────────────────────

/*
 * Fișele de angajat (`employees.id`) ale celor OPT angajați activi. Al nouălea
 * rând — „Mihai Demo (administrator platformă)" — a fost dezactivat de etapa
 * `curatenie` și nu apare în nicio listă; nu-i atribui nimic.
 */
const ANGAJAT = {
  barbu: "e28cb43e-da96-4a7b-8ff2-6039d1582cc2", // Agent de vânzări
  dumitrescu: "0f2c715d-8bc0-4f0f-807f-0a2dd6920ba2", // Operator producție
  georgescu: "8b867d05-d4c0-4a42-9bc7-ce21abe20ac4", // Operator producție
  ionescu: "ca0abb33-272c-4616-8e1f-78246c923b4e", // Director general
  marin: "ec8f2bf2-9495-4458-9efb-cde1d8a1242f", // Specialist resurse umane
  nistor: "ffea192e-97b7-49e4-ad1a-c65168ca00fc", // Agent de vânzări
  pop: "0363109a-9034-49a8-a0b6-9ded5aa88875", // Șef de echipă
  stan: "9ea5f492-9cfb-4df5-82f9-b5bccfa3a174", // Operator producție
};

/*
 * Conturile (`auth.users.id`). DOAR patru dintre cei opt au cont: Barbu,
 * Dumitrescu, Nistor și Stan lucrează fără acces la aplicație. Orice coloană
 * cu FK spre `auth.users` (`announcement_reads.user_id`, `created_by`,
 * `ticket_history.actor_user_id`) rămâne NULL pentru ei — nu se poate inventa
 * un utilizator inexistent.
 */
const CONT = {
  georgescu: "5eae322d-2dcd-4d1b-bd31-1ca0a05f8e56", // employee
  ionescu: "cbd11ea4-ae16-4ff3-a424-f3b1b8bbf4e1", // org_admin
  marin: "bf8ad520-bff0-46a6-a301-5a77c3a89d07", // hr
  pop: "734c1eaf-863f-49b2-98f0-e40754b6eeea", // manager
};

const DEPARTAMENT = {
  administrativ: "3c90a122-4bcf-47bf-bebc-3bd0f7d97aba",
  productie: "ff864dce-4a49-47b2-9761-acff002b637c",
  vanzari: "cf975afe-81ba-460a-be4a-a57199ce0fdb",
};

/*
 * Autorul implicit al datelor de demonstrație: Ionescu Ana, `org_admin`.
 *
 * `internal.set_actor` completează `created_by`/`updated_by` DOAR când
 * `auth.uid()` nu e null. Scriptul ăsta merge prin `service_role`, unde
 * `auth.uid()` e mereu NULL — deci fără valorile de mai jos fiecare ecran ar
 * arăta „Introdus de: —". Tabelele de flotă nici măcar n-au triggerul.
 */
const AUTOR = { created_by: CONT.ionescu, updated_by: CONT.ionescu };

// ── SSM și PSI ──────────────────────────────────────────────────────────────

/** Nomenclatorul de instruiri, seedat de platformă la crearea organizației. */
const TIP_INSTRUIRE = {
  introductivGeneral: "aa202f88-c7d9-4362-8f67-e07921231c0d", // fără periodicitate
  laLoculDeMunca: "e844586e-5da2-4870-aa07-9deff6a73e97", // fără periodicitate
  periodic: "1eca64a2-5205-4fd7-ae7c-701516a785a0", // 6 luni
  suplimentar: "5ff0591e-5125-485b-b4bc-9150ce4698ac", // fără periodicitate
  psiIntroductiv: "9ce7f762-1aec-4f07-af61-009f827058a3", // fără periodicitate
  psiPeriodic: "81ca4502-a1e0-4307-a32a-73660f0f8b18", // 6 luni
};

const LECTOR_SSM = "Cabinet SSM și PSI Prevenție Vest SRL";

/** Aceeași dată de instruire pentru toți cei opt angajați activi. */
function totiLa(data) {
  return Object.fromEntries(Object.values(ANGAJAT).map((id) => [id, data]));
}

/**
 * Matricea de pe `/ssm/instruiri`: opt angajați × șase tipuri = 48 de celule.
 *
 * Doar `periodic` și `psi_periodic` au periodicitate configurată (6 luni), deci
 * doar ele pot expira. Celelalte patru, odată efectuate, rămân valabile — de
 * aceea `stareScadentaSsm` le dă „ok", nu „neaplicabil”: ce contează pentru
 * culoare e că EXISTĂ o înregistrare.
 *
 * `urmatoarea_scadenta` NU se trimite niciodată: `internal.ssm_training_calc` o
 * calculează din periodicitatea legală, iar o valoare trimisă de noi ar ocoli-o
 * tăcut (capcana #29).
 */
const MATRICE_INSTRUIRI = [
  {
    tip: TIP_INSTRUIRE.introductivGeneral,
    durataOre: 8,
    tematica:
      "Instruire introductiv-generală la angajare — prezentarea riscurilor specifice locului de muncă și a regulilor interne de securitate și sănătate în muncă",
    date: totiLa("2026-08-18"),
  },
  {
    tip: TIP_INSTRUIRE.laLoculDeMunca,
    durataOre: 8,
    tematica:
      "Instruire la locul de muncă — instructaj practic la postul de lucru, riscuri specifice și mod de utilizare a echipamentelor",
    date: totiLa("2026-08-18"),
  },
  {
    tip: TIP_INSTRUIRE.suplimentar,
    durataOre: 2,
    tematica:
      "Instruire suplimentară — actualizarea instrucțiunilor proprii de securitate a muncii, urmare a reviziei anuale a planului de prevenire și protecție",
    date: totiLa("2026-08-25"),
  },
  {
    tip: TIP_INSTRUIRE.psiIntroductiv,
    durataOre: 2,
    tematica:
      "Instruire introductivă PSI — reguli de apărare împotriva incendiilor, semnalizare de securitate și căi de evacuare",
    date: totiLa("2026-08-18"),
  },
  {
    tip: TIP_INSTRUIRE.psiPeriodic,
    durataOre: 2,
    tematica:
      "Instruire periodică PSI — exercițiu teoretic de utilizare a stingătoarelor și verificarea cunoștințelor de evacuare",
    date: totiLa("2026-08-18"), // scadență 2027-02-18, toți în regulă
  },
  {
    tip: TIP_INSTRUIRE.periodic,
    durataOre: 2,
    tematica:
      "Instruire periodică SSM — reîmprospătarea cunoștințelor de securitate și sănătate în muncă",
    // Date diferite intenționat: o matrice perfect uniformă arată a seed, nu a
    // firmă. Nistor iese CRITIC (scadență 2026-09-10) și Stan ATENȚIE
    // (2026-09-15) — semnalul că sistemul chiar urmărește termenele.
    date: {
      [ANGAJAT.barbu]: "2026-08-20",
      [ANGAJAT.dumitrescu]: "2026-08-20",
      [ANGAJAT.georgescu]: "2026-08-22",
      [ANGAJAT.ionescu]: "2026-08-18",
      [ANGAJAT.marin]: "2026-08-18",
      [ANGAJAT.nistor]: "2026-03-10",
      [ANGAJAT.pop]: "2026-08-25",
      [ANGAJAT.stan]: "2026-03-15",
    },
  },
];

/**
 * Stingătoarele și verificările lor.
 *
 * Scadențele NU se scriu: `internal.ssm_check_apply` (AFTER, pe verificare)
 * urcă `ultima_*` pe rândul-părinte, iar `internal.ssm_extinguisher_calc`
 * (BEFORE, pe stingător) calculează `scadenta_*` din periodicitățile SSM
 * (12 / 36 / 60 de luni).
 */
const STINGATOARE = [
  {
    cod: "STG-01",
    tip: "Pulbere ABC 6 kg",
    masaKg: 6,
    cladire: "Sediu central",
    locatie: "Hol recepție, lângă intrarea principală",
    serie: "PX-20441",
    pusInFunctiune: "2021-09-05",
    verificari: {
      verificare: "2026-08-20",
      reincarcare: "2024-09-05",
      proba_presiune: "2022-09-05",
    },
  },
  {
    cod: "STG-02",
    tip: "CO2 5 kg",
    masaKg: 5,
    cladire: "Hala producție",
    locatie: "Lângă ieșirea de urgență, latura de est",
    serie: "PX-20885",
    pusInFunctiune: "2021-09-10",
    // Verificarea și proba de presiune expiră pe 2026-09-10 — la cinci zile.
    // Cardul de stingătoare arată „2 de atenționat", nu un zid roșu.
    verificari: {
      verificare: "2025-09-10",
      reincarcare: "2024-01-15",
      proba_presiune: "2021-09-10",
    },
  },
  {
    cod: "STG-03",
    tip: "Pulbere ABC 6 kg",
    masaKg: 6,
    cladire: "Depozit",
    locatie: "Lângă poarta de acces marfă",
    serie: "PX-21190",
    pusInFunctiune: "2021-08-15",
    verificari: {
      verificare: "2026-08-15",
      reincarcare: "2024-08-15",
      proba_presiune: "2022-08-15",
    },
  },
];

/**
 * Fișele de aptitudine. Nistor Vlad rămâne fără fișă — nu toată lumea și-a
 * făcut deja controlul, iar o listă în care toți sunt în regulă nu arată la ce
 * folosește ecranul.
 *
 * Georgescu Ioana are `apt_conditionat` INTENȚIONAT: declanșează
 * `internal.ssm_exam_sync`, care inserează singur restricția de muncă. NU se
 * scrie manual în `employee_work_restrictions`.
 */
const FISE_APTITUDINE = [
  // Rândul existent (9429b41c), curățat de „medic=Miro / unitate=TM / fișa 123".
  {
    angajat: ANGAJAT.barbu,
    data: "2025-09-26",
    rezultat: "apt",
    fisa: "1841/2025",
    pana: "2026-09-26",
  },
  {
    angajat: ANGAJAT.dumitrescu,
    data: "2026-08-19",
    rezultat: "apt",
    fisa: "1842/2026",
    pana: "2027-08-19",
  },
  {
    angajat: ANGAJAT.georgescu,
    data: "2026-08-19",
    rezultat: "apt_conditionat",
    fisa: "1843/2026",
    pana: "2027-08-19",
  },
  {
    angajat: ANGAJAT.ionescu,
    data: "2026-08-21",
    rezultat: "apt",
    fisa: "1844/2026",
    pana: "2027-08-21",
  },
  {
    angajat: ANGAJAT.marin,
    data: "2026-08-21",
    rezultat: "apt",
    fisa: "1845/2026",
    pana: "2027-08-21",
  },
  {
    angajat: ANGAJAT.pop,
    data: "2026-08-24",
    rezultat: "apt",
    fisa: "1846/2026",
    pana: "2027-08-24",
  },
  {
    angajat: ANGAJAT.stan,
    data: "2026-08-24",
    rezultat: "apt",
    fisa: "1847/2026",
    pana: "2027-08-24",
  },
];

/**
 * Autorizațiile nominale.
 *
 * `tip` ajunge, prin `internal.ssm_sync_exp`, direct în `expirables.kind`, care
 * are CHECK `^[a-z][a-z0-9_]{1,48}$`. „Stivuitorist" cu majusculă ar cădea cu
 * 23514 dintr-o tabelă care nu spune nimic despre autorizații — de aceea
 * codurile sunt cu literă mică și underscore, exact ca în formularul viu.
 *
 * `stivuitorist` e cerut și de modulul de mentenanță (`equipment
 * .tip_autorizare_necesara`); se inserează O SINGURĂ DATĂ, aici.
 */
const AUTORIZATII = [
  {
    angajat: ANGAJAT.pop,
    tip: "stivuitorist",
    numar: "3345/2025",
    emitent: "ISCIR",
    emisLa: "2025-02-10",
    pana: "2027-02-10",
  },
  {
    angajat: ANGAJAT.dumitrescu,
    tip: "legator_de_sarcina",
    numar: "0198/2024",
    emitent: "ISCIR",
    emisLa: "2024-09-20",
    pana: "2026-09-20", // la 15 zile ⇒ ATENȚIE, intenționat
  },
];

/**
 * Echipamentul individual de protecție, pentru cei patru din Producție.
 *
 * `data_inlocuirii` NU se trimite: `internal.ssm_ppe_calc` o calculează din
 * `durata_utilizare_luni`. Mănușile Stanei ies scadente pe 2026-09-20 — al
 * doilea semnal realist de pe panou.
 */
const EIP = [
  {
    angajat: ANGAJAT.dumitrescu,
    articol: "Bocanci de protecție S3",
    luni: 12,
    data: "2026-08-18",
    valoare: 220,
  },
  {
    angajat: ANGAJAT.dumitrescu,
    articol: "Cască de protecție",
    luni: 24,
    data: "2026-08-18",
    valoare: 45,
  },
  {
    angajat: ANGAJAT.georgescu,
    articol: "Bocanci de protecție S3",
    luni: 12,
    data: "2026-08-18",
    valoare: 220,
  },
  {
    angajat: ANGAJAT.georgescu,
    articol: "Cască de protecție",
    luni: 24,
    data: "2026-08-18",
    valoare: 45,
  },
  {
    angajat: ANGAJAT.pop,
    articol: "Bocanci de protecție S3",
    luni: 12,
    data: "2026-08-18",
    valoare: 220,
  },
  {
    angajat: ANGAJAT.pop,
    articol: "Cască de protecție",
    luni: 24,
    data: "2026-08-18",
    valoare: 45,
  },
  {
    angajat: ANGAJAT.stan,
    articol: "Bocanci de protecție S3",
    luni: 12,
    data: "2026-08-18",
    valoare: 220,
  },
  {
    angajat: ANGAJAT.stan,
    articol: "Mănuși de protecție",
    luni: 3,
    data: "2026-06-20",
    valoare: 18,
  },
];

/**
 * SSM și PSI: matricea de instruiri, stingătoarele, medicina muncii,
 * autorizațiile nominale și EIP.
 *
 * Ecranul-țintă `/ssm/instruiri` avea 46 din 48 de celule roșii („Niciodată
 * efectuată") — o firmă în neregulă, nu un produs. Cele două instruiri
 * existente aveau tematica „Tematica de verificare adversa"; `asigura()` le
 * prinde după (organizație, angajat, tip) și le rescrie, nu le dublează.
 */
async function ssm() {
  console.log("── SSM și PSI");

  for (const bloc of MATRICE_INSTRUIRI) {
    for (const [employee_id, data] of Object.entries(bloc.date)) {
      await asigura(
        "ssm_trainings",
        { organization_id: ORG, employee_id, training_type_id: bloc.tip },
        {
          data_instruirii: data,
          durata_ore: bloc.durataOre,
          lector_extern: LECTOR_SSM,
          tematica: bloc.tematica,
          semnatura_confirmata: true,
          semnat_la: `${data}T09:00:00+03:00`,
          ...AUTOR,
        },
      );
    }
  }
  console.log(
    `  · ssm_trainings: ${String(MATRICE_INSTRUIRI.length * 8)} celule (8 angajați × 6 tipuri)`,
  );

  for (const s of STINGATOARE) {
    const id = await asigura(
      "fire_extinguishers",
      { organization_id: ORG, cod: s.cod },
      {
        tip: s.tip,
        masa_kg: s.masaKg,
        cladire: s.cladire,
        locatie: s.locatie,
        producator: "Prevenție Total SRL",
        serie: s.serie,
        data_punerii_in_functiune: s.pusInFunctiune,
        status: "activ",
        ...AUTOR,
      },
    );
    for (const [tip_verificare, data] of Object.entries(s.verificari)) {
      await asigura(
        "fire_extinguisher_checks",
        { organization_id: ORG, extinguisher_id: id, tip_verificare },
        {
          data,
          firma_autorizata: "Prevenție Total SRL",
          rezultat: "conform",
          ...AUTOR,
        },
      );
    }
  }
  console.log("  · fire_extinguishers: 3, fire_extinguisher_checks: 9");

  for (const f of FISE_APTITUDINE) {
    await asigura(
      "occupational_health_exams",
      { organization_id: ORG, employee_id: f.angajat, tip: "periodic" },
      {
        data_examinarii: f.data,
        medic: "Dr. Bogdan Tănase",
        unitate_medicala: "Cabinet de Medicina Muncii ProSanitas",
        rezultat: f.rezultat,
        valabil_pana: f.pana,
        numar_fisa: f.fisa,
        cost: 180,
        ...AUTOR,
      },
    );
  }
  console.log("  · occupational_health_exams: 7 (Nistor Vlad rămâne fără fișă, intenționat)");

  for (const a of AUTORIZATII) {
    await asigura(
      "personnel_authorizations",
      { organization_id: ORG, employee_id: a.angajat, tip: a.tip, numar: a.numar },
      { emitent: a.emitent, emis_la: a.emisLa, valabil_pana: a.pana, ...AUTOR },
    );
  }
  console.log("  · personnel_authorizations: 2");

  for (const e of EIP) {
    await asigura(
      "ppe_issuances",
      { organization_id: ORG, employee_id: e.angajat, articol: e.articol },
      {
        cantitate: 1,
        unitate: "buc",
        data_predarii: e.data,
        durata_utilizare_luni: e.luni,
        valoare: e.valoare,
        semnatura_confirmata: true,
        ...AUTOR,
      },
    );
  }
  console.log("  · ppe_issuances: 8");
}

// ── Flotă ───────────────────────────────────────────────────────────────────

/** Nomenclatorul de tipuri de documente, comun tuturor organizațiilor. */
const TIP_DOCUMENT = {
  itp: "38da8a4f-77b9-41dd-a191-22539672d59d",
  rca: "4244510f-c9fb-4b2e-85ee-b045ef1703ae",
  casco: "1dfa2021-f8e7-4a67-859f-fcb236eb2cef",
  rovinieta: "697c3f95-bdbc-4142-abf7-db3fe7530ebe",
  revizie: "9396edd8-0aec-402f-858b-940b4fdd28d5",
  extinctor: "ffdb4df1-3728-474d-b15e-c583e40add1f",
  trusaMedicala: "662d445d-d908-4f54-b2f9-744d09493cac",
};

/**
 * Parcul auto.
 *
 * Primele două rânduri sunt vehiculele pe care umblă foile de parcurs
 * (`FOI_PARCURS` le caută după numărul de înmatriculare NORMALIZAT, fără
 * spații — `internal.vehicles_normalizeaza` taie spațiile și cratimele la
 * scriere, iar indexul unic e pe forma normalizată).
 *
 * `categorie` și `tip_combustibil` sunt NOT NULL cu DEFAULT
 * 'autoturism'/'motorina': se trimit EXPLICIT pe fiecare rând, altfel o
 * utilitară sau o mașină pe benzină apar clasificate greșit, fără nicio eroare.
 *
 * Amestecul e ales ca lista să arate a firmă crescută în timp, nu cumpărată
 * deodată: 2010–2023 ca ani, de la 21 000 la 215 000 km, trei autoturisme și
 * trei autoutilitare, și un vehicul imobilizat în service — singura cale de a
 * arăta că există coloana de stare.
 */
const VEHICULE = [
  {
    nr: "TM33MRO",
    marca: "Mercedes-Benz",
    model: "C 220 d",
    categorie: "autoturism",
    combustibil: "motorina",
    an: 2022,
    cmc: 1950,
    masaKg: 2075,
    locuri: 5,
    consum: 5.8,
    km: 38400, // linie de bază pentru foile de parcurs; urcă singur la aprobare
    angajat: ANGAJAT.nistor,
    departament: DEPARTAMENT.vanzari,
    status: "activ",
    achizitie: "2022-05-10",
    valoare: 145000,
  },
  {
    nr: "TM45PRD",
    marca: "Dacia",
    model: "Dokker Van",
    categorie: "autoutilitara",
    combustibil: "motorina",
    an: 2021,
    cmc: 1461,
    masaKg: 2050,
    locuri: 2,
    consum: 5.5,
    km: 61200,
    angajat: null, // vehicul de pool, fără șofer nominal
    departament: DEPARTAMENT.productie,
    status: "activ",
    achizitie: "2021-06-15",
    valoare: 68000,
  },
  {
    nr: "TM78PRD",
    marca: "Ford",
    model: "Transit Connect",
    categorie: "autoutilitara",
    combustibil: "motorina",
    an: 2020,
    cmc: 1499,
    masaKg: 2210,
    locuri: 2,
    consum: 6.2,
    km: 94300,
    angajat: null,
    departament: DEPARTAMENT.productie,
    status: "activ",
    achizitie: "2020-09-08",
    valoare: 74000,
  },
  {
    nr: "TM90VNZ",
    marca: "Škoda",
    model: "Octavia",
    categorie: "autoturism",
    combustibil: "motorina",
    an: 2023,
    cmc: 1968,
    masaKg: 1985,
    locuri: 5,
    consum: 5.2,
    km: 21750,
    angajat: ANGAJAT.barbu,
    departament: DEPARTAMENT.vanzari,
    status: "activ",
    achizitie: "2023-04-18",
    valoare: 118000,
  },
  {
    // Cel mai vechi din parc, cu kilometrajul pe măsură. Poartă și singurul
    // document EXPIRAT din firmă (ITP-ul), ca semaforul de conformitate să
    // arate la ce folosește.
    nr: "TM12ADM",
    marca: "Dacia",
    model: "Logan",
    categorie: "autoturism",
    combustibil: "benzina",
    an: 2016,
    cmc: 998,
    masaKg: 1620,
    locuri: 5,
    consum: 6.5,
    km: 214800,
    angajat: null,
    departament: DEPARTAMENT.administrativ,
    status: "activ",
    achizitie: "2016-11-22",
    valoare: 34000,
    observatii:
      "Mașina de serviciu a administrativului, folosită la drumuri scurte în oraș. Se analizează înlocuirea ei la anul.",
  },
  {
    nr: "TM55SRV",
    marca: "Volkswagen",
    model: "Caddy",
    categorie: "autoutilitara",
    combustibil: "motorina",
    an: 2019,
    cmc: 1598,
    masaKg: 2170,
    locuri: 2,
    consum: 6.0,
    km: 156200,
    angajat: null,
    departament: DEPARTAMENT.productie,
    // Singurul rând care nu e „în parc": fără el, coloana de stare arată o
    // singură valoare și pare decorativă.
    status: "in_service",
    achizitie: "2019-07-30",
    valoare: 58000,
    observatii:
      "Imobilizat în service pentru înlocuirea ambreiajului; revine în parc după recepția lucrării.",
  },
];

/**
 * Documentele, grupate pe vehicul.
 *
 * Cele cinci tipuri OBLIGATORII (itp, rca, rovinieta, extinctor,
 * trusa_medicala) există pe fiecare vehicul — altfel semaforul ar arăta roșu
 * din lipsă, ceea ce n-ar demonstra nimic. CASCO și revizia, care sunt
 * opționale, apar doar acolo unde e credibil să existe.
 *
 * `este_curent` nu se trimite niciodată: `internal.vdoc_inainte` îl forțează pe
 * false, iar `internal.flota_sincronizeaza_grup` alege singur documentul curent
 * (cel cu `expira_la` maxim) și proiectează scadența în `expirables`.
 */
const DOCUMENTE_FLOTA = {
  TM33MRO: [
    { tip: "itp", de: "2025-03-10", la: "2027-03-10", cost: 120, emitent: "RAR Timiș" },
    // RCA-ul e mereu documentul „pe muchie": zece zile rămase.
    {
      tip: "rca",
      de: "2025-09-15",
      la: "2026-09-15",
      cost: 1450,
      emitent: "Broker de Asigurări Vest SRL",
    },
    {
      tip: "casco",
      de: "2025-09-15",
      la: "2026-09-15",
      cost: 2100,
      emitent: "Broker de Asigurări Vest SRL",
    },
    { tip: "rovinieta", de: "2026-08-01", la: "2027-07-31", cost: 606, emitent: "CNAIR" },
    {
      tip: "revizie",
      de: "2026-07-20",
      la: "2027-01-20",
      cost: 850,
      emitent: "Service Auto Bănățeanu SRL",
    },
    {
      tip: "extinctor",
      de: "2026-01-15",
      la: "2027-01-15",
      cost: 45,
      emitent: "Prevenție Total SRL",
    },
    {
      tip: "trusaMedicala",
      de: "2026-02-01",
      la: "2028-02-01",
      cost: 35,
      emitent: "Farmacia ProVita",
    },
  ],
  TM45PRD: [
    { tip: "itp", de: "2025-11-01", la: "2027-05-01", cost: 100, emitent: "RAR Timiș" },
    {
      tip: "rca",
      de: "2026-03-01",
      la: "2027-03-01",
      cost: 980,
      emitent: "Broker de Asigurări Vest SRL",
    },
    { tip: "rovinieta", de: "2026-08-01", la: "2027-07-31", cost: 606, emitent: "CNAIR" },
    {
      tip: "extinctor",
      de: "2026-08-25",
      la: "2027-08-25",
      cost: 45,
      emitent: "Prevenție Total SRL",
    },
    {
      tip: "trusaMedicala",
      de: "2026-08-25",
      la: "2028-08-25",
      cost: 35,
      emitent: "Farmacia ProVita",
    },
  ],
  TM78PRD: [
    { tip: "itp", de: "2025-10-05", la: "2027-04-05", cost: 100, emitent: "RAR Timiș" },
    {
      tip: "rca",
      de: "2026-02-20",
      la: "2027-02-20",
      cost: 1120,
      emitent: "Broker de Asigurări Vest SRL",
    },
    { tip: "rovinieta", de: "2026-08-01", la: "2027-07-31", cost: 606, emitent: "CNAIR" },
    {
      tip: "extinctor",
      de: "2026-03-10",
      la: "2027-03-10",
      cost: 45,
      emitent: "Prevenție Total SRL",
    },
    {
      tip: "trusaMedicala",
      de: "2026-03-10",
      la: "2028-03-10",
      cost: 35,
      emitent: "Farmacia ProVita",
    },
  ],
  TM90VNZ: [
    { tip: "itp", de: "2025-04-20", la: "2027-04-20", cost: 120, emitent: "RAR Timiș" },
    {
      tip: "rca",
      de: "2026-04-18",
      la: "2027-04-18",
      cost: 1180,
      emitent: "Broker de Asigurări Vest SRL",
    },
    {
      tip: "casco",
      de: "2026-04-18",
      la: "2027-04-18",
      cost: 1750,
      emitent: "Broker de Asigurări Vest SRL",
    },
    { tip: "rovinieta", de: "2026-08-01", la: "2027-07-31", cost: 606, emitent: "CNAIR" },
    {
      tip: "extinctor",
      de: "2026-04-18",
      la: "2027-04-18",
      cost: 45,
      emitent: "Prevenție Total SRL",
    },
    {
      tip: "trusaMedicala",
      de: "2026-04-18",
      la: "2028-04-18",
      cost: 35,
      emitent: "Farmacia ProVita",
    },
  ],
  TM12ADM: [
    // EXPIRAT de aproape o lună — singurul din firmă. Restul documentelor sunt
    // în regulă, ca rândul să arate a scăpare reală, nu a mașină abandonată.
    { tip: "itp", de: "2024-08-10", la: "2026-08-10", cost: 100, emitent: "RAR Timiș" },
    {
      tip: "rca",
      de: "2026-01-15",
      la: "2027-01-15",
      cost: 890,
      emitent: "Broker de Asigurări Vest SRL",
    },
    // Expiră peste 19 zile ⇒ „Expiră curând".
    { tip: "rovinieta", de: "2025-09-25", la: "2026-09-24", cost: 606, emitent: "CNAIR" },
    {
      tip: "extinctor",
      de: "2026-02-01",
      la: "2027-02-01",
      cost: 45,
      emitent: "Prevenție Total SRL",
    },
    {
      tip: "trusaMedicala",
      de: "2026-02-01",
      la: "2028-02-01",
      cost: 35,
      emitent: "Farmacia ProVita",
    },
  ],
  TM55SRV: [
    { tip: "itp", de: "2026-01-20", la: "2028-01-20", cost: 100, emitent: "RAR Timiș" },
    {
      tip: "rca",
      de: "2026-06-05",
      la: "2027-06-05",
      cost: 1040,
      emitent: "Broker de Asigurări Vest SRL",
    },
    { tip: "rovinieta", de: "2026-08-01", la: "2027-07-31", cost: 606, emitent: "CNAIR" },
    {
      tip: "extinctor",
      de: "2026-01-20",
      la: "2027-01-20",
      cost: 45,
      emitent: "Prevenție Total SRL",
    },
    {
      tip: "trusaMedicala",
      de: "2026-01-20",
      la: "2028-01-20",
      cost: 35,
      emitent: "Farmacia ProVita",
    },
  ],
};

/**
 * Foile de parcurs, în ordine cronologică STRICTĂ pe fiecare vehicul.
 *
 * `internal.foi_parcurs_inainte` refuză la INSERT orice `km_plecare` mai mic
 * decât ultimul kilometraj cunoscut al vehiculului — deci ordinea din tablou e
 * o constrângere, nu o preferință.
 *
 * Foile #5 și #8 rămân „trimis" pentru ca `/flota/aprobari` să aibă ce arăta,
 * și tot ele poartă alimentările: `internal.alimentari_inainte` refuză orice
 * scriere de alimentare pe o foaie deja aprobată — inclusiv la a doua rulare a
 * scriptului, ceea ce ar fi rupt idempotența dacă le-am fi pus pe foi aprobate.
 */
const FOI_PARCURS = [
  {
    numar: "FP-2026-0001",
    vehicul: "TM33MRO",
    angajat: ANGAJAT.nistor,
    plecare: "2026-08-20T08:00:00+03:00",
    sosire: "2026-08-20T16:30:00+03:00",
    kmPlecare: 38400,
    kmSosire: 38620,
    traseu: "Timișoara – Arad – Timișoara",
    scop: "Vizită client, prezentare ofertă",
    status: "aprobat",
  },
  {
    numar: "FP-2026-0002",
    vehicul: "TM33MRO",
    angajat: ANGAJAT.nistor,
    plecare: "2026-08-22T09:00:00+03:00",
    sosire: "2026-08-22T14:00:00+03:00",
    kmPlecare: 38620,
    kmSosire: 38790,
    traseu: "Timișoara – Lugoj",
    scop: "Livrare contract semnat",
    status: "aprobat",
  },
  {
    numar: "FP-2026-0003",
    vehicul: "TM33MRO",
    angajat: ANGAJAT.nistor,
    plecare: "2026-08-27T08:30:00+03:00",
    sosire: "2026-08-27T18:00:00+03:00",
    kmPlecare: 38790,
    kmSosire: 38950,
    traseu: "Timișoara – Deva – Timișoara",
    scop: "Târg regional de prezentare produse",
    status: "aprobat",
  },
  {
    numar: "FP-2026-0004",
    vehicul: "TM33MRO",
    angajat: ANGAJAT.nistor,
    plecare: "2026-09-01T08:00:00+03:00",
    sosire: "2026-09-01T20:00:00+03:00",
    // Salt intenționat de 2550 km peste ultimul kilometraj aprobat (38950),
    // adică peste pragul implicit de 1500: `internal.foi_parcurs_dupa` scrie
    // SINGUR o anomalie de tip „salt", care alimentează /flota/anomalii.
    kmPlecare: 41500,
    kmSosire: 41680,
    traseu: "Timișoara – București – Timișoara",
    scop: "Întâlnire client național",
    status: "aprobat",
  },
  {
    numar: "FP-2026-0005",
    vehicul: "TM33MRO",
    angajat: ANGAJAT.nistor,
    plecare: "2026-09-04T08:00:00+03:00",
    sosire: "2026-09-04T17:00:00+03:00",
    kmPlecare: 41680,
    kmSosire: 41810,
    traseu: "Timișoara – Oradea",
    scop: "Vizită client nou",
    status: "trimis",
    alimentare: {
      litri: 45.2,
      cost: 331.72,
      statie: "Stație PECO, ieșire Timișoara spre Lugoj",
      numarBon: "48213",
      la: "2026-09-04T10:30:00+03:00",
    },
  },
  {
    numar: "FP-2026-0006",
    vehicul: "TM33MRO",
    angajat: ANGAJAT.nistor,
    plecare: "2026-09-05T07:30:00+03:00",
    sosire: null,
    kmPlecare: 41810,
    kmSosire: null,
    traseu: "Curse locale Timișoara",
    scop: "Vizite clienți locali",
    status: "draft", // foaia de azi, încă în lucru
  },
  {
    numar: "FP-2026-0007",
    vehicul: "TM45PRD",
    angajat: ANGAJAT.pop,
    plecare: "2026-08-21T09:00:00+03:00",
    sosire: "2026-08-21T13:00:00+03:00",
    kmPlecare: 61200,
    kmSosire: 61350,
    traseu: "Timișoara – depozit furnizor, retur",
    scop: "Ridicare materiale",
    status: "aprobat",
  },
  {
    numar: "FP-2026-0008",
    vehicul: "TM45PRD",
    angajat: ANGAJAT.dumitrescu,
    plecare: "2026-08-29T10:00:00+03:00",
    sosire: "2026-08-29T15:00:00+03:00",
    kmPlecare: 61350,
    kmSosire: 61410,
    traseu: "Livrări locale Timișoara",
    scop: "Distribuție comenzi către clienți locali",
    status: "trimis",
    alimentare: {
      litri: 38.0,
      cost: 278.92,
      statie: "Stație PECO, zona industrială Timișoara",
      numarBon: "19042",
      la: "2026-08-29T10:20:00+03:00",
    },
  },
];

/**
 * Parcul auto: două vehicule cu documentele la zi, opt foi de parcurs și două
 * alimentări.
 *
 * `/flota` arăta un singur vehicul cu marca și modelul inversate
 * („C300De / Mercedes"), fără an de fabricație, fără șofer și fără NICIUN
 * document — adică semafor roșu pe toate cele cinci tipuri obligatorii.
 *
 * Nici `vehicles`, nici `vehicle_documents`, nici `trip_sheets` n-au trigger de
 * actor: `created_by`/`updated_by` se trimit explicit peste tot (capcana #23).
 */
async function flota() {
  console.log("── Flotă");

  /*
   * `km_curent` se pune la linia de bază a foilor, nu la valoarea finală:
   * `internal.foi_parcurs_inainte` refuză o foaie al cărei `km_plecare` e sub
   * kilometrajul curent al vehiculului. La aprobare, `internal.foi_parcurs_dupa`
   * îl urcă singur — inclusiv la a doua rulare, când UPDATE-ul de aici îl
   * coboară pentru o clipă și fiecare foaie aprobată îl ridică la loc.
   */
  const vehiculDupaNumar = {};
  for (const v of VEHICULE) {
    vehiculDupaNumar[v.nr] = await asigura(
      "vehicles",
      { organization_id: ORG, nr_inmatriculare: v.nr },
      {
        marca: v.marca,
        model: v.model,
        categorie: v.categorie,
        tip_combustibil: v.combustibil,
        an_fabricatie: v.an,
        capacitate_cilindrica: v.cmc,
        masa_maxima_kg: v.masaKg,
        numar_locuri: v.locuri,
        consum_mediu_declarat: v.consum,
        km_curent: v.km,
        employee_id: v.angajat,
        department_id: v.departament,
        status: v.status,
        data_achizitie: v.achizitie,
        valoare_achizitie: v.valoare,
        observatii: v.observatii ?? null,
        ...AUTOR,
      },
    );
  }
  console.log(
    `  · vehicles: ${String(VEHICULE.length)} (3 autoturisme, 3 autoutilitare, 1 în service)`,
  );

  let numarDocumente = 0;
  for (const [nr, documente] of Object.entries(DOCUMENTE_FLOTA)) {
    for (const d of documente) {
      await asigura(
        "vehicle_documents",
        {
          organization_id: ORG,
          vehicle_id: vehiculDupaNumar[nr],
          document_type_id: TIP_DOCUMENT[d.tip],
        },
        { valabil_de_la: d.de, expira_la: d.la, cost: d.cost, emitent: d.emitent, ...AUTOR },
      );
      numarDocumente += 1;
    }
  }
  console.log(`  · vehicle_documents: ${String(numarDocumente)}`);

  for (const f of FOI_PARCURS) {
    /*
     * Foaia se inserează DIRECT în starea finală. Politica `foi_insert` cere
     * status='draft', dar `service_role` are BYPASSRLS, deci politica nu se
     * aplică; triggerul, care se aplică, verifică tranziții doar la UPDATE.
     * `aprobat_de`/`aprobat_la` NU se scriu singure: sub context de serviciu
     * `internal.foi_parcurs_inainte` sare peste ramura care le-ar completa.
     */
    const foaie = await asigura(
      "trip_sheets",
      { organization_id: ORG, numar: f.numar },
      {
        vehicle_id: vehiculDupaNumar[f.vehicul],
        employee_id: f.angajat,
        plecare_la: f.plecare,
        sosire_la: f.sosire,
        km_plecare: f.kmPlecare,
        km_sosire: f.kmSosire,
        traseu: f.traseu,
        scop: f.scop,
        status: f.status,
        trimis_la: f.status === "draft" ? null : f.sosire,
        aprobat_de: f.status === "aprobat" ? CONT.ionescu : null,
        aprobat_la: f.status === "aprobat" ? f.sosire : null,
        ...AUTOR,
      },
    );

    if (f.alimentare === undefined) continue;
    // `pret_litru` e GENERATED ALWAYS: pomenirea ei în lista de coloane dă
    // 428C9 înaintea oricărei validări de business (capcana #22).
    await asigura(
      "fuel_entries",
      { organization_id: ORG, trip_sheet_id: foaie, numar_bon: f.alimentare.numarBon },
      {
        litri: f.alimentare.litri,
        cost: f.alimentare.cost,
        statie: f.alimentare.statie,
        alimentat_la: f.alimentare.la,
        plin: true,
        ...AUTOR,
      },
    );
  }
  console.log("  · trip_sheets: 8 (5 aprobate, 2 trimise, 1 ciornă), fuel_entries: 2");
}

// ── Inventar ────────────────────────────────────────────────────────────────

/** Categoriile de PLATFORMĂ (organization_id IS NULL). Nu se creează altele. */
const CATEGORIE = {
  laptop: "60799f84-01ee-4416-881d-4b4ee20c91f4",
  telefon: "d8fa8afc-5c22-457d-8c1d-69bf8d50d877",
  monitor: "4054827a-b8c5-41a5-9218-57c441bd194c",
  scule: "3cc9efde-fe09-4dd5-beb6-1a4396b18f14",
  mobilier: "33ffaf81-e9e5-4da6-9281-bfb8507cb9a4",
};

/**
 * Obiectele de inventar.
 *
 * `status` se trimite DOAR pentru obiectele care NU primesc alocare:
 * `internal.inventory_items_valideaza` refuză cu P0001 orice rând al cărui
 * status contrazice existența unei predări-primiri deschise — la a doua rulare,
 * un `status: "in_stoc"` trimis peste un obiect deja alocat ar rupe scriptul.
 * Pentru cele alocate, statusul îl pune singur `internal.inventory_alloc_propaga`.
 */
const OBIECTE = [
  {
    numar: "IT-014",
    denumire: "Laptop Dell Latitude 5540",
    categorie: CATEGORIE.laptop,
    serie: "5CG34829XY",
    model: "Latitude 5540",
    producator: "Dell",
    achizitie: "2021-11-15",
    valoare: 4500,
    garantie: "2024-11-15",
    stare: "uzat",
    status: "casat",
    locatie: "Depozit IT — scos din uz",
    observatii:
      "Retras din inventar după aproximativ patru ani de utilizare; performanțe sub necesarul actual.",
  },
  {
    numar: "IT-015",
    denumire: "Laptop Lenovo ThinkPad E14",
    categorie: CATEGORIE.laptop,
    serie: "PF3K8821",
    model: "ThinkPad E14",
    producator: "Lenovo",
    achizitie: "2024-03-01",
    valoare: 3800,
    garantie: "2027-03-01",
    stare: "bun",
    locatie: "La deținătorul curent",
  },
  {
    numar: "IT-016",
    denumire: "Laptop Dell Latitude 5540",
    categorie: CATEGORIE.laptop,
    serie: "5CG41207QZ",
    model: "Latitude 5540",
    producator: "Dell",
    achizitie: "2025-01-20",
    valoare: 4200,
    garantie: "2028-01-20",
    stare: "nou",
    locatie: "La deținătorul curent",
  },
  {
    numar: "IT-017",
    denumire: "Laptop HP ProBook 450 G9",
    categorie: CATEGORIE.laptop,
    serie: "5CD2431XKQ",
    model: "ProBook 450 G9",
    producator: "HP",
    achizitie: "2023-06-10",
    valoare: 3600,
    garantie: "2026-06-10",
    stare: "defect",
    status: "in_reparatie",
    locatie: "Service extern — Depanero SRL",
    observatii: "Placă de bază defectă; în service extern, în așteptarea devizului.",
  },
  {
    numar: "TEL-021",
    denumire: "Telefon mobil Samsung Galaxy A55",
    categorie: CATEGORIE.telefon,
    serie: "R58N123ABCD",
    model: "Galaxy A55",
    producator: "Samsung",
    achizitie: "2025-03-05",
    valoare: 1800,
    garantie: "2027-03-05",
    stare: "bun",
    locatie: "La deținătorul curent",
  },
  {
    numar: "TEL-022",
    denumire: "Telefon mobil Samsung Galaxy A55",
    categorie: CATEGORIE.telefon,
    serie: "R58N456EFGH",
    model: "Galaxy A55",
    producator: "Samsung",
    achizitie: "2025-03-05",
    valoare: 1800,
    garantie: "2027-03-05",
    stare: "bun",
    locatie: "La deținătorul curent",
  },
  {
    numar: "MON-031",
    denumire: "Monitor Dell P2422H",
    categorie: CATEGORIE.monitor,
    serie: "CN-0P2422H-99123",
    model: "P2422H",
    producator: "Dell",
    achizitie: "2023-06-01",
    valoare: 950,
    garantie: "2026-06-01",
    stare: "bun",
    status: "in_stoc",
    locatie: "Depozit IT",
  },
  {
    numar: "SCL-041",
    denumire: "Trusă de scule electrician Bosch",
    categorie: CATEGORIE.scule,
    model: "Bosch Professional Set",
    producator: "Bosch",
    achizitie: "2024-05-15",
    valoare: 650,
    stare: "bun",
    locatie: "La deținătorul curent",
  },
  {
    numar: "MOB-051",
    denumire: "Birou ergonomic reglabil pe înălțime",
    categorie: CATEGORIE.mobilier,
    producator: "Nowy Styl",
    achizitie: "2024-09-01",
    valoare: 1450,
    stare: "nou",
    status: "in_stoc",
    locatie: "Depozit mobilier",
  },
];

/**
 * Predările-primiri.
 *
 * Constrângerea de excludere GiST `inventory_alloc_fara_suprapunere` interzice
 * două intervale suprapuse pe același obiect: a doua predare a laptopului
 * IT-015 începe STRICT după returnarea primei.
 *
 * Alocarea lui Pop Radu rămâne NECONFIRMATĂ intenționat — fără ea,
 * `/inventar/in-primire` e un ecran gol.
 */
const ALOCARI = [
  {
    obiect: "IT-015",
    angajat: ANGAJAT.stan,
    predat: "2024-03-01T09:00:00+03:00",
    returnat: "2025-01-15T17:00:00+03:00",
    starePredare: "nou",
    stareReturnare: "bun",
    confirmat: "2024-03-01T10:00:00+03:00",
  },
  {
    obiect: "IT-015",
    angajat: ANGAJAT.barbu,
    predat: "2025-01-20T09:00:00+03:00",
    starePredare: "bun",
    confirmat: "2025-01-20T11:30:00+03:00",
  },
  {
    obiect: "IT-016",
    angajat: ANGAJAT.nistor,
    predat: "2025-02-01T09:00:00+03:00",
    starePredare: "nou",
    confirmat: "2025-02-01T09:45:00+03:00",
  },
  {
    obiect: "TEL-021",
    angajat: ANGAJAT.pop,
    predat: "2026-09-01T10:00:00+03:00",
    starePredare: "bun",
    confirmat: null, // apare pe /inventar/in-primire
  },
  {
    obiect: "TEL-022",
    angajat: ANGAJAT.stan,
    predat: "2025-03-10T09:00:00+03:00",
    starePredare: "bun",
    confirmat: "2025-03-10T09:30:00+03:00",
  },
  {
    obiect: "SCL-041",
    angajat: ANGAJAT.dumitrescu,
    predat: "2024-05-20T09:00:00+03:00",
    starePredare: "bun",
    confirmat: "2024-05-20T09:15:00+03:00",
  },
];

/**
 * Inventarul: nouă obiecte pe cinci categorii și șase predări-primiri.
 *
 * `/inventar` avea un singur rând — un laptop casat, numit „VERIF-001", cu
 * observația „Obiect creat automat de verificatorul advers".
 *
 * ATENȚIE la ordine: `ticketing` REFOLOSEȘTE obiectele de aici (un tichet de
 * defecțiune cere o alocare DESCHISĂ către chiar solicitantul lui), deci etapa
 * asta rulează prima.
 */
async function inventar() {
  console.log("── Inventar");

  // Numărul de inventar e prima cheie naturală, deci se corectează ÎNAINTE de
  // `asigura`. Indexul `inventory_items_numar_uq` e TOTAL, iar tabela n-are
  // `deleted_at`: un număr greșit rămâne ocupat definitiv.
  await redenumeste("inventory_items", "numar_inventar", "VERIF-001", "IT-014");

  const obiectDupaNumar = {};
  for (const o of OBIECTE) {
    obiectDupaNumar[o.numar] = await asigura(
      "inventory_items",
      { organization_id: ORG, numar_inventar: o.numar },
      {
        category_id: o.categorie,
        denumire: o.denumire,
        serie: o.serie ?? null,
        model: o.model ?? null,
        producator: o.producator ?? null,
        data_achizitie: o.achizitie,
        valoare: o.valoare,
        garantie_expira: o.garantie ?? null,
        stare: o.stare,
        locatie: o.locatie,
        observatii: o.observatii ?? null,
        ...(o.status === undefined ? {} : { status: o.status }),
        ...AUTOR,
      },
    );
  }
  console.log(`  · inventory_items: ${String(OBIECTE.length)}`);

  /*
   * ⚠️ DEFECT DE GRANTURI, nereparat aici (ar fi DDL pe producție).
   *
   * `inventory_allocations` are triggerul AFTER `trg_inventory_allocations_60_checklist`
   * → `internal.sync_itemi_returnare_inventar()`, care NU e `SECURITY DEFINER`
   * și cheamă necondiționat `app.checklist_sincronizeaza_inventar(uuid, uuid)`.
   * Funcția aceea e acordată în `0014_checklist.sql` DOAR lui `authenticated`
   * (linia 338), deci ORICE scriere pe `inventory_allocations` făcută prin
   * `service_role` cade cu 42501 „permission denied for function
   * checklist_sincronizeaza_inventar”. Interfața vie nu e afectată — ea scrie
   * ca `authenticated` — dar orice script, seed sau rută cu
   * `createAdminSupabase()` este.
   *
   * Reparația e o singură linie, într-o migrare nouă:
   *   grant execute on function app.checklist_sincronizeaza_inventar(uuid, uuid) to service_role;
   *
   * Până atunci: rândurile existente nu se ating (deci scriptul rămâne
   * idempotent), iar o inserare nouă va cădea explicit, cu mesajul de mai sus.
   */
  for (const a of ALOCARI) {
    await asiguraDacaLipseste(
      "inventory_allocations",
      {
        organization_id: ORG,
        item_id: obiectDupaNumar[a.obiect],
        employee_id: a.angajat,
        predat_la: a.predat,
      },
      {
        returnat_la: a.returnat ?? null,
        stare_la_predare: a.starePredare,
        stare_la_returnare: a.stareReturnare ?? null,
        confirmat_de_angajat_la: a.confirmat ?? null,
        ...AUTOR,
      },
    );
  }
  console.log(`  · inventory_allocations: ${String(ALOCARI.length)}`);
}

// ── Ticketing ───────────────────────────────────────────────────────────────

/**
 * Cele nouă tichete, câte unul pentru fiecare valoare din `ticket_status`.
 *
 * Trei CHECK-uri leagă starea de tip și nu se pot ocoli:
 *   · `tickets_aprobare_ck` fixează `aprobare_ceruta = tip in (software, hardware)`;
 *   · `tickets_status_aprobare_ck` cere `aprobare_ceruta` pentru `in_aprobare`
 *     și `respins` — deci acele două stări NU pot fi defecțiune sau bug;
 *   · `tickets_closed_ck` acceptă `closed_at` doar la `inchis`, `anulat`,
 *     `respins`; pe `rezolvat` rămâne NULL.
 *
 * Tichetele se inserează DIRECT în starea finală: triggerul de tranziție cere o
 * sesiune reală (`app.fisa_mea()`), pe care un script prin `service_role` n-o
 * are. Parcursul se reconstituie manual în `ticket_history`, altfel fișa unui
 * tichet închis n-ar avea nicio urmă a drumului.
 */
const TICHETE = [
  {
    numar: "IT-2026-00001",
    tip: "bug_erp",
    solicitant: ANGAJAT.georgescu,
    departament: DEPARTAMENT.productie,
    status: "inchis",
    titlu: "Exportul fișei de pontaj generează un PDF gol",
    descriere:
      "La exportul fișei lunare de pontaj se descarcă un PDF de o pagină, complet alb. Se întâmplă de fiecare dată, pentru orice lună aleasă.",
    modul: "pontaj",
    pasi: "Am deschis Pontaj → luna august 2026, am apăsat „Export PDF” și am salvat fișierul propus de browser.",
    asteptat: "Un PDF cu tabelul de prezență al lunii, cu totalurile pe fiecare angajat.",
    obtinut: "Un PDF de o pagină, complet alb, de 4 KB.",
    context: {
      url: "/pontaj?luna=2026-08",
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0",
      versiune_aplicatie: "2026.7.1",
    },
    creatLa: "2026-07-08T16:20:00+03:00",
    inchisLa: "2026-07-14T09:00:00+03:00",
    asignat: ANGAJAT.ionescu,
    creatDe: CONT.georgescu,
  },
  {
    numar: "IT-2026-00002",
    tip: "software",
    solicitant: ANGAJAT.marin,
    departament: DEPARTAMENT.administrativ,
    status: "rezolvat",
    titlu: "Licență SmartBill pentru facturarea lunară",
    descriere:
      "Am nevoie de acces la SmartBill pentru emiterea facturilor către clienți. Până acum le-am întocmit manual, în tabel.",
    aplicatie: "SmartBill",
    licente: 1,
    motivNecesitate:
      "Facturarea manuală consumă aproximativ o zi pe lună și a produs deja două erori de TVA.",
    aprobatDe: ANGAJAT.ionescu,
    decizieLa: "2026-08-15T11:00:00+03:00",
    creatLa: "2026-08-14T09:15:00+03:00",
    asignat: ANGAJAT.ionescu,
    creatDe: CONT.marin,
  },
  {
    numar: "IT-2026-00003",
    tip: "hardware",
    solicitant: ANGAJAT.barbu,
    departament: DEPARTAMENT.vanzari,
    status: "respins",
    titlu: "Monitor suplimentar de 24 de inchi pentru postul de lucru",
    descriere:
      "Lucrez în paralel cu oferta și cu fișa clientului; pe un singur ecran comut permanent între ele.",
    hardware: 'Monitor Dell 24"',
    locLivrare: "birou",
    costEstimat: 950,
    aprobatDe: ANGAJAT.ionescu,
    decizieLa: "2026-08-20T15:00:00+03:00",
    motivRespingere:
      "Bugetul de hardware pe trimestrul acesta este epuizat; cererea se reia în trimestrul următor.",
    inchisLa: "2026-08-20T15:00:00+03:00",
    creatLa: "2026-08-19T11:00:00+03:00",
  },
  {
    numar: "IT-2026-00004",
    tip: "bug_erp",
    solicitant: ANGAJAT.nistor,
    departament: DEPARTAMENT.vanzari,
    status: "in_asteptare",
    titlu: "Diurna nu se calculează corect pentru ziua de întoarcere",
    descriere:
      "La o deplasare încheiată la ora 11:00, ultima zi apare cu diurnă întreagă, deși plecarea a fost înainte de prânz.",
    modul: "diurna",
    pasi: "Am înregistrat deplasarea 18–20 august, cu întoarcere la 11:00, și am deschis calculul de diurnă.",
    asteptat: "Ultima zi socotită parțial, conform regulamentului intern.",
    obtinut: "Ultima zi socotită întreagă, cu 3 zile de diurnă în loc de 2,5.",
    context: {
      url: "/diurna/deplasari",
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0",
      versiune_aplicatie: "2026.8.2",
    },
    creatLa: "2026-08-24T14:30:00+03:00",
    asignat: ANGAJAT.ionescu,
  },
  {
    numar: "IT-2026-00005",
    tip: "hardware",
    solicitant: ANGAJAT.nistor,
    departament: DEPARTAMENT.vanzari,
    status: "anulat",
    titlu: "Căști cu microfon pentru apelurile cu clienții",
    descriere: "Apelurile lungi din difuzorul laptopului se aud prost la celălalt capăt.",
    hardware: "Căști cu microfon pentru apeluri",
    locLivrare: "birou",
    // Retras înainte de decizie: `tickets_decizie_ck` acceptă perechea
    // (decizie_la, aprobat_de_employee_id) doar goală sau completă.
    inchisLa: "2026-08-27T09:00:00+03:00",
    creatLa: "2026-08-26T10:00:00+03:00",
  },
  {
    numar: "IT-2026-00006",
    tip: "bug_erp",
    solicitant: ANGAJAT.pop,
    departament: DEPARTAMENT.productie,
    status: "redeschis",
    titlu: "Pontajul de noapte se salvează cu ziua greșită",
    descriere:
      "Schimbul de noapte, început la 22:00 și încheiat la 6:00, apare integral pe ziua următoare. A fost reparat o dată, dar de săptămâna trecută se întâmplă din nou.",
    modul: "pontaj",
    pasi: "Am înregistrat prezența pentru schimbul de noapte 26–27 august și am deschis fișa lunară a echipei.",
    asteptat: "Orele împărțite între cele două zile, după ora reală de început.",
    obtinut: "Toate cele opt ore trecute pe 27 august, iar 26 august rămâne gol.",
    context: {
      url: "/pontaj/echipa?luna=2026-08",
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0",
      versiune_aplicatie: "2026.8.2",
    },
    creatLa: "2026-08-27T08:45:00+03:00",
    asignat: ANGAJAT.ionescu,
    creatDe: CONT.pop,
  },
  {
    numar: "IT-2026-00007",
    tip: "hardware",
    solicitant: ANGAJAT.dumitrescu,
    departament: DEPARTAMENT.productie,
    status: "in_lucru",
    titlu: "Imprimantă de etichete pentru linia de ambalare",
    descriere:
      "Etichetele de lot se scriu acum de mână, iar la ambalare se citesc greu. O imprimantă dedicată ar scurta operația și ar elimina confuziile de la expediție.",
    hardware: "Imprimantă de etichete Zebra ZD421",
    locLivrare: "birou",
    costEstimat: 2400,
    motivNecesitate: "Aproximativ 200 de etichete pe schimb, scrise manual.",
    aprobatDe: ANGAJAT.ionescu,
    decizieLa: "2026-09-01T09:00:00+03:00",
    creatLa: "2026-09-01T07:50:00+03:00",
    asignat: ANGAJAT.ionescu,
  },
  {
    numar: "IT-2026-00008",
    tip: "software",
    solicitant: ANGAJAT.georgescu,
    departament: DEPARTAMENT.productie,
    status: "in_aprobare",
    titlu: "Licență Microsoft Project pentru planificarea liniei",
    descriere:
      "Planificarea reorganizării liniei de ambalare se ține acum într-un tabel care nu arată dependențele dintre activități.",
    aplicatie: "Microsoft Project",
    licente: 1,
    motivNecesitate: "Proiectul de reorganizare a liniei are termen 15 septembrie.",
    prioritateManuala: true,
    prioritate: "ridicata",
    prioritateMotiv:
      "Necesar urgent pentru proiectul cu termen 15 septembrie, aprobat telefonic de directorul general.",
    creatLa: "2026-09-02T10:05:00+03:00",
    creatDe: CONT.georgescu,
  },
  {
    numar: "IT-2026-00009",
    tip: "bug_erp",
    solicitant: ANGAJAT.marin,
    departament: DEPARTAMENT.administrativ,
    status: "nou",
    titlu: "Adeverința de venit se generează fără număr de înregistrare",
    descriere:
      "Adeverințele emise din aplicație ies cu spațiul de număr necompletat, iar registratura le refuză. Le completăm de mână, ceea ce anulează avantajul generării automate.",
    modul: "documente",
    pasi: "Am generat o adeverință de venit pentru un coleg, din fișa lui, și am deschis PDF-ul rezultat.",
    asteptat: "Numărul de înregistrare completat automat, din registrul de documente.",
    obtinut: "Câmpul „Nr. înregistrare” apare gol, cu linie punctată.",
    context: {
      url: "/documente/adeverinte",
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0",
      versiune_aplicatie: "2026.9.1",
    },
    creatLa: "2026-09-04T15:10:00+03:00",
    creatDe: CONT.marin,
  },
];

/**
 * Parcursul fiecărui tichet, reconstituit manual.
 *
 * `internal.tickets_valideaza_tranzitia` scrie singur în `ticket_history`, dar
 * NUMAI pe UPDATE de status — iar tichetele de mai sus se nasc direct în starea
 * finală. Fără rândurile astea, fișa unui tichet închis ar arăta o stare fără
 * nicio istorie.
 *
 * `actor_user_id` rămâne NULL pentru angajații fără cont: Stan Cristina și
 * Nistor Vlad chiar nu au un `auth.users` de indicat.
 */
const ISTORIC_TICHETE = [
  {
    numar: "IT-2026-00001",
    de: "nou",
    la: "in_lucru",
    cand: "2026-07-09T09:30:00+03:00",
    actor: CONT.ionescu,
  },
  {
    numar: "IT-2026-00001",
    de: "in_lucru",
    la: "rezolvat",
    cand: "2026-07-13T16:00:00+03:00",
    actor: CONT.ionescu,
  },
  {
    numar: "IT-2026-00001",
    de: "rezolvat",
    la: "inchis",
    cand: "2026-07-14T09:00:00+03:00",
    actor: CONT.georgescu,
  },
  {
    numar: "IT-2026-00002",
    de: "in_aprobare",
    la: "in_lucru",
    cand: "2026-08-15T11:00:00+03:00",
    actor: CONT.ionescu,
  },
  {
    numar: "IT-2026-00002",
    de: "in_lucru",
    la: "rezolvat",
    cand: "2026-08-22T10:15:00+03:00",
    actor: CONT.ionescu,
  },
  {
    numar: "IT-2026-00003",
    de: "in_aprobare",
    la: "respins",
    cand: "2026-08-20T15:00:00+03:00",
    actor: CONT.ionescu,
  },
  {
    numar: "IT-2026-00004",
    de: "nou",
    la: "in_lucru",
    cand: "2026-08-25T09:00:00+03:00",
    actor: CONT.ionescu,
  },
  {
    numar: "IT-2026-00004",
    de: "in_lucru",
    la: "in_asteptare",
    cand: "2026-08-28T11:20:00+03:00",
    actor: CONT.ionescu,
  },
  {
    numar: "IT-2026-00005",
    de: "in_aprobare",
    la: "anulat",
    cand: "2026-08-27T09:00:00+03:00",
    actor: null,
  },
  {
    numar: "IT-2026-00006",
    de: "nou",
    la: "in_lucru",
    cand: "2026-08-28T08:10:00+03:00",
    actor: CONT.ionescu,
  },
  {
    numar: "IT-2026-00006",
    de: "in_lucru",
    la: "rezolvat",
    cand: "2026-08-30T15:40:00+03:00",
    actor: CONT.ionescu,
  },
  {
    numar: "IT-2026-00006",
    de: "rezolvat",
    la: "inchis",
    cand: "2026-09-03T09:00:00+03:00",
    actor: CONT.ionescu,
  },
  {
    numar: "IT-2026-00006",
    de: "inchis",
    la: "redeschis",
    cand: "2026-09-04T07:55:00+03:00",
    actor: CONT.pop,
  },
  {
    numar: "IT-2026-00007",
    de: "in_aprobare",
    la: "in_lucru",
    cand: "2026-09-01T09:00:00+03:00",
    actor: CONT.ionescu,
  },
];

const COMENTARII_TICHETE = [
  {
    numar: "IT-2026-00001",
    autor: ANGAJAT.ionescu,
    intern: false,
    continut:
      "Am identificat cauza: generatorul de PDF nu încărca fontul cu diacritice, iar pagina ieșea goală. Corecția e livrată în versiunea 2026.7.3.",
    cand: "2026-07-13T15:50:00+03:00",
  },
  {
    numar: "IT-2026-00004",
    autor: ANGAJAT.ionescu,
    intern: false,
    continut:
      "Puteți atașa o captură de ecran cu ecranul de calcul? Nu reușim să reproducem diferența din descriere.",
    cand: "2026-08-28T11:20:00+03:00",
  },
  {
    numar: "IT-2026-00006",
    autor: ANGAJAT.pop,
    intern: false,
    continut:
      "Problema a reapărut: pontajul schimbului de azi-noapte s-a salvat tot pe ziua următoare. Redeschid tichetul.",
    cand: "2026-09-04T07:50:00+03:00",
  },
  {
    numar: "IT-2026-00007",
    autor: ANGAJAT.ionescu,
    intern: true,
    continut: "Comandă plasată la furnizor, livrare estimată în trei zile lucrătoare.",
    cand: "2026-09-01T09:10:00+03:00",
  },
];

/**
 * Ticketing: coada IT, cu toate cele nouă stări acoperite.
 *
 * `/ticketing/coada` era complet goală, cu toate cifrele KPI pe zero.
 *
 * DEPINDE de etapa `inventar`: tichetele de defecțiune trec prin
 * `trg_tickets_valideaza_inventarul`, care cere o alocare DESCHISĂ a obiectului
 * chiar către solicitantul tichetului.
 */
async function ticketing() {
  console.log("── Ticketing");

  /*
   * `app.aloca_numar_tichet()` nu se uită la ce e deja în `tickets`: fără
   * rândul ăsta, primul tichet creat din interfață ar cere iar „IT-2026-00001"
   * și ar coliziona cu `tickets_numar_uq`.
   */
  await asigura(
    "document_sequences",
    { organization_id: ORG, document_type: "tichet_it", year: 2026 },
    { prefix: "IT", next_number: TICHETE.length + 1, padding: 5, ...AUTOR },
  );

  /*
   * ⚠️ DEFECT DE SCHEMĂ, nereparat aici (ar fi DDL pe producție).
   *
   * NICIUN tichet de tip `defectiune` nu se poate crea — nici din script, nici
   * din interfață. `tickets_defectiune_ck` cere `inventory_item_id` non-NULL
   * pentru tipul ăsta, iar `internal.tickets_valideaza_inventarul` (BEFORE
   * INSERT/UPDATE) caută obiectul cu:
   *
   *   from public.inventory_items i
   *   where i.id = new.inventory_item_id and i.deleted_at is null
   *
   * `inventory_items` NU are coloana `deleted_at` (indexul
   * `inventory_items_numar_uq` e total tocmai fiindcă tabela n-are ștergere
   * logică). Rezultatul e 42703 „column i.deleted_at does not exist”, un mesaj
   * care trimite investigația spre inventar, nu spre ticketing.
   *
   * Reparația e scoaterea condiției din funcție, într-o migrare nouă. Până
   * atunci, setul de mai jos acoperă toate cele nouă stări FĂRĂ tipul
   * `defectiune`; harta de mai jos rămâne, ca reactivarea să fie o singură
   * linie în `TICHETE` (câmpul `obiect`).
   */
  const { data: obiecte, error: eroareObiecte } = await db
    .from("inventory_items")
    .select("id, numar_inventar")
    .eq("organization_id", ORG);
  verifica("citire inventory_items", { error: eroareObiecte });
  const obiectDupaNumar = Object.fromEntries((obiecte ?? []).map((o) => [o.numar_inventar, o.id]));

  const tichetDupaNumar = {};
  for (const t of TICHETE) {
    tichetDupaNumar[t.numar] = await asigura(
      "tickets",
      { organization_id: ORG, numar_afisat: t.numar },
      {
        tip: t.tip,
        titlu: t.titlu,
        descriere: t.descriere,
        solicitant_employee_id: t.solicitant,
        department_id: t.departament,
        status: t.status,
        // `prioritate` e derivată de `internal.tickets_calculeaza_prioritatea`,
        // cu excepția suprascrierii manuale, care cere un motiv de min. 3 car.
        prioritate_manuala: t.prioritateManuala ?? false,
        ...(t.prioritateManuala === true
          ? { prioritate: t.prioritate, prioritate_motiv: t.prioritateMotiv }
          : {}),
        asignat_employee_id: t.asignat ?? null,
        inventory_item_id: t.obiect === undefined ? null : obiectDupaNumar[t.obiect],
        aprobare_ceruta: t.tip === "software" || t.tip === "hardware",
        aprobat_de_employee_id: t.aprobatDe ?? null,
        decizie_la: t.decizieLa ?? null,
        motiv_respingere: t.motivRespingere ?? null,
        aplicatie: t.aplicatie ?? null,
        motiv_necesitate: t.motivNecesitate ?? null,
        numar_licente: t.licente ?? null,
        denumire_hardware: t.hardware ?? null,
        loc_livrare: t.locLivrare ?? null,
        cost_estimat: t.costEstimat ?? null,
        blocheaza_activitatea: t.blocheaza ?? null,
        locatie: t.locatie ?? null,
        modul: t.modul ?? null,
        pasi_efectuati: t.pasi ?? null,
        rezultat_asteptat: t.asteptat ?? null,
        rezultat_obtinut: t.obtinut ?? null,
        context: t.context ?? null,
        closed_at: t.inchisLa ?? null,
        created_at: t.creatLa,
        created_by: t.creatDe ?? null,
        updated_by: CONT.ionescu,
      },
    );
  }
  console.log(`  · tickets: ${String(TICHETE.length)} (toate cele 9 stări)`);

  for (const h of ISTORIC_TICHETE) {
    await asigura(
      "ticket_history",
      {
        organization_id: ORG,
        ticket_id: tichetDupaNumar[h.numar],
        camp: "status",
        valoare_veche: h.de,
        valoare_noua: h.la,
      },
      { actor_user_id: h.actor, created_at: h.cand },
    );
  }
  console.log(`  · ticket_history: ${String(ISTORIC_TICHETE.length)}`);

  for (const c of COMENTARII_TICHETE) {
    await asigura(
      "ticket_comments",
      { organization_id: ORG, ticket_id: tichetDupaNumar[c.numar], autor_employee_id: c.autor },
      { continut: c.continut, intern: c.intern, created_at: c.cand, ...AUTOR },
    );
  }
  console.log(`  · ticket_comments: ${String(COMENTARII_TICHETE.length)}`);

  const urmaritori = [
    // HR urmărește defectele care afectează pontajul, deci și statul de plată.
    { numar: "IT-2026-00006", angajat: ANGAJAT.marin },
    // Șeful de echipă urmărește cererea subalternului lui.
    { numar: "IT-2026-00007", angajat: ANGAJAT.pop },
  ];
  for (const u of urmaritori) {
    await asigura(
      "ticket_watchers",
      { organization_id: ORG, ticket_id: tichetDupaNumar[u.numar], employee_id: u.angajat },
      { created_by: CONT.ionescu },
    );
  }
  console.log("  · ticket_watchers: 2");
}

// ── Anunțuri ────────────────────────────────────────────────────────────────

/**
 * Avizierul.
 *
 * `announcements` NU are `internal.set_actor` — doar `seteaza_updated_at`.
 * Fără `created_by` explicit, fiecare anunț ar arăta „Publicat de: —”, exact ca
 * rândul existent, scris de aplicația vie (care nici ea nu-l completează azi).
 */
const ANUNTURI = [
  {
    titlu: "Actualizare a politicii de securitate și acces în sediu",
    continut:
      "Începând cu 1 septembrie, accesul în sediu se face exclusiv pe baza ecusonului nominal. Ecusoanele se ridică de la biroul de resurse umane, între orele 9:00 și 15:00.\n\nPentru vizitatori se completează registrul de la recepție, iar însoțitorul din firmă rămâne responsabil pe toată durata vizitei. Vă rugăm să anunțați din timp vizitele programate, ca să pregătim ecusoanele temporare.\n\nEcusonul pierdut se anunță în aceeași zi: cardul se dezactivează imediat, iar înlocuirea se eliberează în maximum două zile lucrătoare.",
    fixat: true,
    publicat: "2026-08-25T08:00:00+03:00",
    expira: null,
    autor: CONT.ionescu,
  },
  {
    titlu: "Bun venit în echipă noilor colegi din Producție",
    continut:
      "Le urăm bun venit colegilor care ni s-au alăturat luna aceasta în departamentul Producție. În primele două săptămâni vor parcursă programul de integrare: instruirea de securitate a muncii, prezentarea liniei de ambalare și lucrul alături de un coleg cu experiență.\n\nDacă îi întâlniți prin hală, ajutați-i cu o îndrumare — primele zile într-o firmă nouă sunt mereu mai ușoare cu un coleg lângă tine.",
    fixat: false,
    publicat: "2026-09-01T09:00:00+03:00",
    expira: null,
    autor: CONT.marin,
  },
  {
    titlu: "Sondaj intern de satisfacție — completați până pe 10 septembrie",
    continut:
      "Am pregătit un chestionar scurt, de zece întrebări, despre condițiile de lucru, comunicarea în echipă și programul de lucru. Completarea durează în jur de cinci minute și este anonimă.\n\nRăspunsurile se strâng până pe 10 septembrie, iar concluziile se discută în ședința de departament din a doua jumătate a lunii. Linkul l-ați primit pe adresa de e-mail de serviciu.",
    fixat: false,
    publicat: "2026-09-02T10:00:00+03:00",
    expira: "2026-09-10T23:59:00+03:00",
    autor: CONT.marin,
  },
  {
    titlu: "Plan de evacuare actualizat — instruire obligatorie",
    continut:
      "Planul de evacuare a fost actualizat după reorganizarea halei de producție: s-a schimbat traseul de la linia de ambalare spre ieșirea de est și s-a mutat punctul de adunare.\n\nInstruirea se ține pe departamente, în a doua săptămână din septembrie. Programul exact urmează.",
    fixat: false,
    publicat: null, // ciornă: se vede DOAR cu announcements:update=all
    expira: null,
    autor: CONT.ionescu,
  },
  {
    titlu: "Zile libere de Sfântul Andrei și Ziua Națională — programul lunii noiembrie",
    continut:
      "30 noiembrie și 1 decembrie sunt zile libere legale. Cum ambele cad în cursul săptămânii, activitatea se reia pe 2 decembrie, după programul obișnuit.\n\nColegii din Producție care lucrează în schimburi vor primi planificarea până pe 15 noiembrie. Cererile de concediu din jurul acestor zile se depun cu cel puțin zece zile înainte, ca să putem acoperi schimburile.",
    fixat: false,
    publicat: "2026-08-28T08:00:00+03:00",
    expira: "2026-12-02T00:00:00+03:00",
    autor: CONT.ionescu,
  },
];

/**
 * Anunțuri: avizierul firmei.
 *
 * `/anunturi` avea un singur anunț, fără autor și nefixat.
 *
 * `announcement_reads.user_id` e NOT NULL cu FK spre `auth.users`: confirmările
 * de citire se pot pune DOAR pentru cei patru angajați cu cont. Lista de
 * confirmări rămâne astfel parțială — ceea ce e și realitatea unui avizier.
 */
async function anunturi() {
  console.log("── Anunțuri");

  // Rândul care exista deja e curat ca text, dar fără autor.
  await asigura(
    "announcements",
    { organization_id: ORG, titlu: "Program special de Sfânta Maria" },
    { created_by: CONT.marin, updated_by: CONT.marin },
  );

  const anuntDupaTitlu = {};
  for (const a of ANUNTURI) {
    anuntDupaTitlu[a.titlu] = await asigura(
      "announcements",
      { organization_id: ORG, titlu: a.titlu },
      {
        continut: a.continut,
        fixat: a.fixat,
        publicat_la: a.publicat,
        expira_la: a.expira,
        created_by: a.autor,
        updated_by: a.autor,
      },
    );
  }
  console.log(`  · announcements: ${String(ANUNTURI.length)} adăugate (una fixată, una ciornă)`);

  const citiri = [
    {
      titlu: ANUNTURI[0].titlu,
      angajat: ANGAJAT.ionescu,
      cont: CONT.ionescu,
      cand: "2026-08-25T08:30:00+03:00",
    },
    {
      titlu: ANUNTURI[0].titlu,
      angajat: ANGAJAT.pop,
      cont: CONT.pop,
      cand: "2026-08-25T10:12:00+03:00",
    },
    {
      titlu: ANUNTURI[0].titlu,
      angajat: ANGAJAT.marin,
      cont: CONT.marin,
      cand: "2026-08-25T11:00:00+03:00",
    },
    // Georgescu Ioana lipsește de pe anunțul fixat intenționat: lista de
    // confirmări trebuie să arate parțial, nu 100%.
    {
      titlu: ANUNTURI[1].titlu,
      angajat: ANGAJAT.georgescu,
      cont: CONT.georgescu,
      cand: "2026-09-01T09:20:00+03:00",
    },
  ];
  for (const c of citiri) {
    await asigura(
      "announcement_reads",
      { organization_id: ORG, announcement_id: anuntDupaTitlu[c.titlu], employee_id: c.angajat },
      { user_id: c.cont, citit_la: c.cand },
    );
  }
  console.log(`  · announcement_reads: ${String(citiri.length)}`);
}

// ── Cursuri ─────────────────────────────────────────────────────────────────

/*
 * Rândurile care existau deja în firma demo. `curatenie` le-a curățat textul,
 * aici primesc identitatea completă. Le refer prin `id`, nu prin `cod`: codul
 * se schimbă chiar în acest pas, iar o cheie naturală care se schimbă ar face
 * a doua rulare să insereze un duplicat în loc să actualizeze.
 */
const CURS_EXISTENT = "dc3c2a3f-e273-4f67-b90b-ddd42c719156";
const MATERIAL_EXISTENT = "95cef01e-1953-4b29-881e-756a2a927c34";
const VERSIUNE_EXISTENTA = "5369979f-45c6-47c6-9eac-672e17ec9a1a";

/**
 * Materialele din bibliotecă, în afară de cel existent (`regulament_intern`).
 *
 * `treapta_dovada` NU e liberă: `course_materials_parcurgere_ck` cere
 * `fel='video'` pentru treapta „parcurgere", iar `course_materials_link_ck`
 * interzice „parcurgere" pe un material din link. Un video măsurat ar avea deci
 * nevoie de un fișier REAL în bucket-ul `org-courses`, pe care un script de
 * seed nu-l poate încărca — de aceea toate videoclipurile de aici rămân pe
 * „bifa". Vezi raportul: e singura abatere de la specificație.
 *
 * `uuid` e fixat în cod, nu generat: calea fișierului intră în rând, iar un
 * uuid nou la fiecare rulare ar rescrie calea — adică ar strica idempotența
 * exact pe coloana pe care `internal.cursuri_versiune_imutabila` o îngheață
 * după publicare.
 */
const MATERIALE = [
  {
    cod: "protectia_datelor",
    titlu: "Protecția datelor cu caracter personal (GDPR)",
    descriere:
      "Principiile de prelucrare a datelor cu caracter personal și obligațiile fiecărui angajat.",
    fel: "pdf",
    sursa: "fisier",
    treapta: "bifa",
    autor: CONT.marin,
    versiune: {
      uuid: "6b1d0f42-6a37-4f0f-9a2e-8c1f5b2a7d31",
      nume: "protectia-datelor-gdpr.pdf",
      mime: "application/pdf",
      pagini: 6,
      nota: "Ediția în vigoare din ianuarie 2026",
    },
  },
  {
    cod: "cultura_organizationala",
    titlu: "Cultura organizațională Administrativo Demo",
    descriere: "Valorile companiei și așteptările privind colaborarea internă.",
    fel: "video",
    sursa: "fisier",
    treapta: "bifa",
    autor: CONT.ionescu,
    versiune: {
      uuid: "2a7e94c1-0d55-4f8b-9c63-71b0a4e2f508",
      nume: "cultura-organizationala.mp4",
      mime: "video/mp4",
      durata: 480,
      nota: "Filmare internă, august 2026",
    },
  },
  {
    cod: "tur_birou",
    titlu: "Tur virtual al sediului central",
    descriere: "Prezentarea birourilor pe departamente și a facilităților.",
    fel: "video",
    sursa: "link",
    treapta: "bifa",
    autor: CONT.ionescu,
    versiune: {
      furnizor: "vimeo",
      linkId: "927481563",
      codPrivat: "tv2026adm",
      durata: 300,
      nota: "Turul filmat după reamenajarea etajului doi",
    },
  },
  {
    cod: "confidentialitate_declaratie",
    titlu: "Declarație de confidențialitate și integritate",
    descriere: "Angajamentul scris privind protecția informațiilor confidențiale ale companiei.",
    fel: "pdf",
    sursa: "fisier",
    treapta: "declaratie",
    declaratieText:
      "Declar că am luat cunoștință de politica de confidențialitate a Administrativo Demo SRL și mă angajez să protejez informațiile confidențiale, datele clienților și secretele comerciale ale companiei, atât pe durata activității, cât și după încetarea acesteia.",
    autor: CONT.ionescu,
    versiune: {
      uuid: "c4f8b2d0-3e16-4a97-8b5d-9f0c1e7a4632",
      nume: "declaratie-confidentialitate.pdf",
      mime: "application/pdf",
      pagini: 1,
      nota: "Formular semnat electronic în portal",
    },
  },
  {
    cod: "test_protectia_datelor",
    titlu: "Verificarea cunoștințelor: protecția datelor",
    descriere: "Test grilă de patru întrebări pentru confirmarea înțelegerii politicii GDPR.",
    fel: "pdf",
    sursa: "fisier",
    treapta: "test",
    pragTest: 80,
    autor: CONT.marin,
    versiune: {
      uuid: "9d3a1c65-7b48-4e20-a1f9-58c2d6b03e74",
      nume: "test-protectia-datelor.pdf",
      mime: "application/pdf",
      pagini: 2,
      nota: "Grila de verificare, ediția 2026",
      intrebari: [
        {
          id: "q1",
          text: "Ce înseamnă GDPR?",
          optiuni: [
            { id: "o1", text: "Regulamentul general privind protecția datelor" },
            { id: "o2", text: "Un standard de calitate ISO" },
            { id: "o3", text: "O procedură de arhivare" },
          ],
        },
        {
          id: "q2",
          text: "Cui raportați o suspiciune de breșă de date?",
          optiuni: [
            { id: "o1", text: "Responsabilului cu protecția datelor" },
            { id: "o2", text: "Nimănui" },
            { id: "o3", text: "Direct clientului, fără aviz intern" },
          ],
        },
        {
          id: "q3",
          text: "Codurile numerice personale ale colegilor pot fi trimise prin e-mail neprotejat?",
          optiuni: [
            { id: "o1", text: "Nu, transmiterea cere protecție corespunzătoare" },
            { id: "o2", text: "Da, oricând" },
            { id: "o3", text: "Doar vinerea" },
          ],
        },
        {
          id: "q4",
          text: "Cât se păstrează datele candidaților respinși?",
          optiuni: [
            { id: "o1", text: "Cel mult doi ani" },
            { id: "o2", text: "Nelimitat" },
            { id: "o3", text: "O săptămână" },
          ],
        },
      ],
      chei: { q1: "o1", q2: "o1", q3: "o1", q4: "o1" },
    },
  },
  {
    cod: "ghid_echipamente_productie",
    titlu: "Ghid de operare a echipamentelor din producție",
    descriere:
      "Instrucțiuni practice pentru operarea corectă și în siguranță a utilajelor din secția de producție.",
    fel: "pdf",
    sursa: "fisier",
    treapta: "bifa",
    // Autor: șeful de echipă. Arată că managerul e producător de conținut, nu
    // doar aprobator.
    autor: CONT.pop,
    versiune: {
      uuid: "e07b5f13-8c24-4d6a-b0e8-2f91a3c47d5b",
      nume: "ghid-echipamente-productie.pdf",
      mime: "application/pdf",
      pagini: 4,
      nota: "Redactat de șeful de echipă, revizuit în august 2026",
    },
  },
];

/**
 * Cursurile. `C1` (integrare) e rândul existent, restul sunt noi.
 *
 * `termen_zile` are DEFAULT 30 în bază: pentru un curs fără termen se trimite
 * NULL explicit, altfel fiecare înrolare primește tăcut un termen de 30 de
 * zile calculat de `internal.cursuri_pregateste_inrolarea`.
 */
const CURSURI = [
  {
    id: CURS_EXISTENT,
    cod: "integrare_noi_angajati",
    denumire: "Integrare angajați noi: prezentare generală",
    descriere:
      "Parcurs introductiv pentru fiecare angajat nou: tur al sediului, regulamentul intern și cultura organizațională.",
    obligatoriu: true,
    valabilitateLuni: null,
    termenZile: 14,
    pragAvertizare: 7,
    publicat: "2026-08-18T09:00:00+03:00",
    autor: CONT.ionescu,
    lectii: ["tur_birou", "regulament_intern", "cultura_organizationala"],
  },
  {
    cod: "protectia_datelor_gdpr",
    denumire: "Protecția datelor cu caracter personal",
    descriere:
      "Obligațiile legale de prelucrare a datelor personale, cu verificarea cunoștințelor la final.",
    obligatoriu: true,
    valabilitateLuni: 24,
    termenZile: 30,
    pragAvertizare: 30,
    publicat: "2026-08-20T09:00:00+03:00",
    autor: CONT.marin,
    lectii: ["protectia_datelor", "test_protectia_datelor"],
  },
  {
    cod: "confidentialitate_si_etica",
    denumire: "Confidențialitate și etică în afaceri",
    descriere:
      "Angajamentul de confidențialitate și regulile de conduită în relația cu clienții și partenerii.",
    obligatoriu: true,
    valabilitateLuni: 12,
    termenZile: 21,
    pragAvertizare: 14,
    publicat: "2026-08-22T09:00:00+03:00",
    autor: CONT.ionescu,
    lectii: ["confidentialitate_declaratie"],
  },
  {
    cod: "siguranta_echipamente_productie",
    denumire: "Utilizarea în siguranță a echipamentelor din producție",
    descriere:
      "Ghid practic realizat de șeful de echipă pentru operarea corectă a utilajelor din secția de producție.",
    obligatoriu: true,
    valabilitateLuni: 12,
    termenZile: 14,
    pragAvertizare: 14,
    publicat: "2026-08-19T09:00:00+03:00",
    autor: CONT.pop,
    lectii: ["ghid_echipamente_productie"],
  },
  {
    cod: "tehnici_avansate_vanzare",
    denumire: "Tehnici avansate de vânzare",
    descriere: "Curs în pregătire pentru echipa de vânzări; materialele urmează să fie încărcate.",
    obligatoriu: false,
    valabilitateLuni: null,
    termenZile: 30,
    pragAvertizare: 30,
    // Nepublicat și FĂRĂ lecții, intenționat: lista trebuie să arate și un curs
    // în lucru. O înrolare pe el ar fi respinsă cu P0001.
    publicat: null,
    autor: CONT.ionescu,
    lectii: [],
  },
];

/** Cine e înrolat pe ce. `motiv` distinge atribuirea manuală de cea din regulă. */
const INROLARI = [
  {
    curs: "integrare_noi_angajati",
    angajat: "georgescu",
    la: "2026-08-18",
    motiv: "manual",
    autor: CONT.marin,
  },
  {
    curs: "integrare_noi_angajati",
    angajat: "nistor",
    la: "2026-08-25",
    motiv: "manual",
    autor: CONT.marin,
  },
  // Restul firmei a intrat pe C1 prin regula „toți angajații".
  {
    curs: "integrare_noi_angajati",
    angajat: "dumitrescu",
    la: "2026-08-18",
    motiv: "regula",
    autor: CONT.ionescu,
  },
  {
    curs: "integrare_noi_angajati",
    angajat: "ionescu",
    la: "2026-08-18",
    motiv: "regula",
    autor: CONT.ionescu,
  },
  {
    curs: "integrare_noi_angajati",
    angajat: "marin",
    la: "2026-08-18",
    motiv: "regula",
    autor: CONT.ionescu,
  },
  {
    curs: "integrare_noi_angajati",
    angajat: "pop",
    la: "2026-08-18",
    motiv: "regula",
    autor: CONT.ionescu,
  },
  {
    curs: "integrare_noi_angajati",
    angajat: "stan",
    la: "2026-08-18",
    motiv: "regula",
    autor: CONT.ionescu,
  },
  {
    curs: "integrare_noi_angajati",
    angajat: "barbu",
    la: "2026-08-18",
    motiv: "regula",
    autor: CONT.ionescu,
  },
  ...["barbu", "dumitrescu", "georgescu", "ionescu", "marin", "nistor", "pop", "stan"].map((a) => ({
    curs: "protectia_datelor_gdpr",
    angajat: a,
    la: "2026-08-20",
    motiv: "manual",
    autor: CONT.marin,
  })),
  ...["ionescu", "pop", "barbu"].map((a) => ({
    curs: "confidentialitate_si_etica",
    angajat: a,
    la: "2026-08-22",
    motiv: "manual",
    autor: CONT.ionescu,
  })),
  ...["pop", "dumitrescu", "georgescu", "stan"].map((a) => ({
    curs: "siguranta_echipamente_productie",
    angajat: a,
    la: "2026-08-19",
    motiv: "manual",
    autor: CONT.pop,
  })),
];

/**
 * Ce a parcurs efectiv fiecare. Restul lecțiilor rămân „neinceput".
 *
 * Barbu, Dumitrescu, Nistor și Stan n-au cont: pentru ei se pot bifa plauzibil
 * doar lecțiile de tip „bifa", atestate de HR sau de șeful de echipă. O
 * declarație semnată sau un test dat în numele lor ar fi o minciună vizibilă.
 */
const PROGRES_CURSURI = [
  {
    curs: "integrare_noi_angajati",
    angajat: "georgescu",
    lectii: [
      { material: "tur_birou", cand: "2026-08-19T09:20:00+03:00" },
      { material: "regulament_intern", cand: "2026-08-19T09:45:00+03:00" },
      { material: "cultura_organizationala", cand: "2026-08-20T10:10:00+03:00", secunde: 480 },
    ],
  },
  {
    curs: "integrare_noi_angajati",
    angajat: "nistor",
    // Lecția „cultura_organizationala" rămâne neatinsă: înrolarea lui trebuie să
    // arate „în curs", nu finalizată.
    lectii: [
      { material: "tur_birou", cand: "2026-08-26T08:40:00+03:00" },
      { material: "regulament_intern", cand: "2026-08-26T09:05:00+03:00" },
    ],
  },
  {
    curs: "protectia_datelor_gdpr",
    angajat: "ionescu",
    lectii: [{ material: "protectia_datelor", cand: "2026-08-21T11:00:00+03:00" }],
  },
  {
    curs: "protectia_datelor_gdpr",
    angajat: "marin",
    // Testul rămâne nedat: înrolarea Elenei rămâne „în curs".
    lectii: [{ material: "protectia_datelor", cand: "2026-08-21T13:30:00+03:00" }],
  },
  {
    curs: "confidentialitate_si_etica",
    angajat: "ionescu",
    lectii: [
      {
        material: "confidentialitate_declaratie",
        cand: "2026-08-24T16:00:00+03:00",
        semnatura: "Ionescu Ana",
      },
    ],
  },
  {
    curs: "siguranta_echipamente_productie",
    angajat: "pop",
    lectii: [{ material: "ghid_echipamente_productie", cand: "2026-08-20T07:30:00+03:00" }],
  },
  {
    curs: "siguranta_echipamente_productie",
    angajat: "dumitrescu",
    lectii: [{ material: "ghid_echipamente_productie", cand: "2026-08-21T07:40:00+03:00" }],
  },
];

/**
 * Cursuri: bibliotecă, lecții, înrolări și parcurgere.
 *
 * `/cursuri` avea un singur curs nepublicat, fără nicio lecție și fără nicio
 * înrolare. Ordinea de aici e obligatorie, nu stilistică:
 * material → versiune → legarea versiunii curente → curs → lecții → înrolări.
 * `internal.cursuri_pregateste_inrolarea` respinge cu P0001 orice înrolare la
 * un curs nepublicat sau fără lecții, iar cheia compusă
 * `(versiune_curenta_id, organization_id)` nu e deferabilă.
 */
async function cursuri() {
  console.log("── Cursuri");

  // 1. Materialul care exista deja, plus versiunea lui publicată. Din versiune
  //    se pot atinge doar `fisier_nume` și `nota_versiune`: restul e înghețat
  //    de `internal.cursuri_versiune_imutabila` după publicare.
  await asigura(
    "course_materials",
    { id: MATERIAL_EXISTENT, organization_id: ORG },
    {
      cod: "regulament_intern",
      titlu: "Regulamentul intern de ordine interioară",
      descriere:
        "Programul de lucru, regulile de disciplină și conduita așteptată în cadrul companiei.",
      activ: true,
      updated_by: CONT.ionescu,
    },
  );
  await asigura(
    "course_material_versions",
    { id: VERSIUNE_EXISTENTA, organization_id: ORG },
    {
      fisier_nume: "regulament-intern.pdf",
      nota_versiune: "Versiunea în vigoare din ianuarie 2026",
      updated_by: CONT.ionescu,
    },
  );

  const material = { regulament_intern: MATERIAL_EXISTENT };
  const versiune = { regulament_intern: VERSIUNE_EXISTENTA };

  for (const m of MATERIALE) {
    const id = await asigura(
      "course_materials",
      { organization_id: ORG, cod: m.cod },
      {
        titlu: m.titlu,
        descriere: m.descriere,
        fel: m.fel,
        sursa: m.sursa,
        treapta_dovada: m.treapta,
        procent_minim: m.procentMinim ?? null,
        prag_test: m.pragTest ?? null,
        declaratie_text: m.declaratieText ?? null,
        activ: true,
        created_by: m.autor,
        updated_by: m.autor,
      },
    );
    material[m.cod] = id;

    const v = m.versiune;
    const dinFisier = v.uuid !== undefined;
    const idVersiune = await asigura(
      "course_material_versions",
      { organization_id: ORG, material_id: id, versiune: 1 },
      {
        // Contractul de cale din `src/lib/media/cale.ts`, bucket `org-courses`.
        fisier_path: dinFisier ? `${ORG}/courses/${id}/v1-${v.uuid}-${v.nume}` : null,
        fisier_nume: dinFisier ? v.nume : null,
        fisier_mime: dinFisier ? v.mime : null,
        numar_pagini: v.pagini ?? null,
        durata_secunde: v.durata ?? null,
        link_furnizor: v.furnizor ?? null,
        link_id: v.linkId ?? null,
        link_cod_privat: v.codPrivat ?? null,
        nota_versiune: v.nota,
        intrebari: v.intrebari ?? null,
        publicata_la: "2026-08-18T09:00:00+03:00",
        created_by: m.autor,
        updated_by: m.autor,
      },
    );
    versiune[m.cod] = idVersiune;

    // Al treilea pas al lanțului: cheia compusă spre versiune nu e deferabilă,
    // deci materialul se leagă de versiune abia după ce versiunea există.
    await asigura(
      "course_materials",
      { id, organization_id: ORG },
      { versiune_curenta_id: idVersiune },
    );

    if (v.chei !== undefined) {
      await asigura(
        "course_answer_keys",
        { organization_id: ORG, version_id: idVersiune },
        { chei: v.chei, created_by: m.autor, updated_by: m.autor },
      );
    }
  }
  console.log(`  · course_materials: ${String(MATERIALE.length + 1)} (unul redenumit)`);
  console.log(
    `  · course_material_versions: ${String(MATERIALE.length + 1)}, course_answer_keys: 1`,
  );

  const curs = {};
  for (const c of CURSURI) {
    // Cursul existent se caută după `id`: codul lui se schimbă chiar acum.
    const cheie =
      c.id === undefined
        ? { organization_id: ORG, cod: c.cod }
        : { id: c.id, organization_id: ORG };
    const id = await asigura("courses", cheie, {
      cod: c.cod,
      denumire: c.denumire,
      descriere: c.descriere,
      obligatoriu: c.obligatoriu,
      valabilitate_luni: c.valabilitateLuni,
      termen_zile: c.termenZile,
      prag_avertizare_zile: c.pragAvertizare,
      publicat: c.publicat !== null,
      publicat_la: c.publicat,
      activ: true,
      created_by: c.autor,
      updated_by: c.autor,
    });
    curs[c.cod] = id;

    let ordine = 0;
    for (const codMaterial of c.lectii) {
      ordine += 1;
      await asigura(
        "course_items",
        { organization_id: ORG, course_id: id, material_id: material[codMaterial] },
        { ordine, obligatoriu: true, created_by: c.autor, updated_by: c.autor },
      );
    }
  }
  console.log(`  · courses: ${String(CURSURI.length)} (patru publicate, unul în lucru)`);
  console.log(
    `  · course_items: ${String(CURSURI.reduce((n, c) => n + c.lectii.length, 0))} lecții`,
  );

  // Regula de atribuire automată. Nu declanșează nimic singură — înrolările
  // pe care le-ar fi produs sunt inserate mai jos cu `motiv='regula'`, fiindcă
  // `internal.cursuri_aplica_regulile` nu e apelabilă prin PostgREST (schema
  // `internal` nu e expusă).
  await asigura(
    "course_assignment_rules",
    { organization_id: ORG, course_id: curs["integrare_noi_angajati"], criteriu: "toti" },
    { decalaj_zile: 0, termen_zile: null, activ: true, ...AUTOR },
  );
  console.log("  · course_assignment_rules: 1 (toți angajații, pe cursul de integrare)");

  const inrolare = {};
  for (const i of INROLARI) {
    const id = await asigura(
      "course_enrollments",
      { organization_id: ORG, course_id: curs[i.curs], employee_id: ANGAJAT[i.angajat] },
      {
        motiv: i.motiv,
        atribuit_la: i.la,
        // `internal.cursuri_materializeaza` copiază `created_by` în toate
        // lecțiile materializate. NULL aici ar lăsa o sută de rânduri fără autor.
        created_by: i.autor,
        updated_by: i.autor,
      },
    );
    inrolare[`${i.curs}|${i.angajat}`] = id;
  }
  console.log(`  · course_enrollments: ${String(INROLARI.length)}`);

  let lectiiParcurse = 0;
  for (const p of PROGRES_CURSURI) {
    const idInrolare = inrolare[`${p.curs}|${p.angajat}`];
    for (const l of p.lectii) {
      const { error } = await db
        .from("course_enrollment_items")
        .update({
          status: "finalizat",
          finalizat_la: l.cand,
          deschis_la: l.cand,
          secunde_vizionate: l.secunde ?? 0,
          pozitie_secunde: l.secunde ?? 0,
          semnatura_nume: l.semnatura ?? null,
          semnat_la: l.semnatura === undefined ? null : l.cand,
          updated_by: CONT.ionescu,
        })
        .eq("organization_id", ORG)
        .eq("enrollment_id", idInrolare)
        .eq("material_id", material[l.material]);
      verifica(`progres ${p.curs}/${p.angajat}/${l.material}`, { error });
      lectiiParcurse += 1;
    }
  }
  console.log(`  · course_enrollment_items: ${String(lectiiParcurse)} lecții marcate finalizate`);

  /*
   * Testul Anei, dat pe calea reală: `internal.cursuri_evalueaza_incercarea`
   * compară răspunsurile cu `course_answer_keys` și calculează scorul, apoi
   * `cursuri_incercare_promovata` închide lecția. O încercare inserată de două
   * ori ar fi o a doua încercare reală, nu o repetare — de aceea
   * `asiguraDacaLipseste`, nu `asigura`.
   */
  const { data: lectiaTest, error: eroareLectie } = await db
    .from("course_enrollment_items")
    .select("id")
    .eq("organization_id", ORG)
    .eq("enrollment_id", inrolare["protectia_datelor_gdpr|ionescu"])
    .eq("material_id", material["test_protectia_datelor"])
    .maybeSingle();
  verifica("select lecția de test", { error: eroareLectie });
  if (lectiaTest !== null) {
    await asiguraDacaLipseste(
      "course_quiz_attempts",
      { organization_id: ORG, enrollment_item_id: lectiaTest.id },
      {
        employee_id: ANGAJAT.ionescu,
        version_id: versiune["test_protectia_datelor"],
        raspunsuri: { q1: "o1", q2: "o1", q3: "o1", q4: "o1" },
        created_by: CONT.ionescu,
      },
    );
    console.log("  · course_quiz_attempts: 1 (test promovat, dovada se scrie singură)");
  }
}

// ── Integrare și ieșire (onboarding) ────────────────────────────────────────

/** Șablonul existent, curățat de `curatenie` și reutilizat aici. */
const SABLON_INTEGRARE = "8fd6c448-8c29-4f8b-9fbc-86498f48e324";

/** Cele două instanțe pornite din șablonul GOL, înainte ca el să aibă pași. */
const INSTANTE_GOALE = [
  "5f440915-a3c2-43c4-a6a2-3c2be0bd9cc6",
  "6ed30b98-f595-4564-a853-6999b86dba29",
];

/**
 * Etapele celor două șabloane.
 *
 * `ordine` NU poate fi zero și NU poate fi negativă: pe lângă CHECK-ul
 * `-100..100 și <> 0` există și triggerul `internal.checklist_ordine_pozitiva`,
 * care ridică P0001 pe orice rând viu cu ordine sub zero. `termen_zile_relativ`
 * în schimb e legitim negativ — „cu cinci zile înainte de prima zi".
 */
const ETAPE_SABLON = {
  integrare: [
    { ordine: 1, titlu: "Înainte de prima zi", termen: -5 },
    { ordine: 2, titlu: "Prima zi", termen: 0 },
    { ordine: 3, titlu: "Prima săptămână", termen: 5 },
  ],
  iesire: [
    { ordine: 1, titlu: "Ultima săptămână", termen: -3 },
    { ordine: 2, titlu: "Ultima zi", termen: 0 },
  ],
};

/**
 * Pașii. `ordine` e unică pe ȘABLON, nu pe etapă.
 *
 * `responsabil_tip='subiect'` e forma corectă pentru „angajatul își bifează
 * singur pasul"; `rol` + `responsabil_rol='employee'` e capcana veche, care
 * produce un pas pe care nu-l poate bifa nimeni relevant.
 */
const PASI_SABLON = {
  integrare: [
    {
      ordine: 1,
      etapa: 1,
      titlu: "Pregătirea postului de lucru",
      tip: "rol",
      rol: "hr",
      termen: -5,
    },
    {
      ordine: 2,
      etapa: 1,
      titlu: "Predarea echipamentului de lucru (laptop, telefon)",
      tip: "rol",
      rol: "hr",
      termen: 0,
    },
    {
      ordine: 3,
      etapa: 1,
      titlu: "Crearea conturilor și a accesului la aplicații",
      tip: "rol",
      rol: "hr",
      termen: -2,
    },
    {
      ordine: 4,
      etapa: 2,
      titlu: "Citirea regulamentului intern de ordine interioară",
      tip: "subiect",
      termen: 1,
      material: MATERIAL_EXISTENT,
    },
    {
      ordine: 5,
      etapa: 2,
      titlu: "Parcurgerea cursului de integrare",
      tip: "subiect",
      termen: 7,
      verificare: "curs_finalizat",
      curs: CURS_EXISTENT,
    },
    {
      ordine: 6,
      etapa: 2,
      titlu: "Întâlnire de prezentare cu managerul direct",
      tip: "manager_direct",
      termen: 1,
    },
    {
      ordine: 7,
      etapa: 3,
      titlu: "Depunerea copiei actului de identitate",
      tip: "subiect",
      termen: 5,
      dovada: "document",
    },
    {
      ordine: 8,
      etapa: 3,
      titlu: "Declarație de confidențialitate și integritate",
      tip: "subiect",
      termen: 5,
      dovada: "semnatura",
    },
    {
      ordine: 9,
      etapa: 3,
      titlu: "Confirmarea finalizării integrării",
      tip: "rol",
      rol: "org_admin",
      termen: 10,
    },
  ],
  iesire: [
    {
      ordine: 1,
      etapa: 1,
      titlu: "Returnarea echipamentului și a bunurilor companiei",
      tip: "subiect",
      termen: -1,
      verificare: "inventar_returnat",
    },
    {
      ordine: 2,
      etapa: 1,
      titlu: "Predarea proiectelor în curs către înlocuitor",
      tip: "manager_direct",
      termen: -2,
    },
    {
      ordine: 3,
      etapa: 2,
      titlu: "Revocarea accesului la aplicațiile companiei",
      tip: "rol",
      rol: "hr",
      termen: 0,
    },
    {
      ordine: 4,
      etapa: 2,
      titlu: "Semnarea procesului-verbal de predare-primire",
      tip: "subiect",
      termen: 0,
      dovada: "semnatura",
    },
  ],
};

/**
 * Cele trei parcursuri pornite și starea în care se află.
 *
 * Pasul 4 (citirea regulamentului) NU se bifează direct: se inserează o
 * confirmare în `checklist_material_reads`, iar triggerul bifează el pasul —
 * altfel ar rămâne un pas „bifat" fără nicio citire în spate. Pasul 5 se
 * bifează singur la materializare, dacă angajatul are deja cursul finalizat.
 */
const PARCURSURI = [
  {
    angajat: "georgescu",
    data: "2026-08-18",
    citesteMaterialul: true,
    finalizeaza: true,
    pasi: [
      { ordine: 1, status: "bifat", cine: CONT.marin, cand: "2026-08-14T09:00:00+03:00" },
      { ordine: 2, status: "bifat", cine: CONT.marin, cand: "2026-08-18T08:30:00+03:00" },
      { ordine: 3, status: "bifat", cine: CONT.marin, cand: "2026-08-17T15:00:00+03:00" },
      { ordine: 6, status: "bifat", cine: CONT.pop, cand: "2026-08-18T11:00:00+03:00" },
      {
        ordine: 7,
        status: "neaplicabil",
        observatii:
          "Copia actului de identitate a fost preluată în format fizic și atașată la dosarul de personal.",
      },
      {
        ordine: 8,
        status: "bifat",
        cine: CONT.georgescu,
        cand: "2026-08-21T10:20:00+03:00",
        semnatura: "Georgescu Ioana",
      },
      { ordine: 9, status: "bifat", cine: CONT.ionescu, cand: "2026-08-28T16:00:00+03:00" },
    ],
  },
  {
    angajat: "nistor",
    data: "2026-08-25",
    citesteMaterialul: false,
    finalizeaza: false,
    // Fără cont, Vlad nu-și poate confirma singur citirea sau semnătura: pașii
    // „subiect" rămân de făcut, iar cursul lui e abia în curs.
    pasi: [
      { ordine: 1, status: "bifat", cine: CONT.marin, cand: "2026-08-21T09:00:00+03:00" },
      { ordine: 2, status: "bifat", cine: CONT.marin, cand: "2026-08-25T08:30:00+03:00" },
      { ordine: 3, status: "bifat", cine: CONT.marin, cand: "2026-08-24T14:00:00+03:00" },
      { ordine: 6, status: "bifat", cine: CONT.ionescu, cand: "2026-08-25T12:00:00+03:00" },
    ],
  },
  {
    angajat: "marin",
    data: "2026-09-01",
    citesteMaterialul: false,
    finalizeaza: false,
    // Niciun pas atins, deliberat: contrastul cu vechea instanță goală e „0 din
    // 9 pași reali", nu „0 din 0".
    pasi: [],
  },
];

/**
 * Onboarding: șabloane cu pași reali și trei parcursuri în derulare.
 *
 * `/onboarding` arăta „0 din 0 pași" — două instanțe pornite dintr-un șablon
 * care n-avea niciun pas. Astăzi `internal.checklist_pregateste_instanta`
 * refuză exact asta cu P0001, deci ordinea e obligatorie: pașii de șablon
 * ÎNAINTEA oricărei instanțe.
 *
 * Rulează DUPĂ `cursuri`: pasul „Parcurgerea cursului de integrare" se bifează
 * singur la materializare doar dacă angajatul are deja înrolarea finalizată.
 */
async function onboarding() {
  console.log("── Integrare (onboarding)");

  /*
   * Cele două instanțe goale nu se pot completa retroactiv: pașii se copiază o
   * singură dată, la creare. Le ascund cu `deleted_at`. Un UPDATE care atinge
   * DOAR `deleted_at` trece de `internal.checklist_verifica_finalizarea`,
   * fiindcă acela compară statusul vechi cu cel nou. Dovada imutabilă atașată
   * celei finalizate rămâne orfană în bază — asta nu se poate repara.
   */
  const { data: ascunse, error: eroareAscundere } = await db
    .from("checklist_instances")
    .update({ deleted_at: new Date().toISOString() })
    .eq("organization_id", ORG)
    .in("id", INSTANTE_GOALE)
    .is("deleted_at", null)
    .select("id");
  verifica("ascunderea instanțelor goale", { error: eroareAscundere });
  if ((ascunse ?? []).length > 0) {
    console.log(`  · checklist_instances: ${String(ascunse.length)} instanțe fără pași ascunse`);
  }

  const sablon = {
    integrare: await asigura(
      "checklist_templates",
      { id: SABLON_INTEGRARE, organization_id: ORG },
      {
        denumire: "Integrare angajat nou",
        descriere:
          "Parcurs standard pentru un angajat nou: pregătirea postului, predarea echipamentului, acces la aplicații, prezentarea companiei și confirmarea documentelor interne.",
        // Șablonul era legat de un departament și de o funcție care nu se
        // potriveau niciunui angajat real. Fără ele, se aplică întregii firme.
        department_id: null,
        job_position_id: null,
        valabil_pana_la: null,
        activ: true,
        updated_by: CONT.marin,
      },
    ),
    iesire: await asigura(
      "checklist_templates",
      { organization_id: ORG, denumire: "Predare la finalul contractului" },
      {
        tip: "offboarding",
        descriere:
          "Parcurs de ieșire: returnarea bunurilor companiei, revocarea accesului și confirmarea documentelor de încetare.",
        activ: true,
        valabil_de_la: "2026-01-01",
        created_by: CONT.marin,
        updated_by: CONT.marin,
      },
    ),
  };
  console.log("  · checklist_templates: 2 (integrare + ieșire)");

  const etapa = {};
  for (const [cheie, lista] of Object.entries(ETAPE_SABLON)) {
    for (const e of lista) {
      etapa[`${cheie}|${String(e.ordine)}`] = await asigura(
        "checklist_template_stages",
        { organization_id: ORG, template_id: sablon[cheie], ordine: e.ordine },
        {
          titlu: e.titlu,
          termen_zile_relativ: e.termen,
          created_by: CONT.marin,
          updated_by: CONT.marin,
        },
      );
    }
  }
  console.log("  · checklist_template_stages: 5");

  /*
   * Singurul loc din tot fișierul unde NU se scrie prin cheia de serviciu:
   * coloana generată `fel` cheamă `app.checklist_fel_derivat`, funcție pe care
   * `service_role` n-are drept s-o execute. Vezi `dbCaOrgAdmin`.
   */
  const caAdmin = await dbCaOrgAdmin();
  let pasiScrisi = 0;
  for (const [cheie, lista] of Object.entries(PASI_SABLON)) {
    for (const p of lista) {
      await asiguraPe(
        caAdmin,
        "checklist_template_items",
        { organization_id: ORG, template_id: sablon[cheie], ordine: p.ordine },
        {
          etapa_id: etapa[`${cheie}|${String(p.etapa)}`],
          titlu: p.titlu,
          responsabil_tip: p.tip,
          responsabil_rol: p.rol ?? null,
          responsabil_employee_id: null,
          termen_zile_relativ: p.termen,
          obligatoriu: true,
          tip_dovada: p.dovada ?? "bifa",
          verificare_automata: p.verificare ?? null,
          curs_id: p.curs ?? null,
          material_id: p.material ?? null,
        },
      );
      pasiScrisi += 1;
    }
  }
  console.log(`  · checklist_template_items: ${String(pasiScrisi)}`);

  let bifati = 0;
  let inchise = 0;
  for (const parcurs of PARCURSURI) {
    /*
     * Tot prin contul de org_admin, din două motive care se adună:
     * `internal.checklist_verifica_finalizarea` cheamă
     * `app.checklist_bunuri_nereturnate` fără SECURITY DEFINER, iar pașii
     * instanței au aceeași coloană generată `fel`. Niciuna dintre cele două
     * funcții nu e grantată lui `service_role`.
     */
    const idInstanta = await asiguraDacaLipsestePe(
      caAdmin,
      "checklist_instances",
      {
        organization_id: ORG,
        template_id: sablon.integrare,
        employee_id: ANGAJAT[parcurs.angajat],
      },
      { data_referinta: parcurs.data },
    );

    /*
     * O instanță ieșită din „in_curs" e ÎNGHEȚATĂ: `checklist_pregateste_pasul`
     * refuză orice atingere a pașilor ei. La a doua rulare, parcursul finalizat
     * al Ioanei e deja închis — de aceea se citește starea înainte, nu după.
     */
    const { data: stare, error: eroareStare } = await db
      .from("checklist_instances")
      .select("status")
      .eq("id", idInstanta)
      .single();
    verifica("select starea instanței", { error: eroareStare });
    if (stare.status !== "in_curs") {
      inchise += 1;
      continue;
    }

    for (const p of parcurs.pasi) {
      const { error } = await caAdmin
        .from("checklist_instance_items")
        .update({
          status: p.status,
          bifat_de: p.cine ?? null,
          bifat_la: p.cand ?? null,
          dovada: p.semnatura ?? null,
          observatii: p.observatii ?? null,
        })
        .eq("organization_id", ORG)
        .eq("instance_id", idInstanta)
        .eq("ordine", p.ordine);
      verifica(`bifare pas ${String(p.ordine)} (${parcurs.angajat})`, { error });
      bifati += 1;
    }

    if (parcurs.citesteMaterialul) {
      const { data: pasCitire, error: eroareCitire } = await db
        .from("checklist_instance_items")
        .select("id")
        .eq("organization_id", ORG)
        .eq("instance_id", idInstanta)
        .eq("ordine", 4)
        .maybeSingle();
      verifica("select pasul de citire", { error: eroareCitire });
      if (pasCitire !== null) {
        await asiguraDacaLipseste(
          "checklist_material_reads",
          { organization_id: ORG, instance_item_id: pasCitire.id },
          {
            employee_id: ANGAJAT[parcurs.angajat],
            material_id: MATERIAL_EXISTENT,
            citit_la: "2026-08-19T09:50:00+03:00",
            created_by: CONT.georgescu,
          },
        );
      }
    }

    if (parcurs.finalizeaza) {
      const { data: inchisa, error: eroareInchidere } = await caAdmin
        .from("checklist_instances")
        .update({
          status: "finalizata",
          finalizata_de: CONT.ionescu,
          finalizata_la: "2026-08-28T16:30:00+03:00",
        })
        .eq("id", idInstanta)
        .eq("organization_id", ORG)
        .select("id");
      verifica(`finalizare parcurs ${parcurs.angajat}`, { error: eroareInchidere });
      if ((inchisa ?? []).length > 0) inchise += 1;
    }
  }
  console.log(`  · checklist_instances: 3 parcursuri, ${String(inchise)} închis(e)`);
  console.log(`  · checklist_instance_items: ${String(bifati)} pași atinși manual`);
}

// ── Evaluări anuale ─────────────────────────────────────────────────────────

const SABLON_EVALUARE = {
  /** Șablonul firmei, duplicat din cel de platformă și rămas needitat. */
  firma: "c42a9194-fc4b-4a25-a387-023d4aa596cf",
  /** Șablonul de platformă (`organization_id` NULL), folosit o dată pentru varietate. */
  platforma: "38717ba5-e2be-4cb1-9552-40e823bac945",
};

/**
 * Criteriile, înghețate pe fiecare evaluare.
 *
 * Ambele șabloane au azi EXACT aceleași patru criterii, în aceeași ordine, la
 * versiunea 1 — de aceea `criterii_sablon` e identic pe toate rândurile, iar
 * `versiune_sablon` e 1 peste tot. `criterii_sablon` și `raspunsuri` au ambele
 * `check (jsonb_typeof(...) = 'array')`: un obiect gol în loc de tablou cade cu
 * 23514, fără să spună despre ce coloană e vorba.
 */
const CRITERII_EVALUARE = [
  {
    cod: "calitate_munca",
    denumire: "Calitatea muncii",
    descriere: null,
    tip: "scala",
    scala_max: 5,
    pondere: null,
  },
  {
    cod: "punctualitate",
    denumire: "Punctualitate și disciplină",
    descriere: null,
    tip: "scala",
    scala_max: 5,
    pondere: null,
  },
  {
    cod: "lucru_echipa",
    denumire: "Lucru în echipă",
    descriere: null,
    tip: "scala",
    scala_max: 5,
    pondere: null,
  },
  {
    cod: "initiativa",
    denumire: "Inițiativă și implicare",
    descriere: null,
    tip: "scala",
    scala_max: 5,
    pondere: null,
  },
];

/**
 * Cele șapte evaluări anuale. Ordinea scorurilor urmează ordinea criteriilor.
 *
 * Evaluatorul e managerul DIRECT: Ana pentru subordonații ei direcți (Radu,
 * Elena, Vlad, Alexandra), Radu pentru cei trei operatori din producție.
 */
const EVALUARI = [
  {
    angajat: "pop",
    sablon: "firma",
    evaluator: CONT.ionescu,
    data: "2026-08-11",
    scoruri: [5, 5, 4, 5],
    concluzie:
      "Radu conduce echipa de producție cu rezultate constante și este un exemplu de implicare zilnică. Obiectiv pentru trimestrul următor: să delege mai multe decizii operative către operatorii cu experiență.",
  },
  {
    angajat: "marin",
    sablon: "firma",
    evaluator: CONT.ionescu,
    data: "2026-08-11",
    scoruri: [5, 5, 5, 4],
    concluzie:
      "Elena gestionează impecabil procesele de resurse umane și comunică eficient cu toate departamentele. Recomand implicarea ei într-o inițiativă proprie de dezvoltare a echipei anul viitor.",
  },
  {
    angajat: "nistor",
    sablon: "firma",
    evaluator: CONT.ionescu,
    data: "2026-08-13",
    scoruri: [4, 3, 4, 4],
    concluzie:
      "Vlad și-a depășit constant obiectivele de vânzări în acest trimestru. Punctualitatea la raportările interne de vineri rămâne un punct de îmbunătățit.",
  },
  {
    angajat: "barbu",
    // Singura evaluare pe șablonul de platformă: lista trebuie să arate două
    // șabloane distincte pe coloana „Șablon".
    sablon: "platforma",
    evaluator: CONT.ionescu,
    data: "2026-08-13",
    scoruri: [4, 4, 5, 3],
    concluzie:
      "Alexandra colaborează foarte bine cu echipa și cu clienții și se adaptează rapid. O recomand pentru implicare directă în prospectarea de clienți noi din trimestrul viitor.",
  },
  {
    angajat: "dumitrescu",
    sablon: "firma",
    evaluator: CONT.pop,
    data: "2026-08-19",
    scoruri: [4, 5, 4, 3],
    concluzie:
      "Andrei respectă întotdeauna programul și procedurile de lucru din secție. Poate fi mai proactiv în semnalarea problemelor tehnice de pe linia de producție.",
  },
  {
    angajat: "georgescu",
    sablon: "firma",
    evaluator: CONT.pop,
    data: "2026-08-19",
    scoruri: [5, 4, 5, 4],
    concluzie:
      "Ioana are cea mai mică rată de rebuturi din echipă și ajută constant colegii noi. Performanță foarte bună, fără observații majore.",
  },
  {
    angajat: "stan",
    sablon: "firma",
    evaluator: CONT.pop,
    data: "2026-09-02",
    // Formular în lucru: două criterii din patru, fără concluzie.
    scoruri: [4, null, 4, null],
    concluzie: null,
    ciorna: true,
  },
];

/**
 * Evaluări anuale de performanță.
 *
 * `/evaluari` era complet gol. Șablonul firmei se redenumește ÎNAINTE de
 * inserare: numele lui apare pe fiecare rând din listă, iar „(copie)" ar fi
 * ajuns direct în poză.
 */
async function evaluari() {
  console.log("── Evaluări anuale");

  await redenumeste(
    "evaluation_templates",
    "denumire",
    "Evaluare anuală standard (copie)",
    "Evaluare anuală de performanță",
    { updated_by: CONT.ionescu },
  );

  for (const e of EVALUARI) {
    await asigura(
      "employee_evaluations",
      { organization_id: ORG, employee_id: ANGAJAT[e.angajat], data_evaluarii: e.data },
      {
        template_id: SABLON_EVALUARE[e.sablon],
        // `internal.set_actor` nu completează nimic fără `auth.uid()`: evaluatorul
        // și autorul se trimit explicit, altfel lista arată „Evaluator: —".
        evaluator_id: e.evaluator,
        criterii_sablon: CRITERII_EVALUARE,
        versiune_sablon: 1,
        raspunsuri: CRITERII_EVALUARE.map((c, i) => ({
          criteriu_cod: c.cod,
          scor: e.scoruri[i],
          raspuns_text: null,
          comentariu: null,
        })),
        concluzie: e.concluzie,
        status: e.ciorna === true ? "draft" : "finalizat",
        created_by: e.evaluator,
        updated_by: e.evaluator,
      },
    );
  }
  console.log(`  · employee_evaluations: ${String(EVALUARI.length)} (șase finalizate, una ciornă)`);
}

// ── KPI lunar ───────────────────────────────────────────────────────────────

/**
 * Seturile de indicatori, legate de funcție.
 *
 * `functie` trebuie să coincidă cu `employees.functie` după `lower(btrim(...))`
 * — `kpi_seturi.functie_norm` e coloană GENERATĂ exact așa, iar deschiderea
 * lunii caută setul prin ea. O literă în plus și luna nu se deschide pentru
 * nimeni, fără nicio eroare vizibilă.
 *
 * Doar cinci dintre cei opt angajați intră aici: Ionescu Ana e director
 * general, Marin Elena e specialist resurse umane, iar Pop Radu e șef de
 * echipă — niciunul dintre ei nu e nici agent de vânzări, nici operator.
 */
const SETURI_KPI = [
  {
    cheie: "vanzari",
    functie: "Agent de vânzări",
    denumire: "KPI agenți de vânzări",
    descriere:
      "Indicatori lunari pentru echipa de vânzări: activitate comercială, contracte și calitatea relației cu clienții.",
    indicatori: [
      {
        cod: "vizite_clienti",
        denumire: "Vizite la clienți",
        descriere: "Numărul de vizite comerciale efectuate în lună.",
        tip: "masurat",
        unitate: "vizite",
        sens: "crestere",
        tinta: 40,
        pondere: 30,
      },
      {
        cod: "contracte_semnate",
        denumire: "Contracte semnate",
        descriere: "Contracte noi sau reînnoite semnate în lună.",
        tip: "masurat",
        unitate: "contracte",
        sens: "crestere",
        tinta: 8,
        pondere: 40,
      },
      {
        cod: "rata_reclamatii",
        denumire: "Rata reclamațiilor de la clienți",
        descriere: "Procentul de comenzi cu reclamație din totalul comenzilor lunii.",
        tip: "masurat",
        unitate: "%",
        sens: "descrestere",
        tinta: 2,
        pondere: 15,
      },
      {
        cod: "atitudine_client",
        denumire: "Atitudine față de client",
        descriere: null,
        tip: "apreciat",
        scalaMax: 5,
        pondere: 15,
      },
    ],
  },
  {
    cheie: "productie",
    functie: "Operator producție",
    denumire: "KPI operatori producție",
    descriere:
      "Indicatori lunari pentru operatorii din producție: cantitate realizată, calitate și respectarea procedurilor.",
    indicatori: [
      {
        cod: "cantitate_produsa",
        denumire: "Cantitate produsă",
        descriere: "Bucăți realizate în lună, conform planului de producție.",
        tip: "masurat",
        unitate: "buc",
        sens: "crestere",
        tinta: 1200,
        pondere: 35,
      },
      {
        cod: "rata_rebuturi",
        denumire: "Rata de rebuturi",
        descriere: "Procentul de piese rebutate din producția lunii.",
        tip: "masurat",
        unitate: "%",
        sens: "descrestere",
        tinta: 2,
        pondere: 30,
      },
      {
        cod: "respectare_program",
        denumire: "Respectarea programului de lucru",
        descriere: null,
        tip: "apreciat",
        scalaMax: 5,
        pondere: 20,
      },
      {
        cod: "respectare_ssm",
        denumire: "Respectarea normelor de securitate a muncii",
        descriere: null,
        tip: "apreciat",
        scalaMax: 5,
        pondere: 15,
      },
    ],
  },
];

/** Abaterile de țintă, pe angajat. Zero e o țintă legitimă, deci `??`, nu `||`. */
const TINTE_KPI = [
  {
    angajat: "barbu",
    set: "vanzari",
    indicator: "contracte_semnate",
    tinta: 5,
    motiv: "Angajată din mai 2026 — obiectiv redus pe perioada de acomodare.",
  },
];

/**
 * Lunile completate. `valori` e `cod → realizat` la indicatorii măsurați și
 * `cod → notă` la cei apreciați; `null` înseamnă „necompletat", niciodată zero.
 */
const LUNI_KPI = [
  {
    angajat: "nistor",
    set: "vanzari",
    evaluator: CONT.ionescu,
    an: 2026,
    luna: 6,
    finalizatLa: "2026-07-03T17:00:00+03:00",
    valori: { vizite_clienti: 36, contracte_semnate: 7, rata_reclamatii: 1.8, atitudine_client: 4 },
  },
  {
    angajat: "nistor",
    set: "vanzari",
    evaluator: CONT.ionescu,
    an: 2026,
    luna: 7,
    finalizatLa: "2026-08-04T17:00:00+03:00",
    valori: { vizite_clienti: 39, contracte_semnate: 8, rata_reclamatii: 1.6, atitudine_client: 4 },
  },
  {
    angajat: "nistor",
    set: "vanzari",
    evaluator: CONT.ionescu,
    an: 2026,
    luna: 8,
    finalizatLa: "2026-09-03T17:00:00+03:00",
    concluzie: "Cea mai bună lună a lui Vlad de până acum — a depășit ținta la contracte semnate.",
    valori: { vizite_clienti: 41, contracte_semnate: 9, rata_reclamatii: 1.7, atitudine_client: 5 },
  },
  {
    angajat: "barbu",
    set: "vanzari",
    evaluator: CONT.ionescu,
    an: 2026,
    luna: 7,
    finalizatLa: "2026-08-04T17:00:00+03:00",
    valori: { vizite_clienti: 30, contracte_semnate: 4, rata_reclamatii: 2.2, atitudine_client: 4 },
  },
  {
    angajat: "barbu",
    set: "vanzari",
    evaluator: CONT.ionescu,
    an: 2026,
    luna: 8,
    finalizatLa: "2026-09-03T17:00:00+03:00",
    concluzie: "Progres vizibil față de luna trecută, mai ales la contracte semnate.",
    valori: { vizite_clienti: 34, contracte_semnate: 5, rata_reclamatii: 1.9, atitudine_client: 4 },
  },
  {
    angajat: "dumitrescu",
    set: "productie",
    evaluator: CONT.pop,
    an: 2026,
    luna: 7,
    finalizatLa: "2026-08-05T16:00:00+03:00",
    valori: {
      cantitate_produsa: 1150,
      rata_rebuturi: 1.8,
      respectare_program: 4,
      respectare_ssm: 5,
    },
  },
  {
    angajat: "dumitrescu",
    set: "productie",
    evaluator: CONT.pop,
    an: 2026,
    luna: 8,
    finalizatLa: "2026-09-04T16:00:00+03:00",
    valori: {
      cantitate_produsa: 1230,
      rata_rebuturi: 1.9,
      respectare_program: 4,
      respectare_ssm: 5,
    },
  },
  {
    angajat: "georgescu",
    set: "productie",
    evaluator: CONT.pop,
    an: 2026,
    luna: 6,
    finalizatLa: "2026-07-05T16:00:00+03:00",
    concluzie: "Cea mai bună producătoare a lunii, fără abateri de la procedură.",
    valori: {
      cantitate_produsa: 1260,
      rata_rebuturi: 1.7,
      respectare_program: 5,
      respectare_ssm: 5,
    },
  },
  {
    angajat: "georgescu",
    set: "productie",
    evaluator: CONT.pop,
    an: 2026,
    luna: 7,
    finalizatLa: "2026-08-05T16:00:00+03:00",
    valori: {
      cantitate_produsa: 1290,
      rata_rebuturi: 1.6,
      respectare_program: 5,
      respectare_ssm: 5,
    },
  },
  {
    angajat: "georgescu",
    set: "productie",
    evaluator: CONT.pop,
    an: 2026,
    luna: 8,
    finalizatLa: "2026-09-04T16:00:00+03:00",
    concluzie: "Ioana continuă seria de trei luni peste țintă.",
    valori: {
      cantitate_produsa: 1310,
      rata_rebuturi: 1.6,
      respectare_program: 5,
      respectare_ssm: 5,
    },
  },
  {
    angajat: "georgescu",
    set: "productie",
    evaluator: CONT.pop,
    an: 2026,
    luna: 9,
    // Luna curentă, deschisă și abia începută: o singură linie completată.
    // `status='draft'` cere `finalizat_la` NULL (kpi_evaluari_lunare_finalizat).
    finalizatLa: null,
    valori: {
      cantitate_produsa: null,
      rata_rebuturi: 1.1,
      respectare_program: null,
      respectare_ssm: null,
    },
    comentarii: { rata_rebuturi: "Sub prag la jumătatea lunii, foarte bine." },
  },
  {
    angajat: "stan",
    set: "productie",
    evaluator: CONT.pop,
    an: 2026,
    luna: 8,
    finalizatLa: "2026-09-02T16:00:00+03:00",
    concluzie:
      "Prima lună de evaluare KPI. Rezultate promițătoare, sub țintă la cantitate — normal pentru perioada de acomodare.",
    valori: {
      cantitate_produsa: 1050,
      rata_rebuturi: 2.6,
      respectare_program: 4,
      respectare_ssm: 4,
    },
  },
];

/** O zecimală, fără zgomotul de virgulă mobilă al lui `toFixed` + `Number`. */
function rotunjesteZecimal(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Procentul unei linii — aceeași formulă ca `procentLinie` din
 * `src/domain/evaluations/kpi.ts`.
 *
 * Baza NU calculează nimic aici: `kpi_valori.procent` și
 * `kpi_evaluari_lunare.scor_procent` se scriu de mână. O cifră inconsecventă cu
 * formula aplicației s-ar vedea direct în poză, de aceea se recalculează la
 * fiecare rulare în loc să fie scrisă în tabelul de mai sus.
 */
function procentLinieKpi(indicator, valoare) {
  if (valoare === null || valoare === undefined) return null;
  const incadreaza = (p) => rotunjesteZecimal(Math.min(Math.max(p, 0), 9999.9));
  if (indicator.tip === "apreciat") {
    return incadreaza(
      (Math.min(Math.max(valoare, 0), indicator.scalaMax) / indicator.scalaMax) * 100,
    );
  }
  const tinta = indicator.tintaEfectiva;
  if (indicator.sens === "descrestere") {
    if (tinta === 0) return valoare <= 0 ? 100 : 0;
    return incadreaza((2 - valoare / tinta) * 100);
  }
  if (tinta <= 0) return null;
  return incadreaza((valoare / tinta) * 100);
}

/** Media ponderată a liniilor completate, cu ponderile renormalizate. */
function scorLunarKpi(linii) {
  let suma = 0;
  let ponderi = 0;
  for (const l of linii) {
    if (l.procent === null) continue;
    suma += l.pondere * l.procent;
    ponderi += l.pondere;
  }
  return ponderi === 0 ? null : rotunjesteZecimal(suma / ponderi);
}

/**
 * KPI lunar: seturi pe funcție, indicatori, ținte și douăsprezece luni evaluate.
 *
 * `/evaluari/kpi` era complet gol. Ecranul filtrează implicit pe luna curentă,
 * deci o captură reprezentativă cere o lună încheiată în URL — de exemplu
 * `/evaluari/kpi?an=2026&luna=8`, unde stau cinci luni finalizate.
 */
async function kpi() {
  console.log("── KPI lunar");

  const indicator = {};
  for (const s of SETURI_KPI) {
    const idSet = await asigura(
      "kpi_seturi",
      { organization_id: ORG, functie: s.functie },
      { denumire: s.denumire, descriere: s.descriere, activ: true, ...AUTOR },
    );
    s.id = idSet;
    let ordine = -1;
    for (const i of s.indicatori) {
      ordine += 1;
      i.ordine = ordine;
      i.tintaEfectiva = i.tinta ?? null;
      i.id = await asigura(
        "kpi_indicatori",
        { organization_id: ORG, set_id: idSet, cod: i.cod },
        {
          denumire: i.denumire,
          descriere: i.descriere,
          tip: i.tip,
          unitate: i.unitate ?? null,
          sens: i.sens ?? null,
          tinta_implicita: i.tinta ?? null,
          scala_max: i.scalaMax ?? null,
          pondere: i.pondere,
          ordine,
          ...AUTOR,
        },
      );
      indicator[`${s.cheie}|${i.cod}`] = i;
    }
  }
  console.log(`  · kpi_seturi: ${String(SETURI_KPI.length)}, kpi_indicatori: 8`);

  const abatere = {};
  for (const t of TINTE_KPI) {
    await asigura(
      "kpi_tinte_angajat",
      {
        organization_id: ORG,
        employee_id: ANGAJAT[t.angajat],
        indicator_id: indicator[`${t.set}|${t.indicator}`].id,
      },
      { tinta: t.tinta, motiv: t.motiv, ...AUTOR },
    );
    abatere[`${t.angajat}|${t.indicator}`] = t.tinta;
  }
  console.log(`  · kpi_tinte_angajat: ${String(TINTE_KPI.length)}`);

  let linii = 0;
  for (const luna of LUNI_KPI) {
    const set = SETURI_KPI.find((s) => s.cheie === luna.set);
    const calculate = set.indicatori.map((i) => {
      const tinta = abatere[`${luna.angajat}|${i.cod}`] ?? i.tinta ?? null;
      const valoare = luna.valori[i.cod] ?? null;
      return {
        indicator: i,
        tinta,
        valoare,
        pondere: i.pondere,
        procent: procentLinieKpi({ ...i, tintaEfectiva: tinta }, valoare),
      };
    });
    const scor = scorLunarKpi(calculate);
    const finalizata = luna.finalizatLa !== null;

    const idLuna = await asigura(
      "kpi_evaluari_lunare",
      { organization_id: ORG, employee_id: ANGAJAT[luna.angajat], an: luna.an, luna: luna.luna },
      {
        set_id: set.id,
        status: finalizata ? "finalizat" : "draft",
        scor_procent: scor,
        concluzie: luna.concluzie ?? null,
        evaluator_id: luna.evaluator,
        finalizat_la: luna.finalizatLa,
        created_by: luna.evaluator,
        updated_by: luna.evaluator,
      },
    );

    for (const l of calculate) {
      const i = l.indicator;
      await asigura(
        "kpi_valori",
        { organization_id: ORG, evaluare_id: idLuna, cod: i.cod },
        {
          indicator_id: i.id,
          denumire: i.denumire,
          tip: i.tip,
          unitate: i.unitate ?? null,
          sens: i.sens ?? null,
          pondere: i.pondere,
          scala_max: i.scalaMax ?? null,
          tinta: i.tip === "masurat" ? l.tinta : null,
          ordine: i.ordine,
          realizat: i.tip === "masurat" ? l.valoare : null,
          nota: i.tip === "apreciat" ? l.valoare : null,
          procent: l.procent,
          comentariu: luna.comentarii?.[i.cod] ?? null,
          created_by: luna.evaluator,
          updated_by: luna.evaluator,
        },
      );
      linii += 1;
    }
  }
  console.log(
    `  · kpi_evaluari_lunare: ${String(LUNI_KPI.length)} (unsprezece finalizate, una ciornă)`,
  );
  console.log(`  · kpi_valori: ${String(linii)}`);
}

// ── Mentenanță ──────────────────────────────────────────────────────────────

/** Rândurile de mentenanță care existau deja, curățate mai jos. */
const ECHIPAMENT_EXISTENT = "76750e2a-8ddb-40d8-ad1f-004146a0a14a";
const INTERVENTIE_EXISTENTA = "f1f5d533-05e5-4f23-b677-a05a0cb7ad20";
const SESIZARE_EXISTENTA = "d93a45ab-db6a-4e6c-9c24-bd0d8c5edb64";

/**
 * Parcul de echipamente.
 *
 * ECH-002 e sub incidența ISCIR: `internal.ssm_iscir_guard` cere ca
 * responsabilul să aibă o autorizație nominală VALABILĂ, de tipul cerut, deja
 * în bază la momentul scrierii. Firma demo are două autorizații, puse de primul
 * val: Pop Radu — stivuitorist (2027), Dumitrescu Andrei — legător de sarcină
 * (2026). Responsabilul stivuitorului e deci Radu, nu Andrei; cu Andrei
 * inserarea ar fi căzut cu P0001, fiindcă „legator_de_sarcina" nu e
 * „stivuitorist".
 */
const ECHIPAMENTE = [
  {
    id: ECHIPAMENT_EXISTENT,
    cod: "ECH-001",
    denumire: "Compresor de aer Kaeser SK19",
    serie: "40211078",
    producator: "Kaeser Kompressoren",
    model: "SK19",
    an: 2019,
    locatie: "Hală producție",
    departament: DEPARTAMENT.productie,
    responsabil: "pop",
    status: "in_functiune",
    valoare: 18500,
    dinData: "2019-06-10",
  },
  {
    cod: "ECH-002",
    denumire: "Stivuitor electric Linde E16",
    serie: "E16-58231",
    producator: "Linde Material Handling",
    model: "E16",
    an: 2021,
    locatie: "Depozit materii prime",
    departament: DEPARTAMENT.productie,
    responsabil: "pop",
    status: "in_functiune",
    iscir: true,
    autorizare: "stivuitorist",
    valoare: 62000,
    dinData: "2021-03-15",
  },
  {
    cod: "ECH-003",
    denumire: "Mașină de găurit cu coloană Optimum B28H",
    producator: "Optimum Maschinen",
    model: "B28H",
    an: 2018,
    locatie: "Atelier mecanic",
    departament: DEPARTAMENT.productie,
    responsabil: "stan",
    status: "in_functiune",
    valoare: 7200,
    dinData: "2018-09-01",
  },
  {
    cod: "ECH-004",
    denumire: "Presă hidraulică de îndoit tablă HGT-40",
    producator: "Metalcut",
    model: "HGT-40",
    an: 2017,
    locatie: "Hală producție",
    departament: DEPARTAMENT.productie,
    responsabil: "pop",
    status: "in_reparatie",
    valoare: 24500,
    dinData: "2017-04-20",
  },
  {
    cod: "ECH-005",
    denumire: "Aparat de sudură MIG/MAG Lincoln Electric Powertec 305C",
    producator: "Lincoln Electric",
    model: "Powertec 305C",
    an: 2020,
    locatie: "Atelier sudură",
    departament: DEPARTAMENT.productie,
    responsabil: "dumitrescu",
    status: "in_functiune",
    valoare: 15800,
    dinData: "2020-02-10",
  },
  {
    cod: "ECH-006",
    denumire: "Generator electric de rezervă Hyundai DHY8000SE",
    producator: "Hyundai Power Products",
    model: "DHY8000SE",
    an: 2016,
    locatie: "Curte exterioară",
    departament: DEPARTAMENT.administrativ,
    responsabil: "marin",
    status: "in_conservare",
    valoare: 9800,
    dinData: "2016-11-05",
  },
  {
    cod: "ECH-007",
    denumire: "Centrală termică pe gaz Viessmann Vitodens 100-W",
    producator: "Viessmann",
    model: "Vitodens 100-W",
    an: 2015,
    locatie: "Centrala termică, sediu birouri",
    departament: DEPARTAMENT.administrativ,
    responsabil: "marin",
    status: "in_functiune",
    valoare: 6200,
    dinData: "2015-10-01",
  },
  {
    cod: "ECH-008",
    denumire: "Aparat de sudură prin puncte Telwin Point Star 5000",
    producator: "Telwin",
    model: "Point Star 5000",
    an: 2010,
    locatie: "Depozit echipamente scoase din uz",
    departament: DEPARTAMENT.productie,
    responsabil: null,
    status: "casat",
    valoare: 4200,
    dinData: "2010-05-01",
  },
];

/**
 * Citirile de contor, în ordine cronologică crescătoare.
 *
 * `internal.ssm_meter_guard` respinge o citire mai MICĂ decât ultima
 * înregistrată (egală trece) și orice dată în viitor.
 */
const CONTOARE = [
  {
    echipament: "ECH-001",
    cititor: "pop",
    citiri: [
      ["2026-06-01", 4050],
      ["2026-07-01", 4200],
      ["2026-08-01", 4450],
      ["2026-08-25", 4610],
    ],
  },
  {
    echipament: "ECH-002",
    cititor: "dumitrescu",
    citiri: [
      ["2026-06-01", 1650],
      ["2026-07-01", 1800],
      ["2026-08-01", 1950],
      ["2026-08-28", 2080],
    ],
  },
];

/**
 * Planurile de mentenanță.
 *
 * `urmatoarea_scadenta` NU se trimite: `internal.ssm_plan_calc` o calculează
 * din `coalesce(ultima_executie, AZI) + periodicitate_zile`. Consecința care
 * contează pentru poză: un plan FĂRĂ `ultima_executie` primește scadență în
 * viitor și nu poate apărea niciodată depășit — planurile care trebuie roșii
 * (B și F de mai jos) au deci o ultimă execuție îndeajuns de veche.
 */
const PLANURI = [
  {
    cheie: "A",
    echipament: "ECH-001",
    denumire: "Verificare și schimb ulei compresor",
    tip: "preventiva",
    zile: 90,
    ultima: "2026-06-15",
    responsabil: "pop",
    instructiuni:
      "Verificare nivel ulei, schimb filtru de aer și control al presiunii de lucru, conform manualului Kaeser.",
  },
  {
    cheie: "F",
    echipament: "ECH-001",
    denumire: "Verificare presiune și supapă de siguranță",
    tip: "preventiva",
    zile: 180,
    // Scadență calculată 2026-08-28: depășită. Fără nicio intervenție reușită
    // legată de plan, altfel `ssm_intervention_apply` i-ar muta ultima execuție.
    ultima: "2026-03-01",
    responsabil: "pop",
    instructiuni: "Control supapă de siguranță și etanșeitate a rezervorului sub presiune.",
  },
  {
    cheie: "B",
    echipament: "ECH-002",
    denumire: "Revizie tehnică stivuitor la 500 de ore",
    tip: "preventiva",
    contor: 500,
    tipContor: "ore",
    ultima: "2026-07-01",
    ultimaCitire: 1800,
    responsabil: "pop",
    instructiuni: "Verificare frâne, baterie de tracțiune, furci de ridicare și sistem hidraulic.",
  },
  {
    cheie: "C",
    echipament: "ECH-004",
    denumire: "Verificare anuală a etanșeității presei hidraulice",
    tip: "preventiva",
    zile: 365,
    // Scadență 2026-08-01: depășită, coerent cu echipamentul aflat în reparație.
    ultima: "2025-08-01",
    responsabil: "pop",
    instructiuni: "Control etanșeitate circuit hidraulic și presiune de lucru.",
  },
  {
    cheie: "D",
    echipament: "ECH-005",
    denumire: "Verificare tehnică a aparatului de sudură",
    tip: "preventiva",
    zile: 180,
    ultima: "2026-07-20",
    responsabil: "dumitrescu",
    instructiuni: "Verificare cabluri, conexiuni electrice și sistem de răcire.",
  },
  {
    cheie: "E",
    echipament: "ECH-007",
    denumire: "Curățare și verificare a centralei termice",
    tip: "preventiva",
    zile: 365,
    ultima: "2025-10-05",
    responsabil: "marin",
    instructiuni: "Curățare arzător, verificare etanșeitate și emisii ale gazelor de ardere.",
  },
];

/** Intervențiile. `cost_total` e coloană GENERATĂ — trimiterea ei dă 428C9. */
const INTERVENTII = [
  {
    id: INTERVENTIE_EXISTENTA,
    cheie: "existenta",
    echipament: "ECH-001",
    tip: "corectiva",
    data: "2026-08-13",
    descriere:
      "Înlocuire rulment motor și verificare etanșeitate presostat, în urma sesizării de zgomot anormal la pornire.",
    piese: 200,
    manopera: 100,
    rezultat: "reusita",
  },
  {
    cheie: "ulei",
    echipament: "ECH-001",
    plan: "A",
    tip: "preventiva",
    data: "2026-06-15",
    executant: "pop",
    descriere: "Schimb ulei compresor și filtru de aer, conform planului de mentenanță preventivă.",
    piese: 450,
    manopera: 200,
    rezultat: "reusita",
    contor: 4200,
  },
  {
    cheie: "revizie_stivuitor",
    echipament: "ECH-002",
    plan: "B",
    tip: "preventiva",
    data: "2026-07-01",
    extern: "Linde Service România",
    descriere:
      "Revizie tehnică la 1800 de ore: verificare frâne, baterie de tracțiune și furci de ridicare.",
    piese: 380,
    manopera: 250,
    rezultat: "reusita",
    contor: 1800,
  },
  {
    cheie: "presa",
    echipament: "ECH-004",
    tip: "corectiva",
    data: "2026-09-02",
    extern: "Hidraulica Service SRL",
    descriere:
      "Defecțiune la cilindrul hidraulic principal; piesă comandată, echipamentul rămâne oprit până la recepția piesei de schimb.",
    piese: 0,
    manopera: 0,
    rezultat: "amanata",
    oprire: 480,
  },
  {
    cheie: "generator",
    echipament: "ECH-006",
    tip: "preventiva",
    data: "2026-05-10",
    extern: "Electrogrup Service",
    descriere:
      "Pornire de probă lunară și verificare a nivelului de combustibil și de ulei la generatorul de rezervă.",
    piese: 0,
    manopera: 150,
    rezultat: "reusita",
  },
  {
    cheie: "centrala",
    echipament: "ECH-007",
    plan: "E",
    tip: "preventiva",
    data: "2025-10-05",
    extern: "Termoinstal Service",
    descriere: "Curățare arzător, verificare etanșeitate și emisii ale gazelor de ardere.",
    piese: 120,
    manopera: 180,
    rezultat: "reusita",
  },
  {
    cheie: "mandrina",
    echipament: "ECH-003",
    tip: "corectiva",
    data: "2026-08-27",
    executant: "stan",
    descriere:
      "Curățare și reglare a mandrinei, după sesizarea de strângere defectuoasă la diametre mari.",
    piese: 0,
    manopera: 80,
    rezultat: "partiala",
    observatii: "Reglaj temporar; se recomandă schimbarea mandrinei la următoarea revizie.",
  },
];

/**
 * Sesizările de defecțiune.
 *
 * `internal.ssm_fault_guard`: „rezolvat" cere `intervention_id`, „respins" cere
 * un motiv de cel puțin cinci caractere.
 */
const SESIZARI = [
  {
    id: SESIZARE_EXISTENTA,
    echipament: "ECH-001",
    raportor: "ionescu",
    descriere: "Zgomot anormal la pornirea compresorului, posibil rulment defect.",
    urgenta: "medie",
    status: "rezolvat",
    interventie: "existenta",
    opreste: false,
    la: "2026-08-18T17:11:00+03:00",
  },
  {
    echipament: "ECH-002",
    raportor: "dumitrescu",
    descriere:
      "Frâna de mână nu ține stivuitorul pe rampa de acces; risc de alunecare a paletului.",
    urgenta: "ridicata",
    status: "in_lucru",
    opreste: true,
    la: "2026-08-30T09:15:00+03:00",
  },
  {
    echipament: "ECH-004",
    raportor: "stan",
    descriere: "Scurgere de ulei hidraulic la baza cilindrului principal.",
    urgenta: "critica",
    status: "in_lucru",
    interventie: "presa",
    opreste: true,
    la: "2026-09-01T08:00:00+03:00",
  },
  {
    echipament: "ECH-005",
    raportor: "dumitrescu",
    descriere:
      "Cablul de masă al aparatului de sudură este uzat și produce arc electric intermitent.",
    urgenta: "medie",
    status: "nou",
    opreste: false,
    la: "2026-09-03T14:20:00+03:00",
  },
  {
    echipament: "ECH-003",
    raportor: "stan",
    descriere: "Mandrina mașinii de găurit nu mai strânge burghiul corect la diametre mari.",
    urgenta: "scazuta",
    status: "in_lucru",
    interventie: "mandrina",
    opreste: false,
    la: "2026-08-25T11:00:00+03:00",
  },
  {
    echipament: "ECH-007",
    raportor: "marin",
    descriere: "Miros de gaz sesizat lângă centrala termică.",
    urgenta: "critica",
    status: "respins",
    motiv:
      "Verificare la fața locului: nicio scurgere; mirosul provenea de la un produs de curățenie folosit în apropiere.",
    opreste: false,
    la: "2026-08-20T16:40:00+03:00",
  },
];

/**
 * Mentenanță: echipamente, contoare, planuri, intervenții și sesizări.
 *
 * `/mentenanta` avea toate cele patru panouri pe zero: un singur echipament
 * numit „Compresor verificare", nicio scadență, nicio citire de contor.
 */
async function mentenanta() {
  console.log("── Mentenanță");

  const echipament = {};
  for (const e of ECHIPAMENTE) {
    const cheie =
      e.id === undefined
        ? { organization_id: ORG, cod: e.cod }
        : { id: e.id, organization_id: ORG };
    echipament[e.cod] = await asigura("equipment", cheie, {
      cod: e.cod,
      denumire: e.denumire,
      serie: e.serie ?? null,
      producator: e.producator,
      model: e.model,
      an_fabricatie: e.an,
      locatie: e.locatie,
      department_id: e.departament,
      responsabil_employee_id: e.responsabil === null ? null : ANGAJAT[e.responsabil],
      status: e.status,
      este_iscir: e.iscir === true,
      tip_autorizare_necesara: e.autorizare ?? null,
      valoare_achizitie: e.valoare,
      data_punerii_in_functiune: e.dinData,
      ...AUTOR,
    });
  }
  console.log(`  · equipment: ${String(ECHIPAMENTE.length)} (unul redenumit, unul ISCIR)`);

  let citiri = 0;
  for (const c of CONTOARE) {
    for (const [data, valoare] of c.citiri) {
      await asigura(
        "equipment_meters",
        {
          organization_id: ORG,
          equipment_id: echipament[c.echipament],
          tip: "ore",
          data_citirii: data,
        },
        {
          citire: valoare,
          resetare_contor: false,
          sursa: "manual",
          citit_de_employee_id: ANGAJAT[c.cititor],
          ...AUTOR,
        },
      );
      citiri += 1;
    }
  }
  console.log(`  · equipment_meters: ${String(citiri)}`);

  const plan = {};
  for (const p of PLANURI) {
    plan[p.cheie] = await asigura(
      "maintenance_plans",
      { organization_id: ORG, equipment_id: echipament[p.echipament], denumire: p.denumire },
      {
        tip: p.tip,
        periodicitate_zile: p.zile ?? null,
        periodicitate_contor: p.contor ?? null,
        tip_contor: p.tipContor ?? null,
        ultima_executie: p.ultima,
        ultima_citire_contor: p.ultimaCitire ?? null,
        responsabil_employee_id: ANGAJAT[p.responsabil],
        instructiuni: p.instructiuni,
        activ: true,
        ...AUTOR,
      },
    );
  }
  console.log(`  · maintenance_plans: ${String(PLANURI.length)} (două depășite: C și F)`);

  const interventie = {};
  for (const i of INTERVENTII) {
    const cheie =
      i.id === undefined
        ? { organization_id: ORG, equipment_id: echipament[i.echipament], data: i.data }
        : { id: i.id, organization_id: ORG };
    interventie[i.cheie] = await asigura("maintenance_interventions", cheie, {
      equipment_id: echipament[i.echipament],
      plan_id: i.plan === undefined ? null : plan[i.plan],
      tip: i.tip,
      data: i.data,
      executant_employee_id: i.executant === undefined ? null : ANGAJAT[i.executant],
      executant_extern: i.extern ?? null,
      descriere: i.descriere,
      cost_piese: i.piese,
      cost_manopera: i.manopera,
      rezultat: i.rezultat,
      oprire_minute: i.oprire ?? null,
      citire_contor: i.contor ?? null,
      observatii: i.observatii ?? null,
      ...AUTOR,
    });
  }
  console.log(`  · maintenance_interventions: ${String(INTERVENTII.length)} (una redenumită)`);

  for (const s of SESIZARI) {
    const cheie =
      s.id === undefined
        ? { organization_id: ORG, equipment_id: echipament[s.echipament], raportat_la: s.la }
        : { id: s.id, organization_id: ORG };
    await asigura("fault_reports", cheie, {
      equipment_id: echipament[s.echipament],
      raportat_de_employee_id: ANGAJAT[s.raportor],
      descriere: s.descriere,
      urgenta: s.urgenta,
      status: s.status,
      raportat_la: s.la,
      opreste_functionarea: s.opreste,
      intervention_id: s.interventie === undefined ? null : interventie[s.interventie],
      motiv_respingere: s.motiv ?? null,
      ...AUTOR,
    });
  }
  console.log(`  · fault_reports: ${String(SESIZARI.length)} (una redenumită, patru deschise)`);

  await asigura(
    "iscir_authorizations",
    { organization_id: ORG, numar: "RSVTI-2025-1187" },
    {
      equipment_id: echipament["ECH-002"],
      /*
       * `tip` NU e text liber: triggerul `iscir_authorizations_exp` îl copiază
       * VERBATIM în `expirables.kind`, iar acolo CHECK-ul cere
       * `^[a-z][a-z0-9_]{1,48}$`. O denumire cu spații și diacritice cade cu
       * 23514 pe o tabelă despre care INSERT-ul nici nu pomenește. Textul
       * explicativ stă în `conditii`.
       */
      tip: "verificare_tehnica_periodica",
      emitent: "ISCIR",
      emis_la: "2024-09-18",
      // Sub pragul de 15 zile al panoului: fără o scadență apropiată,
      // autorizația n-ar apărea deloc pe `/mentenanta`.
      valabil_pana: "2026-09-18",
      scadenta_verificare_tehnica: "2026-09-18",
      conditii:
        "Verificare tehnică periodică obligatorie pentru echipamentul de ridicat, efectuată de un responsabil RSVTI autorizat.",
      ...AUTOR,
    },
  );
  console.log("  · iscir_authorizations: 1 (stivuitorul, scadentă apropiată)");
}

// ── Diurnă ──────────────────────────────────────────────────────────────────

/** Țările la care se referă deplasările. `countries` e globală, nu se inserează. */
const TARA = {
  ro: "fa28d58f-607d-4366-96d3-b525214e214d",
  at: "c011e4ee-5c07-48f4-ad92-927f056d7ae9",
  de: "b516a1dd-2bc2-470b-b548-0c104ce3c50a",
  hu: "307a40d5-7eef-4593-ae94-5264bd2b41e5",
};

/** Mercedes-ul de serviciu, singurul vehicul folosit într-o deplasare externă. */
const AUTO_SERVICIU = "f0c8aad8-2fad-4a54-b569-832ced5fb54c";

/** Deplasarea care exista deja, curățată ca text de `curatenie`. */
const DEPLASARE_EXISTENTA = "7b90b77d-c205-41c2-8e0d-ad55bebc1323";

/**
 * Deplasările. Șapte stări distincte, câte una de fiecare, ca lista să arate
 * întreg ciclul de viață și nu un singur rând de ciornă.
 *
 * `vehicle_id` se poate seta DOAR pe „auto_serviciu" sau „mixt"
 * (`business_trips_vehicul_ck`), iar `moneda_avans` e obligatorie de îndată ce
 * avansul e diferit de zero.
 */
const DEPLASARI = [
  {
    id: DEPLASARE_EXISTENTA,
    angajat: "ionescu",
    status: "ciorna",
    tara: TARA.ro,
    localitate: "Arad",
    transport: "auto_serviciu",
    // Rândul avea datele în trecut, deși e ciornă. Cum e „ciorna",
    // `internal.valideaza_deplasare` lasă mutarea intervalului fără aprobator.
    plecare: "2026-09-16T07:00:00+00:00",
    sosire: "2026-09-17T19:00:00+00:00",
    autor: CONT.ionescu,
  },
  {
    angajat: "georgescu",
    status: "in_aprobare",
    tara: TARA.ro,
    localitate: "Timișoara",
    transport: "tren",
    plecare: "2026-09-08T07:00:00+00:00",
    sosire: "2026-09-09T20:00:00+00:00",
    scop: "Curs de operare pentru noul utilaj de producție, la sediul furnizorului din Timișoara",
    autor: CONT.georgescu,
  },
  {
    cheie: "austria",
    angajat: "dumitrescu",
    status: "incheiata",
    tara: TARA.at,
    localitate: "Graz",
    transport: "auto_serviciu",
    vehicul: AUTO_SERVICIU,
    plecare: "2026-08-24T05:00:00+00:00",
    sosire: "2026-08-28T22:00:00+00:00",
    km: 1840,
    avans: 1500,
    monedaAvans: "RON",
    curs: 4.975,
    scop: "Instalare și configurare a liniei noi de ambalare la fabricile partenere din Austria și Germania",
    // Andrei n-are cont: fișa lui a fost introdusă de administrator.
    autor: CONT.ionescu,
  },
  {
    cheie: "ungaria",
    angajat: "nistor",
    status: "decontata",
    tara: TARA.hu,
    localitate: "Szeged",
    transport: "auto_personal",
    plecare: "2026-08-10T06:00:00+00:00",
    sosire: "2026-08-12T20:00:00+00:00",
    km: 620,
    avans: 800,
    monedaAvans: "RON",
    curs: 4.975,
    scop: "Vizită la un client din Ungaria pentru semnarea contractului anual de distribuție",
    autor: CONT.ionescu,
  },
  {
    angajat: "barbu",
    status: "respinsa",
    tara: TARA.ro,
    localitate: "Cluj-Napoca",
    transport: "tren",
    plecare: "2026-09-15T08:00:00+00:00",
    sosire: "2026-09-17T18:00:00+00:00",
    scop: "Participare la târgul regional de mobilă și decorațiuni, cu stand de prezentare a produselor firmei",
    autor: CONT.ionescu,
  },
  {
    angajat: "marin",
    status: "anulata",
    tara: TARA.ro,
    localitate: "Timișoara",
    transport: "auto_personal",
    plecare: "2026-09-20T09:00:00+00:00",
    sosire: "2026-09-20T17:00:00+00:00",
    km: 40,
    scop: "Deplasare la sediul inspectoratului teritorial de muncă pentru un control programat, amânat de instituție",
    autor: CONT.marin,
  },
  {
    angajat: "pop",
    status: "aprobata",
    tara: TARA.ro,
    localitate: "Sibiu",
    transport: "auto_serviciu",
    plecare: "2026-09-12T07:00:00+00:00",
    sosire: "2026-09-13T19:00:00+00:00",
    scop: "Vizită la depozitul din Sibiu pentru evaluarea unui nou furnizor de ambalaje și paleți",
    autor: CONT.pop,
  },
];

/** Etapele deplasării externe — singura cu trecere de frontieră. */
const ETAPE_DEPLASARE = [
  {
    deplasare: "austria",
    ordine: 1,
    din: TARA.ro,
    spre: TARA.at,
    plecare: "2026-08-24T05:00:00+00:00",
    sosire: "2026-08-25T16:00:00+00:00",
    localitate: "Graz",
    transport: "auto_serviciu",
  },
  {
    deplasare: "austria",
    ordine: 2,
    din: TARA.at,
    spre: TARA.de,
    plecare: "2026-08-26T08:00:00+00:00",
    sosire: "2026-08-26T14:00:00+00:00",
    localitate: "München",
    transport: "auto_serviciu",
  },
  {
    deplasare: "austria",
    ordine: 3,
    din: TARA.de,
    spre: TARA.ro,
    plecare: "2026-08-28T07:00:00+00:00",
    sosire: "2026-08-28T22:00:00+00:00",
    localitate: "Timișoara",
    transport: "auto_serviciu",
  },
];

/**
 * Cheltuielile decontate.
 *
 * `suma_lei` NU se trimite: e coloană GENERATED ALWAYS
 * (`round(suma * curs_valutar, 2)`), iar apariția ei în lista de coloane dă
 * 428C9 înaintea oricărei validări. `aprobata`, `aprobata_de` și `aprobata_la`
 * merg toate trei împreună sau deloc (`trip_expenses_aprobare_ck`).
 */
const CHELTUIELI = [
  {
    deplasare: "austria",
    tip: "cazare",
    data: "2026-08-25",
    suma: 95,
    moneda: "EUR",
    curs: 4.975,
    descriere: "Cazare Graz, două nopți",
    aprobataLa: "2026-08-29T10:00:00+03:00",
  },
  {
    deplasare: "austria",
    tip: "cazare",
    data: "2026-08-26",
    suma: 88,
    moneda: "EUR",
    curs: 4.975,
    descriere: "Cazare München, o noapte",
    aprobataLa: "2026-08-29T10:00:00+03:00",
  },
  {
    deplasare: "austria",
    tip: "combustibil",
    data: "2026-08-24",
    suma: 320,
    moneda: "RON",
    curs: 1,
    descriere: "Alimentare la plecare",
    aprobataLa: "2026-08-29T10:00:00+03:00",
  },
  // Rămâne neaprobată: fișa deplasării trebuie să arate și o cheltuială în
  // așteptare, nu doar un decont încheiat.
  {
    deplasare: "austria",
    tip: "taxa_drum",
    data: "2026-08-24",
    suma: 9.5,
    moneda: "EUR",
    curs: 4.975,
    descriere: "Vinietă Austria, zece zile",
    aprobataLa: null,
  },
  {
    deplasare: "ungaria",
    tip: "cazare",
    data: "2026-08-11",
    suma: 60,
    moneda: "EUR",
    curs: 4.975,
    descriere: "Cazare Szeged, o noapte",
    aprobataLa: "2026-08-14T09:00:00+03:00",
  },
  {
    deplasare: "ungaria",
    tip: "taxa_drum",
    data: "2026-08-10",
    suma: 15,
    moneda: "EUR",
    curs: 4.975,
    descriere: "Vinietă Ungaria, zece zile",
    aprobataLa: "2026-08-14T09:00:00+03:00",
  },
];

/**
 * Diurnă: șapte deplasări în șapte stări, cu etape și cheltuieli.
 *
 * `/diurna` avea o singură deplasare, ciornă. Politica firmei se redenumește
 * ÎNTÂI: `internal.valideaza_deplasare` cere o politică valabilă la data
 * plecării, altfel fiecare INSERT de mai jos ar cădea cu P0001.
 *
 * `per_diem_calculations` rămâne intenționat nescrisă — vezi raportul.
 */
async function diurna() {
  console.log("── Diurnă");

  await redenumeste(
    "per_diem_policies",
    "denumire",
    "Politica 2026 verificare",
    "Politica de diurnă 2026",
    { updated_by: CONT.ionescu },
  );

  const deplasare = {};
  for (const d of DEPLASARI) {
    const cheie =
      d.id === undefined
        ? { organization_id: ORG, employee_id: ANGAJAT[d.angajat], plecare_la: d.plecare }
        : { id: d.id, organization_id: ORG };
    const rand = {
      employee_id: ANGAJAT[d.angajat],
      country_id: d.tara,
      localitate: d.localitate,
      plecare_la: d.plecare,
      sosire_la: d.sosire,
      mijloc_transport: d.transport,
      vehicle_id: d.vehicul ?? null,
      km_parcursi: d.km ?? null,
      avans_acordat: d.avans ?? 0,
      moneda_avans: d.monedaAvans ?? null,
      curs_diurna: d.curs ?? null,
      status: d.status,
      created_by: d.autor,
      updated_by: d.autor,
    };
    // Scopul rândului existent a fost deja scris de `curatenie`; nu-l rescriu.
    if (d.scop !== undefined) rand.scop = d.scop;
    const id = await asigura("business_trips", cheie, rand);
    if (d.cheie !== undefined) deplasare[d.cheie] = id;
  }
  console.log(`  · business_trips: ${String(DEPLASARI.length)} (șapte stări distincte)`);

  for (const e of ETAPE_DEPLASARE) {
    await asigura(
      "business_trip_legs",
      { organization_id: ORG, business_trip_id: deplasare[e.deplasare], ordine: e.ordine },
      {
        from_country_id: e.din,
        to_country_id: e.spre,
        plecare_la: e.plecare,
        sosire_la: e.sosire,
        localitate_sosire: e.localitate,
        mijloc_transport: e.transport,
        ...AUTOR,
      },
    );
  }
  console.log(
    `  · business_trip_legs: ${String(ETAPE_DEPLASARE.length)} (deplasarea în Austria și Germania)`,
  );

  for (const c of CHELTUIELI) {
    await asigura(
      "trip_expenses",
      {
        organization_id: ORG,
        business_trip_id: deplasare[c.deplasare],
        tip: c.tip,
        data_cheltuielii: c.data,
      },
      {
        descriere: c.descriere,
        suma: c.suma,
        moneda: c.moneda,
        curs_valutar: c.curs,
        aprobata: c.aprobataLa !== null,
        aprobata_de: c.aprobataLa === null ? null : CONT.ionescu,
        aprobata_la: c.aprobataLa,
        ...AUTOR,
      },
    );
  }
  console.log(`  · trip_expenses: ${String(CHELTUIELI.length)} (una încă neaprobată)`);
}

// ── rulare ──────────────────────────────────────────────────────────────────

/*
 * Ordinea contează: `inventar` ÎNAINTEA lui `ticketing`, fiindcă tichetele de
 * defecțiune cer un obiect alocat deschis solicitantului lor.
 */
const ETAPE = {
  curatenie,
  ssm,
  flota,
  inventar,
  ticketing,
  anunturi,
  cursuri,
  onboarding,
  evaluari,
  kpi,
  mentenanta,
  diurna,
};

const cerute = process.argv.slice(2);
const deRulat = Object.entries(ETAPE).filter(([n]) => cerute.length === 0 || cerute.includes(n));
if (deRulat.length === 0) {
  console.error(`Etape disponibile: ${Object.keys(ETAPE).join(", ")}`);
  process.exit(1);
}

console.log(`Firma demo ${ORG}`);
console.log(`Etape: ${deRulat.map(([n]) => n).join(", ")}\n`);
for (const [, fn] of deRulat) {
  await fn();
}
console.log("\nGata.");
