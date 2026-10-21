// src/components/ui/buton-confirmare.test.tsx
//
// Regula pe care o apără fișierul: **declanșatorul nu execută nimic.** Primul
// clic deschide caseta cu consecința; acțiunea pleacă doar din butonul de
// confirmare, o singură dată, iar un refuz al serverului lasă caseta deschisă,
// cu eroarea lângă ea — nu o închide peste un ecran care arată ca înainte.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ButonConfirmare } from "./buton-confirmare";
import { ZonaToast, golesteToasturi } from "./toast";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

/**
 * `<dialog>` nativ: mediul de test nu implementează întotdeauna `showModal`.
 * Îl completăm cu o variantă care face exact ce ne interesează — pune `open`.
 */
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

const dialog = (): HTMLDialogElement | null => document.querySelector("dialog");

function randeaza(
  executa: () => Promise<{ ok: true; data: unknown } | { ok: false; error: { message: string } }>,
  dupaReusita?: () => void,
) {
  return render(
    <>
      <ZonaToast />
      <ButonConfirmare
        eticheta="Blochează"
        titlu="Blocați luna?"
        consecinta="Pontajele lunii nu se mai pot modifica."
        cifre={[{ eticheta: "Linii neaprobate", valoare: "3" }]}
        etichetaConfirmare="Blochează luna"
        executa={executa as never}
        mesajReusita="Luna a fost blocată."
        {...(dupaReusita === undefined ? {} : { dupaReusita })}
      />
    </>,
  );
}

async function apasa(nume: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: nume }));
  });
}

beforeEach(() => {
  refresh.mockClear();
  golesteToasturi();
});

describe("ButonConfirmare", () => {
  it("la randare nu execută nimic și caseta e închisă", () => {
    const executa = vi.fn(async () => ({ ok: true as const, data: null }));
    randeaza(executa);
    expect(executa).not.toHaveBeenCalled();
    expect(dialog()?.open).toBeFalsy();
  });

  it("clicul pe declanșator deschide caseta cu consecința și cifrele", async () => {
    const executa = vi.fn(async () => ({ ok: true as const, data: null }));
    randeaza(executa);
    await apasa("Blochează");
    expect(dialog()?.open).toBe(true);
    expect(screen.getByText("Pontajele lunii nu se mai pot modifica.")).toBeDefined();
    expect(screen.getByText("Linii neaprobate")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(executa).not.toHaveBeenCalled();
  });

  it("„Renunță” închide fără să execute", async () => {
    const executa = vi.fn(async () => ({ ok: true as const, data: null }));
    randeaza(executa);
    await apasa("Blochează");
    await apasa("Renunță");
    expect(dialog()?.open).toBe(false);
    expect(executa).not.toHaveBeenCalled();
  });

  it("confirmarea execută o singură dată; la reușită închide, anunță și reîmprospătează", async () => {
    const executa = vi.fn(async () => ({ ok: true as const, data: null }));
    randeaza(executa);
    await apasa("Blochează");
    await apasa("Blochează luna");
    expect(executa).toHaveBeenCalledTimes(1);
    expect(dialog()?.open).toBe(false);
    expect(screen.getByText("Luna a fost blocată.")).toBeDefined();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("cu `dupaReusita`, acela înlocuiește `router.refresh()`", async () => {
    const executa = vi.fn(async () => ({ ok: true as const, data: null }));
    const dupaReusita = vi.fn();
    randeaza(executa, dupaReusita);
    await apasa("Blochează");
    await apasa("Blochează luna");
    expect(dupaReusita).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("la refuz caseta RĂMÂNE deschisă și eroarea apare ca notificare", async () => {
    const executa = vi.fn(async () => ({
      ok: false as const,
      error: { message: "Perioada este deja blocată." },
    }));
    randeaza(executa);
    await apasa("Blochează");
    await apasa("Blochează luna");
    expect(executa).toHaveBeenCalledTimes(1);
    expect(dialog()?.open).toBe(true);
    expect(screen.getByText("Perioada este deja blocată.")).toBeDefined();
    expect(refresh).not.toHaveBeenCalled();
  });
});
