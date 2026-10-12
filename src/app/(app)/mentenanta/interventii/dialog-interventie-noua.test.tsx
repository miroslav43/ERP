// src/app/(app)/mentenanta/interventii/dialog-interventie-noua.test.tsx
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Caseta „Intervenție nouă” din listă (M6). Ce apără fișierul:
 *  · planurile oferite sunt DOAR ale echipamentului ales;
 *  · un plan de verificare legală face documentul obligatoriu (cazul 34);
 *  · documentul urcă ÎNAINTEA intervenției, pe id-ul generat în browser, iar
 *    acțiunea primește exact acel id și calea; o retrimitere a aceluiași
 *    fișier după un refuz nu-l urcă a doua oară.
 */
const { inregistreaza, pregateste, urca, fisierAles } = vi.hoisted(() => ({
  /**
   * happy-dom nu pune fișierul unui `<input type="file">` în `new FormData(form)`
   * (verificat: `get()` întoarce un `File` gol), deci fișierul „ales” vine de aici.
   * Browserul real îl pune; maparea însăși e testată în `valori-interventie.test.ts`.
   */
  fisierAles: { curent: null as File | null },
  inregistreaza: vi.fn(async (_input: Record<string, unknown>) => ({
    ok: true as const,
    data: { id: "i-nou" },
  })),
  pregateste: vi.fn(async (input: { entity_id: string }) => ({
    ok: true as const,
    data: {
      cale: `org/intervention/${input.entity_id}/x-pv.pdf`,
      urlSemnat: "https://stocare.test/semnat",
    },
  })),
  urca: vi.fn(async () => true),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }),
  usePathname: () => "/mentenanta/interventii",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../actions", () => ({ inregistreazaInterventie: inregistreaza }));
vi.mock("../sesizari/actions", () => ({ pregatesteFisier: pregateste }));
vi.mock("@/lib/storage/urca-semnat", () => ({ urcaPeUrlSemnat: urca }));
vi.mock("./valori-interventie", async (orig) => ({
  ...(await orig<typeof import("./valori-interventie")>()),
  documentDinFormular: () => fisierAles.curent,
}));

import { DialogInterventieNoua } from "./dialog-interventie-noua";

const ECHIPAMENTE = [
  { id: "e1", nume: "CMP-1 — Compresor" },
  { id: "e2", nume: "LFT-2 — Lift" },
];
const PLANURI = [
  { id: "p1", nume: "Revizie compresor", equipment_id: "e1", tip: "preventiva" as const },
  { id: "p2", nume: "VTP lift", equipment_id: "e2", tip: "verificare_legala" as const },
];

function deschide() {
  render(
    <DialogInterventieNoua
      deschisInitial
      echipamente={ECHIPAMENTE}
      planuri={PLANURI}
      angajati={[{ id: "a1", nume: "Ana Admin" }]}
      azi="2026-10-12"
    />,
  );
  return screen.getByRole("dialog");
}

function completeaza(caseta: HTMLElement) {
  fireEvent.change(within(caseta).getByLabelText(/Ce s-a făcut/u), {
    target: { value: "Verificare tehnică periodică." },
  });
  fireEvent.change(within(caseta).getByLabelText(/Executant \(firmă externă\)/u), {
    target: { value: "RSVTI Service SRL" },
  });
}

describe("DialogInterventieNoua", () => {
  beforeEach(() => {
    inregistreaza.mockClear();
    pregateste.mockClear();
    urca.mockClear();
    fisierAles.curent = null;
  });

  it("planurile sunt doar ale echipamentului ales; selectorul e închis până la alegere", () => {
    const caseta = deschide();
    const plan = within(caseta).getByLabelText("Din planul") as HTMLSelectElement;
    expect(plan.disabled).toBe(true);

    fireEvent.change(within(caseta).getByLabelText(/^Echipament/u), { target: { value: "e1" } });
    const optiuni = [...plan.options].map((o) => o.value);
    expect(plan.disabled).toBe(false);
    expect(optiuni).toEqual(["", "p1"]);
  });

  it("planul de verificare legală face documentul obligatoriu", () => {
    const caseta = deschide();
    expect(within(caseta).getByText(/Document \(opțional\)/u)).toBeTruthy();
    fireEvent.change(within(caseta).getByLabelText(/^Echipament/u), { target: { value: "e2" } });
    fireEvent.change(within(caseta).getByLabelText("Din planul"), { target: { value: "p2" } });
    expect(within(caseta).getByText(/Procesul-verbal sau buletinul \(obligatoriu\)/u)).toBeTruthy();
  });

  it("fără fișier: acțiunea primește echipamentul, planul și id/atasament null", async () => {
    const caseta = deschide();
    fireEvent.change(within(caseta).getByLabelText(/^Echipament/u), { target: { value: "e1" } });
    fireEvent.change(within(caseta).getByLabelText("Din planul"), { target: { value: "p1" } });
    completeaza(caseta);
    fireEvent.click(within(caseta).getByRole("button", { name: "Salvează intervenția" }));

    await waitFor(() => {
      expect(inregistreaza).toHaveBeenCalledTimes(1);
    });
    expect(pregateste).not.toHaveBeenCalled();
    expect(inregistreaza.mock.calls[0]?.[0]).toMatchObject({
      equipment_id: "e1",
      plan_id: "p1",
      id: null,
      atasament: null,
      executant_extern: "RSVTI Service SRL",
    });
  });

  it("cu PV: urcă întâi pe id-ul generat, apoi trimite același id și calea; retrimiterea nu-l urcă iar", async () => {
    inregistreaza.mockResolvedValueOnce({
      ok: false,
      error: { code: "VALIDARE", message: "Ceva lipsește.", fieldErrors: {}, requestId: "r" },
    } as never);
    const caseta = deschide();
    fireEvent.change(within(caseta).getByLabelText(/^Echipament/u), { target: { value: "e2" } });
    fireEvent.change(within(caseta).getByLabelText("Din planul"), { target: { value: "p2" } });
    completeaza(caseta);
    const fisier = new File(["%PDF-1.7"], "pv-vtp.pdf", {
      type: "application/pdf",
      lastModified: 1,
    });
    fisierAles.curent = fisier;

    fireEvent.click(within(caseta).getByRole("button", { name: "Salvează intervenția" }));
    await waitFor(() => {
      expect(inregistreaza).toHaveBeenCalledTimes(1);
    });
    expect(pregateste).toHaveBeenCalledTimes(1);
    const idGenerat = pregateste.mock.calls[0]?.[0].entity_id;
    expect(idGenerat).toMatch(/^[0-9a-f-]{36}$/u);
    expect(pregateste.mock.calls[0]?.[0]).toMatchObject({ entity_type: "intervention" });
    expect(urca).toHaveBeenCalledTimes(1);
    expect(inregistreaza.mock.calls[0]?.[0]).toMatchObject({
      id: idGenerat,
      atasament: {
        cale: `org/intervention/${String(idGenerat)}/x-pv.pdf`,
        denumire: "pv-vtp.pdf",
        tip: "pv",
      },
    });

    // Refuzat: omul alege din nou ACELAȘI fișier și retrimite.
    fisierAles.curent = new File(["%PDF-1.7"], "pv-vtp.pdf", {
      type: "application/pdf",
      lastModified: 1,
    });
    fireEvent.click(within(caseta).getByRole("button", { name: "Salvează intervenția" }));
    await waitFor(() => {
      expect(inregistreaza).toHaveBeenCalledTimes(2);
    });
    expect(pregateste).toHaveBeenCalledTimes(1);
    expect(urca).toHaveBeenCalledTimes(1);
    expect(inregistreaza.mock.calls[1]?.[0]).toMatchObject({ id: idGenerat });
  });
});
