// src/app/(app)/mentenanta/setari/formular-setari-mentenanta.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Câmpul de praguri al rezumatului zilnic (0191). Ce apără fișierul: textul
 * „30, 14, 7” din câmp ajunge la acțiune ca listă de bucăți — nu ca un singur
 * șir, pe care schema l-ar refuza în întregime — și pragurile salvate se
 * recitesc în câmp, în forma normalizată.
 */
const { salveaza } = vi.hoisted(() => ({
  salveaza: vi.fn(async (_input: Record<string, unknown>) => ({
    ok: true as const,
    data: { id: "s1" },
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }),
  usePathname: () => "/mentenanta/setari",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../sesizari/actions", () => ({ salveazaSetariMentenanta: salveaza }));

import type { SetariMentenanta } from "@/lib/queries/maintenance";

import { FormularSetariMentenanta } from "./formular-setari-mentenanta";

const SETARI: SetariMentenanta = {
  id: "s1",
  responsabili: [],
  rsvti_employee_id: null,
  inchidere_automata_zile: 5,
  prag_avertizare_zile: 15,
  prag_contor_necitit_zile: 30,
  ore_functionare_pe_zi: 8,
  zile_pe_saptamana: 5,
  cost_ora_oprire: null,
  praguri_alerta_zile: [5, 20],
};

describe("FormularSetariMentenanta — pragurile rezumatului zilnic", () => {
  beforeEach(() => {
    salveaza.mockClear();
  });

  it("afișează pragurile salvate, ordonate descrescător", () => {
    render(<FormularSetariMentenanta setari={SETARI} angajati={[]} />);
    const camp = screen.getByLabelText(/Alertă înainte de scadență/u);
    expect((camp as HTMLInputElement).value).toBe("20, 5");
  });

  it("trimite textul tăiat în bucăți, nu ca un singur șir", async () => {
    render(<FormularSetariMentenanta setari={SETARI} angajati={[]} />);
    fireEvent.change(screen.getByLabelText(/Alertă înainte de scadență/u), {
      target: { value: "30; 10 3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvează setările" }));

    await waitFor(() => {
      expect(salveaza).toHaveBeenCalledTimes(1);
    });
    expect(salveaza.mock.calls[0]?.[0]).toMatchObject({
      praguri_alerta_zile: ["30", "10", "3"],
    });
  });
});
