// src/app/(app)/flota/incidente/componente-incidente.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  `../actions-amenzi` e un modul `"use server"`: se înlocuiește cu spioni. Ce se
  verifică aici e ce PLEACĂ din casete (cheile schemelor), ce stadii se oferă și
  unde ajunge eroarea bazei. Verificarea în browser nu e posibilă: baza din
  cloud n-are migrarea 0206, deci componentele sunt probate doar în happy-dom.
*/
const raporteazaIncident = vi.fn();
const actualizeazaIncident = vi.fn();
const schimbaStadiulIncidentului = vi.fn();
const stergeIncident = vi.fn();
vi.mock("../actions-amenzi", () => ({
  raporteazaIncident: (...a: unknown[]) => raporteazaIncident(...a),
  actualizeazaIncident: (...a: unknown[]) => actualizeazaIncident(...a),
  schimbaStadiulIncidentului: (...a: unknown[]) => schimbaStadiulIncidentului(...a),
  stergeIncident: (...a: unknown[]) => stergeIncident(...a),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/flota/incidente",
}));

import { golesteToasturi } from "@/components/ui/toast";
import type {
  CercetareSsm,
  OptiuneSofer,
  OptiuneVehiculAmenda,
  RandIncident,
} from "@/lib/queries/flota-amenzi";

import { ButonStergeIncident, DialogStadiuIncident } from "./actiuni-incident";
import { DialogIncident } from "./dialog-incident";

function asiguraDialogNativ(): void {
  const proto = globalThis.HTMLDialogElement?.prototype;
  if (proto === undefined) return;
  if (typeof proto.showModal !== "function") {
    proto.showModal = function () {
      this.open = true;
    };
  }
  if (typeof proto.close !== "function") {
    proto.close = function () {
      this.open = false;
    };
  }
}
asiguraDialogNativ();

const INCIDENT_ID = "a1a1a1a1-1111-4111-8111-111111111111";
const VEHICUL = "b2b2b2b2-2222-4222-8222-222222222222";
const ANA = "c3c3c3c3-3333-4333-8333-333333333333";
const CERCETARE = "d4d4d4d4-4444-4444-8444-444444444444";

const VEHICULE: readonly OptiuneVehiculAmenda[] = [
  { id: VEHICUL, nr_inmatriculare: "PH12ABC", marca: "Dacia", model: "Logan" },
];
const SOFERI: readonly OptiuneSofer[] = [
  { id: ANA, full_name: "Popescu Ana", marca: "A1", status: "activ" },
];
const CERCETARI: readonly CercetareSsm[] = [
  { id: CERCETARE, numar_intern: "AM-1", data_producerii: "2026-10-11", locul: "Parcare" },
];

const INCIDENT: RandIncident = {
  id: INCIDENT_ID,
  vehicle_id: VEHICUL,
  tip: "coliziune",
  produs_la: "2026-10-11T13:00:00.000Z",
  locul: "Parcarea sediului",
  descriere: "Zgâriere aripă dreapta",
  sofer_id: null,
  stadiu: "raportat",
  cost_estimat: 1200,
  cost_final: null,
  despagubire: null,
  asigurator: null,
  dosar_numar: null,
  work_accident_id: null,
  inchis_la: null,
  observatii: null,
  declarat_de_employee_id: null,
};

function camp(eticheta: RegExp): HTMLInputElement {
  return screen.getByLabelText(eticheta) as HTMLInputElement;
}

async function trimite(): Promise<void> {
  await act(async () => {
    fireEvent.submit(document.querySelector("form")!);
  });
}

beforeEach(() => {
  golesteToasturi();
  for (const spion of [
    raporteazaIncident,
    actualizeazaIncident,
    schimbaStadiulIncidentului,
    stergeIncident,
    push,
  ]) {
    spion.mockReset();
  }
  for (const spion of [
    raporteazaIncident,
    actualizeazaIncident,
    schimbaStadiulIncidentului,
    stergeIncident,
  ]) {
    spion.mockResolvedValue({ ok: true, data: { id: INCIDENT_ID } });
  }
});

describe("DialogIncident — incident nou", () => {
  it("trimite EXACT cheile schemei, fără câmpurile de dosar", async () => {
    render(<DialogIncident fel="nou" vehicule={VEHICULE} soferi={SOFERI} />);
    fireEvent.click(screen.getByRole("button", { name: /Incident nou/ }));

    fireEvent.change(camp(/^Vehicul/), { target: { value: VEHICUL } });
    fireEvent.change(camp(/^Tipul/), { target: { value: "coliziune" } });
    fireEvent.change(camp(/Momentul incidentului/), { target: { value: "2026-10-11T16:00" } });
    fireEvent.change(camp(/^Descrierea/), { target: { value: "Zgâriere aripă dreapta" } });
    fireEvent.change(camp(/Costul estimat/), { target: { value: "1200" } });
    await trimite();

    expect(raporteazaIncident).toHaveBeenCalledTimes(1);
    expect(raporteazaIncident.mock.calls[0]?.[0]).toEqual({
      vehicle_id: VEHICUL,
      tip: "coliziune",
      produs_la: "2026-10-11T16:00",
      locul: "",
      descriere: "Zgâriere aripă dreapta",
      sofer_id: "",
      cost_estimat: "1200",
      observatii: "",
    });
    expect(actualizeazaIncident).not.toHaveBeenCalled();
    // Asigurătorul, dosarul și legătura SSM apar abia la corectură.
    expect(screen.queryByLabelText(/Asigurătorul/)).toBeNull();
  });

  it("eroarea de pe descriere ajunge sub câmp", async () => {
    raporteazaIncident.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDARE",
        message: "Datele introduse nu sunt valide.",
        fieldErrors: { descriere: ["Descrieți incidentul, în cel puțin 3 caractere."] },
        requestId: "t",
      },
    });
    render(<DialogIncident fel="nou" vehicule={VEHICULE} soferi={SOFERI} />);
    fireEvent.click(screen.getByRole("button", { name: /Incident nou/ }));
    await trimite();
    expect(screen.getByText("Descrieți incidentul, în cel puțin 3 caractere.")).toBeTruthy();
  });
});

describe("DialogIncident — corectura", () => {
  it("pornește de la incident, scrie pe același id și trimite legătura SSM aleasă", async () => {
    render(
      <DialogIncident
        fel="corectura"
        incident={INCIDENT}
        soferi={SOFERI}
        cercetari={CERCETARI}
        sugestieSoferId={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Corectează detaliile/ }));

    expect(camp(/^Descrierea/).value).toBe("Zgâriere aripă dreapta");
    // 13:00 UTC = 16:00 ora României (EEST).
    expect(camp(/Momentul incidentului/).value).toBe("2026-10-11T16:00");
    expect(camp(/Costul estimat/).value).toBe("1200");
    fireEvent.change(camp(/^Asigurătorul/), { target: { value: "Allianz" } });
    fireEvent.change(camp(/Cercetarea SSM/), { target: { value: CERCETARE } });
    await trimite();

    expect(actualizeazaIncident).toHaveBeenCalledTimes(1);
    const trimis = actualizeazaIncident.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(trimis).toMatchObject({
      id: INCIDENT_ID,
      asigurator: "Allianz",
      work_accident_id: CERCETARE,
      cost_estimat: "1200",
    });
    expect("vehicle_id" in trimis).toBe(false);
    expect("stadiu" in trimis).toBe(false);
    expect(raporteazaIncident).not.toHaveBeenCalled();
  });

  it("șoferul sugerat precompletează selectorul când incidentul n-are încă unul", () => {
    render(
      <DialogIncident
        fel="corectura"
        incident={INCIDENT}
        soferi={SOFERI}
        cercetari={[]}
        sugestieSoferId={ANA}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Corectează detaliile/ }));
    expect(camp(/Șoferul de atunci/).value).toBe(ANA);
  });

  it("legătura SSM existentă, ieșită din listă (modul oprit, peste primele 100), NU se pierde la salvare", async () => {
    // Fără opțiunea ei, `<select defaultValue>` cade pe „— Fără legătură —” și
    // formularul trimite „”: o simplă corectură de descriere ar șterge legătura.
    const LEGATA = "e5e5e5e5-5555-4555-8555-555555555555";
    render(
      <DialogIncident
        fel="corectura"
        incident={{ ...INCIDENT, work_accident_id: LEGATA }}
        soferi={SOFERI}
        cercetari={[]}
        sugestieSoferId={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Corectează detaliile/ }));
    expect(camp(/Cercetarea SSM/).value).toBe(LEGATA);
    fireEvent.change(camp(/^Descrierea/), { target: { value: "Zgâriere aripă stângă" } });
    await trimite();

    expect(actualizeazaIncident).toHaveBeenCalledTimes(1);
    expect(actualizeazaIncident.mock.calls[0]?.[0]).toMatchObject({ work_accident_id: LEGATA });
  });

  it("legătura SSM citibilă, dar în afara listei, apare cu numărul cercetării", () => {
    render(
      <DialogIncident
        fel="corectura"
        incident={{ ...INCIDENT, work_accident_id: CERCETARE }}
        soferi={SOFERI}
        cercetari={[]}
        cercetareLegata={CERCETARI[0] ?? null}
        sugestieSoferId={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Corectează detaliile/ }));
    expect(camp(/Cercetarea SSM/).value).toBe(CERCETARE);
    expect(screen.getByRole("option", { name: /AM-1 — 2026-10-11, Parcare/ })).toBeTruthy();
  });

  it("șoferul legat, care nu mai e în listă, NU se pierde la salvare", async () => {
    const PLECAT = "f6f6f6f6-6666-4666-8666-666666666666";
    render(
      <DialogIncident
        fel="corectura"
        incident={{ ...INCIDENT, sofer_id: PLECAT }}
        soferi={SOFERI}
        cercetari={[]}
        sugestieSoferId={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Corectează detaliile/ }));
    expect(camp(/Șoferul de atunci/).value).toBe(PLECAT);
    await trimite();
    expect(actualizeazaIncident.mock.calls[0]?.[0]).toMatchObject({ sofer_id: PLECAT });
  });

  it("fără acces SSM (listă goală), selectorul spune de ce nu oferă nimic", () => {
    render(
      <DialogIncident
        fel="corectura"
        incident={INCIDENT}
        soferi={SOFERI}
        cercetari={[]}
        sugestieSoferId={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Corectează detaliile/ }));
    expect(screen.getByText(/Nicio cercetare SSM disponibilă/)).toBeTruthy();
  });
});

describe("DialogStadiuIncident", () => {
  it("nu oferă stadiul curent și nu apare deloc pe un incident închis", () => {
    const { container, rerender } = render(
      <DialogStadiuIncident
        incidentId={INCIDENT_ID}
        stadiu="constatat"
        asigurator={null}
        dosarNumar={null}
        despagubire={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Schimbă stadiul/ }));
    const optiuni = [...document.querySelectorAll("select[name=stadiu] option")].map(
      (o) => o.textContent,
    );
    expect(optiuni).toEqual(["Raportat", "La asigurător", "În reparație", "Închis"]);

    rerender(
      <DialogStadiuIncident
        incidentId={INCIDENT_ID}
        stadiu="inchis"
        asigurator={null}
        dosarNumar={null}
        despagubire={null}
      />,
    );
    expect(container.querySelector("button")).toBeNull();
  });

  it("„la asigurător” trimite asigurătorul și dosarul, cu cheile schemei", async () => {
    render(
      <DialogStadiuIncident
        incidentId={INCIDENT_ID}
        stadiu="constatat"
        asigurator={null}
        dosarNumar={null}
        despagubire={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Schimbă stadiul/ }));
    fireEvent.change(camp(/^Stadiul nou/), { target: { value: "la_asigurator" } });
    fireEvent.change(camp(/^Asigurătorul/), { target: { value: "Allianz" } });
    fireEvent.change(camp(/Numărul dosarului/), { target: { value: "D-77" } });
    await trimite();

    expect(schimbaStadiulIncidentului).toHaveBeenCalledWith({
      id: INCIDENT_ID,
      stadiu: "la_asigurator",
      asigurator: "Allianz",
      dosar_numar: "D-77",
      cost_final: "",
      despagubire: "",
    });
  });

  it("alegerea lui „închis” marchează costul final ca obligatoriu și explică înghețarea", () => {
    render(
      <DialogStadiuIncident
        incidentId={INCIDENT_ID}
        stadiu="in_reparatie"
        asigurator="Allianz"
        dosarNumar={null}
        despagubire={900}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Schimbă stadiul/ }));
    expect(camp(/Costul final/).required).toBe(false);
    fireEvent.change(camp(/^Stadiul nou/), { target: { value: "inchis" } });
    expect(camp(/Costul final/).required).toBe(true);
    expect(screen.getByText(/După închidere, incidentul nu se mai modifică/)).toBeTruthy();
    // Asigurătorul și despăgubirea curente sunt precompletate: nu se pierd la închidere.
    expect(camp(/^Asigurătorul/).value).toBe("Allianz");
    expect(camp(/Despăgubirea primită/).value).toBe("900");
  });

  it("costul final lipsă la închidere: eroarea ajunge sub câmpul lui", async () => {
    schimbaStadiulIncidentului.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDARE",
        message: "Datele introduse nu sunt valide.",
        fieldErrors: {
          cost_final: [
            "Scrieți costul final al daunei (0 dacă n-a fost nimic de plătit) înainte de închidere.",
          ],
        },
        requestId: "t",
      },
    });
    render(
      <DialogStadiuIncident
        incidentId={INCIDENT_ID}
        stadiu="in_reparatie"
        asigurator={null}
        dosarNumar={null}
        despagubire={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Schimbă stadiul/ }));
    fireEvent.change(camp(/^Stadiul nou/), { target: { value: "inchis" } });
    await trimite();
    expect(
      screen.getByText(
        "Scrieți costul final al daunei (0 dacă n-a fost nimic de plătit) înainte de închidere.",
      ),
    ).toBeTruthy();
  });
});

describe("ButonStergeIncident", () => {
  function inCaseta(nume: string): HTMLElement {
    const gasit = screen
      .getAllByRole("button", { name: nume, hidden: true })
      .find((b) => b.closest("dialog") !== null);
    if (gasit === undefined) throw new Error(`Niciun buton „${nume}” într-o casetă.`);
    return gasit;
  }

  it("cere confirmare, șterge și întoarce pe listă", async () => {
    render(<ButonStergeIncident incidentId={INCIDENT_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Șterge" }));
    expect(stergeIncident).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(inCaseta("Șterge incidentul"));
    });
    expect(stergeIncident).toHaveBeenCalledWith({ id: INCIDENT_ID });
    expect(push).toHaveBeenCalledWith("/flota/incidente");
  });

  it("eroarea nu navighează", async () => {
    stergeIncident.mockResolvedValue({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Incidentul nu a fost șters.",
        fieldErrors: null,
        requestId: "t",
      },
    });
    render(<ButonStergeIncident incidentId={INCIDENT_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Șterge" }));
    await act(async () => {
      fireEvent.click(inCaseta("Șterge incidentul"));
    });
    expect(push).not.toHaveBeenCalled();
  });
});
