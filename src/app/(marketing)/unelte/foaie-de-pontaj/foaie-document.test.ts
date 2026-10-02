import { describe, expect, it } from "vitest";

import { construiesteFoaie } from "./foaie";
import { foaieCaDocument } from "./foaie-document";

describe("foaia de pontaj ca document", () => {
  it("are o coloană pe zi, plus numele și totalul, și umbrește weekendurile și sărbătorile", () => {
    // Decembrie 2026: 1 dec (Ziua Națională, marți), 25–26 dec (Crăciun).
    const foaie = construiesteFoaie(2026, 12, ["Popa Ion"], 8);
    const d = foaieCaDocument(foaie);
    expect(d.coloane).toHaveLength(31 + 2);
    // Pe două rânduri: „12 M” nu încape pe o coloană de zi în A4 peisaj și se
    // tăia în „1…” — văzut în PDF-ul randat, nu presupus.
    expect(d.coloane[1]?.eticheta).toBe("1\nM");
    expect(d.umbrite).toContain(1); // 1 decembrie, sărbătoare
    expect(d.umbrite).toContain(5); // 5 decembrie, sâmbătă
    expect(d.umbrite).not.toContain(2); // 2 decembrie, miercuri lucrătoare
    expect(d.randuri[0]?.[0]).toBe("Popa Ion");
    expect(d.orientare).toBe("peisaj");
    expect(d.numeFisier).toBe("pontaj-2026-12");
    expect(d.note.join(" ")).toMatch(/Crăciun/u);
  });
});
