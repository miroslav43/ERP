// src/app/(app)/mentenanta/iscir/actiuni-autorizatie.test.tsx
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Gesturile de pe autorizația ISCIR (M7). Ce apără fișierul:
 *  · reînnoirea trimite id-ul rândului VECHI și datele documentului nou, fără
 *    tip/regim (le moștenește rândul nou), cu numărul vechi precompletat;
 *  · suspendarea trimite data și motivul; ridicarea ei trece prin confirmare;
 *  · corectarea unei autorizații cu tip scris liber (dinainte de 0211) păstrează
 *    tipul vechi, nu îl schimbă tăcut în primul din listă;
 *  · confirmarea ștergerii spune consecința: o reînnoire ștearsă readuce
 *    autorizația anterioară.
 */
const { actualizeaza, reinnoieste, suspenda, reactiveaza, sterge } = vi.hoisted(() => {
  const ok = vi.fn(async (_input: Record<string, unknown>) => ({
    ok: true as const,
    data: { id: "a-nou", equipment_id: "e1" },
  }));
  return {
    actualizeaza: vi.fn(ok),
    reinnoieste: vi.fn(ok),
    suspenda: vi.fn(ok),
    reactiveaza: vi.fn(ok),
    sterge: vi.fn(ok),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }),
  usePathname: () => "/mentenanta/echipamente/e1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("./actions", () => ({
  actualizeazaAutorizatie: actualizeaza,
  reinnoiesteAutorizatie: reinnoieste,
  suspendaAutorizatie: suspenda,
  reactiveazaAutorizatie: reactiveaza,
  stergeAutorizatie: sterge,
}));

import { ActiuniAutorizatie } from "./actiuni-autorizatie";

const EXISTENTA = {
  regim: "inregistrat",
  numar: "ISCIR-77",
  tip: "Macara capră 5t",
  emitent: "ISCIR",
  emis_la: "2025-01-10",
  valabil_pana: "2027-01-10",
  scadenta_verificare_tehnica: "2027-01-10",
  conditii: "",
};

function randeaza(props: Partial<{ suspendata: boolean; esteReinnoire: boolean }> = {}) {
  render(
    <ActiuniAutorizatie
      id="a1"
      eticheta="Macara · ISCIR-77"
      suspendata={props.suspendata ?? false}
      esteReinnoire={props.esteReinnoire ?? false}
      existenta={EXISTENTA}
      azi="2026-10-12"
    />,
  );
}

describe("ActiuniAutorizatie", () => {
  beforeEach(() => {
    for (const f of [actualizeaza, reinnoieste, suspenda, reactiveaza, sterge]) f.mockClear();
  });

  it("reînnoirea: id-ul rândului vechi, numărul precompletat, fără tip și regim", async () => {
    randeaza();
    fireEvent.click(screen.getByRole("button", { name: "Reînnoiește" }));
    const caseta = screen.getByRole("dialog");
    expect(
      (within(caseta).getByLabelText(/Număr de înregistrare/u) as HTMLInputElement).value,
    ).toBe("ISCIR-77");
    fireEvent.change(within(caseta).getByLabelText(/Valabilă până la/u), {
      target: { value: "2029-01-10" },
    });
    fireEvent.click(within(caseta).getByRole("button", { name: "Salvează reînnoirea" }));

    await waitFor(() => {
      expect(reinnoieste).toHaveBeenCalledTimes(1);
    });
    const intrare = reinnoieste.mock.calls[0]?.[0] ?? {};
    expect(intrare).toMatchObject({
      id: "a1",
      numar: "ISCIR-77",
      emitent: "ISCIR",
      emis_la: "2026-10-12",
      valabil_pana: "2029-01-10",
    });
    expect(intrare).not.toHaveProperty("tip");
    expect(intrare).not.toHaveProperty("regim");
  });

  it("suspendarea trimite data și motivul", async () => {
    randeaza();
    fireEvent.click(screen.getByRole("button", { name: "Suspendă" }));
    const caseta = screen.getByRole("dialog");
    fireEvent.change(within(caseta).getByLabelText(/Motivul suspendării/u), {
      target: { value: "PV ISCIR: frâna necorespunzătoare." },
    });
    fireEvent.click(within(caseta).getByRole("button", { name: "Suspendă autorizația" }));

    await waitFor(() => {
      expect(suspenda).toHaveBeenCalledTimes(1);
    });
    expect(suspenda.mock.calls[0]?.[0]).toEqual({
      id: "a1",
      suspendata_la: "2026-10-12",
      motiv_suspendare: "PV ISCIR: frâna necorespunzătoare.",
    });
  });

  it("suspendată: în locul „Suspendă” apare „Ridică suspendarea”, cu confirmare", async () => {
    randeaza({ suspendata: true });
    expect(screen.queryByRole("button", { name: "Suspendă" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ridică suspendarea" }));
    const caseta = screen.getByRole("dialog");
    expect(within(caseta).getByText(/revine în scadențe/u)).toBeTruthy();
    fireEvent.click(within(caseta).getByRole("button", { name: "Ridică suspendarea" }));
    await waitFor(() => {
      expect(reactiveaza).toHaveBeenCalledWith({ id: "a1" });
    });
  });

  it("corectarea păstrează tipul scris liber și trimite id-ul", async () => {
    randeaza();
    fireEvent.click(screen.getByRole("button", { name: "Corectează" }));
    const caseta = screen.getByRole("dialog");
    const tip = within(caseta).getByLabelText(/Tipul echipamentului/u) as HTMLSelectElement;
    expect(tip.value).toBe("Macara capră 5t");
    fireEvent.click(within(caseta).getByRole("button", { name: "Salvează corectura" }));

    await waitFor(() => {
      expect(actualizeaza).toHaveBeenCalledTimes(1);
    });
    expect(actualizeaza.mock.calls[0]?.[0]).toMatchObject({
      id: "a1",
      tip: "Macara capră 5t",
      numar: "ISCIR-77",
      regim: "inregistrat",
      conditii: null,
    });
  });

  it("regimul RSVTI face numărul neobligatoriu și spune de ce", () => {
    randeaza();
    fireEvent.click(screen.getByRole("button", { name: "Corectează" }));
    const caseta = screen.getByRole("dialog");
    const numar = within(caseta).getByLabelText(/Număr de înregistrare/u) as HTMLInputElement;
    expect(numar.required).toBe(true);
    fireEvent.change(within(caseta).getByLabelText(/^Regim/u), {
      target: { value: "neinregistrat_rsvti" },
    });
    expect(numar.required).toBe(false);
    expect(within(caseta).getByText(/nu e înregistrat la ISCIR/u)).toBeTruthy();
  });

  it.each([
    [false, /iese din liste și din scadențe/u],
    [true, /autorizația anterioară revine în scadențe/u],
  ])("ștergerea (reînnoire = %s) spune consecința", async (esteReinnoire, consecinta) => {
    randeaza({ esteReinnoire });
    fireEvent.click(screen.getByRole("button", { name: "Șterge" }));
    const caseta = screen.getByRole("dialog");
    expect(within(caseta).getByText(consecinta)).toBeTruthy();
    fireEvent.click(within(caseta).getByRole("button", { name: "Șterge autorizația" }));
    await waitFor(() => {
      expect(sterge).toHaveBeenCalledWith({ id: "a1" });
    });
  });
});
