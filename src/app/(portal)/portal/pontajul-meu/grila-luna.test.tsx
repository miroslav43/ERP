// src/app/(portal)/portal/pontajul-meu/grila-luna.test.tsx
/**
 * Gărzi de randare pentru grila lunară din „Pontajul meu” (UX-045, ANG-033).
 *
 * La 390 px pagina se derula lateral (`scrollWidth` 525 față de 390): tabelul
 * avea `min-w-[44rem]`, deci se vedeau doar Luni–Joi, iar spanurile `sr-only`
 * din celule (`position: absolute`) nu aveau niciun strămoș poziționat — blocul
 * lor conținător era cel inițial, iar poziția lor statică, în coloana de
 * sâmbătă, întindea `documentElement`. Leacul e `relative` pe containerul
 * derulabil (memoria `erp-sronly-in-overflow`) și grila pe 7 coloane înguste.
 *
 * happy-dom nu calculează stil, deci astea sunt gărzi de CLASĂ: apără forma,
 * nu măsoară. Măsurătoarea reală (`scrollWidth` vs `clientWidth`) e în
 * `e2e/responsive.spec.ts`, pe staging. Fiecare gardă a fost văzută roșie
 * înainte de corecție.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ZiPontaj } from "@/lib/queries/portal";

import { GrilaLuna } from "./grila-luna";

const ZI: ZiPontaj = {
  id: "z1",
  data: "2026-10-08",
  ora_inceput: "08:00:00",
  ora_sfarsit: "16:00:00",
  ore_lucrate: 8,
  ore_suplimentare: 0,
  ore_noapte: 0,
  tip_zi: "lucratoare",
  tip_prezenta: null,
  punct_lucru_id: null,
  punct_lucru_declarat_id: null,
  observatii: null,
  leave_request_id: null,
  approved_at: null,
  respins_la: null,
  motiv_respingere: null,
};

function deseneaza(): HTMLElement {
  const { container } = render(
    <GrilaLuna an={2026} luna={10} zile={[ZI]} poateEdita azi="2026-10-08" angajatDin={null} />,
  );
  return container;
}

describe("grila lunară din portal, pe telefon", () => {
  it("ține spanurile sr-only în containerul derulabil (relative)", () => {
    const container = deseneaza();
    const tabel = container.querySelector("table");
    expect(tabel).not.toBeNull();
    const parinte = tabel?.parentElement;
    expect(parinte?.classList.contains("overflow-x-auto")).toBe(true);
    expect(parinte?.classList.contains("relative")).toBe(true);
  });

  it("nu impune o lățime minimă mai mare decât telefonul", () => {
    const container = deseneaza();
    const tabel = container.querySelector("table");
    expect(tabel?.className).not.toContain("min-w-");
  });

  it("păstrează numele întreg al zilei în antet, și când se văd inițialele", () => {
    deseneaza();
    const antete = screen.getAllByRole("columnheader");
    expect(antete).toHaveLength(7);
    expect(antete.map((a) => a.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("Luni")]),
    );
    expect(screen.getByRole("columnheader", { name: "Luni" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "Duminică" })).toBeDefined();
  });
});

describe("etichetele de stare, în coloana îngustă", () => {
  // La 390 px o coloană are ~43 px utili: „Respinsă” și „Aprobată” se rupeau
  // în mijlocul cuvântului („Respin/să”, măsurat headless). Pe telefon se
  // vede prescurtarea, de la `sm` cuvântul întreg; cititorul de ecran
  // primește mereu cuvântul întreg.
  function eticheta(container: HTMLElement, scurt: string, intreg: string): void {
    const vizibilScurt = [...container.querySelectorAll("span")].find(
      (s) => s.textContent === scurt,
    );
    expect(vizibilScurt?.getAttribute("aria-hidden")).toBe("true");
    expect(vizibilScurt?.classList.contains("sm:hidden")).toBe(true);
    const citit = [...container.querySelectorAll("span.sr-only")].find(
      (s) => s.textContent === intreg,
    );
    expect(citit).toBeDefined();
  }

  it("prescurtează „Respinsă” și „Aprobată” pe telefon, fără să le schimbe numele", () => {
    const { container } = render(
      <GrilaLuna
        an={2026}
        luna={10}
        zile={[
          { ...ZI, id: "z2", data: "2026-10-01", approved_at: "2026-10-02T08:00:00Z" },
          { ...ZI, id: "z3", data: "2026-10-02", respins_la: "2026-10-03T08:00:00Z" },
        ]}
        poateEdita
        azi="2026-10-08"
        angajatDin={null}
      />,
    );
    eticheta(container, "Resp.", "Respinsă");
    eticheta(container, "Apr.", "Aprobată");
  });
});

describe("ziua de azi", () => {
  it("e marcată cu aria-current și „(azi)”, ca în calendarul din aplicație", () => {
    const container = deseneaza();
    const curenta = container.querySelector('[aria-current="date"]');
    expect(curenta).not.toBeNull();
    expect(curenta?.tagName).toBe("TD");
    expect(curenta?.textContent).toContain("8");
    expect(curenta?.textContent).toContain("(azi)");
    // Doar o singură zi e „azi”.
    expect(container.querySelectorAll('[aria-current="date"]')).toHaveLength(1);
  });
});
