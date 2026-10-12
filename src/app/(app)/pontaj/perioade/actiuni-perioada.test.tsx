// src/app/(app)/pontaj/perioade/actiuni-perioada.test.tsx
//
// Blocarea lunii „ESTE aprobarea ei” și, până aici, se dădea dintr-un singur
// clic, fără să spună câte linii rămân neaprobate (QA oct 2026: ADM-033,
// FLX-009). Fișierul verifică DOUĂ lucruri: că acțiunea nu pleacă la primul
// clic, și că avertismentul poartă cifra — „3 linii rămân neaprobate”, cu
// acordul corect la 1.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActiuniPerioada } from "./actiuni-perioada";

const { blocheazaPerioada, deschidePerioada, redeschidePerioada } = vi.hoisted(() => ({
  blocheazaPerioada: vi.fn(),
  deschidePerioada: vi.fn(),
  redeschidePerioada: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/pontaj/perioade",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../actions", () => ({ blocheazaPerioada, deschidePerioada, redeschidePerioada }));

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

const PERIOD_ID = "66666666-6666-4666-8666-666666666666";

const dialogDeschis = (): HTMLDialogElement | null => document.querySelector("dialog[open]");

async function apasa(nume: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: nume }));
  });
}

beforeEach(() => {
  blocheazaPerioada.mockReset();
  deschidePerioada.mockReset();
  redeschidePerioada.mockReset();
  blocheazaPerioada.mockResolvedValue({ ok: true, data: null });
  deschidePerioada.mockResolvedValue({ ok: true, data: null });
  redeschidePerioada.mockResolvedValue({ ok: true, data: null });
});

describe("ActiuniPerioada — blocarea cere confirmare", () => {
  it("„Blochează” NU cheamă acțiunea la primul clic și arată cifra liniilor neaprobate", async () => {
    render(
      <ActiuniPerioada
        an={2026}
        luna={9}
        periodId={PERIOD_ID}
        status="deschisa"
        poateDeschide
        poateBloca
        liniiNeaprobate={3}
      />,
    );
    await apasa("Blochează");
    expect(blocheazaPerioada).not.toHaveBeenCalled();
    expect(dialogDeschis()).not.toBeNull();
    expect(screen.getByText("Blocați luna septembrie 2026?")).toBeDefined();
    expect(screen.getByText("Linii neaprobate")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(document.body.textContent).toMatch(/3 linii rămân neaprobate/u);
  });

  it("cu 0 linii neaprobate, propoziția de avertisment lipsește", async () => {
    render(
      <ActiuniPerioada
        an={2026}
        luna={9}
        periodId={PERIOD_ID}
        status="deschisa"
        poateDeschide
        poateBloca
        liniiNeaprobate={0}
      />,
    );
    await apasa("Blochează");
    // Cifra „Linii neaprobate: 0” rămâne în casetă; doar avertismentul dispare.
    expect(screen.getByText("Linii neaprobate")).toBeDefined();
    expect(document.body.textContent).not.toMatch(/rămân neaprobate|rămâne neaprobată/u);
  });

  it("acord la 1: „1 linie rămâne neaprobată”", async () => {
    render(
      <ActiuniPerioada
        an={2026}
        luna={9}
        periodId={PERIOD_ID}
        status="deschisa"
        poateDeschide
        poateBloca
        liniiNeaprobate={1}
      />,
    );
    await apasa("Blochează");
    expect(document.body.textContent).toMatch(/1 linie rămâne neaprobată/u);
  });

  it("confirmarea cheamă `blocheazaPerioada({ id })` o singură dată", async () => {
    render(
      <ActiuniPerioada
        an={2026}
        luna={9}
        periodId={PERIOD_ID}
        status="deschisa"
        poateDeschide
        poateBloca
        liniiNeaprobate={3}
      />,
    );
    await apasa("Blochează");
    await apasa("Blochează luna");
    expect(blocheazaPerioada).toHaveBeenCalledTimes(1);
    expect(blocheazaPerioada).toHaveBeenCalledWith({ id: PERIOD_ID });
  });

  it("„Redeschide” cere și el confirmare, cu avertismentul despre salarizare", async () => {
    render(
      <ActiuniPerioada
        an={2026}
        luna={9}
        periodId={PERIOD_ID}
        status="blocata"
        poateDeschide
        poateBloca
        liniiNeaprobate={0}
      />,
    );
    await apasa("Redeschide");
    expect(redeschidePerioada).not.toHaveBeenCalled();
    expect(dialogDeschis()).not.toBeNull();
    expect(document.body.textContent).toMatch(/statul de plată/u);
    await apasa("Redeschide luna");
    expect(redeschidePerioada).toHaveBeenCalledWith({ id: PERIOD_ID });
  });

  it("„Deschide luna” rămâne directă: nu e distructivă", async () => {
    render(
      <ActiuniPerioada
        an={2026}
        luna={9}
        periodId={null}
        status={null}
        poateDeschide
        poateBloca
        liniiNeaprobate={0}
      />,
    );
    await apasa("Deschide luna");
    expect(deschidePerioada).toHaveBeenCalledWith({ an: 2026, luna: 9, observatii: null });
    expect(dialogDeschis()).toBeNull();
  });
});
