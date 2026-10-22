// src/lib/asistent/unelte/flota/comun.test.ts
/**
 * Bucățile pure ale uneltelor de flotă: normalizarea numărului în ordinea
 * bazei, luna cerută și destinațiile efemere pe zone. Cea mai scumpă greșeală
 * de aici e tăcută: un href din zona greșită devine un buton spre un ecran de
 * refuz, iar un drum scris de mână devine o indicație care nu există în meniu.
 */
import { describe, expect, it } from "vitest";

import { intervalLuna } from "@/domain/fleet/rapoarte";
import { NAV_ITEMS, PORTAL_NAV_ITEMS } from "@/config/navigation";
import type { FeatureKey } from "@/config/features";
import type { PermissionMap } from "@/lib/auth/permissions";

import { destinatiaDupaId } from "../../destinatii";
import {
  destinatieFisa,
  destinatieFoaie,
  destinatiePropunereFoaie,
  destinatieVehicul,
  lunaCeruta,
  lunaInViitor,
  normalizeazaNr,
  peZiua,
  plafoneaza,
  pragZile,
  referintePermise,
  relativLaAzi,
} from "./comun";

const ID = "55555555-5555-4555-8555-555555555555";

describe("normalizeazaNr", () => {
  it("scoate tot ce nu e literă sau cifră și face majuscule", () => {
    expect(normalizeazaNr("b-123 abc")).toBe("B123ABC");
    expect(normalizeazaNr(" CJ 01 xyz ")).toBe("CJ01XYZ");
  });

  it("șterge ÎNAINTE de majuscule, în ordinea din `internal.vehicles_normalizeaza`", () => {
    // `"ß".toUpperCase()` e „SS”, `"ı".toUpperCase()` e „I”: în ordinea inversă,
    // căutarea ar fi primit litere pe care baza le-ar fi șters.
    expect(normalizeazaNr("ß1")).toBe("1");
    expect(normalizeazaNr("ıb12")).toBe("B12");
  });
});

describe("luna cerută", () => {
  it("fără parametri, luna din ziua de azi", () => {
    expect(lunaCeruta("2026-10-22")).toBe("2026-10");
  });

  it("o lună dată fără an, mai mare decât luna curentă, e din anul trecut", () => {
    expect(lunaCeruta("2027-01-05", undefined, 12)).toBe("2026-12");
    expect(lunaCeruta("2026-10-22", undefined, 9)).toBe("2026-09");
  });

  it("anul și luna date se iau ca atare", () => {
    expect(lunaCeruta("2026-10-22", 2025, 3)).toBe("2025-03");
  });

  it("februarie din anul bisect are 29 de zile (intervalul rapoartelor F8)", () => {
    expect(intervalLuna(lunaCeruta("2028-03-01", 2028, 2))).toEqual({
      deLa: "2028-02-01",
      panaLa: "2028-02-29",
    });
  });

  it("recunoaște o lună din viitor", () => {
    expect(lunaInViitor("2026-11", "2026-10-22")).toBe(true);
    expect(lunaInViitor("2026-10", "2026-10-22")).toBe(false);
  });
});

describe("zile și praguri", () => {
  it("pragul se socotește pe zile românești, peste capăt de lună", () => {
    expect(pragZile("2026-10-22", 30)).toBe("2026-11-21");
    expect(pragZile("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("scrie relativ la azi, cu regula lui „de”", () => {
    expect(relativLaAzi("2026-10-22", "2026-10-22")).toBe("azi");
    expect(relativLaAzi("2026-10-22", "2026-10-23")).toBe("în 1 zi");
    expect(relativLaAzi("2026-10-22", "2026-11-13")).toBe("în 22 de zile");
    expect(relativLaAzi("2026-10-22", "2026-10-01")).toBe("acum 21 de zile");
    expect(peZiua("2026-10-22", "2026-11-03")).toBe("pe 03.11.2026 (în 12 zile)");
    expect(peZiua("2026-10-22", "2026-10-22")).toBe("azi, 22.10.2026");
  });

  it("plafonează la 12 rânduri și spune câte au rămas", () => {
    const randuri = Array.from({ length: 15 }, (_, i) => `- ${String(i)}`);
    const plafonate = plafoneaza(randuri);
    expect(plafonate).toHaveLength(13);
    expect(plafonate.at(-1)).toBe("…și încă 3.");
    expect(plafoneaza(randuri.slice(0, 12))).toHaveLength(12);
  });
});

describe("destinațiile efemere", () => {
  const dinZona = (zona: "app" | "portal") => [
    destinatieVehicul(zona, ID, "B123ABC"),
    destinatieFoaie(zona, ID, "FP-2026-0042"),
    destinatiePropunereFoaie(zona, ID, "B123ABC"),
  ];

  it("niciun href din portal nu duce în aplicație", () => {
    for (const d of dinZona("portal")) {
      expect(d.href.startsWith("/portal/"), d.id).toBe(true);
      expect(d.href.startsWith("/flota"), d.id).toBe(false);
      expect(d.zona).toBe("portal");
    }
  });

  it("în aplicație, href-urile sunt ale flotei", () => {
    const [vehicul, foaie, propunere] = dinZona("app");
    expect(vehicul?.href).toBe(`/flota/${ID}`);
    expect(foaie?.href).toBe(`/flota/foi/${ID}`);
    expect(propunere?.href).toBe(`/flota/foi?vehicul=${ID}&foaie=noua`);
  });

  it("propunerea din portal deschide caseta cu vehiculul ales", () => {
    expect(destinatiePropunereFoaie("portal", ID, "B1").href).toBe(
      `/portal/masina-mea?foaie=noua&vehicul=${ID}`,
    );
  });

  it("prefixele sunt cele trei din D7", () => {
    const [vehicul, foaie, propunere] = dinZona("app");
    expect(vehicul?.id).toBe(`vehicul.${ID}`);
    expect(foaie?.id).toBe(`foaie.${ID}`);
    expect(propunere?.id).toBe(`propune.foaie.${ID}`);
  });

  it("drumul e al destinației statice părinte, plus eticheta — nu un literal", () => {
    expect(destinatieVehicul("app", ID, "B123ABC").drum).toEqual([
      ...(destinatiaDupaId("flota")?.drum ?? ["lipsă"]),
      "B123ABC",
    ]);
    expect(destinatieFoaie("portal", ID, "FP-1").drum).toEqual([
      ...(destinatiaDupaId("portal.masina")?.drum ?? ["lipsă"]),
      "FP-1",
    ]);
    expect(destinatieFisa(ID, "Ion Popescu").drum).toEqual([
      ...(destinatiaDupaId("angajati")?.drum ?? ["lipsă"]),
      "Ion Popescu",
    ]);
    // Drumul nu are voie să fie doar eticheta: părintele trebuie să existe.
    expect(destinatieVehicul("app", ID, "B1").drum.length).toBeGreaterThan(1);
  });

  it("părintele fiecărei destinații e o intrare reală de meniu, în zona ei", () => {
    const app = new Set(NAV_ITEMS.map((i) => i.id));
    const portal = new Set(PORTAL_NAV_ITEMS.map((i) => i.id));
    for (const d of [...dinZona("app"), destinatieFisa(ID, "X")]) {
      expect(app.has(d.parinte ?? ""), d.id).toBe(true);
    }
    for (const d of dinZona("portal")) {
      expect(portal.has(d.parinte ?? ""), d.id).toBe(true);
    }
  });

  it("poarta pastilei e a paginii-țintă", () => {
    expect(destinatieVehicul("app", ID, "B1").permission).toBe("vehicles:read");
    expect(destinatieVehicul("portal", ID, "B1").permission).toBe("trip_sheets:read");
    expect(destinatiePropunereFoaie("app", ID, "B1").permission).toBe("trip_sheets:create");
  });
});

describe("referintePermise", () => {
  const context = (
    zona: "app" | "portal",
    permisiuni: Readonly<Record<string, "own" | "team" | "all">>,
  ) => ({
    zona,
    features: new Set<FeatureKey>(["nucleu", "fleet"]),
    permisiuni: new Map(Object.entries(permisiuni)) as PermissionMap,
  });

  it("taie identificatorii inexistenți, din altă zonă sau fără drept", () => {
    expect(
      referintePermise(context("app", { "vehicles:read": "own", "trip_sheets:read": "own" }), [
        "flota",
        "flota.foi",
        "portal.masina",
        "flota.amenzi",
        "inventat.de.model",
      ]),
    ).toEqual(["flota", "flota.foi"]);
  });

  it("în portal, doar destinațiile portalului", () => {
    expect(
      referintePermise(context("portal", { "trip_sheets:read": "own" }), [
        "flota",
        "portal.masina",
      ]),
    ).toEqual(["portal.masina"]);
  });

  it("modulul stins taie tot ce ține de el", () => {
    expect(
      referintePermise(
        {
          ...context("app", { "vehicles:read": "all" }),
          features: new Set<FeatureKey>(["nucleu"]),
        },
        ["flota"],
      ),
    ).toEqual([]);
  });
});
