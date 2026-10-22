// src/app/api/export/flota/pachet/route.test.ts
//
// Pachetul lunar pentru contabil (F8), pe clientul fals: poarta, plafonul de foi,
// luna fără foi și arhiva care iese (Excel + câte un PDF pe foaie aprobată + jurnalul
// de costuri din F12g).

import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("@/lib/teste/actiune")).falsuri.nextHeaders());
vi.mock("@/lib/tenant/resolve-tenant", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.resolveTenant(await orig()),
);
vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);
vi.mock("@/lib/auth/features", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.features(await orig()),
);
vi.mock("@/lib/auth/permissions", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.permissions(await orig()),
);

import { PLAFON_FOI_PACHET } from "@/domain/fleet/rapoarte";
import { configureazaActiunea, ID_1, USER_ID, type ConfigurareActiune } from "@/lib/teste/actiune";
import { areFiltru, type ClientFals } from "@/lib/teste/supabase-fals";

import { GET } from "./route";

const ADMIN: ConfigurareActiune = {
  permisiuni: {
    "vehicles:read": "all",
    "trip_sheets:read": "all",
    "vehicles:export": "all",
  },
};
const SOFER = "88888888-8888-4888-8888-888888888888";

let db: ClientFals;
beforeEach(() => {
  db = configureazaActiunea(ADMIN).server;
});

const cere = (parametri: string) =>
  GET(new Request(`https://exemplu.test/api/export/flota/pachet${parametri}`));

const vehicul = {
  id: ID_1,
  nr_inmatriculare: "B100ABC",
  categorie: "autoturism",
  tip_combustibil: "motorina",
  consum_mediu_declarat: 7,
};

function programeazaPachet(): void {
  db.raspunde("trip_sheets", "select", { data: null, count: 1 });
  db.raspunde("trip_sheets", "select", {
    data: [
      {
        id: ID_1,
        vehicle_id: ID_1,
        employee_id: SOFER,
        numar: "FP-2026-0001",
        data: "2026-09-02",
        km_plecare: 1000,
        km_sosire: 1400,
        km_parcursi: 400,
        observatii: null,
        trimis_la: "2026-09-02T15:00:00Z",
        aprobat_de: USER_ID,
        aprobat_la: "2026-09-03T08:00:00Z",
        vehicul_nr: "B100ABC",
        vehicul_categorie: "autoturism",
        vehicul_combustibil: "motorina",
        norma_l_100km: 7,
        alimentari: [
          {
            alimentat_la: "2026-09-02T10:00:00Z",
            litri: 36,
            cost: 252.5,
            statie: "Petrom",
            numar_bon: "123",
            plin: true,
          },
        ],
        curse: [
          {
            id: "c1",
            ordine: 1,
            plecare_la: "2026-09-02T05:00:00Z",
            sosire_la: "2026-09-02T09:00:00Z",
            de_la_loc: "Sediu",
            pana_la_loc: "Client",
            scop: "Livrare",
            km_plecare: 1000,
            km_sosire: 1400,
            km_parcursi: 400,
          },
        ],
      },
    ],
  });
  db.raspunde("trip_sheets", "select", { data: [] });
  // Câte două: raportul (F8) și jurnalul de costuri (F12g) citesc aceleași tabele.
  db.raspunde("vehicle_service_entries", "select", { data: [] });
  db.raspunde("vehicle_service_entries", "select", { data: [] });
  db.raspunde("vehicle_expenses", "select", { data: [] });
  db.raspunde("vehicle_expenses", "select", { data: [] });
  db.raspunde("vehicle_documents", "select", { data: [] });
  // Jurnalul de costuri (F12g): firma, alimentarea lunii, cardul, regimul fiscal.
  db.raspunde("organizations", "select", {
    data: {
      name: "Firma Test",
      legal_name: "Firma Test SRL",
      cui: "RO1",
      cui_normalizat: "1",
      platitor_tva: true,
    },
  });
  db.raspunde("fuel_entries", "select", {
    data: [
      {
        id: ID_1,
        alimentat_la: "2026-09-02T10:00:00Z",
        cost: 252.5,
        litri: 36,
        numar_bon: "123",
        statie: "Petrom",
        cui_statie: null,
        foaie: {
          status: "aprobat",
          deleted_at: null,
          vehicle_id: ID_1,
          vehicul_nr: "B100ABC",
          vehicul_combustibil: "motorina",
          vehicul: {
            nr_inmatriculare: "B100ABC",
            masa_maxima_kg: null,
            tip_combustibil: "motorina",
          },
          sofer: { full_name: "Popescu Ion" },
        },
      },
    ],
  });
  db.raspunde("fuel_card_transactions", "select", { data: [] });
  db.raspunde("vehicle_fiscal_regimes", "select", { data: [] });
  db.raspunde("vehicles", "select", { data: [vehicul] });
  db.raspunde("vehicles", "select", { data: [vehicul] });
  const angajat = { id: SOFER, full_name: "Popescu Ion", marca: "M1", deleted_at: null };
  db.raspunde("employees", "select", { data: [angajat] });
  db.raspunde("employees", "select", { data: [angajat] });
  db.raspunde("profiles", "select", { data: { full_name: "Ionescu Maria", email: "m@x.ro" } });
  db.raspunde("organizations", "select", {
    data: {
      name: "Firma Test",
      legal_name: "Firma Test SRL",
      forma_juridica: "SRL",
      cui: "RO1",
      reg_com: null,
      adresa: null,
      oras: null,
      judet: null,
      capital_social: null,
      capital_social_varsat: null,
      sistem_dualist: false,
      telefon_contact: null,
      email_contact: null,
    },
  });
  db.raspunde("organization_branding", "select", { data: null });
}

describe("GET /api/export/flota/pachet", () => {
  it("fără cheia `vehicles:export`: 403, iar baza nu e atinsă", async () => {
    db = configureazaActiunea({
      permisiuni: { "vehicles:read": "all", "trip_sheets:read": "all" },
    }).server;
    expect((await cere("?luna=2026-09")).status).toBe(403);
    expect(db.apeluri).toHaveLength(0);
  });

  it("luna lipsă sau invalidă: 400", async () => {
    expect((await cere("")).status).toBe(400);
    expect((await cere("?luna=2026-00")).status).toBe(400);
  });

  it("luna fără nicio foaie aprobată: 404 cu explicație, nu o arhivă goală", async () => {
    db.raspunde("trip_sheets", "select", { data: null, count: 0 });
    const r = await cere("?luna=2026-09");
    expect(r.status).toBe(404);
    expect(await r.text()).toContain("nicio foaie aprobată");
  });

  it("peste plafon: 413, cu numărul foilor și îndemnul spre un vehicul, fără să genereze un PDF", async () => {
    db.raspunde("trip_sheets", "select", { data: null, count: PLAFON_FOI_PACHET + 1 });
    const r = await cere("?luna=2026-09");
    expect(r.status).toBe(413);
    const text = await r.text();
    expect(text).toContain(String(PLAFON_FOI_PACHET + 1));
    expect(text).toContain(String(PLAFON_FOI_PACHET));
    expect(text).toContain("vehicul");
    // Doar numărătoarea a atins foile; nu s-a citit nicio foaie întreagă.
    expect(db.apeluriPe("trip_sheets")).toHaveLength(1);
  });

  it("plafonul se aplică și pe un vehicul ales (numărătoarea îl poartă)", async () => {
    db.raspunde("vehicles", "select", { data: [vehicul] });
    db.raspunde("trip_sheets", "select", { data: null, count: PLAFON_FOI_PACHET + 5 });
    const r = await cere(`?luna=2026-09&vehicul=${ID_1}`);
    expect(r.status).toBe(413);
    expect(areFiltru(db.apeluriPe("trip_sheets")[0], "eq", "vehicle_id", ID_1)).toBe(true);
  });

  it("administratorul primește un ZIP cu Excelul și PDF-ul foii aprobate", async () => {
    programeazaPachet();
    const r = await cere("?luna=2026-09");

    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/zip");
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="pachet-flota-2026-09.zip"',
    );
    expect(r.headers.get("cache-control")).toBe("private, no-store");

    const zip = await JSZip.loadAsync(new Uint8Array(await r.arrayBuffer()));
    const nume = Object.keys(zip.files).filter((n) => !zip.files[n]?.dir);
    expect(nume.sort()).toEqual([
      "foi/foaie-de-parcurs-b100abc-2026-09-02-fp-2026-0001.pdf",
      "jurnal-costuri-flota-2026-09.csv",
      "raport-flota-2026-09.xlsx",
    ]);
    // F12g (I-g7): jurnalul cu conturile PROPUSE, nu un fișier de import.
    const jurnal = await zip.file("jurnal-costuri-flota-2026-09.csv")?.async("string");
    expect(jurnal).toContain('"123"');
    expect(jurnal).toContain("propuse — de confirmat cu contabilul");
    expect(jurnal).toContain('"Combustibil";6022');
    const xlsx = await JSZip.loadAsync(
      (await zip.file("raport-flota-2026-09.xlsx")?.async("uint8array")) ?? new Uint8Array(),
    );
    const texte = await xlsx.file("xl/sharedStrings.xml")?.async("string");
    expect(texte).toContain("FP-2026-0001");
    // Tot ce s-a citit a fost cu firma explicită.
    expect(areFiltru(db.apeluriPe("trip_sheets")[1], "eq", "status", "aprobat")).toBe(true);
  });
});
