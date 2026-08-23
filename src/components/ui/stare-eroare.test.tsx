// src/components/ui/stare-eroare.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StareEroare } from "./stare-eroare";

/**
 * Ce apără fișierul: contractul butonului „Reîncearcă".
 *
 * Componenta chema, până acum, `router.refresh()` urmat de `reset()` — adică
 * rescria de mână ce face `retry()` din Next 16.3. Documentația e explicită
 * (`node_modules/next/dist/docs/…/error.md`): `retry` REÎNCARCĂ datele,
 * `reset` doar golește limita de eroare, iar „in most cases, you should use
 * retry() instead". Cum aproape toate erorile produsului vin dintr-o citire de
 * pe server care a eșuat, `reset` singur reface exact aceleași date stricate și
 * butonul pare mut.
 *
 * De aceea componenta nu mai decide ea ce înseamnă „încă o dată": primește o
 * funcție și o cheamă. Testul apără exact asta — că o cheamă, o singură dată,
 * și că nu mai face nimic pe deasupra.
 */

const EROARE = Object.assign(new Error("citirea a eșuat"), { digest: "abc123" });

describe("StareEroare", () => {
  it("cheamă `reincearca` la apăsarea butonului, o singură dată", () => {
    const reincearca = vi.fn();
    render(<StareEroare eroare={EROARE} reincearca={reincearca} />);
    fireEvent.click(screen.getByRole("button", { name: /Reîncearcă/ }));
    expect(reincearca).toHaveBeenCalledTimes(1);
  });

  it("arată codul de incident — singura punte spre jurnalul serverului", () => {
    render(<StareEroare eroare={EROARE} reincearca={vi.fn()} />);
    expect(screen.getByText(/abc123/)).toBeDefined();
  });

  it("fără `digest`, spune că lipsește în loc să lase golul", () => {
    // Un raport de problemă care începe cu „nu mergea nimic" nu se poate urmări.
    render(<StareEroare eroare={new Error("x")} reincearca={vi.fn()} />);
    expect(screen.getByText(/indisponibil/)).toBeDefined();
  });

  it("NU arată mesajul brut al erorii", () => {
    // Erorile de Server Component ajung deja anonimizate de Next, dar cele de
    // client nu: un mesaj de la Postgres într-un ecran e o scurgere.
    render(<StareEroare eroare={EROARE} reincearca={vi.fn()} />);
    expect(screen.queryByText(/citirea a eșuat/)).toBeNull();
  });

  it("se anunță ca alertă, deci cititorul de ecran o aude fără să caute", () => {
    const { container } = render(<StareEroare eroare={EROARE} reincearca={vi.fn()} />);
    const alerta = container.querySelector('[role="alert"]');
    expect(alerta?.getAttribute("aria-live")).toBe("assertive");
  });

  it("ieșirea alternativă apare doar când e dată", () => {
    const { rerender } = render(<StareEroare eroare={EROARE} reincearca={vi.fn()} />);
    expect(screen.queryByRole("link")).toBeNull();
    rerender(
      <StareEroare
        eroare={EROARE}
        reincearca={vi.fn()}
        inapoi={{ eticheta: "Înapoi la listă", href: "/angajati" }}
      />,
    );
    expect(screen.getByRole("link", { name: "Înapoi la listă" }).getAttribute("href")).toBe(
      "/angajati",
    );
  });
});
