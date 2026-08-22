import { describe, expect, it } from "vitest";

import {
  RUTA_ALEGE_ORGANIZATIA,
  RUTA_DUPA_AUTENTIFICARE,
  RUTA_PORTAL,
  RUTA_SUPER_ADMIN,
  rutaDupaAutentificare,
} from "./routes";

describe("rutaDupaAutentificare", () => {
  it("duce administratorul de platformă fără firme în consolă", () => {
    expect(
      rutaDupaAutentificare({ estePlatformAdmin: true, areOrganizatii: false, rol: null }),
    ).toBe(RUTA_SUPER_ADMIN);
  });

  it("duce administratorul de platformă CU firme tot în consolă", () => {
    // Planul de platformă e „acasă" pentru el; spre firmă comută explicit,
    // din antetul consolei.
    expect(
      rutaDupaAutentificare({ estePlatformAdmin: true, areOrganizatii: true, rol: "org_admin" }),
    ).toBe(RUTA_SUPER_ADMIN);
  });

  it("duce utilizatorul obișnuit cu firme în aplicație", () => {
    expect(
      rutaDupaAutentificare({ estePlatformAdmin: false, areOrganizatii: true, rol: "org_admin" }),
    ).toBe(RUTA_DUPA_AUTENTIFICARE);
  });

  it("duce utilizatorul fără firme la ecranul de alegere, care explică situația", () => {
    expect(
      rutaDupaAutentificare({ estePlatformAdmin: false, areOrganizatii: false, rol: null }),
    ).toBe(RUTA_ALEGE_ORGANIZATIA);
  });

  it("duce angajatul direct în portal", () => {
    expect(
      rutaDupaAutentificare({ estePlatformAdmin: false, areOrganizatii: true, rol: "employee" }),
    ).toBe(RUTA_PORTAL);
  });

  it("celelalte roluri de firmă ajung în aplicație, nu în portal", () => {
    for (const rol of ["org_admin", "manager", "hr"] as const) {
      expect(
        rutaDupaAutentificare({ estePlatformAdmin: false, areOrganizatii: true, rol }),
        `rolul ${rol} nu are ce căuta în portal`,
      ).toBe(RUTA_DUPA_AUTENTIFICARE);
    }
  });

  it("rolul încă necunoscut cade pe implicit, nu pe portal", () => {
    // Un cont cu apartenențe în mai multe firme n-are rol unic la autentificare.
    // A ghici „employee" ar trimite în portal pe cineva care e administrator
    // dincolo; poarta din layout face saltul corect, după ce se știe organizația.
    expect(
      rutaDupaAutentificare({ estePlatformAdmin: false, areOrganizatii: true, rol: null }),
    ).toBe(RUTA_DUPA_AUTENTIFICARE);
  });

  it("administratorul de platformă care e și angajat ajunge tot în consolă", () => {
    // Ordinea ramurilor: platforma bate rolul de firmă.
    expect(
      rutaDupaAutentificare({ estePlatformAdmin: true, areOrganizatii: true, rol: "employee" }),
    ).toBe(RUTA_SUPER_ADMIN);
  });

  it("lipsa organizației bate rolul", () => {
    // Fără apartenență activă nu există rol de aplicat — ecranul de alegere
    // explică de ce lista e goală. O inversare de ramuri ar trimite în portal un
    // cont care n-are unde ateriza.
    expect(
      rutaDupaAutentificare({ estePlatformAdmin: false, areOrganizatii: false, rol: "employee" }),
    ).toBe(RUTA_ALEGE_ORGANIZATIA);
  });
});
