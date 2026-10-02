// src/lib/reges/reconciliere.test.ts
//
// Ciclul de reconciliere, prima jumătate: închirierea (două replici nu consumă
// aceeași coadă), izolarea eșecului per firmă și trimiterea contractelor gata
// (niciodată a salariaților — conțin CNP). Culegerea rezultatelor și a
// propunerilor e în `reconciliere-culegere.test.ts`.
//
// ⚠ `cheamaReges`, jetonul și credențialele sunt înlocuite COMPLET; `fetch`
// global aruncă. Nimic de aici nu poate ajunge la Inspecția Muncii.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const falsuriReges = vi.hoisted(() => ({
  cheamaReges: vi.fn(),
  jetonValid: vi.fn(),
  citesteCredentiale: vi.fn(),
}));
vi.mock("@/lib/reges/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/reges/client")>()),
  cheamaReges: falsuriReges.cheamaReges,
}));
vi.mock("@/lib/reges/jeton", () => ({ jetonValid: falsuriReges.jetonValid }));
vi.mock("@/lib/reges/credentiale", () => ({ citesteCredentiale: falsuriReges.citesteCredentiale }));

import { areFiltru, clientFals, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";

import { CHEIE_INCHIRIERE, iaInchirierea, lasaInchirierea, ruleazaCiclu } from "./reconciliere";

const ORG = "11111111-1111-4111-8111-111111111111";
const ALTA_ORG = "22222222-2222-4222-8222-222222222222";
const MESAJ = "55555555-5555-4555-8555-555555555555";
const ANGAJAT = "66666666-6666-4666-8666-666666666666";
const CONTRACT = "77777777-7777-4777-8777-777777777777";

const cred = (organizationId = ORG) => ({
  organizationId,
  mediu: "test",
  cuiAngajator: "123",
  clientId: "c",
  utilizator: "u",
  clientSecret: "s",
  parola: "p",
  consumerId: "consumer-1",
  activ: true,
});

type Raspuns = Readonly<{ ok: boolean; [k: string]: unknown }>;
const OK_GOL: Raspuns = { ok: true, date: [], status: 200, durataMs: 1 };

/** `cheamaReges` fals, cu răspuns ales după cale. Ce nu e numit ⇒ coadă goală. */
function regesDupaCale(rute: Readonly<Record<string, Raspuns | Raspuns[]>>): void {
  const cozi = new Map(
    Object.entries(rute).map(([k, v]) => [k, Array.isArray(v) ? [...v] : [v]] as const),
  );
  falsuriReges.cheamaReges.mockImplementation(async ({ cale }: { cale: string }) => {
    const coada = cozi.get(cale);
    if (coada !== undefined && coada.length > 0)
      return coada.length === 1 ? coada[0] : coada.shift();
    return OK_GOL;
  });
}

function cereri(cale: string): Record<string, unknown>[] {
  return falsuriReges.cheamaReges.mock.calls
    .map((c) => c[0] as Record<string, unknown>)
    .filter((c) => c.cale === cale);
}

/** Închirierea luată, o singură firmă activă, jurnalul de apeluri programat larg. */
function cicluCuOFirma(): ClientFals {
  const db = clientFals();
  db.raspundeRpc("reges_ia_inchirierea", { data: true });
  db.raspundeRpc("reges_lasa_inchirierea", { data: null });
  db.raspunde("reges_credentiale", "select", { data: [{ organization_id: ORG }] });
  for (let i = 0; i < 30; i += 1) db.raspunde("reges_apeluri", "insert", { data: null });
  return db;
}

beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("fetch real interzis în teste: apelurile REGES sunt ireversibile");
  });
  for (const f of Object.values(falsuriReges)) f.mockReset();
  falsuriReges.citesteCredentiale.mockImplementation(async (_db: unknown, org: string) =>
    cred(org),
  );
  falsuriReges.jetonValid.mockResolvedValue({ ok: true, jeton: "jwt", expiraLa: new Date() });
  regesDupaCale({});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/* ------------------------------- închirierea ----------------------------- */

describe("iaInchirierea / lasaInchirierea", () => {
  it("cere închirierea pe cheia ciclului, cu deținătorul și termenul", async () => {
    const db = clientFals();
    db.raspundeRpc("reges_ia_inchirierea", { data: true });
    expect(await iaInchirierea(db.client, "replica-1")).toBe(true);
    expect(db.apeluriRpc[0]).toEqual({
      nume: "reges_ia_inchirierea",
      argumente: { p_cheie: CHEIE_INCHIRIERE, p_detinator: "replica-1", p_secunde: 300 },
    });
  });

  it.each([false, null, "true", 1])(
    "orice altceva decât `true` (%j) înseamnă „nu e a ta”",
    async (data) => {
      const db = clientFals();
      db.raspundeRpc("reges_ia_inchirierea", { data });
      expect(await iaInchirierea(db.client, "r")).toBe(false);
    },
  );

  it("eroarea la luare sau la lăsare se aruncă", async () => {
    const db = clientFals();
    const eroare = eroarePostgrest("57014");
    db.raspundeRpc("reges_ia_inchirierea", { error: eroare });
    db.raspundeRpc("reges_lasa_inchirierea", { error: eroare });
    await expect(iaInchirierea(db.client, "r")).rejects.toBe(eroare);
    await expect(lasaInchirierea(db.client, "r")).rejects.toBe(eroare);
    expect(db.apeluriRpc[1]?.argumente).toEqual({ p_cheie: CHEIE_INCHIRIERE, p_detinator: "r" });
  });
});

/* --------------------------------- ciclul -------------------------------- */

describe("ruleazaCiclu — orchestrarea", () => {
  it("închirierea ocupată: nu rulează nimic și nu eliberează închirierea altcuiva", async () => {
    const db = clientFals();
    db.raspundeRpc("reges_ia_inchirierea", { data: false });

    const r = await ruleazaCiclu(db.client, "replica-2");

    expect(r).toEqual({
      rulat: false,
      motiv: "Un alt ciclu de reconciliere e deja în curs.",
      organizatii: [],
    });
    expect(db.apeluri).toHaveLength(0);
    expect(db.apeluriRpc.map((a) => a.nume)).toEqual(["reges_ia_inchirierea"]);
  });

  it("doar firmele cu transmiterea pornită; închirierea se lasă la final", async () => {
    const db = clientFals();
    db.raspundeRpc("reges_ia_inchirierea", { data: true });
    db.raspundeRpc("reges_lasa_inchirierea", { data: null });
    db.raspunde("reges_credentiale", "select", { data: [] });

    const r = await ruleazaCiclu(db.client, "replica-1");

    expect(r).toEqual({ rulat: true, organizatii: [] });
    const [active] = db.apeluriPe("reges_credentiale");
    expect(areFiltru(active, "eq", "activ", true)).toBe(true);
    expect(areFiltru(active, "is", "deleted_at", null)).toBe(true);
    expect(db.apeluriRpc.map((a) => a.nume)).toEqual([
      "reges_ia_inchirierea",
      "reges_lasa_inchirierea",
    ]);
  });

  it("închirierea se lasă și când citirea firmelor aruncă", async () => {
    const db = clientFals();
    db.raspundeRpc("reges_ia_inchirierea", { data: true });
    db.raspundeRpc("reges_lasa_inchirierea", { data: null });
    db.raspunde("reges_credentiale", "select", { error: eroarePostgrest("57014") });

    await expect(ruleazaCiclu(db.client, "r")).rejects.toMatchObject({ code: "57014" });
    expect(db.apeluriRpc.at(-1)?.nume).toBe("reges_lasa_inchirierea");
  });

  it("o firmă stricată nu oprește celelalte; eroarea ei e mascată în raport", async () => {
    const db = clientFals();
    db.raspundeRpc("reges_ia_inchirierea", { data: true });
    db.raspundeRpc("reges_lasa_inchirierea", { data: null });
    db.raspunde("reges_credentiale", "select", {
      data: [{ organization_id: ORG }, { organization_id: ALTA_ORG }],
    });
    for (let i = 0; i < 10; i += 1) db.raspunde("reges_apeluri", "insert", { data: null });
    db.raspunde("reges_mesaje", "select", { data: [] });
    falsuriReges.citesteCredentiale.mockImplementation(async (_db: unknown, org: string) => {
      if (org === ORG) throw new Error("cheie coruptă pentru 1990101123456");
      return cred(org);
    });

    const r = await ruleazaCiclu(db.client, "r");

    expect(r.rulat).toBe(true);
    expect(r.organizatii).toHaveLength(2);
    expect(r.organizatii[0]).toMatchObject({ organizationId: ORG, trimise: 0 });
    expect(r.organizatii[0]?.eroare).toContain("*********3456");
    expect(r.organizatii[0]?.eroare).not.toContain("1990101123456");
    expect(r.organizatii[1]).toEqual({
      organizationId: ALTA_ORG,
      trimise: 0,
      rezultate: 0,
      propuneri: 0,
      eroare: null,
    });
  });

  it("fără chei: firma raportează configurarea incompletă, fără apeluri", async () => {
    const db = cicluCuOFirma();
    falsuriReges.citesteCredentiale.mockResolvedValue(null);
    const r = await ruleazaCiclu(db.client, "r");
    expect(r.organizatii[0]?.eroare).toBe("Configurarea REGES e incompletă: lipsesc cheile API.");
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });

  it("jetonul refuzat: verificarea se scrie `false` pe rândul firmei, nimic nu pleacă", async () => {
    const db = cicluCuOFirma();
    falsuriReges.jetonValid.mockResolvedValue({
      ok: false,
      motiv: "credentiale",
      mesaj: "Parolă greșită",
    });
    db.raspunde("reges_credentiale", "update", { data: null });

    const r = await ruleazaCiclu(db.client, "r");

    expect(r.organizatii[0]?.eroare).toBe("Parolă greșită");
    const [verificare] = db.apeluriPe("reges_credentiale", "update");
    expect(verificare?.payload).toMatchObject({
      verificat_ok: false,
      verificat_mesaj: "Parolă greșită",
    });
    expect(areFiltru(verificare, "eq", "organization_id", ORG)).toBe(true);
    expect(falsuriReges.cheamaReges).not.toHaveBeenCalled();
  });
});

/* ------------------------------- trimiterea ------------------------------ */

describe("ruleazaCiclu — trimiterea mesajelor gata", () => {
  const mesaj = (peste: Record<string, unknown> = {}) => ({
    id: MESAJ,
    organization_id: ORG,
    employee_id: ANGAJAT,
    contract_id: CONTRACT,
    tip: "contract",
    operatie: "IncetareContract",
    message_id: "msg-1",
    depinde_de: null,
    incercari: 0,
    ...peste,
  });
  const contract = (peste: Record<string, unknown> = {}) => ({
    reges_contract_id: "ctr-1",
    incetat_la: "2026-09-30",
    temei_incetare: "art. 55 lit. b",
    reges_temei_incetare: null,
    ...peste,
  });

  it("selectează doar mesajele firmei, `de_transmis`, FĂRĂ salariați, scadente, FIFO, plafonat", async () => {
    const db = cicluCuOFirma();
    db.raspunde("reges_mesaje", "select", { data: [] });

    await ruleazaCiclu(db.client, "r");

    const [apel] = db.apeluriPe("reges_mesaje", "select");
    expect(areFiltru(apel, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(apel, "eq", "stare", "de_transmis")).toBe(true);
    expect(areFiltru(apel, "neq", "tip", "salariat")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    const or = apel?.filtre.find((f) => f.metoda === "or");
    expect(String(or?.argumente[0])).toMatch(
      /^urmatoarea_incercare_la\.is\.null,urmatoarea_incercare_la\.lte\./,
    );
    expect(apel?.filtre).toEqual(
      expect.arrayContaining([
        { metoda: "order", argumente: ["ordine", { ascending: true }] },
        { metoda: "order", argumente: ["created_at", { ascending: true }] },
        { metoda: "limit", argumente: [25] },
      ]),
    );
  });

  it("încetarea pleacă pe /api/Contract și mesajul trece în așteptare cu responseId", async () => {
    const db = cicluCuOFirma();
    db.raspunde("reges_mesaje", "select", { data: [mesaj()] });
    db.raspunde("employees", "select", { data: { reges_salariat_id: "sal-1" } });
    db.raspunde("employment_contracts", "select", { data: contract() });
    db.raspunde("reges_mesaje", "update", { data: null });
    regesDupaCale({
      "/api/Contract": { ok: true, date: { responseId: "resp-1" }, status: 202, durataMs: 3 },
    });

    const r = await ruleazaCiclu(db.client, "r");

    expect(r.organizatii[0]).toMatchObject({ trimise: 1, eroare: null });
    const [trimitere] = cereri("/api/Contract");
    expect(trimitere).toMatchObject({
      metoda: "POST",
      jeton: "jwt",
      parametri: { consumerId: "consumer-1" },
    });
    expect(trimitere?.corp).toMatchObject({
      $type: "contract",
      header: { operation: "IncetareContract", messageId: "msg-1" },
      referintaContract: { id: "ctr-1" },
      actiune: { $type: "actiuneIncetare", temeiLegal: "art. 55 lit. b" },
    });
    const [stare] = db.apeluriPe("reges_mesaje", "update");
    expect(stare?.payload).toMatchObject({
      stare: "asteapta_raspuns",
      response_id: "resp-1",
      incercari: 1,
    });
    expect(areFiltru(stare, "eq", "id", MESAJ)).toBe(true);
    // Contractul și angajatul se citesc în firma mesajului.
    expect(areFiltru(db.apeluriPe("employment_contracts")[0], "eq", "organization_id", ORG)).toBe(
      true,
    );
    expect(areFiltru(db.apeluriPe("employees")[0], "eq", "organization_id", ORG)).toBe(true);
  });

  it("salariatul fără identificator REGES încă: mesajul așteaptă, nu pleacă și nu eșuează", async () => {
    const db = cicluCuOFirma();
    db.raspunde("reges_mesaje", "select", { data: [mesaj()] });
    db.raspunde("employees", "select", { data: { reges_salariat_id: null } });

    const r = await ruleazaCiclu(db.client, "r");

    expect(r.organizatii[0]?.trimise).toBe(0);
    expect(cereri("/api/Contract")).toHaveLength(0);
    expect(db.apeluriPe("reges_mesaje", "update")).toHaveLength(0);
  });

  it.each([
    ["mesaj fără contract", { contract_id: null }, undefined, "Mesajul nu are un contract atașat."],
    ["contract dispărut", {}, null, "Contractul legat de mesaj nu mai există."],
    [
      "încetare fără dată",
      {},
      contract({ incetat_la: null }),
      "Contractul nu are dată de încetare sau identificator REGES.",
    ],
  ])(
    "%s: mesajul devine `esuat` cu motivul, fără apel",
    async (_e, pesteMesaj, randContract, motiv) => {
      const db = cicluCuOFirma();
      db.raspunde("reges_mesaje", "select", { data: [mesaj(pesteMesaj)] });
      db.raspunde("employees", "select", { data: { reges_salariat_id: "sal-1" } });
      if (randContract !== undefined)
        db.raspunde("employment_contracts", "select", { data: randContract });
      db.raspunde("reges_mesaje", "update", { data: null });

      await ruleazaCiclu(db.client, "r");

      const [esec] = db.apeluriPe("reges_mesaje", "update");
      expect(esec?.payload).toMatchObject({ stare: "esuat", eroare: motiv });
      expect(cereri("/api/Contract")).toHaveLength(0);
    },
  );

  it("400 de la ITM: `esuat` cu statusul, fără reîncercare", async () => {
    const db = cicluCuOFirma();
    db.raspunde("reges_mesaje", "select", { data: [mesaj()] });
    db.raspunde("employees", "select", { data: { reges_salariat_id: "sal-1" } });
    db.raspunde("employment_contracts", "select", { data: contract() });
    db.raspunde("reges_mesaje", "update", { data: null });
    regesDupaCale({
      "/api/Contract": {
        ok: false,
        motiv: "validare",
        mesaj: "Temei invalid",
        status: 400,
        durataMs: 2,
      },
    });

    await ruleazaCiclu(db.client, "r");

    expect(db.apeluriPe("reges_mesaje", "update")[0]?.payload).toMatchObject({
      stare: "esuat",
      eroare: "Temei invalid",
      http_status: 400,
    });
  });

  it("ITM indisponibil: rămâne de transmis, cu încercarea numărată și amânare de 10 minute", async () => {
    const db = cicluCuOFirma();
    db.raspunde("reges_mesaje", "select", { data: [mesaj({ incercari: 2 })] });
    db.raspunde("employees", "select", { data: { reges_salariat_id: "sal-1" } });
    db.raspunde("employment_contracts", "select", { data: contract() });
    db.raspunde("reges_mesaje", "update", { data: null });
    regesDupaCale({
      "/api/Contract": { ok: false, motiv: "indisponibil", mesaj: "503", status: 503, durataMs: 2 },
    });
    const inainte = Date.now();

    await ruleazaCiclu(db.client, "r");

    const p = db.apeluriPe("reges_mesaje", "update")[0]?.payload as Record<string, unknown>;
    expect(p).not.toHaveProperty("stare");
    expect(p.incercari).toBe(3);
    const amanare = Date.parse(String(p.urmatoarea_incercare_la)) - inainte;
    expect(amanare).toBeGreaterThanOrEqual(10 * 60_000 - 1000);
    expect(amanare).toBeLessThanOrEqual(10 * 60_000 + 5000);
  });

  it("propunerea de detașare pleacă pe propriul endpoint, cu datele din `reges_propuneri`", async () => {
    const db = cicluCuOFirma();
    db.raspunde("reges_mesaje", "select", {
      data: [mesaj({ tip: "propunere_detasare", operatie: "PropunereDetasareContract" })],
    });
    db.raspunde("employees", "select", { data: { reges_salariat_id: "sal-1" } });
    db.raspunde("employment_contracts", "select", { data: contract() });
    db.raspunde("reges_propuneri", "select", {
      data: {
        reges_contract_id: "ctr-1",
        angajator_partener_cui: "RO999",
        data_inceput: "2026-10-01",
        data_sfarsit: null,
        temei_legal: "Art45",
      },
    });
    db.raspunde("reges_mesaje", "update", { data: null });
    regesDupaCale({
      "/api/Detasare/Propuneri": { ok: true, date: { responseId: "r" }, status: 202, durataMs: 1 },
    });

    await ruleazaCiclu(db.client, "r");

    const [p] = cereri("/api/Detasare/Propuneri");
    expect(p?.corp).toMatchObject({
      $type: "propunereDetasareContract",
      referintaContract: { $type: "referinta", id: "ctr-1" },
      temeiLegal: "Art45",
      cuiAngajatorDestinatie: "RO999",
    });
    expect(p?.corp).not.toHaveProperty("dataSfarsit");
    const [citirePropunere] = db.apeluriPe("reges_propuneri");
    expect(areFiltru(citirePropunere, "eq", "mesaj_id", MESAJ)).toBe(true);
    expect(areFiltru(citirePropunere, "eq", "organization_id", ORG)).toBe(true);
    expect(cereri("/api/Contract")).toHaveLength(0);
  });

  it.each([
    ["SuspendareContract", "2026-10-01", null],
    ["ReactivareContract", "2026-09-01", "2026-09-30"],
  ])(
    "%s: datele vin din suspendarea ACTIVĂ și vie a contractului, în firma mesajului",
    async (operatie, inceput, sfarsit) => {
      const db = cicluCuOFirma();
      db.raspunde("reges_mesaje", "select", { data: [mesaj({ operatie })] });
      db.raspunde("employees", "select", { data: { reges_salariat_id: "sal-1" } });
      db.raspunde("employment_contracts", "select", { data: contract() });
      db.raspunde("contract_suspendari", "select", {
        data: {
          data_inceput: inceput,
          data_sfarsit: sfarsit,
          temei_legal: "Art51",
          explicatie: null,
        },
      });
      db.raspunde("reges_mesaje", "update", { data: null });
      regesDupaCale({
        "/api/Contract": { ok: true, date: { responseId: "r" }, status: 202, durataMs: 1 },
      });

      const r = await ruleazaCiclu(db.client, "r");

      expect(r.organizatii[0]?.trimise).toBe(1);
      const [suspendare] = db.apeluriPe("contract_suspendari");
      expect(areFiltru(suspendare, "eq", "contract_id", CONTRACT)).toBe(true);
      expect(areFiltru(suspendare, "eq", "organization_id", ORG)).toBe(true);
      expect(areFiltru(suspendare, "eq", "stare", "activa")).toBe(true);
      expect(areFiltru(suspendare, "is", "deleted_at", null)).toBe(true);
      const [trimitere] = cereri("/api/Contract");
      expect(trimitere?.corp).toMatchObject({
        header: { operation: operatie },
        referintaContract: { id: "ctr-1" },
      });
    },
  );

  it("fără suspendare activă: mesajul de suspendare devine `esuat`, fără apel", async () => {
    const db = cicluCuOFirma();
    db.raspunde("reges_mesaje", "select", { data: [mesaj({ operatie: "SuspendareContract" })] });
    db.raspunde("employees", "select", { data: { reges_salariat_id: "sal-1" } });
    db.raspunde("employment_contracts", "select", { data: contract() });
    db.raspunde("contract_suspendari", "select", { data: null });
    db.raspunde("reges_mesaje", "update", { data: null });

    await ruleazaCiclu(db.client, "r");

    expect(db.apeluriPe("reges_mesaje", "update")[0]?.payload).toMatchObject({
      stare: "esuat",
      eroare: "Nu există o suspendare activă de transmis pentru contract.",
    });
    expect(cereri("/api/Contract")).toHaveLength(0);
  });

  it("eroarea citirii cozii se raportează pe firmă, nu trece drept „nimic de trimis”", async () => {
    const db = cicluCuOFirma();
    db.raspunde("reges_mesaje", "select", { error: eroarePostgrest("57014") });

    const r = await ruleazaCiclu(db.client, "r");

    expect(r.organizatii[0]?.trimise).toBe(0);
    expect(r.organizatii[0]?.eroare).not.toBeNull();
    expect(cereri("/api/Status/ReadBatch")).toHaveLength(0);
  });
});
