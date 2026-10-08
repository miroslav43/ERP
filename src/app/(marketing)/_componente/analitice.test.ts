import { Children, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

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
