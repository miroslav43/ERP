// src/app/(app)/flota/[id]/buton-sterge-service.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* Acțiunile sunt mimate (moduli `"use server"`); baza din cloud n-are 0200. */
const stergeIntrareService = vi.fn();
const stergeCheltuiala = vi.fn();
vi.mock("../actions-service", () => ({
  stergeIntrareService: (...a: unknown[]) => stergeIntrareService(...a),
  stergeCheltuiala: (...a: unknown[]) => stergeCheltuiala(...a),
}));
const reimprospateaza = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: reimprospateaza,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/flota/x",
}));

import { golesteToasturi } from "@/components/ui/toast";

import { ButonStergeService } from "./buton-sterge-service";

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

const VEHICUL = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  golesteToasturi();
  stergeIntrareService.mockReset();
  stergeCheltuiala.mockReset();
  reimprospateaza.mockReset();
  stergeIntrareService.mockResolvedValue({ ok: true, data: { id: ID } });
  stergeCheltuiala.mockResolvedValue({ ok: true, data: { id: ID } });
});

describe("ButonStergeService", () => {
  it("intervenția legată de plan: confirmarea spune că planul revine, apoi cheamă acțiunea cu id și vehicul", async () => {
    render(
      <ButonStergeService
        fel="intrare"
        id={ID}
        vehiculId={VEHICUL}
        descriere="intervenția din 01.10.2026"
        legataDePlan
        cifre={[{ eticheta: "Total", valoare: "750,00 lei" }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Șterge intervenția din 01.10.2026" }));
    expect(screen.getByText(/planul legat revine la intervenția anterioară/u)).toBeTruthy();
    expect(screen.getByText(/Kilometrajul vehiculului nu coboară/u)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Șterge intervenția" }));
    await waitFor(() => {
      expect(stergeIntrareService).toHaveBeenCalledTimes(1);
    });
    expect(stergeIntrareService).toHaveBeenCalledWith({ id: ID, vehicle_id: VEHICUL });
    expect(stergeCheltuiala).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(reimprospateaza).toHaveBeenCalled();
    });
  });

  it("cheltuiala: altă acțiune, alt mesaj, fără vorbă de plan", async () => {
    render(
      <ButonStergeService
        fel="cheltuiala"
        id={ID}
        vehiculId={VEHICUL}
        descriere="cheltuiala din 02.10.2026"
        cifre={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Șterge cheltuiala din 02.10.2026" }));
    expect(screen.queryByText(/planul/iu)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Șterge cheltuiala" }));
    await waitFor(() => {
      expect(stergeCheltuiala).toHaveBeenCalledWith({ id: ID, vehicle_id: VEHICUL });
    });
    expect(stergeIntrareService).not.toHaveBeenCalled();
  });

  it("un refuz (zero rânduri = CONFLICT) nu reîmprospătează pagina ca și cum ar fi reușit", async () => {
    stergeIntrareService.mockResolvedValue({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Intervenția nu a fost ștearsă.",
        fieldErrors: null,
        requestId: "t",
      },
    });
    render(
      <ButonStergeService
        fel="intrare"
        id={ID}
        vehiculId={VEHICUL}
        descriere="intervenția din 01.10.2026"
        cifre={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Șterge intervenția din 01.10.2026" }));
    fireEvent.click(screen.getByRole("button", { name: "Șterge intervenția" }));
    await waitFor(() => {
      expect(stergeIntrareService).toHaveBeenCalled();
    });
    expect(reimprospateaza).not.toHaveBeenCalled();
  });
});
