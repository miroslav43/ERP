import { describe, expect, it } from "vitest";

import { caleaDePortal } from "./legaturi";

describe("caleaDePortal", () => {
  const ID = "3f8c1d2e-1111-4222-8333-444455556666";

  it("traduce cele patru legături pe care le primește un angajat", () => {
    expect(caleaDePortal(`/concedii/${ID}`)).toBe(`/portal/concediile-mele/${ID}`);
    expect(caleaDePortal("/pontaj/saptamana")).toBe("/portal/pontajul-meu/saptamana");
    expect(caleaDePortal(`/anunturi/${ID}`)).toBe(`/portal/anunturi/${ID}`);
    expect(caleaDePortal(`/ticketing/${ID}`)).toBe(`/portal/tichetele-mele/${ID}`);
  });

  it("lasă neatinsă o cale care e deja de portal", () => {
    expect(caleaDePortal("/portal/concediile-mele")).toBe("/portal/concediile-mele");
    expect(caleaDePortal("/portal")).toBe("/portal");
  });

  it("întoarce `null` pentru legăturile de aprobator", () => {
    // Un angajat nu le primește. Dacă totuși ajunge una la el, un text fără link
    // e mai onest decât o cale ghicită care duce în 404.
    expect(caleaDePortal("/concedii/aprobari")).toBeNull();
    expect(caleaDePortal("/pontaj/aprobare")).toBeNull();
  });

  it("întoarce `null` pentru orice cale necunoscută", () => {
    expect(caleaDePortal("/salarizare/2026/8")).toBeNull();
    expect(caleaDePortal("/angajati")).toBeNull();
    expect(caleaDePortal("")).toBeNull();
    expect(caleaDePortal(null)).toBeNull();
  });

  it("nu traduce o cale care doar SEAMĂNĂ cu una cunoscută", () => {
    // Listă albă, nu potrivire pe prefix: `/concediix` nu e `/concedii`.
    expect(caleaDePortal("/concediile-altcuiva")).toBeNull();
    expect(caleaDePortal(`/concedii/${ID}/editare`)).toBeNull();
    expect(caleaDePortal("/concedii/nu-e-uuid")).toBeNull();
  });

  it("nu poate produce o cale în afara portalului", () => {
    const intrari = [
      `/concedii/${ID}`,
      "/pontaj/saptamana",
      `/anunturi/${ID}`,
      `/ticketing/${ID}`,
      "/anunturi",
      "/concedii",
      "/pontaj",
    ];
    for (const intrare of intrari) {
      const iesire = caleaDePortal(intrare);
      expect(iesire, `${intrare} → ${String(iesire)}`).toMatch(/^\/portal(\/|$)/);
    }
  });
});
