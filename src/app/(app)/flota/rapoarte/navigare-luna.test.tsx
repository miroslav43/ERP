// src/app/(app)/flota/rapoarte/navigare-luna.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NavigareLuna } from "./navigare-luna";

const V1 = "11111111-1111-4111-8111-111111111111";
const V2 = "22222222-2222-4222-8222-222222222222";
const VEHICULE = [
  { id: V1, nr_inmatriculare: "B100ABC" },
  { id: V2, nr_inmatriculare: "CJ200XYZ" },
];

describe("NavigareLuna", () => {
  it("luna aleasă e titlul, iar legăturile duc la luna dinainte și la cea de după", () => {
    render(<NavigareLuna luna="2026-08" vehicul={null} azi="2026-10-12" vehicule={VEHICULE} />);
    expect(screen.getByRole("heading", { name: "august 2026" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Luna anterioară, iulie 2026" }).getAttribute("href"),
    ).toBe("/flota/rapoarte?luna=2026-07");
    expect(
      screen.getByRole("link", { name: "Luna următoare, septembrie 2026" }).getAttribute("href"),
    ).toBe("/flota/rapoarte?luna=2026-09");
  });

  it("vehiculul ales se păstrează când se schimbă luna", () => {
    render(<NavigareLuna luna="2026-08" vehicul={V2} azi="2026-10-12" vehicule={VEHICULE} />);
    expect(
      screen.getByRole("link", { name: "Luna anterioară, iulie 2026" }).getAttribute("href"),
    ).toBe(`/flota/rapoarte?luna=2026-07&vehicul=${V2}`);
  });

  it("după luna curentă nu mai există „luna următoare”: o lună viitoare n-are foi aprobate", () => {
    render(<NavigareLuna luna="2026-10" vehicul={null} azi="2026-10-12" vehicule={VEHICULE} />);
    expect(screen.queryByRole("link", { name: /Luna următoare/u })).toBeNull();
    expect(screen.getByRole("link", { name: /Luna anterioară/u })).toBeTruthy();
  });

  it("formularul de vehicul trimite prin GET luna curentă, fără JavaScript", () => {
    const { container } = render(
      <NavigareLuna luna="2026-08" vehicul={V1} azi="2026-10-12" vehicule={VEHICULE} />,
    );
    const formular = container.querySelector("form");
    expect(formular?.getAttribute("method")).toBe("get");
    expect(formular?.getAttribute("action")).toBe("/flota/rapoarte");
    expect(
      container.querySelector('input[type="hidden"][name="luna"]')?.getAttribute("value"),
    ).toBe("2026-08");
    const selector = screen.getByLabelText("Vehicul") as HTMLSelectElement;
    expect(selector.value).toBe(V1);
    expect(Array.from(selector.options).map((o) => o.text)).toEqual([
      "Toată flota",
      "B100ABC",
      "CJ200XYZ",
    ]);
  });
});
