import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { dinBrut } from "@/lib/unelte/salariu";

import { Desfasurator } from "./desfasurator";

describe("desfășurătorul", () => {
  it("valorile nu se rup pe două rânduri: „− 1.250 lei” rămâne întreg la 360 px", () => {
    // Auditul din 8 oct 2026: la 360 px, „lei” cădea sub cifră la CAS și la cost.
    const { container } = render(<Desfasurator r={dinBrut(5000, 0, true)} />);
    const celule = [...container.querySelectorAll("td")];
    expect(celule.length).toBeGreaterThan(0);
    for (const td of celule)
      expect(td.className, td.textContent ?? "").toContain("whitespace-nowrap");
    expect(celule.map((td) => td.textContent)).toContain("− 1.250 lei");
  });

  it("are două tabele, pentru angajat și pentru firmă", () => {
    const { container } = render(<Desfasurator r={dinBrut(5000, 0, true)} />);
    expect([...container.querySelectorAll("caption")].map((c) => c.textContent)).toEqual([
      "Angajatul",
      "Firma",
    ]);
  });
});
