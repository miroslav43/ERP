// src/app/(app)/flota/rapoarte/prezentare-raport.test.tsx
//
// Corpul raportului lunar, randat din domeniu: ce vede administratorul (cifrele,
// foile care nu intră în cifre, butoanele de descărcare) și ce NU vede cine n-are
// cheia de export. Pagina întreagă n-a rulat într-un browser: baza din cloud n-are
// încă migrările fazei, deci nu are cu ce date să se deschidă.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }),
  usePathname: () => "/flota/rapoarte",
  useSearchParams: () => new URLSearchParams(),
}));

import {
  consumPeVehicul,
  costPeVehicul,
  intervalLuna,
  kmPeSofer,
  PLAFON_FOI_PACHET,
  registruFoi,
  totaluriCost,
  totaluriLuna,
  type FoaieRaport,
  type FoiNeaprobate,
  type RaportLunar,
} from "@/domain/fleet/rapoarte";

import { PrezentareRaport } from "./prezentare-raport";

const V1 = "11111111-1111-4111-8111-111111111111";
const S1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VEHICUL = "22222222-2222-4222-8222-222222222222";

const foaie = (i: number, m: Partial<FoaieRaport> = {}): FoaieRaport => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  vehicle_id: V1,
  employee_id: S1,
  numar: `FP-2026-${String(i).padStart(4, "0")}`,
  data: "2026-09-02",
  km_parcursi: 400,
  vehicul_nr: "B100ABC",
  vehicul_combustibil: "motorina",
  norma_l_100km: 7,
  alimentari: [{ litri: 36, cost: 252.5 }],
  ...m,
});

function raport(
  foi: readonly FoaieRaport[],
  neaprobate: FoiNeaprobate = { ciorne: 0, trimise: 0, respinse: 0 },
  vehicul: string | null = null,
): RaportLunar {
  const vehicule = new Map([[V1, "B100ABC"]]);
  const soferi = new Map([[S1, "Popescu Ion"]]);
  const costuri = costPeVehicul(
    {
      foi,
      servicii: foi.length === 0 ? [] : [{ vehicle_id: V1, cost_total: 750 }],
      cheltuieli: [],
      documente: [],
    },
    vehicule,
  );
  return {
    luna: "2026-09",
    interval: intervalLuna("2026-09"),
    vehicul,
    totaluri: totaluriLuna(foi),
    foiNeaprobate: neaprobate,
    consum: consumPeVehicul(foi, vehicule),
    soferi: kmPeSofer(foi, soferi),
    costuri,
    totalCost: totaluriCost(costuri),
    registru: registruFoi(foi, vehicule, soferi),
  };
}

const randeaza = (
  r: RaportLunar,
  m: Partial<{ poateExporta: boolean; poateAproba: boolean }> = {},
) =>
  render(
    <PrezentareRaport
      raport={r}
      poateExporta={m.poateExporta ?? true}
      poateAproba={m.poateAproba ?? true}
    />,
  );

describe("PrezentareRaport", () => {
  it("luna fără nicio activitate: stare goală, nu patru tabele goale", () => {
    randeaza(raport([]));
    expect(screen.getByText("Nicio activitate în septembrie 2026")).toBeTruthy();
    expect(screen.queryByText("Cost pe vehicul")).toBeNull();
  });

  it("cifrele lunii, costul pe vehicul, consumul față de normă și kilometrii pe șofer", () => {
    randeaza(raport([foaie(1)]));

    // 750 service + 252,50 combustibil la 400 km.
    expect(screen.getByText("Foi aprobate").nextElementSibling?.textContent).toBe("1");
    expect(screen.getByText("Cost total").nextElementSibling?.textContent).toContain("1.002,50");
    expect(screen.getByText("Cost pe km").nextElementSibling?.textContent).toContain("2,51");

    const consum = screen.getByRole("heading", { name: "Consum față de normă" }).closest("section");
    // 36 l la 400 km = 9,00 față de norma 7,00: +28,6%, peste pragul de 15%.
    expect(within(consum as HTMLElement).getAllByText("+28,6%").length).toBeGreaterThan(0);

    const soferi = screen.getByRole("heading", { name: "Kilometri pe șofer" }).closest("section");
    expect(within(soferi as HTMLElement).getAllByText("Popescu Ion").length).toBeGreaterThan(0);
  });

  it("fără foi aprobate, costul pe km lipsește și ecranul spune de ce", () => {
    randeaza(raport([], { ciorne: 1, trimise: 0, respinse: 0 }));
    expect(screen.getByText("Cost pe km").nextElementSibling?.textContent).toContain("—");
    expect(screen.getByText("Fără kilometri pe foi aprobate")).toBeTruthy();
  });

  it("foile neaprobate se spun pe față, cu legătura „De aprobat” doar pentru cine poate aproba", () => {
    randeaza(raport([foaie(1)], { ciorne: 1, trimise: 1, respinse: 0 }), { poateAproba: true });
    expect(
      screen.getByText(/Luna mai are 2 foi neaprobate \(1 în ciornă, 1 trimisă\)\./u),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "De aprobat" }).getAttribute("href")).toBe(
      "/flota/aprobari",
    );
  });

  it("fără dreptul de aprobare, avertismentul rămâne dar legătura dispare", () => {
    randeaza(raport([foaie(1)], { ciorne: 0, trimise: 1, respinse: 0 }), { poateAproba: false });
    expect(screen.getByText(/Luna mai are o foaie neaprobată \(1 trimisă\)\./u)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "De aprobat" })).toBeNull();
  });

  it("administratorul are Excelul și pachetul, cu luna și vehiculul în adresă", () => {
    randeaza(raport([foaie(1)], undefined, VEHICUL));
    expect(screen.getByRole("link", { name: "Descarcă Excel" }).getAttribute("href")).toBe(
      `/api/export/flota?luna=2026-09&vehicul=${VEHICUL}`,
    );
    expect(
      screen.getByRole("link", { name: "Pachet pentru contabil (ZIP)" }).getAttribute("href"),
    ).toBe(`/api/export/flota/pachet?luna=2026-09&vehicul=${VEHICUL}`);
    expect(
      screen.getByRole("link", { name: "Vezi foile aprobate ale lunii" }).getAttribute("href"),
    ).toBe(
      `/flota/foi?status=aprobat&de_la=2026-09-01&pana_la=2026-09-30&vehicul=${VEHICUL}`,
    );
  });

  it("fără cheia de export, nicio legătură de descărcare — doar explicația", () => {
    randeaza(raport([foaie(1)]), { poateExporta: false });
    expect(screen.queryByRole("link", { name: "Descarcă Excel" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Pachet pentru contabil/u })).toBeNull();
    expect(screen.getByText(/dreptul de export/u)).toBeTruthy();
  });

  it("peste plafon, pachetul nu se oferă: textul spune de ce și îndeamnă la un vehicul", () => {
    const multe = Array.from({ length: PLAFON_FOI_PACHET + 1 }, (_, i) => foaie(i + 1));
    randeaza(raport(multe));
    expect(screen.getByRole("link", { name: "Descarcă Excel" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Pachet pentru contabil/u })).toBeNull();
    expect(
      screen.getByText(new RegExp(`cel mult ${String(PLAFON_FOI_PACHET)}`, "u")),
    ).toBeTruthy();
  });

  it("pachetul are nevoie de cel puțin o foaie aprobată", () => {
    randeaza(raport([], { ciorne: 0, trimise: 1, respinse: 0 }));
    expect(screen.queryByRole("link", { name: /Pachet pentru contabil/u })).toBeNull();
    expect(screen.getByText(/cel puțin o foaie aprobată/u)).toBeTruthy();
  });
});
