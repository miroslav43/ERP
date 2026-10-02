// src/app/(app)/salarizare/actions-fluturasi.test.ts
//
// `trimiteFluturasii`: un PDF per salariat, pe e-mail. Generarea PDF-ului,
// antetul firmei și trimiterea propriu-zisă sunt înlocuite cu spioni — aici se
// verifică ce ALEGE acțiunea (cine primește, pe ce adresă, ce intră în corpul
// mesajului, cum se numără eșecurile), nu cum arată documentul.

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

// Cusăturile proprii ale acțiunii: PDF, antet, e-mail.
vi.mock("@/lib/pdf/antet-organizatie", () => ({ antetOrganizatie: vi.fn() }));
vi.mock("@/lib/pdf/fluturas", () => ({ genereazaFluturas: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));

import type { AntetOrganizatie } from "@/lib/documents/bloc-firma";
import { sendEmail } from "@/lib/email/send";
import { antetOrganizatie } from "@/lib/pdf/antet-organizatie";
import { genereazaFluturas } from "@/lib/pdf/fluturas";
import { caiRevalidate, configureazaActiunea, ID_1, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";
import { trimiteFluturasii } from "./actions";

const ANTET: AntetOrganizatie = {
  denumire: "Firma Test SRL",
  formaJuridica: "S.R.L.",
  cui: "RO123",
  regCom: "J12/1/2020",
  adresa: "Str. Test 1",
  capitalSocial: 200,
  capitalVarsat: null,
  sistemDualist: false,
  telefon: null,
  email: null,
  pozitie: "antet",
  sigla: null,
};

const PDF = new Uint8Array([37, 80, 68, 70]);

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.mocked(antetOrganizatie).mockReset().mockResolvedValue(ANTET);
  vi.mocked(genereazaFluturas).mockReset().mockResolvedValue(PDF);
  vi.mocked(sendEmail)
    .mockReset()
    .mockResolvedValue({ ok: true, status: "queued", logId: null, providerId: null });
});

const PERMIS = { "payroll:export": "all" } as const;

type Angajat = {
  full_name: string | null;
  marca: string;
  email_serviciu: string | null;
  email_personal: string | null;
  functie: string | null;
};

function rand(id: string, angajat: Partial<Angajat> | null) {
  return {
    id,
    baza_salariu: 5000,
    suma_ore_suplimentare: 0,
    spor_noapte: 0,
    prime_total: 0,
    valoare_tichete: 0,
    brut: 5000,
    cas: 1250,
    cass: 500,
    deducere_personala: 0,
    scutire_fiscala: 0,
    impozit: 325,
    net: 2925,
    retineri_total: 0,
    net_de_plata: 2925,
    rest_de_plata: 2925,
    zile_lucratoare_luna: 21,
    zile_lucrate: 21,
    zile_concediu_odihna: 0,
    zile_concediu_medical: 0,
    ore_lucrate: 168,
    ore_suplimentare: 0,
    ore_noapte: 0,
    calc_warnings: [{ cod: "X", mesaj: "Avertisment de test" }],
    angajat:
      angajat === null
        ? null
        : {
            full_name: "Ion Pop",
            marca: "7",
            email_serviciu: null,
            email_personal: null,
            functie: "Contabil",
            ...angajat,
          },
  };
}

function programeazaPerioada(server: ClientFals, status: string, randuri: unknown[] = []): void {
  server.raspunde("payroll_periods", "select", {
    data: { id: ID_1, an: 2026, luna: 8, status },
  });
  server.raspunde("payroll_entries", "select", { data: randuri });
}

describe("trimiteFluturasii", () => {
  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:export": "team" } });
    const r = await trimiteFluturasii({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("dreptul de citire a salariilor nu ajunge: cere `payroll:export`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:read": "all" } });
    const r = await trimiteFluturasii({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("perioadă inexistentă: NEGASIT, fără nicio trimitere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_periods", "select", { data: null });

    const r = await trimiteFluturasii({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each(["draft", "calculat"])(
    "perioadă în starea %s: CONFLICT — un fluturaș dintr-o ciornă nu pleacă",
    async (status) => {
      const { server } = configureazaActiunea({ permisiuni: PERMIS });
      server.raspunde("payroll_periods", "select", {
        data: { id: ID_1, an: 2026, luna: 8, status },
      });

      const r = await trimiteFluturasii({ id: ID_1 });

      expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
      expect(server.apeluriPe("payroll_entries")).toHaveLength(0);
      expect(sendEmail).not.toHaveBeenCalled();
    },
  );

  it("eroare la citirea rândurilor: eșec, nu „0 trimise” cu succes", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_periods", "select", {
      data: { id: ID_1, an: 2026, luna: 8, status: "aprobat" },
    });
    server.raspunde("payroll_entries", "select", { error: eroarePostgrest("57014") });

    const r = await trimiteFluturasii({ id: ID_1 });

    expect(r).toMatchObject({
      ok: false,
      error: { code: "EROARE_INTERNA", message: "Operațiunea a durat prea mult și a fost oprită." },
    });
    expect(antetOrganizatie).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(caiRevalidate()).toEqual([]);
  });

  it.each(["aprobat", "inchis"])("perioadă în starea %s: rândurile se citesc", async (status) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaPerioada(server, status);

    const r = await trimiteFluturasii({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { trimise: 0, faraAdresa: 0, esuate: 0 } });
    const [perioada] = server.apeluriPe("payroll_periods");
    expect(areFiltru(perioada, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(perioada, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(perioada, "is", "deleted_at", null)).toBe(true);
    const [intrari] = server.apeluriPe("payroll_entries");
    expect(areFiltru(intrari, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(intrari, "eq", "period_id", ID_1)).toBe(true);
    expect(areFiltru(intrari, "is", "deleted_at", null)).toBe(true);
    // Funcția vine din coloana `functie`, nu din embed-ul desființat în 0110.
    expect(intrari?.coloane).toContain("functie");
    expect(caiRevalidate()).toEqual(["/salarizare", "/panou"]);
  });

  it("e-mailul de serviciu bate e-mailul personal; cel personal e rezerva", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaPerioada(server, "aprobat", [
      rand("r1", { email_serviciu: "ion@firma.ro", email_personal: "ion@gmail.com" }),
      rand("r2", { full_name: "Ana Dan", marca: "9", email_personal: "ana@gmail.com" }),
    ]);

    const r = await trimiteFluturasii({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { trimise: 2, faraAdresa: 0, esuate: 0 } });
    const destinatari = vi.mocked(sendEmail).mock.calls.map(([m]) => m.to);
    expect(destinatari).toEqual(["ion@firma.ro", "ana@gmail.com"]);
  });

  it("cifrele stau doar în PDF: corpul mesajului poartă numele, firma și luna, nimic altceva", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaPerioada(server, "aprobat", [rand("r1", { email_serviciu: "ion@firma.ro" })]);

    await trimiteFluturasii({ id: ID_1 });

    const [[mesaj]] = vi.mocked(sendEmail).mock.calls as [[Parameters<typeof sendEmail>[0]]];
    expect(mesaj.template).toBe("fluturas");
    // Idempotența e pe rândul de salariu: același fluturaș nu pleacă de două ori.
    expect(mesaj.entityId).toBe("r1");
    expect(mesaj.data).toEqual({
      nume: "Ion Pop",
      organizatie: "Firma Test SRL",
      luna: "august",
      an: 2026,
    });
    // Jurnalul de e-mail se scrie prin clientul de platformă, nu prin cel al utilizatorului.
    expect(mesaj.db).toBe(admin.client);
    const [atasament] = mesaj.atasamente ?? [];
    expect(atasament?.filename).toMatch(/^fluturas-august-2026-7.*\.pdf$/u);
    expect(atasament?.contentBase64).toBe(Buffer.from(PDF).toString("base64"));
  });

  it("PDF-ul primește restul de plată, funcția și avertismentele calculului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaPerioada(server, "inchis", [rand("r1", { email_serviciu: "ion@firma.ro" })]);

    await trimiteFluturasii({ id: ID_1 });

    expect(genereazaFluturas).toHaveBeenCalledWith(
      expect.objectContaining({
        organizatie: ANTET,
        an: 2026,
        luna: 8,
        angajatNume: "Ion Pop",
        angajatMarca: "7",
        functie: "Contabil",
        restDePlata: 2925,
        avertismente: ["Avertisment de test"],
      }),
    );
    expect(antetOrganizatie).toHaveBeenCalledWith(expect.anything(), ORG_ID, "Firma Test");
  });

  it("fără adresă (lipsă, goală sau doar spații): se numără, nu se trimite", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaPerioada(server, "aprobat", [
      rand("r1", {}),
      rand("r2", { email_serviciu: "   " }),
      rand("r3", null),
    ]);

    const r = await trimiteFluturasii({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { trimise: 0, faraAdresa: 3, esuate: 0 } });
    expect(genereazaFluturas).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("un eșec de trimitere sau de generare nu oprește restul lotului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaPerioada(server, "aprobat", [
      rand("r1", { email_serviciu: "a@firma.ro" }),
      rand("r2", { email_serviciu: "b@firma.ro" }),
      rand("r3", { email_serviciu: "c@firma.ro" }),
      rand("r4", { email_serviciu: "d@firma.ro" }),
    ]);
    vi.mocked(sendEmail)
      .mockResolvedValueOnce({ ok: true, status: "sent", logId: null, providerId: "p1" })
      .mockResolvedValueOnce({
        ok: false,
        motiv: "provider",
        message: "refuzat",
        logId: null,
      });
    vi.mocked(genereazaFluturas)
      .mockResolvedValueOnce(PDF)
      .mockResolvedValueOnce(PDF)
      .mockRejectedValueOnce(new Error("font lipsă"));

    const r = await trimiteFluturasii({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { trimise: 2, faraAdresa: 0, esuate: 2 } });
    expect(vi.mocked(sendEmail).mock.calls.map(([m]) => m.to)).toEqual([
      "a@firma.ro",
      "b@firma.ro",
      "d@firma.ro",
    ]);
  });
});
