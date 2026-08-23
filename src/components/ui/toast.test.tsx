// src/components/ui/toast.test.tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ZonaToast, arataToast } from "./toast";

/**
 * Regula pe care o apără fișierul: **eroarea nu dispare singură.**
 *
 * O confirmare de salvare poate să treacă — dacă omul n-a văzut-o, nu s-a
 * pierdut nimic. Un mesaj de eroare care se stinge după șase secunde lasă în
 * urmă un ecran care arată exact ca înainte de apăsare, iar utilizatorul
 * încearcă din nou aceeași acțiune.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // Depozitarul e la nivel de modul, deci trebuie golit între teste — altfel
  // notificările unui test rămân pe ecran în următorul.
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

function goleste(): void {
  for (const b of screen.queryAllByRole("button", { name: "Închide notificarea" })) {
    act(() => b.click());
  }
}

describe("ZonaToast — durata de viață", () => {
  it("reușita se stinge singură", () => {
    render(<ZonaToast />);
    act(() => arataToast({ fel: "reusita", text: "Angajat înregistrat." }));
    expect(screen.getByText("Angajat înregistrat.")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByText("Angajat înregistrat.")).toBeNull();
  });

  it("eroarea NU se stinge niciodată singură", () => {
    render(<ZonaToast />);
    act(() => arataToast({ fel: "eroare", text: "Salvarea a eșuat." }));

    act(() => {
      vi.advanceTimersByTime(600_000); // zece minute
    });
    expect(screen.getByText("Salvarea a eșuat.")).toBeDefined();
    goleste();
  });

  it("se poate închide manual, oricare ar fi felul", () => {
    render(<ZonaToast />);
    act(() => arataToast({ fel: "eroare", text: "Salvarea a eșuat." }));
    act(() => screen.getByRole("button", { name: "Închide notificarea" }).click());
    expect(screen.queryByText("Salvarea a eșuat.")).toBeNull();
  });
});

describe("ZonaToast — cum se anunță", () => {
  it("eroarea întrerupe cititorul de ecran, restul așteaptă o pauză", () => {
    render(<ZonaToast />);
    act(() => arataToast({ fel: "eroare", text: "A eșuat." }));
    const alerta = screen.getByRole("alert");
    expect(alerta.getAttribute("aria-live")).toBe("assertive");
    goleste();

    act(() => arataToast({ fel: "reusita", text: "S-a salvat." }));
    const stare = screen.getByRole("status");
    expect(stare.getAttribute("aria-live")).toBe("polite");
    goleste();
  });
});

describe("ZonaToast — acțiunea de anulare", () => {
  it("cheamă handlerul și închide notificarea", () => {
    const anuleaza = vi.fn();
    render(<ZonaToast />);
    act(() =>
      arataToast({
        fel: "reusita",
        text: "Obiect casat.",
        actiune: { eticheta: "Anulează", onClick: anuleaza },
      }),
    );

    act(() => screen.getByRole("button", { name: "Anulează" }).click());
    expect(anuleaza).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Obiect casat.")).toBeNull();
  });
});

describe("ZonaToast — mai multe deodată", () => {
  it("le arată pe toate, în ordinea sosirii", () => {
    render(<ZonaToast />);
    act(() => {
      arataToast({ fel: "reusita", text: "Prima." });
      arataToast({ fel: "informativ", text: "A doua." });
    });
    expect(screen.getByText("Prima.")).toBeDefined();
    expect(screen.getByText("A doua.")).toBeDefined();
    expect(screen.getAllByRole("button", { name: "Închide notificarea" })).toHaveLength(2);
    goleste();
  });

  it("închiderea uneia nu le atinge pe celelalte", () => {
    render(<ZonaToast />);
    act(() => {
      arataToast({ fel: "eroare", text: "Rămâne." });
      arataToast({ fel: "eroare", text: "Pleacă." });
    });
    const butoane = screen.getAllByRole("button", { name: "Închide notificarea" });
    act(() => butoane[1]?.click());
    expect(screen.getByText("Rămâne.")).toBeDefined();
    expect(screen.queryByText("Pleacă.")).toBeNull();
    goleste();
  });
});
