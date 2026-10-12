import { Children, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Element = ReactElement<Record<string, unknown>>;

function copiiDin(element: unknown): Element[] {
  expect(element).not.toBeNull();
  return Children.toArray(
    (element as ReactElement<{ children?: ReactNode }>).props.children,
  ) as Element[];
}

describe("Analitice", () => {
  it("pornește GA prin PornireGa, nu prin scriptul inline „ga-pornire”", async () => {
    const { Analitice, ID_GA } = await import("./analitice");
    const { PornireGa } = await import("./pornire-ga");
    const copii = copiiDin(Analitice());
    expect(copii.filter((c) => c.type === PornireGa).map((c) => c.props["id"])).toEqual([ID_GA]);
    expect(copii.some((c) => c.props["id"] === "ga-pornire")).toBe(false);
  });

  it("consimțământul implicit rămâne primul copil, înaintea bibliotecii", async () => {
    const { Analitice } = await import("./analitice");
    const [primul] = copiiDin(Analitice());
    expect(primul?.type).toBe("script");
  });
});

describe("ScriptUmami", () => {
  beforeEach(() => {
    // `UMAMI_SRC`/`UMAMI_ID` se citesc la evaluarea modulului: mediu întâi, import după.
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_UMAMI_SRC", "https://analitice.administrativo.ro/script.js");
    vi.stubEnv("NEXT_PUBLIC_UMAMI_ID", "id-test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("cere tăierea query string-ului și numește funcția de dinainte de trimitere", async () => {
    const { ScriptUmami } = await import("./analitice");
    const { FUNCTIE_UMAMI } = await import("./adresa-analitice");
    const { PregatireUmami } = await import("./pregatire-umami");
    const copii = copiiDin(ScriptUmami());
    const indiceScript = copii.findIndex((c) => c.props["data-website-id"] === "id-test");
    const script = copii[indiceScript];
    expect(script?.props["data-exclude-search"]).toBe("true");
    expect(script?.props["data-before-send"]).toBe(FUNCTIE_UMAMI);
    const indicePregatire = copii.findIndex((c) => c.type === PregatireUmami);
    expect(indicePregatire).toBeGreaterThanOrEqual(0);
    expect(indicePregatire).toBeLessThan(indiceScript);
  });

  it("fără identificatorul sitului nu randează nimic", async () => {
    vi.stubEnv("NEXT_PUBLIC_UMAMI_ID", "");
    const { ScriptUmami } = await import("./analitice");
    expect(ScriptUmami()).toBeNull();
  });
});
