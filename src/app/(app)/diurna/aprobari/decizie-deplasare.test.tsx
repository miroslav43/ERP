// src/app/(app)/diurna/aprobari/decizie-deplasare.test.tsx
//
// „Aprobă” pe o deplasare se executa la primul clic și rândul dispărea din
// listă fără niciun mesaj (QA oct 2026: MGR-018, FLX-009). Caseta de
// confirmare arată CE se aprobă — omul, intervalul, avansul — iar reușita se
// spune, nu se deduce din dispariția rândului.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ZonaToast, golesteToasturi } from "@/components/ui/toast";

import { DecizieDeplasare } from "./decizie-deplasare";

const { decideDeplasare, deconteazaDeplasare } = vi.hoisted(() => ({
  decideDeplasare: vi.fn(),
  deconteazaDeplasare: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/diurna/aprobari",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../actions", () => ({ decideDeplasare, deconteazaDeplasare }));

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

const ID = "55555555-5555-4555-8555-555555555555";
const REZUMAT = {
  angajat: "Ana Pop (0007)",
  interval: "12.10.2026, 08:00 – 14.10.2026, 18:00",
  avans: "500,00 lei",
} as const;

const dialogDeschis = (): HTMLDialogElement | null => document.querySelector("dialog[open]");

async function apasa(nume: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: nume }));
  });
}

function randeaza(): void {
  render(
    <>
      <ZonaToast />
      <DecizieDeplasare id={ID} status="in_aprobare" rezumat={REZUMAT} />
    </>,
  );
}

beforeEach(() => {
  decideDeplasare.mockReset();
  decideDeplasare.mockResolvedValue({ ok: true, data: null });
  golesteToasturi();
});

describe("DecizieDeplasare — decizia cere confirmare", () => {
  it("„Aprobă” nu decide la primul clic; caseta arată omul și avansul", async () => {
    randeaza();
    await apasa("Aprobă");
    expect(decideDeplasare).not.toHaveBeenCalled();
    expect(dialogDeschis()).not.toBeNull();
    expect(screen.getByText("Aprobați deplasarea?")).toBeDefined();
    expect(screen.getByText("Ana Pop (0007)")).toBeDefined();
    expect(screen.getByText("500,00 lei")).toBeDefined();
  });

  it("confirmarea aprobă și spune că a aprobat", async () => {
    randeaza();
    await apasa("Aprobă");
    await apasa("Aprobă deplasarea");
    expect(decideDeplasare).toHaveBeenCalledTimes(1);
    expect(decideDeplasare).toHaveBeenCalledWith({ id: ID, decizie: "aprobata" });
    expect(screen.getByText("Deplasarea a fost aprobată.")).toBeDefined();
  });

  it("„Respinge” trece prin aceeași casetă, cu butonul de confirmare conturat roșu", async () => {
    randeaza();
    await apasa("Respinge");
    expect(decideDeplasare).not.toHaveBeenCalled();
    expect(screen.getByText("Respingeți deplasarea?")).toBeDefined();
    const confirmare = screen.getByRole("button", { name: "Respinge deplasarea" });
    expect(confirmare.className).toContain("text-danger");
    await apasa("Respinge deplasarea");
    expect(decideDeplasare).toHaveBeenCalledWith({ id: ID, decizie: "respinsa" });
    expect(screen.getByText("Deplasarea a fost respinsă.")).toBeDefined();
  });

  it("la refuz caseta rămâne deschisă, cu eroarea ca notificare", async () => {
    decideDeplasare.mockResolvedValue({
      ok: false,
      error: { message: "Nu vă puteți aproba propria deplasare." },
    });
    randeaza();
    await apasa("Aprobă");
    await apasa("Aprobă deplasarea");
    expect(dialogDeschis()).not.toBeNull();
    expect(screen.getByText("Nu vă puteți aproba propria deplasare.")).toBeDefined();
  });
});
