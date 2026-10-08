import { describe, expect, it } from "vitest";

import { filaActiva } from "./file-client";

const FILE = [
  { href: "/flota", eticheta: "Vehicule" },
  { href: "/flota/foi", eticheta: "Foi de parcurs" },
  { href: "/flota/aprobari", eticheta: "De aprobat" },
];

describe("filaActiva", () => {
  it("aprinde rădăcina doar pe ea însăși", () => {
    expect(filaActiva("/flota", FILE)).toBe("/flota");
    expect(filaActiva("/flota/foi", FILE)).toBe("/flota/foi");
  });

  it("aprinde fila cu cel mai lung prefix, inclusiv pe pagina de detaliu", () => {
    expect(filaActiva("/flota/foi/0f8fad5b-d9cb-469f-a165-70867728950e", FILE)).toBe("/flota/foi");
    expect(filaActiva("/flota/aprobari?pagina=2", FILE)).toBe("/flota/aprobari");
  });

  it("nu confundă un prefix de text cu un segment", () => {
    expect(filaActiva("/flota/foile-vechi", FILE)).toBe("/flota");
    expect(filaActiva("/pontaj", FILE)).toBeNull();
  });
});
