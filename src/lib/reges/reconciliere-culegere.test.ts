// src/lib/reges/reconciliere-culegere.test.ts
//
// Ciclul de reconciliere, a doua jumătate: culegerea rezultatelor cu
// confirmarea numărului REAL citit, idempotența pe rezultat și propunerile din
// cele patru cozi.
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

import { areFiltru, clientFals, type ClientFals } from "@/lib/teste/supabase-fals";

import { ruleazaCiclu } from "./reconciliere";

const ORG = "11111111-1111-4111-8111-111111111111";
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

/* ------------------------- culegerea rezultatelor ------------------------ */

describe("ruleazaCiclu — culegerea rezultatelor", () => {
  const rezultat = (responseId: string, code: string, ref: string | null) => ({
    responseId,
    result: { code, codeType: "x", description: "ok", ref, relatedResultsExpected: false },
  });

  it("aplică rezultatele, scrie identificatorul pe entitate și confirmă numărul REAL citit", async () => {
    const db = cicluCuOFirma();
    db.raspunde("reges_mesaje", "select", { data: [] });
    // Rezultatul 1: salariat reușit cu referință.
    db.raspunde("reges_mesaje", "select", {
      data: {
        id: "m1",
        tip: "salariat",
        stare: "asteapta_raspuns",
        employee_id: ANGAJAT,
        contract_id: null,
      },
    });
    db.raspunde("reges_mesaje", "update", { data: null });
    db.raspunde("employees", "update", { data: null });
    // Rezultatul 2: contract reușit cu referință.
    db.raspunde("reges_mesaje", "select", {
      data: {
        id: "m2",
        tip: "contract",
        stare: "asteapta_raspuns",
        employee_id: ANGAJAT,
        contract_id: CONTRACT,
      },
    });
    db.raspunde("reges_mesaje", "update", { data: null });
    db.raspunde("employment_contracts", "update", { data: null });
    regesDupaCale({
      "/api/Status/ReadBatch": {
        ok: true,
        date: [rezultat("resp-1", "SUCCES", "sal-uuid"), rezultat("resp-2", "SUCCES", "ctr-uuid")],
        status: 200,
        durataMs: 1,
      },
    });

    const r = await ruleazaCiclu(db.client, "r");

    expect(r.organizatii[0]?.rezultate).toBe(2);
    const [cautare] = db.apeluriPe("reges_mesaje", "select").slice(1);
    expect(areFiltru(cautare, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(cautare, "eq", "response_id", "resp-1")).toBe(true);
    const [stare1] = db.apeluriPe("reges_mesaje", "update");
    expect(stare1?.payload).toMatchObject({
      stare: "reusit",
      referinta_id: "sal-uuid",
      eroare: null,
    });
    const [salariat] = db.apeluriPe("employees", "update");
    expect(salariat?.payload).toEqual({ reges_salariat_id: "sal-uuid" });
    // Identificatorul se scrie o singură dată, niciodată peste unul existent.
    expect(areFiltru(salariat, "is", "reges_salariat_id", null)).toBe(true);
    // Clientul e service_role: id-ul plus firma sunt singura barieră.
    expect(areFiltru(salariat, "eq", "id", ANGAJAT)).toBe(true);
    expect(areFiltru(salariat, "eq", "organization_id", ORG)).toBe(true);
    const [ctr] = db.apeluriPe("employment_contracts", "update");
    expect(ctr?.payload).toEqual({ reges_contract_id: "ctr-uuid" });
    expect(areFiltru(ctr, "is", "reges_contract_id", null)).toBe(true);
    expect(areFiltru(ctr, "eq", "id", CONTRACT)).toBe(true);
    expect(areFiltru(ctr, "eq", "organization_id", ORG)).toBe(true);
    // CommitReadBatch cu 2 (cât s-a citit), nu cu 20 (cât s-a cerut).
    const [commit] = cereri("/api/Status/CommitReadBatch");
    expect(commit?.corp).toEqual({ messages: 2 });
    expect(cereri("/api/Status/ReadBatch")[0]?.corp).toEqual({ messages: 20 });
  });

  it("rezultat deja aplicat (reusit/esuat): nu se rescrie (idempotență)", async () => {
    const db = cicluCuOFirma();
    db.raspunde("reges_mesaje", "select", { data: [] });
    db.raspunde("reges_mesaje", "select", {
      data: { id: "m1", tip: "salariat", stare: "reusit", employee_id: ANGAJAT, contract_id: null },
    });
    regesDupaCale({
      "/api/Status/ReadBatch": {
        ok: true,
        date: [rezultat("resp-1", "SUCCES", "x")],
        status: 200,
        durataMs: 1,
      },
    });

    const r = await ruleazaCiclu(db.client, "r");

    expect(r.organizatii[0]?.rezultate).toBe(0);
    expect(db.apeluriPe("reges_mesaje", "update")).toHaveLength(0);
    // Confirmarea se face oricum: lotul a fost citit.
    expect(cereri("/api/Status/CommitReadBatch")[0]?.corp).toEqual({ messages: 1 });
  });

  it("SUCCES fără identificator: `esuat` cu explicație, entitatea nu se atinge", async () => {
    const db = cicluCuOFirma();
    db.raspunde("reges_mesaje", "select", { data: [] });
    db.raspunde("reges_mesaje", "select", {
      data: {
        id: "m1",
        tip: "salariat",
        stare: "asteapta_raspuns",
        employee_id: ANGAJAT,
        contract_id: null,
      },
    });
    db.raspunde("reges_mesaje", "update", { data: null });
    regesDupaCale({
      "/api/Status/ReadBatch": {
        ok: true,
        date: [rezultat("resp-1", "SUCCES", null)],
        status: 200,
        durataMs: 1,
      },
    });

    await ruleazaCiclu(db.client, "r");

    expect(db.apeluriPe("reges_mesaje", "update")[0]?.payload).toMatchObject({
      stare: "esuat",
      referinta_id: null,
      eroare: "Inspecția Muncii a raportat succes fără să întoarcă identificatorul entității.",
    });
    expect(db.apeluriPe("employees", "update")).toHaveLength(0);
  });

  it("un lot plin (20) cere lotul următor; unul incomplet oprește bucla", async () => {
    const db = cicluCuOFirma();
    db.raspunde("reges_mesaje", "select", { data: [] });
    // 20 de rezultate fără responseId: se sar, dar lotul e plin.
    const plin = Array.from({ length: 20 }, () => ({ responseId: "", result: { code: "SUCCES" } }));
    regesDupaCale({
      "/api/Status/ReadBatch": [
        { ok: true, date: plin, status: 200, durataMs: 1 },
        { ok: true, date: [], status: 200, durataMs: 1 },
      ],
    });

    await ruleazaCiclu(db.client, "r");

    expect(cereri("/api/Status/ReadBatch")).toHaveLength(2);
    expect(cereri("/api/Status/CommitReadBatch")).toHaveLength(1);
  });

  it("ReadBatch eșuat: fără confirmare (nu se avansează cursorul pe ceva necitit)", async () => {
    const db = cicluCuOFirma();
    db.raspunde("reges_mesaje", "select", { data: [] });
    regesDupaCale({
      "/api/Status/ReadBatch": {
        ok: false,
        motiv: "indisponibil",
        mesaj: "503",
        status: 503,
        durataMs: 1,
      },
    });
    await ruleazaCiclu(db.client, "r");
    expect(cereri("/api/Status/CommitReadBatch")).toHaveLength(0);
  });
});

/* ------------------------------- propunerile ----------------------------- */

describe("ruleazaCiclu — propunerile", () => {
  it("citește TOATE cele patru cozi de propuneri", async () => {
    const db = cicluCuOFirma();
    db.raspunde("reges_mesaje", "select", { data: [] });
    await ruleazaCiclu(db.client, "r");
    for (const cale of [
      "/api/Detasare/Propuneri/ReadBatch",
      "/api/Detasare/PropuneriPrimite/ReadBatch",
      "/api/Mutare/Propuneri/ReadBatch",
      "/api/Mutare/PropuneriPrimite/ReadBatch",
    ]) {
      expect(cereri(cale)).toHaveLength(1);
    }
  });

  it("propunerea primită nouă se scrie cu CNP-ul DOAR mascat; cea cunoscută se sare", async () => {
    const db = cicluCuOFirma();
    db.raspunde("reges_mesaje", "select", { data: [] });
    db.raspunde("reges_propuneri", "select", { data: null });
    db.raspunde("reges_propuneri", "insert", { data: null });
    db.raspunde("reges_propuneri", "select", { data: { id: "deja" } });
    regesDupaCale({
      "/api/Mutare/PropuneriPrimite/ReadBatch": {
        ok: true,
        date: [
          {
            Id: "prop-1",
            CuiAngajator: "RO555",
            NumeAngajator: "Sursa SRL",
            Cnp: "1990101123456",
            DataInceput: "2026-10-01T00:00:00Z",
            TemeiLegal: "Art47",
          },
          { id: "prop-2" },
          { fara: "identificator" },
        ],
        status: 200,
        durataMs: 1,
      },
    });

    const r = await ruleazaCiclu(db.client, "r");

    expect(r.organizatii[0]?.propuneri).toBe(1);
    const [insert] = db.apeluriPe("reges_propuneri", "insert");
    expect(insert?.payload).toMatchObject({
      organization_id: ORG,
      directie: "primita",
      fel: "mutare",
      reges_propunere_id: "prop-1",
      angajator_partener_cui: "RO555",
      angajator_partener_nume: "Sursa SRL",
      salariat_cnp_last4: "3456",
      data_inceput: "2026-10-01",
      temei_legal: "Art47",
      stare: "noua",
    });
    expect(JSON.stringify(insert?.payload)).not.toContain("1990101123456");
    // Deduplicarea caută propunerea DOAR în firma curentă: același id REGES
    // poate exista legitim la altă firmă (sursa și destinația aceleiași detașări).
    const [dedup] = db.apeluriPe("reges_propuneri", "select");
    expect(areFiltru(dedup, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(dedup, "eq", "reges_propunere_id", "prop-1")).toBe(true);
    expect(cereri("/api/Mutare/PropuneriPrimite/CommitReadBatch")[0]?.corp).toEqual({
      messages: 3,
    });
  });
});
