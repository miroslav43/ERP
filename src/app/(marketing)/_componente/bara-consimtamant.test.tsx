// src/app/(marketing)/_componente/bara-consimtamant.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { BaraConsimtamant } from "./bara-consimtamant";
import { EVENIMENT_CONSIMTAMANT } from "./consimtamant";

beforeEach(() => {
  localStorage.clear();
});

describe("BaraConsimtamant", () => {
  it("la „Accept” anunță alegerea pe window, apoi dispare", async () => {
    const auzite: unknown[] = [];
    const asculta = (e: Event) => auzite.push((e as CustomEvent<unknown>).detail);
    window.addEventListener(EVENIMENT_CONSIMTAMANT, asculta);
    try {
      render(<BaraConsimtamant />);
      (await screen.findByRole("button", { name: "Accept" })).click();
      await waitFor(() =>
        expect(screen.queryByRole("region", { name: "Cookie-uri de analiză" })).toBeNull(),
      );
      expect(auzite).toEqual(["acceptat"]);
    } finally {
      window.removeEventListener(EVENIMENT_CONSIMTAMANT, asculta);
    }
  });
});
