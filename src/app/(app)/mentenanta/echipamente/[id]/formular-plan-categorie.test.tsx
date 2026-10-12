// src/app/(app)/mentenanta/echipamente/[id]/formular-plan-categorie.test.tsx
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Categoria legală din formularul de plan (M7). Ce apără fișierul:
 *  · alegerea categoriei PRECOMPLETEAZĂ tipul „Verificare legală”, periodicitatea
 *    sugerată și temeiul, iar denumirea doar dacă era goală;
 *  · un temei neverificat pe text pleacă cu ⚠, iar ajutorul spune „de confirmat”;
 *  · codul categoriei ajunge la acțiune (`categorie_legala`);
 *  · o categorie legată de eveniment nu golește periodicitatea scrisă de om.
 */
const { creeaza } = vi.hoisted(() => ({
  creeaza: vi.fn(async (_input: Record<string, unknown>) => ({
    ok: true as const,
    data: { id: "p-nou" },
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }),
  usePathname: () => "/mentenanta/echipamente/e1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../../actions", () => ({ creeazaPlan: creeaza, actualizeazaPlan: vi.fn() }));

import { FormularPlan } from "./formular-plan";

function deschide() {
  render(<FormularPlan equipmentId="e1" angajati={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Plan de mentenanță nou" }));
  return screen.getByRole("dialog");
}

const valoare = (caseta: HTMLElement, eticheta: RegExp): string =>
  (within(caseta).getByLabelText(eticheta) as HTMLInputElement | HTMLSelectElement).value;

describe("FormularPlan — categoria legală", () => {
  beforeEach(() => {
    creeaza.mockClear();
  });

  it("precompletează tipul, periodicitatea, temeiul și denumirea goală", () => {
    const caseta = deschide();
    fireEvent.change(within(caseta).getByLabelText(/^Categorie legală/u), {
      target: { value: "vtp_masini_ridicat" },
    });
    expect(valoare(caseta, /^Tip$/u)).toBe("verificare_legala");
    expect(valoare(caseta, /^Periodicitate \(zile\)/u)).toBe("730");
    expect(valoare(caseta, /^Temei legal/u)).toContain("PT R1-2010");
    expect(valoare(caseta, /^Denumire/u)).toContain("VTP ISCIR");
  });

  it("denumirea scrisă de om nu se suprascrie", () => {
    const caseta = deschide();
    fireEvent.change(within(caseta).getByLabelText(/^Denumire/u), {
      target: { value: "VTP macara hală" },
    });
    fireEvent.change(within(caseta).getByLabelText(/^Categorie legală/u), {
      target: { value: "vtp_masini_ridicat" },
    });
    expect(valoare(caseta, /^Denumire/u)).toBe("VTP macara hală");
  });

  it("temeiul neverificat poartă ⚠, iar ajutorul spune că e de confirmat", () => {
    const caseta = deschide();
    fireEvent.change(within(caseta).getByLabelText(/^Categorie legală/u), {
      target: { value: "pram" },
    });
    expect(valoare(caseta, /^Temei legal/u)).toMatch(/^⚠ .*\(de confirmat\)$/u);
    expect(within(caseta).getByText(/Temei de confirmat cu juristul sau RSVTI/u)).toBeTruthy();
  });

  it("categoria legată de eveniment nu golește periodicitatea scrisă", () => {
    const caseta = deschide();
    fireEvent.change(within(caseta).getByLabelText(/^Periodicitate \(zile\)/u), {
      target: { value: "90" },
    });
    fireEvent.change(within(caseta).getByLabelText(/^Categorie legală/u), {
      target: { value: "verificare_montare" },
    });
    expect(valoare(caseta, /^Periodicitate \(zile\)/u)).toBe("90");
  });

  it("codul categoriei ajunge la acțiune", async () => {
    const caseta = deschide();
    fireEvent.change(within(caseta).getByLabelText(/^Categorie legală/u), {
      target: { value: "verificare_gaze" },
    });
    fireEvent.click(within(caseta).getByRole("button", { name: "Salvează planul" }));
    await waitFor(() => {
      expect(creeaza).toHaveBeenCalledTimes(1);
    });
    expect(creeaza.mock.calls[0]?.[0]).toMatchObject({
      equipment_id: "e1",
      tip: "verificare_legala",
      periodicitate_zile: 730,
      categorie_legala: "verificare_gaze",
    });
  });
});
