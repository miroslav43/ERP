import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MasurareCitire } from "./masurare-citire";

let caleCurenta = "/preturi";
vi.mock("next/navigation", () => ({ usePathname: () => caleCurenta }));

type Payload = Record<string, unknown>;
let trimise: Payload[] = [];

function ascundeFila() {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  trimise = [];
  caleCurenta = "/preturi";
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  (window as unknown as { umami: unknown }).umami = {
    track: (f: (p: Payload) => Payload) => trimise.push(f({ url: "/alta-pagina", website: "x" })),
  };
});

afterEach(() => {
  delete (window as unknown as { umami?: unknown }).umami;
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("evenimentul citire", () => {
  it("pleacă o singură dată, chiar dacă fila se ascunde de două ori", () => {
    render(<MasurareCitire />);
    ascundeFila();
    ascundeFila();
    window.dispatchEvent(new Event("pagehide"));
    expect(trimise).toHaveLength(1);
    expect(trimise[0]?.name).toBe("citire");
  });

  it("poartă pagina măsurată, nu adresa la care a ajuns între timp istoria", () => {
    render(<MasurareCitire />);
    ascundeFila();
    expect(trimise[0]?.url).toBe("/preturi");
    expect(trimise[0]?.website).toBe("x");
  });

  it("schimbarea paginii trimite citirea celei vechi și o pornește pe a nouă", () => {
    const { rerender } = render(<MasurareCitire />);
    caleCurenta = "/module";
    rerender(<MasurareCitire />);
    expect(trimise.map((p) => p.url)).toEqual(["/preturi"]);
    ascundeFila();
    expect(trimise.map((p) => p.url)).toEqual(["/preturi", "/module"]);
  });

  it("nu cade dacă scriptul Umami nu s-a încărcat", () => {
    delete (window as unknown as { umami?: unknown }).umami;
    render(<MasurareCitire />);
    expect(() => ascundeFila()).not.toThrow();
  });
});

describe("excluderea dispozitivului propriu", () => {
  it("?nu-ma-numara oprește Umami pe dispozitivul ăsta", () => {
    window.history.replaceState(null, "", "/?nu-ma-numara");
    render(<MasurareCitire />);
    expect(localStorage.getItem("umami.disabled")).toBe("1");
  });

  it("?numara-ma îl readuce", () => {
    localStorage.setItem("umami.disabled", "1");
    window.history.replaceState(null, "", "/?numara-ma");
    render(<MasurareCitire />);
    expect(localStorage.getItem("umami.disabled")).toBeNull();
  });
});
