// src/lib/asistent/unelte/flota/propune-foaie.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/queries/fleet", () => ({ listeazaVehicule: vi.fn(), vehicululMeu: vi.fn() }));
vi.mock("@/lib/queries/fleet-rezervari", () => ({
  ocupareaPool: vi.fn(),
  setarileRezervarilor: vi.fn(),
}));
vi.mock("@/lib/queries/flota-asistent", () => ({ foiInInterval: vi.fn() }));
vi.mock("@/lib/queries/soferi", () => ({ permisulAngajatului: vi.fn() }));

import {
  listeazaVehicule,
  vehicululMeu,
  type RandVehicul,
  type RezultatVehicule,
} from "@/lib/queries/fleet";
import { ocupareaPool, setarileRezervarilor } from "@/lib/queries/fleet-rezervari";
import { foiInInterval } from "@/lib/queries/flota-asistent";
import { permisulAngajatului, type RandPermis } from "@/lib/queries/soferi";

import { verificaAcces } from "../poarta";
import { contextFlota, FISA } from "./context-de-test";
import { unealtaPropuneFoaia } from "./propune-foaie";

const ALOCAT = "f0000000-0000-4000-8000-000000000001";
const POOL = "f0000000-0000-4000-8000-000000000002";

const v = (id: string, nr: string, pool = false): RandVehicul =>
  ({ id, nr_inmatriculare: nr, pool, km_curent: 1000, status: "activ" }) as RandVehicul;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(vehicululMeu).mockResolvedValue({ alocate: [v(ALOCAT, "B123ABC")], pool: [] });
  vi.mocked(listeazaVehicule).mockResolvedValue({
    randuri: [v(ALOCAT, "B123ABC"), v(POOL, "B456POL", true)],
    urmatorulCursor: null,
    total: 2,
  } as unknown as RezultatVehicule);
  vi.mocked(foiInInterval).mockResolvedValue([]);
  vi.mocked(ocupareaPool).mockResolvedValue([]);
  vi.mocked(setarileRezervarilor).mockResolvedValue({
    cuAprobare: false,
    obligatorie: false,
    maxZile: 14,
  });
  vi.mocked(permisulAngajatului).mockResolvedValue(null);
});

describe("propune_foaia_de_azi — poarta", () => {
  it("oricine poate întocmi foi: org_admin, super_admin, manager, angajat; nu hr", () => {
    for (const rol of ["super_admin", "org_admin", "manager", "employee"] as const) {
      expect(verificaAcces(unealtaPropuneFoaia, contextFlota(rol)).permis, rol).toBe(true);
    }
    expect(verificaAcces(unealtaPropuneFoaia, contextFlota("hr")).permis).toBe(false);
  });
});

describe("propune_foaia_de_azi — angajatul, în portal", () => {
  it("propune caseta portalului cu mașina lui; nu promite că a creat ceva", async () => {
    const r = await unealtaPropuneFoaia.executa(contextFlota("employee"), {});
    const [propunere] = r.destinatiiEfemere ?? [];
    expect(propunere?.id).toBe(`propune.foaie.${ALOCAT}`);
    expect(propunere?.href).toBe(`/portal/masina-mea?foaie=noua&vehicul=${ALOCAT}`);
    expect(r.text).toContain("Verifică și salvează.");
    expect(r.text).not.toMatch(/am creat|a fost creat|am salvat/u);
    expect(vehicululMeu).toHaveBeenCalledWith(contextFlota("employee").organizationId, FISA);
    expect(listeazaVehicule).not.toHaveBeenCalled();
    // Ziua de azi, pe vehiculul ales, fără foile respinse.
    expect(vi.mocked(foiInInterval).mock.calls[0]?.slice(1)).toEqual([
      "2026-10-22",
      "2026-10-22",
      { vehicleId: ALOCAT, statusuri: ["draft", "trimis", "aprobat"] },
    ]);
  });

  it("foaia de azi există deja: trimite la ea, nu la o casetă nouă", async () => {
    vi.mocked(foiInInterval).mockResolvedValue([
      {
        id: "foaie-azi",
        vehicle_id: ALOCAT,
        employee_id: FISA,
        numar: null,
        data: "2026-10-22",
        status: "draft",
      },
    ]);
    const r = await unealtaPropuneFoaia.executa(contextFlota("employee"), {});
    expect((r.destinatiiEfemere ?? []).map((d) => d.id)).toEqual(["foaie.foaie-azi"]);
    expect(r.destinatiiEfemere?.[0]?.href).toBe("/portal/masina-mea/foi/foaie-azi");
    expect(r.text).toContain("există deja");
  });

  it("fără fișă de angajat, sub `own`, refuză cu motiv", async () => {
    const r = await unealtaPropuneFoaia.executa(contextFlota("employee", { employeeId: null }), {});
    expect(r.text).toContain("nu are fișă de angajat");
    expect(vehicululMeu).not.toHaveBeenCalled();
  });

  it("mai multe mașini, fără număr: le enumeră și întreabă", async () => {
    vi.mocked(vehicululMeu).mockResolvedValue({
      alocate: [v(ALOCAT, "B123ABC")],
      pool: [v(POOL, "B456POL", true)],
    });
    const r = await unealtaPropuneFoaia.executa(contextFlota("employee"), {});
    expect(r.text).toContain("Pe care mașină");
    expect(r.text).toContain("- B456POL (mașină comună)");
    expect(r.destinatiiEfemere).toBeUndefined();
  });

  it("mașina comună ocupată azi de un coleg: nu propune o salvare refuzată", async () => {
    vi.mocked(vehicululMeu).mockResolvedValue({ alocate: [], pool: [v(POOL, "B456POL", true)] });
    vi.mocked(ocupareaPool).mockResolvedValue([
      {
        vehicle_id: POOL,
        de_la: "2026-10-22",
        pana_la: "2026-10-22",
        sursa: "foaie",
        status: null,
        a_mea: false,
        rezervare_id: null,
      },
    ]);
    const r = await unealtaPropuneFoaia.executa(contextFlota("employee"), {});
    expect(r.text).toContain("e deja ocupată de un coleg (foaia zilei)");
    expect(r.destinatiiEfemere).toBeUndefined();
    expect(r.referinte).toEqual(["portal.masina.rezervari"]);
  });

  it("rezervarea obligatorie fără rezervare confirmată: o cere întâi", async () => {
    vi.mocked(vehicululMeu).mockResolvedValue({ alocate: [], pool: [v(POOL, "B456POL", true)] });
    vi.mocked(setarileRezervarilor).mockResolvedValue({
      cuAprobare: true,
      obligatorie: true,
      maxZile: 14,
    });
    const r = await unealtaPropuneFoaia.executa(contextFlota("employee"), {});
    expect(r.text).toContain("Firma cere rezervare confirmată");
    expect(r.destinatiiEfemere).toBeUndefined();
  });

  it("permisul expirat: avertisment, nu blocaj (F9)", async () => {
    vi.mocked(permisulAngajatului).mockResolvedValue({
      expira_la: "2026-10-01",
    } as RandPermis);
    const r = await unealtaPropuneFoaia.executa(contextFlota("employee"), {});
    expect(r.text).toContain("permisul tău de conducere a expirat pe 01.10.2026");
    expect(r.destinatiiEfemere?.[0]?.id).toBe(`propune.foaie.${ALOCAT}`);
  });
});

describe("propune_foaia_de_azi — org_admin, în aplicație", () => {
  it("fără fișă, sub `all`: parcul activ, href-ul casetei din aplicație", async () => {
    const r = await unealtaPropuneFoaia.executa(contextFlota("org_admin", { employeeId: null }), {
      nr_inmatriculare: "b456 pol",
    });
    expect(listeazaVehicule).toHaveBeenCalledOnce();
    expect(vi.mocked(listeazaVehicule).mock.calls[0]?.[1]).toMatchObject({
      status: "activ",
      limita: 100,
    });
    expect(r.destinatiiEfemere?.[0]?.href).toBe(`/flota/foi?vehicul=${POOL}&foaie=noua`);
    // Sub `all`, în aplicație, administratorul alege șoferul: ocuparea nu se judecă pe el.
    expect(ocupareaPool).not.toHaveBeenCalled();
    expect(permisulAngajatului).not.toHaveBeenCalled();
  });

  it("în portal, chiar cu `all`, caseta oferă doar mașinile lui: fără fișă, refuz", async () => {
    const r = await unealtaPropuneFoaia.executa(
      contextFlota("org_admin", { employeeId: null, zona: "portal" }),
      {},
    );
    expect(r.text).toContain("nu are fișă de angajat");
  });

  it("un număr care nu e printre candidate: îl numește și spune unde a căutat", async () => {
    const r = await unealtaPropuneFoaia.executa(contextFlota("org_admin"), {
      nr_inmatriculare: "CJ01XYZ",
    });
    expect(r.text).toContain("Nu găsesc „CJ01XYZ”");
    expect(r.text).toContain("(vehiculele parcului, doar cele active)");
    expect(r.referinte).toEqual(["flota.foi"]);
  });

  it("parcul are peste 100 de vehicule active: nu afirmă că mașina lipsește, spune plafonul casetei", async () => {
    // Caseta din aplicație oferă doar primele 100 (`date-foaie-noua.ts`); un
    // vehicul activ de după ele nu e „negăsit”, e doar în afara casetei.
    vi.mocked(listeazaVehicule).mockResolvedValue({
      randuri: [v(ALOCAT, "B123ABC"), v(POOL, "B456POL", true)],
      urmatorulCursor: "cursor-pagina-2",
      total: 140,
    } as unknown as RezultatVehicule);
    const r = await unealtaPropuneFoaia.executa(contextFlota("org_admin"), {
      nr_inmatriculare: "B999ZZZ",
    });
    expect(r.text).not.toContain("Nu găsesc");
    expect(r.text).toContain("primele 100");
    expect(r.text).toContain("„B999ZZZ”");
    expect(r.destinatiiEfemere).toBeUndefined();
  });
});
