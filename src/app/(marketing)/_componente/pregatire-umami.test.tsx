import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FUNCTIE_UMAMI, type PayloadUmami } from "./adresa-analitice";
import { PregatireUmami } from "./pregatire-umami";

type Functie = (tip: string, payload: PayloadUmami) => PayloadUmami;
const functie = () => (window as unknown as Record<string, Functie | undefined>)[FUNCTIE_UMAMI];

afterEach(() => {
  delete (window as unknown as Record<string, unknown>)[FUNCTIE_UMAMI];
  window.history.replaceState(null, "", "/");
});

describe("PregatireUmami", () => {
  it("pune pe window funcția numită în data-before-send", () => {
    expect(functie()).toBeUndefined();
    render(<PregatireUmami />);
    expect(typeof functie()).toBe("function");
  });

  it("curăță adresa și sursa și păstrează campania paginii curente", () => {
    window.history.replaceState(
      null,
      "",
      "/unelte/foaie-de-pontaj?utm_source=fisier&angajati=Zzsecret",
    );
    render(<PregatireUmami />);
    const rezultat = functie()?.("event", {
      website: "id",
      url: `${window.location.origin}/unelte/foaie-de-pontaj`,
      referrer: "/unelte/condica-de-prezenta?firma=Zzsecret",
    });
    expect(rezultat).toEqual({
      website: "id",
      url: `${window.location.origin}/unelte/foaie-de-pontaj?utm_source=fisier`,
      referrer: "/unelte/condica-de-prezenta",
    });
  });
});
