// src/app/(app)/flota/amenzi/prezentare-vehicul.test.tsx
//
// Secțiunea „Amenzi și incidente” a fișei vehiculului (/flota/[id]): ce se
// arată fiecărui drept și unde duc legăturile. Datele vin deja citite (prin
// RLS) de `SectiuneAmenziVehicul`; aici e doar prezentarea, într-un DOM.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RandAmenda, RandIncident } from "@/lib/queries/flota-amenzi";

import { PrezentareAmenziVehicul } from "./prezentare-vehicul";

const VEHICUL = "11111111-1111-4111-8111-111111111111";

const amenda = (m: Partial<RandAmenda> = {}): RandAmenda => ({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  vehicle_id: VEHICUL,
  numar_pv: "PV 12/A",
  data_pv: "2026-10-09",
  constatata_la: "2026-10-09T06:30:00Z",
  locul: null,
  fapta: "Depășirea vitezei legale",
  autoritate: null,
  suma: 580,
  primita_la: "2026-10-11",
  termen_raspuns: "2026-10-25",
  stadiu: "primita",
  sofer_desemnat_id: null,
  desemnat_la: null,
  raspuns_trimis_la: null,
  raspuns_numar: null,
  motiv: null,
  observatii: null,
  ...m,
});

const incident = (m: Partial<RandIncident> = {}): RandIncident => ({
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  vehicle_id: VEHICUL,
  tip: "avarie",
  produs_la: "2026-10-11T13:00:00Z",
  locul: "Parcarea sediului",
  descriere: "Oglinda stângă spartă",
  sofer_id: null,
  stadiu: "raportat",
  cost_estimat: null,
  cost_final: null,
  despagubire: null,
  asigurator: null,
  dosar_numar: null,
  work_accident_id: null,
  inchis_la: null,
  observatii: null,
  declarat_de_employee_id: null,
  ...m,
});

describe("PrezentareAmenziVehicul", () => {
  it("cu ambele drepturi: amenzile și incidentele vehiculului, cu legături spre fișe și spre listele filtrate", () => {
    render(
      <PrezentareAmenziVehicul
        vehiculId={VEHICUL}
        azi="2026-10-22"
        amenzi={{ randuri: [amenda()], total: 7 }}
        incidente={{ randuri: [incident()], total: 1 }}
      />,
    );
    const amenzi = screen.getByRole("region", { name: "Amenzi" });
    expect(
      within(amenzi)
        .getByRole("link", { name: /PV 12\/A/u })
        .getAttribute("href"),
    ).toBe("/flota/amenzi/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(
      within(amenzi)
        .getByRole("link", { name: /Toate cele 7 amenzi ale vehiculului/u })
        .getAttribute("href"),
    ).toBe(`/flota/amenzi?vehicul=${VEHICUL}`);
    // Termenul de răspuns: 25.10 față de 22.10 → mai sunt 3 zile.
    expect(within(amenzi).getByText(/Mai sunt 3 zile/u)).toBeTruthy();

    const incidente = screen.getByRole("region", { name: "Incidente și daune" });
    expect(
      within(incidente)
        .getByRole("link", { name: /Avarie/u })
        .getAttribute("href"),
    ).toBe("/flota/incidente/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(
      within(incidente)
        .getByRole("link", { name: /Lista incidentelor vehiculului/u })
        .getAttribute("href"),
    ).toBe(`/flota/incidente?vehicul=${VEHICUL}`);
  });

  it("fără dreptul pe amenzi (de ex. managerul, hr): nicio urmă a amenzilor", () => {
    const { container } = render(
      <PrezentareAmenziVehicul
        vehiculId={VEHICUL}
        azi="2026-10-22"
        amenzi={null}
        incidente={{ randuri: [], total: 0 }}
      />,
    );
    expect(screen.queryByRole("region", { name: "Amenzi" })).toBeNull();
    expect(container.textContent).not.toMatch(/amend/iu);
    expect(screen.getByRole("region", { name: "Incidente și daune" })).toBeTruthy();
    expect(screen.getByText(/Niciun incident înregistrat/u)).toBeTruthy();
  });

  it("fără niciun drept: nu se randează nimic", () => {
    const { container } = render(
      <PrezentareAmenziVehicul
        vehiculId={VEHICUL}
        azi="2026-10-22"
        amenzi={null}
        incidente={null}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("declarația din portal se spune pe rând", () => {
    render(
      <PrezentareAmenziVehicul
        vehiculId={VEHICUL}
        azi="2026-10-22"
        amenzi={null}
        incidente={{
          randuri: [incident({ declarat_de_employee_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" })],
          total: 1,
        }}
      />,
    );
    expect(screen.getByText(/declarat de șofer/u)).toBeTruthy();
  });
});
