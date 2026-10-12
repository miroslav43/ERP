import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PornireGa } from "./pornire-ga";

type FereastraGa = { gtag?: (...argumente: unknown[]) => void; __admGaPornit?: boolean };
const fereastra = () => window as unknown as FereastraGa;
let apeluri: unknown[][] = [];

function cuReferitor(valoare: string) {
  Object.defineProperty(document, "referrer", { value: valoare, configurable: true });
}

const configurari = () => apeluri.filter((a) => a[0] === "config");

beforeEach(() => {
  apeluri = [];
  fereastra().gtag = (...argumente: unknown[]) => {
    apeluri.push(argumente);
  };
  cuReferitor("");
});

afterEach(() => {
  delete fereastra().gtag;
  delete fereastra().__admGaPornit;
  window.history.replaceState(null, "", "/");
});

describe("PornireGa", () => {
  it("pe o pagină fără valori în adresă configurează GA o dată", () => {
    window.history.replaceState(null, "", "/unelte/foaie-de-pontaj?utm_source=fisier");
    render(<PornireGa id="G-TEST" />);
    expect(apeluri[0]?.[0]).toBe("js");
    expect(configurari()).toEqual([["config", "G-TEST", {}]]);
  });

  it("o sursă cu valori de formular pleacă curățată", () => {
    window.history.replaceState(null, "", "/preturi");
    cuReferitor("https://administrativo.ro/unelte/condica-de-prezenta?firma=Zzsecret");
    render(<PornireGa id="G-TEST" />);
    expect(configurari()).toEqual([
      [
        "config",
        "G-TEST",
        { page_referrer: "https://administrativo.ro/unelte/condica-de-prezenta" },
      ],
    ]);
  });

  it("documentul deschis cu valori completate nu configurează GA deloc", () => {
    window.history.replaceState(
      null,
      "",
      "/unelte/foaie-de-pontaj?luna=10&angajati=Zzsecret+Popescu",
    );
    render(<PornireGa id="G-TEST" />);
    expect(apeluri).toEqual([]);
  });

  it("după o pagină cu valori, documentul rămâne fără GA și pe paginile curate", () => {
    window.history.replaceState(null, "", "/unelte/fisa-evaluare?nume=Zzsecret");
    render(<PornireGa id="G-TEST" />).unmount();
    window.history.replaceState(null, "", "/preturi");
    render(<PornireGa id="G-TEST" />);
    expect(apeluri).toEqual([]);
  });

  it("o a doua montare în același document nu mai trimite configurarea", () => {
    window.history.replaceState(null, "", "/unelte");
    render(<PornireGa id="G-TEST" />).unmount();
    render(<PornireGa id="G-TEST" />);
    expect(configurari()).toHaveLength(1);
  });

  it("fără gtag (scriptul de consimțământ blocat) nu cade", () => {
    delete fereastra().gtag;
    window.history.replaceState(null, "", "/unelte");
    expect(() => render(<PornireGa id="G-TEST" />)).not.toThrow();
  });
});
