// src/app/(app)/angajati/nou/actions.test.ts
//
// Înrolarea unificată (fișă + contract + pașii opționali) și ciorna ei.
// Straturile comune ale lui `createAction` sunt verificate în testul canonic
// (`salarizare/actions.test.ts`).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("@/lib/teste/actiune")).falsuri.nextHeaders());
vi.mock("next/server", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.nextServer(await orig()),
);
vi.mock("next/cache", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.nextCache(await orig()),
);
vi.mock("@/lib/tenant/resolve-tenant", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.resolveTenant(await orig()),
);
vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);
vi.mock("@/lib/supabase/admin", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseAdmin(),
);
vi.mock("@/lib/auth/features", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.features(await orig()),
);
vi.mock("@/lib/auth/permissions", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.permissions(await orig()),
);

// Colaboratorii cu propriile interogări sau propriile `createAction`: aici se
// verifică doar ce le cere înrolarea și cum reacționează la eșecul lor.
const f = vi.hoisted(() => ({
  documente: vi.fn(),
  invitatie: vi.fn(),
  reges: vi.fn(),
  predaObiect: vi.fn(),
  fisaAptitudine: vi.fn(),
  autorizatie: vi.fn(),
}));
vi.mock("@/lib/documents/inrolare", async (orig) => ({
  ...(await orig<typeof import("@/lib/documents/inrolare")>()),
  genereazaDocumenteInrolare: f.documente,
}));
vi.mock("@/lib/invitatii/creeaza", async (orig) => ({
  ...(await orig<typeof import("@/lib/invitatii/creeaza")>()),
  creeazaInvitatie: f.invitatie,
}));
vi.mock("@/lib/reges/genereaza-evenimente", async (orig) => ({
  ...(await orig<typeof import("@/lib/reges/genereaza-evenimente")>()),
  genereazaEvenimenteReges: f.reges,
}));
vi.mock("@/app/(app)/inventar/actions", () => ({ predaObiect: f.predaObiect }));
vi.mock("@/app/(app)/ssm/actions", () => ({
  adaugaFisaAptitudine: f.fisaAptitudine,
  adaugaAutorizatieNominala: f.autorizatie,
}));

import {
  asteaptaDupa,
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { inroleazaAngajat, salveazaCiornaInrolare, stergeCiornaInrolare } from "./actions";

const PERMIS = { "employees:create": "all" } as const;
const SUB_PRAG = { "employees:create": "team" } as const;
const CNP = "1960101010109";

const INTRARE = {
  last_name: "Popescu",
  first_name: "Ion",
  cnp: CNP,
  reges_tip_act: "CarteIdentitate",
  tip_act_identitate: "ce scrie clientul",
  serie_act: "CJ",
  numar_act: "123456",
  act_eliberat_de: "SPCLEP Cluj",
  act_eliberat_la: "2020-01-01",
  adresa_strada: "Str. Teiului 4",
  adresa_oras: "Cluj-Napoca",
  adresa_judet: "Cluj",
  hired_on: "2026-10-01",
  functie: "Sudor MAG",
  data_contract: "2026-09-28",
  valabil_de_la: "2026-10-01",
  salariu_baza: 5000,
};

type Fals = ReturnType<typeof configureazaActiunea>["server"];

/** Calea minimă: fără e-mail, fără pași opționali, fără șablon de integrare. */
function programeazaInrolarea(server: Fals, sabloane: unknown[] = []) {
  server.raspundeRpc("urmatoarea_marca", { data: "0001" });
  server.raspunde("employees", "insert", { data: { id: ID_1, full_name: "Popescu Ion" } });
  server.raspundeRpc("hr_write_sensitive", { data: null });
  server.raspundeRpc("aloca_numar_contract", { data: "CIM-1" });
  server.raspunde("employment_contracts", "insert", { data: { id: ID_2 } });
  server.raspunde("employment_contracts", "update", { data: { id: ID_2 } });
  server.raspundeRpc("seed_leave_balances", { data: null });
  server.raspunde("checklist_templates", "select", { data: sabloane });
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  for (const fals of Object.values(f)) fals.mockReset();
  f.documente.mockResolvedValue({ documente: [], avertismente: [] });
  f.reges.mockResolvedValue({ create: 1, respinse: [] });
});

describe("inroleazaAngajat", () => {
  it("employees:create sub `all` (team): INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: SUB_PRAG });
    const r = await inroleazaAngajat(INTRARE);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
  });

  it("succes: fișă activă cu marca din contor și actul DERIVAT din REGES; contract alocat automat, apoi activat", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaInrolarea(server);

    const r = await inroleazaAngajat(INTRARE);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({
      id: ID_1,
      contractId: ID_2,
      numarContract: "CIM-1",
      invitatieTrimisaLa: null,
      checklistPornit: null,
    });

    const fisa = server.apeluriPe("employees", "insert")[0]?.payload as Record<string, unknown>;
    expect(fisa).toMatchObject({
      last_name: "Popescu",
      marca: "0001",
      organization_id: ORG_ID,
      status: "activ",
      tip_act_identitate: "Carte de identitate",
      created_by: USER_ID,
    });
    for (const cheie of ["cnp", "iban", "salariu_baza", "numar", "inventory_item_ids"]) {
      expect(fisa).not.toHaveProperty(cheie);
    }

    const [contract] = server.apeluriPe("employment_contracts", "insert");
    expect(contract?.payload).toMatchObject({
      employee_id: ID_1,
      numar: "CIM-1",
      status: "proiect",
      este_act_aditional: false,
      functie: "Sudor MAG",
      salariu_baza: 5000,
      organization_id: ORG_ID,
    });
    const [activare] = server.apeluriPe("employment_contracts", "update");
    expect(activare?.payload).toEqual({ status: "activ", updated_by: USER_ID });
    expect(areFiltru(activare, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(activare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(activare?.selectDupaScriere).toBeDefined();

    expect(server.apeluriRpc.find((a) => a.nume === "seed_leave_balances")?.argumente).toEqual({
      p_employee: ID_1,
      p_an: 2026,
      p_zile_odihna_override: 21,
    });
    expect(caiRevalidate()).toEqual([
      "/angajati",
      "/reges",
      "/concedii/sold",
      "/onboarding",
      "/setari/membri",
    ]);
  });

  it("CNP-ul nu apare în clar în nicio interogare și în niciun rând de audit", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaInrolarea(server);
    await inroleazaAngajat(INTRARE);
    await asteaptaDupa();
    expect(JSON.stringify(server.apeluri)).not.toContain(CNP);
    expect(JSON.stringify(server.apeluriRpc)).not.toContain(CNP);
    const sensibil = server.apeluriRpc.find((a) => a.nume === "hr_write_sensitive");
    expect(sensibil?.argumente).toMatchObject({ p_employee: ID_1, p_cnp_last4: "0109" });
  });

  it("fără e-mail și fără șablon de integrare: înrolarea reușește, dar SPUNE ce n-a făcut", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaInrolarea(server);
    const r = await inroleazaAngajat(INTRARE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(f.invitatie).not.toHaveBeenCalled();
    expect(r.data.avertismente).toHaveLength(2);
    expect(r.data.avertismente[0]).toContain("nu are e-mail");
    expect(r.data.avertismente[1]).toContain("șablon de integrare");
  });

  it("cetățean român cu pașaport: VALIDARE pe `reges_tip_act`, nicio scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await inroleazaAngajat({ ...INTRARE, reges_tip_act: "Pasaport" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("reges_tip_act");
    expect(server.apeluri).toHaveLength(0);
  });

  it("numărul ales de om e deja folosit: CONFLICT care îl numește, fără realocare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeRpc("urmatoarea_marca", { data: "0001" });
    server.raspunde("employees", "insert", { data: { id: ID_1, full_name: "Popescu Ion" } });
    server.raspundeRpc("hr_write_sensitive", { data: null });
    server.raspunde("employment_contracts", "insert", {
      error: eroarePostgrest("23505", "duplicate key", "Key violates contracts_org_numar_uniq"),
    });

    const r = await inroleazaAngajat({ ...INTRARE, numar: "77" });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("„77”");
    expect(server.apeluriRpc.filter((a) => a.nume === "aloca_numar_contract")).toHaveLength(0);
    expect(server.apeluriPe("employment_contracts", "insert")).toHaveLength(1);
  });

  it("numărul alocat automat a fost luat între timp: realocă și reîncearcă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeRpc("urmatoarea_marca", { data: "0001" });
    server.raspunde("employees", "insert", { data: { id: ID_1, full_name: "Popescu Ion" } });
    server.raspundeRpc("hr_write_sensitive", { data: null });
    server.raspundeRpc("aloca_numar_contract", { data: "CIM-1" });
    server.raspunde("employment_contracts", "insert", {
      error: eroarePostgrest("23505", "contracts_org_numar_uniq"),
    });
    server.raspundeRpc("aloca_numar_contract", { data: "CIM-2" });
    server.raspunde("employment_contracts", "insert", { data: { id: ID_2 } });
    server.raspunde("employment_contracts", "update", { data: { id: ID_2 } });
    server.raspundeRpc("seed_leave_balances", { data: null });
    server.raspunde("checklist_templates", "select", { data: [] });

    const r = await inroleazaAngajat(INTRARE);

    expect(r).toMatchObject({ ok: true, data: { numarContract: "CIM-2" } });
    const inserari = server.apeluriPe("employment_contracts", "insert");
    expect(inserari.map((a) => (a.payload as { numar: string }).numar)).toEqual(["CIM-1", "CIM-2"]);
  });

  it("23505 pe ALT index decât numărul: nu se reîncearcă (n-ar arde numere din registru)", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeRpc("urmatoarea_marca", { data: "0001" });
    server.raspunde("employees", "insert", { data: { id: ID_1, full_name: "Popescu Ion" } });
    server.raspundeRpc("hr_write_sensitive", { data: null });
    server.raspundeRpc("aloca_numar_contract", { data: "CIM-1" });
    server.raspunde("employment_contracts", "insert", {
      error: eroarePostgrest("23505", "contracts_un_contract_activ_uniq"),
    });

    const r = await inroleazaAngajat(INTRARE);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriRpc.filter((a) => a.nume === "aloca_numar_contract")).toHaveLength(1);
  });

  it("cinci numere la rând luate: CONFLICT „numerotarea e ocupată”", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeRpc("urmatoarea_marca", { data: "0001" });
    server.raspunde("employees", "insert", { data: { id: ID_1, full_name: "Popescu Ion" } });
    server.raspundeRpc("hr_write_sensitive", { data: null });
    for (let i = 0; i < 5; i += 1) {
      server.raspundeRpc("aloca_numar_contract", { data: `CIM-${i}` });
      server.raspunde("employment_contracts", "insert", {
        error: eroarePostgrest("23505", "contracts_org_numar_uniq"),
      });
    }
    const r = await inroleazaAngajat(INTRARE);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("Numerotarea");
    expect(server.apeluriPe("employment_contracts", "insert")).toHaveLength(5);
  });

  it("activarea contractului respinsă tăcut: CONFLICT, nu „angajat înrolat”", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeRpc("urmatoarea_marca", { data: "0001" });
    server.raspunde("employees", "insert", { data: { id: ID_1, full_name: "Popescu Ion" } });
    server.raspundeRpc("hr_write_sensitive", { data: null });
    server.raspundeRpc("aloca_numar_contract", { data: "CIM-1" });
    server.raspunde("employment_contracts", "insert", { data: { id: ID_2 } });
    server.raspunde("employment_contracts", "update", { data: null });
    const r = await inroleazaAngajat(INTRARE);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(f.documente).not.toHaveBeenCalled();
  });

  it("punctul de lucru: se caută în organizație, iar denumirea lui se îngheață în `loc_munca`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("puncte_lucru", "select", { data: { denumire: "Hala Nord" } });
    programeazaInrolarea(server);

    await inroleazaAngajat({ ...INTRARE, punct_lucru_id: ID_3, loc_munca: "ce a scris omul" });

    const [punct] = server.apeluriPe("puncte_lucru");
    expect(areFiltru(punct, "eq", "id", ID_3)).toBe(true);
    expect(areFiltru(punct, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(server.apeluriPe("employment_contracts", "insert")[0]?.payload).toMatchObject({
      punct_lucru_id: ID_3,
      loc_munca: "Hala Nord",
    });
  });

  it("punctul de lucru a dispărut: CONFLICT, contractul nu se creează", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeRpc("urmatoarea_marca", { data: "0001" });
    server.raspunde("employees", "insert", { data: { id: ID_1, full_name: "Popescu Ion" } });
    server.raspundeRpc("hr_write_sensitive", { data: null });
    server.raspunde("puncte_lucru", "select", { data: null });
    const r = await inroleazaAngajat({ ...INTRARE, punct_lucru_id: ID_3 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("employment_contracts")).toHaveLength(0);
  });

  it("atribuțiile se scriu în fișa postului, una pe rând, fără rânduri goale", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaInrolarea(server);
    server.raspunde("job_descriptions", "insert", { data: { id: ID_3 } });

    await inroleazaAngajat({ ...INTRARE, atributii: "Sudează\n\n  Verifică piese  \n" });

    expect(server.apeluriPe("job_descriptions")[0]?.payload).toMatchObject({
      organization_id: ORG_ID,
      employee_id: ID_1,
      contract_id: ID_2,
      atributii: ["Sudează", "Verifică piese"],
      competente: [],
    });
    expect(f.documente.mock.calls[0]?.[1]).toMatchObject({
      fisaPostului: { atributii: ["Sudează", "Verifică piese"] },
    });
  });

  it("șablonul de integrare potrivit pornește checklistul relativ la începerea activității", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaInrolarea(server, [
      { id: ID_3, denumire: "Integrare generală", department_id: null, cod_cor: null },
    ]);
    server.raspunde("checklist_instances", "insert", { data: null });

    const r = await inroleazaAngajat(INTRARE);

    expect(r).toMatchObject({ ok: true, data: { checklistPornit: "Integrare generală" } });
    const [sabloane] = server.apeluriPe("checklist_templates");
    expect(areFiltru(sabloane, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(sabloane, "eq", "tip", "onboarding")).toBe(true);
    expect(areFiltru(sabloane, "eq", "activ", true)).toBe(true);
    expect(server.apeluriPe("checklist_instances")[0]?.payload).toMatchObject({
      template_id: ID_3,
      employee_id: ID_1,
      data_referinta: "2026-10-01",
    });
  });

  it("cu e-mail personal: invitația pleacă pe adresa fișei, cu rolul `employee`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaInrolarea(server);
    f.invitatie.mockResolvedValue({ email: "ion@exemplu.ro", emailTrimis: true });

    const r = await inroleazaAngajat({ ...INTRARE, email_personal: "Ion@Exemplu.ro" });

    expect(r).toMatchObject({ ok: true, data: { invitatieTrimisaLa: "ion@exemplu.ro" } });
    expect(f.invitatie.mock.calls[0]?.[0]).toMatchObject({
      organizationId: ORG_ID,
      email: "ion@exemplu.ro",
      rol: "employee",
      employeeId: ID_1,
    });
  });

  it("invitația eșuează: înrolarea rămâne reușită, cu avertisment", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaInrolarea(server);
    f.invitatie.mockRejectedValue(new Error("fără drept"));
    const r = await inroleazaAngajat({ ...INTRARE, email_personal: "ion@exemplu.ro" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.invitatieTrimisaLa).toBeNull();
    expect(r.data.avertismente.some((a) => a.includes("Invitația"))).toBe(true);
  });

  it("componentele salariale intră pe contract, de la începutul lui; eșecul lor e avertisment", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaInrolarea(server);
    server.raspunde("salary_components", "insert", { error: eroarePostgrest("42501") });

    const r = await inroleazaAngajat({
      ...INTRARE,
      componente_salariale: [{ component_type_id: ID_3, kind: "spor_suma", suma: 200 }],
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(server.apeluriPe("salary_components")[0]?.payload).toEqual([
      expect.objectContaining({
        organization_id: ORG_ID,
        employee_id: ID_1,
        contract_id: ID_2,
        component_type_id: ID_3,
        suma: 200,
        valabil_de_la: "2026-10-01",
      }),
    ]);
    expect(r.data.avertismente.some((a) => a.includes("Sporurile"))).toBe(true);
  });

  it("REVISAL eșuează: avertisment cu termenul legal, înrolarea rămâne", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaInrolarea(server);
    f.reges.mockRejectedValue(new Error("x"));
    const r = await inroleazaAngajat(INTRARE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.avertismente.some((a) => a.includes("REVISAL"))).toBe(true);
  });

  it("soldul de concediu nu se poate semăna: înrolarea eșuează, fără documente și fără invitație", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeRpc("urmatoarea_marca", { data: "0001" });
    server.raspunde("employees", "insert", { data: { id: ID_1, full_name: "Popescu Ion" } });
    server.raspundeRpc("hr_write_sensitive", { data: null });
    server.raspundeRpc("aloca_numar_contract", { data: "CIM-1" });
    server.raspunde("employment_contracts", "insert", { data: { id: ID_2 } });
    server.raspunde("employment_contracts", "update", { data: { id: ID_2 } });
    server.raspundeRpc("seed_leave_balances", { error: eroarePostgrest("42501") });

    const r = await inroleazaAngajat({ ...INTRARE, email_personal: "ion@exemplu.ro" });

    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(f.documente).not.toHaveBeenCalled();
    expect(f.invitatie).not.toHaveBeenCalled();
    expect(f.reges).not.toHaveBeenCalled();
  });

  describe("cetățean străin cu permis de muncă", () => {
    const STRAIN = {
      ...INTRARE,
      cetatenie: "MD",
      reges_tip_act: "Pasaport",
      serie_act: null,
      permis_tip: "aviz",
      permis_numar: "AV-123",
      permis_emis_de: "IGI",
      permis_valabil_de_la: "2026-09-01",
      permis_valabil_pana: "2027-08-31",
      numar_pasaport: "P1234567",
    };

    it("permisul complet se înregistrează pe fișă, cu cetățenia omului", async () => {
      const { server } = configureazaActiunea({ permisiuni: PERMIS });
      programeazaInrolarea(server);
      server.raspunde("work_permits", "insert", { data: null });

      const r = await inroleazaAngajat(STRAIN);

      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(server.apeluriPe("work_permits", "insert")[0]?.payload).toEqual({
        organization_id: ORG_ID,
        employee_id: ID_1,
        tip_permis: "aviz",
        numar: "AV-123",
        emis_de: "IGI",
        valabil_de_la: "2026-09-01",
        valabil_pana: "2027-08-31",
        numar_pasaport: "P1234567",
        cetatenie: "MD",
        created_by: USER_ID,
        updated_by: USER_ID,
      });
      expect(r.data.avertismente.some((a) => a.includes("Permisul de muncă"))).toBe(false);
    });

    it("permisul refuzat de bază: înrolarea rămâne, cu avertismentul despre contravenție", async () => {
      const { server } = configureazaActiunea({ permisiuni: PERMIS });
      programeazaInrolarea(server);
      server.raspunde("work_permits", "insert", { error: eroarePostgrest("42501") });

      const r = await inroleazaAngajat(STRAIN);

      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.data.avertismente.some((a) => a.includes("Permisul de muncă"))).toBe(true);
    });
  });

  it("scutirile fiscale intră pe contract, de la începutul lui", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaInrolarea(server);
    server.raspunde("employee_tax_exemptions", "insert", { data: null });

    const r = await inroleazaAngajat({
      ...INTRARE,
      scutiri_fiscale: [{ exemption_type: "it", procent_scutire: 100, plafon_lunar: 10000 }],
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(server.apeluriPe("employee_tax_exemptions", "insert")[0]?.payload).toEqual([
      expect.objectContaining({
        organization_id: ORG_ID,
        employee_id: ID_1,
        contract_id: ID_2,
        exemption_type: "it",
        procent_scutire: 100,
        plafon_lunar: 10000,
        valabil_de_la: "2026-10-01",
        created_by: USER_ID,
      }),
    ]);
    expect(r.data.avertismente.some((a) => a.includes("Scutirile fiscale"))).toBe(false);
  });

  it("scutirile fiscale refuzate: avertisment că primul stat reține impozit, înrolarea rămâne", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaInrolarea(server);
    server.raspunde("employee_tax_exemptions", "insert", { error: eroarePostgrest("42501") });

    const r = await inroleazaAngajat({
      ...INTRARE,
      scutiri_fiscale: [{ exemption_type: "it", procent_scutire: 100 }],
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.avertismente.some((a) => a.includes("Scutirile fiscale"))).toBe(true);
  });

  it("fiecare autorizație nominală se înregistrează pe angajatul nou; cea care aruncă devine avertisment", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaInrolarea(server);
    f.autorizatie
      .mockResolvedValueOnce({ ok: true, data: { id: ID_3 } })
      .mockRejectedValueOnce(new Error("fără drept"));

    const r = await inroleazaAngajat({
      ...INTRARE,
      autorizatii: [
        { tip: "ISCIR", numar: "A-1", emitent: "ISCIR", valabil_pana: "2028-01-01" },
        { tip: "Electrician", numar: "A-2", emitent: "ANRE", valabil_pana: "2028-06-01" },
      ],
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(f.autorizatie).toHaveBeenCalledTimes(2);
    expect(f.autorizatie.mock.calls[0]?.[0]).toMatchObject({
      employee_id: ID_1,
      tip: "ISCIR",
      numar: "A-1",
      emitent: "ISCIR",
      valabil_pana: "2028-01-01",
    });
    expect(f.autorizatie.mock.calls[1]?.[0]).toMatchObject({ employee_id: ID_1, numar: "A-2" });
    const despreAutorizatii = r.data.avertismente.filter((a) => a.includes("Autorizația"));
    expect(despreAutorizatii).toHaveLength(1);
    expect(despreAutorizatii[0]).toContain("Electrician");
  });

  it("invitația creată, dar e-mailul n-a plecat: nicio adresă raportată, avertisment de retrimitere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaInrolarea(server);
    f.invitatie.mockResolvedValue({ email: "ion@exemplu.ro", emailTrimis: false });

    const r = await inroleazaAngajat({ ...INTRARE, email_personal: "ion@exemplu.ro" });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.invitatieTrimisaLa).toBeNull();
    expect(r.data.avertismente.some((a) => a.includes("e-mailul nu a plecat"))).toBe(true);
  });

  it("checklistul refuzat de bază: nu se raportează pornit, iar avertismentul o spune", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaInrolarea(server, [
      { id: ID_3, denumire: "Integrare generală", department_id: null, cod_cor: null },
    ]);
    server.raspunde("checklist_instances", "insert", { error: eroarePostgrest("42501") });

    const r = await inroleazaAngajat(INTRARE);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.checklistPornit).toBeNull();
    expect(r.data.avertismente.some((a) => a.includes("Checklistul"))).toBe(true);
  });

  it("avertismentele generatorului de documente ajung în rezultatul înrolării", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaInrolarea(server);
    f.documente.mockResolvedValue({
      documente: [],
      avertismente: ["Fișa postului nu a putut fi emisă."],
    });

    const r = await inroleazaAngajat(INTRARE);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.avertismente).toContain("Fișa postului nu a putut fi emisă.");
  });

  it("punctul de lucru și șabloanele de integrare retrase logic nu se folosesc", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("puncte_lucru", "select", { data: { denumire: "Hala Nord" } });
    programeazaInrolarea(server);

    await inroleazaAngajat({ ...INTRARE, punct_lucru_id: ID_3 });

    expect(areFiltru(server.apeluriPe("puncte_lucru")[0], "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(server.apeluriPe("checklist_templates")[0], "is", "deleted_at", null)).toBe(
      true,
    );
  });

  it("autorizația refuzată (adaugaAutorizatieNominala întoarce `ok: false`, nu aruncă) produce avertismentul promis", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaInrolarea(server);
    f.autorizatie.mockResolvedValue({ ok: false, error: { code: "INTERZIS", message: "x" } });

    const r = await inroleazaAngajat({
      ...INTRARE,
      autorizatii: [{ tip: "ISCIR", numar: "A-1", emitent: "ISCIR", valabil_pana: "2028-01-01" }],
    });

    expect(f.autorizatie).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) return;
    expect(r.data.avertismente).toEqual(
      expect.arrayContaining([expect.stringContaining("Autorizația")]),
    );
  });

  it("bunul de inventar refuzat (predaObiect întoarce `ok: false`, nu aruncă) produce avertismentul promis", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaInrolarea(server);
    f.predaObiect.mockResolvedValue({ ok: false, error: { code: "INTERZIS", message: "x" } });

    const r = await inroleazaAngajat({ ...INTRARE, inventory_item_ids: [ID_3] });

    expect(f.predaObiect).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) return;
    expect(r.data.avertismente).toEqual(
      expect.arrayContaining([expect.stringContaining("bun de inventar")]),
    );
  });

  it("fișa de aptitudine refuzată (adaugaFisaAptitudine întoarce `ok: false`) produce avertismentul promis", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaInrolarea(server);
    f.fisaAptitudine.mockResolvedValue({ ok: false, error: { code: "INTERZIS", message: "x" } });

    const r = await inroleazaAngajat({ ...INTRARE, examen_data: "2026-09-20" });

    expect(f.fisaAptitudine).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) return;
    expect(r.data.avertismente).toEqual(
      expect.arrayContaining([expect.stringContaining("aptitudine")]),
    );
  });
});

// ── Ciorna ───────────────────────────────────────────────────────────────────

describe("salveazaCiornaInrolare", () => {
  const intrare = { pas: 3, eticheta: "Popescu Ion", date: { cnp: CNP, last_name: "Popescu" } };

  it("employees:create sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: SUB_PRAG });
    const r = await salveazaCiornaInrolare(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("prima salvare: o ciornă per autor și organizație, cu fereastra de 30 de zile", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("inrolare_ciorne", "select", { data: null });
    server.raspunde("inrolare_ciorne", "insert", { data: { id: ID_1 } });

    const inainte = Date.now();
    const r = await salveazaCiornaInrolare(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [cautare] = server.apeluriPe("inrolare_ciorne", "select");
    expect(areFiltru(cautare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(cautare, "eq", "autor_id", USER_ID)).toBe(true);
    expect(areFiltru(cautare, "is", "deleted_at", null)).toBe(true);
    const payload = server.apeluriPe("inrolare_ciorne", "insert")[0]?.payload as {
      expira_la: string;
    };
    expect(payload).toMatchObject({
      organization_id: ORG_ID,
      autor_id: USER_ID,
      pas: 3,
      eticheta: "Popescu Ion",
      date: intrare.date,
    });
    const peste = new Date(payload.expira_la).getTime() - inainte;
    expect(peste).toBeGreaterThan(29.9 * 24 * 3600 * 1000);
    expect(peste).toBeLessThan(30.1 * 24 * 3600 * 1000);
    expect(server.apeluriPe("inrolare_ciorne", "upsert")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("datele ciornei (CNP inclus) nu intră în jurnalul de audit — doar pasul", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("inrolare_ciorne", "select", { data: null });
    server.raspunde("inrolare_ciorne", "insert", { data: { id: ID_1 } });
    await salveazaCiornaInrolare(intrare);
    await asteaptaDupa();
    expect(JSON.stringify(server.audituri())).not.toContain(CNP);
    const [succes] = server.audituri().filter((a) => a["p_status"] === "success");
    expect(succes?.["p_after"]).toEqual({ pas: 3 });
  });

  it("ciornă existentă: o actualizează pe id + organizație, fără o a doua inserare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("inrolare_ciorne", "select", { data: { id: ID_2 } });
    server.raspunde("inrolare_ciorne", "update", { data: { id: ID_2 } });

    const r = await salveazaCiornaInrolare(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [update] = server.apeluriPe("inrolare_ciorne", "update");
    expect(areFiltru(update, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    expect(server.apeluriPe("inrolare_ciorne", "insert")).toHaveLength(0);
  });

  it("ciorna ștearsă între citire și scriere (zero rânduri): se reia ca inserare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("inrolare_ciorne", "select", { data: { id: ID_2 } });
    server.raspunde("inrolare_ciorne", "update", { data: null });
    server.raspunde("inrolare_ciorne", "insert", { data: { id: ID_3 } });
    const r = await salveazaCiornaInrolare(intrare);
    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
  });

  it("pas în afara asistentului (7): VALIDARE", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await salveazaCiornaInrolare({ ...intrare, pas: 7 });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("stergeCiornaInrolare", () => {
  it("employees:create sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: SUB_PRAG });
    const r = await stergeCiornaInrolare({});
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: ciorna proprie se citește, apoi se șterge LOGIC prin `sterge_logic`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("inrolare_ciorne", "select", { data: [{ id: ID_1 }] });
    server.raspundeRpc("sterge_logic", { data: [ID_1] });

    const r = await stergeCiornaInrolare({});

    expect(r).toEqual({ ok: true, data: { sters: true } });
    const [citire, ...altele] = server.apeluriPe("inrolare_ciorne");
    expect(altele).toHaveLength(0);
    expect(citire?.operatie).toBe("select");
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "eq", "autor_id", USER_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    // Nu un UPDATE direct: politica SELECT l-ar respinge mereu cu 42501 (0164).
    const apel = server.apeluriRpc.find((a) => a.nume === "sterge_logic");
    expect(apel?.argumente).toEqual({ p_tabela: "inrolare_ciorne", p_ids: [ID_1] });
    expect(caiRevalidate()).toEqual(["/angajati/nou"]);
  });

  it("nicio ciornă (a doua apăsare): succes cu `sters: false`, fără apel de ștergere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("inrolare_ciorne", "select", { data: [] });
    const r = await stergeCiornaInrolare({});
    expect(r).toEqual({ ok: true, data: { sters: false } });
    expect(server.apeluriRpc.filter((a) => a.nume === "sterge_logic")).toHaveLength(0);
  });
});
