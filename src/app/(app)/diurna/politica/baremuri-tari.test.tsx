import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BaremuriTari } from "./baremuri-tari";

const BAREMURI = [
  { tara: "Germania", valoare: 35, moneda: "EUR", valabilDeLa: "2026-01-01" },
  { tara: "Ungaria", valoare: 32, moneda: "EUR", valabilDeLa: "2026-01-01" },
];

describe("BaremuriTari", () => {
  it("textul e un buton; fereastra apare abia la apăsare", () => {
    render(
      <BaremuriTari baremuri={BAREMURI} multiplu={2.5}>
        baremul țării
      </BaremuriTari>,
    );
    expect(screen.queryByRole("table")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "baremul țării" }));

    const tabel = screen.getByRole("table");
    const germania = within(tabel).getByText("Germania").closest("tr");
    expect(germania).not.toBeNull();
    // Barem 35 EUR, neimpozabil 2,5 × 35 = 87,50 EUR.
    expect(within(germania!).getByText("35,00 EUR")).toBeTruthy();
    expect(within(germania!).getByText("87,50 EUR")).toBeTruthy();
  });

  it("fără multiplu legal nu inventează coloana de neimpozabil", () => {
    render(
      <BaremuriTari baremuri={BAREMURI} multiplu={null}>
        baremul țării
      </BaremuriTari>,
    );
    fireEvent.click(screen.getByRole("button", { name: "baremul țării" }));
    expect(screen.queryByRole("columnheader", { name: "Neimpozabil / zi" })).toBeNull();
  });
});
