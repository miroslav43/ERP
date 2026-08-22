import { describe, expect, it } from "vitest";

import {
  RUTA_ALEGE_ORGANIZATIA,
  RUTA_DUPA_AUTENTIFICARE,
  RUTA_SUPER_ADMIN,
  rutaDupaAutentificare,
} from "./routes";

describe("rutaDupaAutentificare", () => {
  it("duce administratorul de platformă fără firme în consolă", () => {
    expect(rutaDupaAutentificare({ estePlatformAdmin: true, areOrganizatii: false })).toBe(
      RUTA_SUPER_ADMIN,
    );
  });

  it("duce administratorul de platformă CU firme tot în consolă", () => {
    // Planul de platformă e „acasă" pentru el; spre firmă comută explicit,
    // din antetul consolei.
    expect(rutaDupaAutentificare({ estePlatformAdmin: true, areOrganizatii: true })).toBe(
      RUTA_SUPER_ADMIN,
    );
  });

  it("duce utilizatorul obișnuit cu firme în aplicație", () => {
    expect(rutaDupaAutentificare({ estePlatformAdmin: false, areOrganizatii: true })).toBe(
      RUTA_DUPA_AUTENTIFICARE,
    );
  });

  it("duce utilizatorul fără firme la ecranul de alegere, care explică situația", () => {
    expect(rutaDupaAutentificare({ estePlatformAdmin: false, areOrganizatii: false })).toBe(
      RUTA_ALEGE_ORGANIZATIA,
    );
  });
});
