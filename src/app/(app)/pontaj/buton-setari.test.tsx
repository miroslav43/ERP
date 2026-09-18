// src/app/(app)/pontaj/buton-setari.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ButonSetariPontaj } from "./buton-setari";

/**
 * Antetul pontajului, cu cele două drumuri ale lui.
 *
 * ── DE CE ARE NEVOIE DE TESTE UN ANTET CU DOUĂ LINK-URI ───────────────────
 * Fiindcă cele două atârnă de permisiuni DIFERITE, iar diferența e exact
 * lucrul care se pierde la următoarea atingere: „Setări" cere
 * `attendance:update`, „Coduri QR" cere `departments:update`. Compuse din
 * greșeală într-un singur boolean, ar apărea un buton care duce garantat la un
 * refuz — sau ar dispărea unul la care omul avea dreptul.
 *
 * Reclamația din care s-a născut al doilea link: „în pontaj în continuare nu
 * îmi apare nimic de văzut QR-ul". Era adevărat pe două căi deodată — contul
 * folosit era `manager`, deci n-avea niciuna dintre chei, iar pe contul care le
 * avea drumul era ascuns sub un buton pe care scrie „Setări".
 */
describe("ButonSetariPontaj", () => {
  it("cu amândouă cheile, arată amândouă drumurile", () => {
    render(<ButonSetariPontaj poateConfigura poateVedeaCoduriQr />);
    expect(screen.getByRole("link", { name: /Coduri QR/u }).getAttribute("href")).toBe(
      "/pontaj/setari/coduri-qr",
    );
    expect(screen.getByRole("link", { name: /^Setări$/u }).getAttribute("href")).toBe(
      "/pontaj/setari",
    );
  });

  it("cine configurează pontajul fără drept pe structură NU vede codurile", () => {
    // Poarta codurilor e a secretului, nu a modulului: cine vede codul poate
    // ponta de oriunde. Un link către un refuz e mai rău decât absența lui.
    render(<ButonSetariPontaj poateConfigura poateVedeaCoduriQr={false} />);
    expect(screen.queryByRole("link", { name: /Coduri QR/u })).toBeNull();
    expect(screen.getByRole("link", { name: /^Setări$/u })).toBeDefined();
  });

  it("cine are codurile fără dreptul de configurare vede DOAR codurile", () => {
    render(<ButonSetariPontaj poateConfigura={false} poateVedeaCoduriQr />);
    expect(screen.getByRole("link", { name: /Coduri QR/u })).toBeDefined();
    expect(screen.queryByRole("link", { name: /^Setări$/u })).toBeNull();
  });

  it("fără nicio cheie nu desenează nimic — cazul rolului `manager`", () => {
    const { container } = render(
      <ButonSetariPontaj poateConfigura={false} poateVedeaCoduriQr={false} />,
    );
    expect(container.textContent).toBe("");
  });
});
