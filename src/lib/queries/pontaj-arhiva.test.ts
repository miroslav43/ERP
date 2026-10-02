// src/lib/queries/pontaj-arhiva.test.ts
//
// Arhiva lunară de pontaj (0134): versiunile ÎN VIGOARE, numărul de registru
// citit separat (legătura e polimorfă, fără FK) și tăierea intervalului de luni.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import {
  arhivaPontajDupaId,
  arhivePontajInInterval,
  listeazaArhivePontaj,
  MAX_LUNI_DOSAR,
} from "./pontaj-arhiva";

const rand = (id: string, an: number, luna: number) => ({
  id,
  an,
  luna,
  versiune: 1,
  motiv: "blocare",
  status_perioada: "blocata",
  checksum: "abc",
  numar_angajati: 3,
  total_ore: 480,
  total_ore_suplimentare: 0,
  total_ore_noapte: 0,
  generat_la: "2026-08-01T00:00:00Z",
});

describe("listeazaArhivePontaj", () => {
  it("doar versiunile în vigoare, neșterse, din anii ceruți, cea mai recentă lună prima", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("pontaj_arhive_lunare", "select", { data: [rand(ID_1, 2026, 7)] });
    server.raspunde("registru_documente", "select", { data: [] });

    await listeazaArhivePontaj(ORG_ID, 2022, 2026);

    const [apel] = server.apeluriPe("pontaj_arhive_lunare");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "gte", "an", 2022)).toBe(true);
    expect(areFiltru(apel, "lte", "an", 2026)).toBe(true);
    expect(areFiltru(apel, "is", "inlocuita_de", null)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "order", "an", { ascending: false })).toBe(true);
    expect(areFiltru(apel, "order", "luna", { ascending: false })).toBe(true);
    expect(apel?.coloane).not.toContain("continut");
  });

  it("numărul de registru se lipește pe arhiva lui; lipsa lui e `null`, nu o eroare", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("pontaj_arhive_lunare", "select", {
      data: [rand(ID_1, 2026, 7), rand(ID_2, 2026, 6)],
    });
    server.raspunde("registru_documente", "select", {
      data: [{ entitate_id: ID_2, numar_afisat: "PON-12/2026" }],
    });

    const r = await listeazaArhivePontaj(ORG_ID, 2026, 2026);

    expect(r.map((a) => [a.id, a.numarAfisat])).toEqual([
      [ID_1, null],
      [ID_2, "PON-12/2026"],
    ]);
    expect(r[0]).toMatchObject({ an: 2026, luna: 7, total_ore: 480 });
    const [registru] = server.apeluriPe("registru_documente");
    expect(areFiltru(registru, "eq", "entitate_tip", "pontaj_arhive_lunare")).toBe(true);
    expect(areFiltru(registru, "in", "entitate_id", [ID_1, ID_2])).toBe(true);
  });

  it("arhivă goală ⇒ listă goală, fără drum la registru", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("pontaj_arhive_lunare", "select", { data: null });
    expect(await listeazaArhivePontaj(ORG_ID, 2022, 2026)).toEqual([]);
    expect(server.apeluriPe("registru_documente")).toHaveLength(0);
  });

  it("eroarea registrului se propagă", async () => {
    const { server } = configureazaActiunea();
    const eroare = eroarePostgrest("42501");
    server.raspunde("pontaj_arhive_lunare", "select", { data: [rand(ID_1, 2026, 7)] });
    server.raspunde("registru_documente", "select", { error: eroare });
    await expect(listeazaArhivePontaj(ORG_ID, 2026, 2026)).rejects.toBe(eroare);
  });
});

describe("arhivaPontajDupaId", () => {
  it("o arhivă anume, CU conținut, pe id + organizație (inclusiv o versiune înlocuită)", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("pontaj_arhive_lunare", "select", {
      data: { ...rand(ID_1, 2026, 7), continut: { zile: [] } },
    });
    server.raspunde("registru_documente", "select", {
      data: [{ entitate_id: ID_1, numar_afisat: "PON-1/2026" }],
    });

    const r = await arhivaPontajDupaId(ORG_ID, ID_1);

    expect(r).toMatchObject({ id: ID_1, continut: { zile: [] }, numarAfisat: "PON-1/2026" });
    const [apel] = server.apeluriPe("pontaj_arhive_lunare");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "is", "inlocuita_de")).toBe(false);
    expect(apel?.coloane).toContain("continut");
  });

  it("negăsită ⇒ null, fără drum la registru", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("pontaj_arhive_lunare", "select", { data: null });
    expect(await arhivaPontajDupaId(ORG_ID, ID_1)).toBeNull();
    expect(server.apeluriPe("registru_documente")).toHaveLength(0);
  });
});

describe("arhivePontajInInterval", () => {
  it("taie capetele anilor la lunile cerute, cronologic", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("pontaj_arhive_lunare", "select", {
      data: [
        rand("a", 2024, 10),
        rand("b", 2024, 11),
        rand("c", 2025, 6),
        rand("d", 2026, 2),
        rand("e", 2026, 3),
      ],
    });
    server.raspunde("registru_documente", "select", { data: [] });

    const r = await arhivePontajInInterval(ORG_ID, { an: 2024, luna: 11 }, { an: 2026, luna: 2 });

    expect(r.map((a) => a.id)).toEqual(["b", "c", "d"]);
    const [apel] = server.apeluriPe("pontaj_arhive_lunare");
    // Funcția alimentează dosarul exportat: organizația și ștergerea logică
    // nu sunt opționale.
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "gte", "an", 2024)).toBe(true);
    expect(areFiltru(apel, "lte", "an", 2026)).toBe(true);
    expect(areFiltru(apel, "is", "inlocuita_de", null)).toBe(true);
    expect(areFiltru(apel, "order", "an", { ascending: true })).toBe(true);
    expect(areFiltru(apel, "order", "luna", { ascending: true })).toBe(true);
    // Registrul se cere doar pentru lunile rămase după tăiere.
    const [registru] = server.apeluriPe("registru_documente");
    expect(areFiltru(registru, "in", "entitate_id", ["b", "c", "d"])).toBe(true);
  });

  it("aceeași lună la ambele capete ⇒ exact luna aceea", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("pontaj_arhive_lunare", "select", {
      data: [rand("a", 2026, 1), rand("b", 2026, 2), rand("c", 2026, 3)],
    });
    server.raspunde("registru_documente", "select", { data: [] });
    const r = await arhivePontajInInterval(ORG_ID, { an: 2026, luna: 2 }, { an: 2026, luna: 2 });
    expect(r.map((a) => a.id)).toEqual(["b"]);
  });

  it(`dosarul se plafonează la ${String(MAX_LUNI_DOSAR)} de luni, primele cronologic`, async () => {
    const { server } = configureazaActiunea();
    const luni = Array.from({ length: 72 }, (_, i) =>
      rand(`l${String(i)}`, 2020 + Math.floor(i / 12), (i % 12) + 1),
    );
    server.raspunde("pontaj_arhive_lunare", "select", { data: luni });
    server.raspunde("registru_documente", "select", { data: [] });

    const r = await arhivePontajInInterval(ORG_ID, { an: 2020, luna: 1 }, { an: 2025, luna: 12 });

    expect(r).toHaveLength(MAX_LUNI_DOSAR);
    expect(r[0]?.id).toBe("l0");
    expect(r.at(-1)?.id).toBe(`l${String(MAX_LUNI_DOSAR - 1)}`);
  });

  it("nimic în interval ⇒ listă goală, fără drum la registru", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("pontaj_arhive_lunare", "select", { data: [rand(ID_3, 2023, 5)] });
    const r = await arhivePontajInInterval(ORG_ID, { an: 2023, luna: 6 }, { an: 2023, luna: 12 });
    expect(r).toEqual([]);
    expect(server.apeluriPe("registru_documente")).toHaveLength(0);
  });
});
