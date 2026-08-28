// src/components/ui/rezumat-erori.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RezumatErori, type EroareRezumat } from "./rezumat-erori";

/**
 * Rezumatul a apărut fiindcă asistentul de înrolare tăcea: „Continuă” nu
 * avansa și nu scria nimic. Ce se apără aici sunt cele trei lucruri care fac
 * diferența dintre „vezi ce ai greșit” și „vezi că ai greșit”: anunțul,
 * acordul numeralului și drumul înapoi la câmp.
 */
const EXEMPLU: readonly EroareRezumat[] = [
  {
    camp: "special_regime",
    eticheta: "Regim special",
    mesaj: "Alegeți un regim special din listă.",
  },
  {
    camp: "salariu_baza",
    eticheta: "Salariu de bază brut (lunar)",
    mesaj: "Salariul de bază este obligatoriu.",
  },
];

describe("RezumatErori", () => {
  it("nu randează nimic când nu sunt erori", () => {
    // Un chenar gol lângă buton ar sugera că ceva e în neregulă chiar când nu e.
    const { container } = render(<RezumatErori erori={[]} laSelectare={vi.fn()} />);
    expect(container.firstElementChild).toBeNull();
  });

  it('anunță prin `role="alert"`, moștenit din Callout', () => {
    // Focusul e pe butonul apăsat, nu pe listă. Fără anunț, cine folosește un
    // cititor de ecran apasă „Continuă” și nu află niciodată de ce nu s-a
    // întâmplat nimic.
    render(<RezumatErori erori={EXEMPLU} laSelectare={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toContain("Alegeți un regim special din listă.");
  });

  it("arată eticheta omenească, nu numele tehnic al câmpului", () => {
    render(<RezumatErori erori={EXEMPLU} laSelectare={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toContain("Regim special");
    expect(screen.getByRole("alert").textContent).not.toContain("special_regime");
  });

  it.each([
    [1, "Un câmp trebuie corectat"],
    [2, "2 câmpuri trebuie corectate"],
    [19, "19 câmpuri trebuie corectate"],
    [20, "20 de câmpuri trebuie corectate"],
    [21, "21 de câmpuri trebuie corectate"],
  ])("acordă numeralul în română pentru %i", (numar, asteptat) => {
    // De la 20 în sus numeralul cere „de”. „20 câmpuri” trădează un text
    // tradus, într-un produs scris în întregime în română.
    const erori = Array.from({ length: numar }, (_, i) => ({
      camp: `camp_${String(i)}`,
      eticheta: `Câmpul ${String(i)}`,
      mesaj: "Este obligatoriu.",
    }));
    render(<RezumatErori erori={erori} laSelectare={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toContain(asteptat);
  });

  it("fiecare rând duce înapoi la câmp, prin apelant", async () => {
    // Săritura nu se face în componentă: într-un asistent, câmpul poate fi pe
    // un pas nemontat, iar `focus()` pe un element inexistent nu face nimic.
    const laSelectare = vi.fn();
    render(<RezumatErori erori={EXEMPLU} laSelectare={laSelectare} />);
    await userEvent.click(screen.getByRole("button", { name: /Salariu de bază/u }));
    expect(laSelectare).toHaveBeenCalledExactlyOnceWith("salariu_baza");
  });

  it("rândurile sunt butoane, deci se ajunge la ele cu tastatura", () => {
    render(<RezumatErori erori={EXEMPLU} laSelectare={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
