// src/app/not-found.test.tsx
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ce apără fișierul: 404-ul rădăcină, cel care prinde adresele fără nicio rută
 * (UX-043).
 *
 * Trei publicuri, trei ecrane:
 *   · vizitatorul fără sesiune — ecranul public, cu drum spre pagina de start
 *     (un `/panou` l-ar trimite la autentificare: regresia „soft 404”);
 *   · membrul unei firme, alt rol decât angajatul — corpul 404 ÎN carcasa
 *     aplicației, cu meniu și antet, și buton primar spre panou;
 *   · angajatul — fără carcasa de administrare (layout-ul `(app)` îl mută
 *     oricum în portal), cu drum spre `/portal`.
 * Iar o eroare la rezolvarea firmei nu are voie să transforme un 404 în 500.
 */

const resolveTenant = vi.fn();
const getEnabledFeatures = vi.fn();

vi.mock("@/lib/tenant/resolve-tenant", () => ({ resolveTenant }));
vi.mock("@/lib/auth/features", () => ({ getEnabledFeatures }));
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
}));
vi.mock("@/components/layout/carcasa-app", () => ({
  COOKIE_SIDEBAR: "adm_sidebar",
  CarcasaApp: ({ children }: { children: ReactNode }) => (
    <div data-testid="carcasa">{children}</div>
  ),
}));

const { default: Negasit } = await import("./not-found");

const UTILIZATOR = { id: "u-1", email: "ana@exemplu.ro", fullName: "Ana" };

function tenant(role: string) {
  return {
    status: "ok",
    user: UTILIZATOR,
    tenant: { organizationId: "org-1", name: "Firma", role, memberId: "m-1" },
  };
}

async function randeaza() {
  render(await Negasit());
}

describe("404-ul rădăcină", () => {
  beforeEach(() => {
    resolveTenant.mockReset();
    getEnabledFeatures.mockReset();
    getEnabledFeatures.mockResolvedValue(new Set());
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("fără sesiune: ecranul public, cu pagina de start, fără carcasă", async () => {
    resolveTenant.mockResolvedValue({ status: "neautentificat" });
    await randeaza();
    expect(screen.getByRole("heading", { level: 1, name: "Pagina nu există" })).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Înapoi la pagina de start" }).getAttribute("href"),
    ).toBe("/");
    expect(screen.queryByTestId("carcasa")).toBeNull();
    expect(getEnabledFeatures).not.toHaveBeenCalled();
  });

  it("administrator: corpul 404 în carcasa aplicației, cu buton spre panou", async () => {
    resolveTenant.mockResolvedValue(tenant("org_admin"));
    await randeaza();
    const carcasa = screen.getByTestId("carcasa");
    expect(carcasa.querySelector("h1")?.textContent).toBe("Pagina nu există");
    expect(screen.getByRole("link", { name: "Înapoi la panou" }).getAttribute("href")).toBe(
      "/panou",
    );
    expect(getEnabledFeatures).toHaveBeenCalledWith("org-1");
  });

  it("angajat: fără carcasa de administrare, cu drum spre portal", async () => {
    resolveTenant.mockResolvedValue(tenant("employee"));
    await randeaza();
    expect(screen.queryByTestId("carcasa")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Pagina nu există" })).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Înapoi la pagina de start" }).getAttribute("href"),
    ).toBe("/portal");
  });

  it("eroare la rezolvarea firmei: tot 404 public, nu 500", async () => {
    resolveTenant.mockRejectedValue(new Error("rețea"));
    await randeaza();
    expect(screen.getByRole("heading", { level: 1, name: "Pagina nu există" })).toBeDefined();
    expect(screen.queryByTestId("carcasa")).toBeNull();
  });
});
