import { describe, expect, it } from "vitest";

import { etichetaRutei } from "./breadcrumb";

describe("etichetaRutei — firimitura numește modulul, nu prima filă a lui", () => {
  it("părintele bate copilul cu același href (UX-034)", () => {
    // „Tichetele mele” are href-ul `/ticketing`, ca și părintele. Copilul
    // suprascria părintele, iar coada arăta „Tichetele mele > Coada echipei”.
    expect(etichetaRutei("/ticketing")).toBe("Tichete IT");
    expect(etichetaRutei("/concedii")).toBe("Concedii");
  });

  it("copiii cu href propriu își păstrează eticheta", () => {
    expect(etichetaRutei("/ticketing/coada")).toBe("Coada echipei");
  });

  it("o rută din afara meniului nu are etichetă de meniu", () => {
    expect(etichetaRutei("/nu-exista")).toBeUndefined();
  });
});
