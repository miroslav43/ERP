import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { descriePermisiunea } from "@/config/permisiuni-etichete";
import type { PermissionKey, PermissionScope } from "@/config/permissions";

import type { RandPermisiune } from "./matrice-permisiuni";

/*
  `./actions` e un modul `"use server"` care trage după el `server-only`, iar
  `useRouter` cere contextul App Router. Ce se verifică aici e ce se DESENEAZĂ:
  administratorul citea `announcements` și `read` (QA UX-016, ADM-012).
*/
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("./actions", () => ({ suprascriePermisiunea: vi.fn() }));

vi.mock("@/components/incarcare/use-incarcare", () => ({
  useSemnalIncarcare: () => undefined,
}));

const { MatricePermisiuni } = await import("./matrice-permisiuni");

/** Exact ce construiește pagina pe server pentru o cheie. */
function rand(
  cheie: PermissionKey,
  implicit: PermissionScope | null,
  suprascris: PermissionScope | null = null,
  plafon: PermissionScope = "all",
): RandPermisiune {
  const d = descriePermisiunea(cheie);
  return {
    cheie,
    resursa: d.resursa,
    actiune: d.actiune,
    grup: d.grup,
    etichetaResursa: d.etichetaResursa,
    descriereResursa: d.descriereResursa,
    etichetaActiune: d.etichetaActiune,
    descriere: d.descriere,
    implicit,
    suprascris,
    plafon,
  };
}

const RANDURI: readonly RandPermisiune[] = [
  rand("announcements:read", "all"),
  rand("announcements:create", null),
  rand("attendance:approve", "team", "all"),
];

function deseneaza(poateScrie = true) {
  return render(
    <MatricePermisiuni
      memberId="11111111-1111-4111-8111-111111111111"
      randuri={RANDURI}
      poateScrie={poateScrie}
    />,
  );
}

describe("MatricePermisiuni", () => {
  it("arată resursa și acțiunea în română, nu cheia brută", () => {
    const { container } = deseneaza();
    const text = container.textContent ?? "";

    expect(text).toContain("Anunțuri");
    expect(text).toContain("Citire");
    expect(text).toContain("Aprobare");
    expect(text).not.toMatch(/\bannouncements\b/u);
    expect(text).not.toMatch(/\battendance\b/u);
    expect(text).not.toMatch(/\bread\b/u);
    expect(text).not.toMatch(/\bapprove\b/u);
  });

  it("titlul secțiunii poartă modulul, iar sub el stă descrierea resursei", () => {
    deseneaza();
    expect(screen.getByRole("heading", { name: "Anunțuri" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Pontaj" })).toBeTruthy();
    expect(
      screen.getByText(descriePermisiunea("attendance:approve").descriereResursa),
    ).toBeTruthy();
  });

  it("fiecare rând are fraza lui și ce dă rolul, în cuvinte", () => {
    const { container } = deseneaza();
    const li = container.querySelector('li[data-cheie="attendance:approve"]');
    expect(li).not.toBeNull();
    const text = li?.textContent ?? "";
    expect(text).toContain(descriePermisiunea("attendance:approve").descriere);
    expect(text).toContain("Rolul dă: Echipa lui");
    expect(text).toContain("suprascris");

    const nimic = container.querySelector('li[data-cheie="announcements:create"]');
    expect(nimic?.textContent ?? "").toContain("Rolul dă: nimic");
  });

  it("eticheta acțiunii e legată de selectul ei", () => {
    deseneaza();
    const select = screen.getByLabelText("Citire");
    expect(select.tagName).toBe("SELECT");
    expect((select as HTMLSelectElement).value).toBe("implicit");
    expect((screen.getByLabelText("Aprobare") as HTMLSelectElement).value).toBe("all");
  });

  it("fără drept de scriere, toate selecturile sunt dezactivate", () => {
    const { container } = deseneaza(false);
    const selecturi = [...container.querySelectorAll("select")];
    expect(selecturi).toHaveLength(RANDURI.length);
    expect(selecturi.every((s) => s.disabled)).toBe(true);
  });

  it("opțiunile de peste plafonul acordantului sunt inactive, restul rămân", () => {
    const { container } = render(
      <MatricePermisiuni
        memberId="11111111-1111-4111-8111-111111111111"
        randuri={[
          rand("payroll:read", null, null, "none"),
          rand("leave:approve", "team", null, "team"),
        ]}
        poateScrie
      />,
    );
    const optiuni = (cheie: string) =>
      Object.fromEntries(
        [...container.querySelectorAll<HTMLOptionElement>(`li[data-cheie="${cheie}"] option`)].map(
          (o) => [o.value, o.disabled],
        ),
      );

    expect(optiuni("payroll:read")).toEqual({
      implicit: false,
      none: false,
      own: true,
      team: true,
      all: true,
    });
    expect(optiuni("leave:approve")).toEqual({
      implicit: false,
      none: false,
      own: false,
      team: false,
      all: true,
    });
  });

  // Retragerea cade pe implicitul rolului: un `hr` cu `payroll:read = none` pus
  // de administrator ar reveni la `all`. Managerul fără salarizare nu poate.
  it("„Ca la rol” e inactivă când implicitul rolului depășește plafonul, și spune de ce", () => {
    const { container } = render(
      <MatricePermisiuni
        memberId="11111111-1111-4111-8111-111111111111"
        randuri={[
          rand("payroll:read", "all", "none", "none"),
          rand("leave:approve", "team", "none", "team"),
        ]}
        poateScrie
      />,
    );
    const caLaRol = (cheie: string) =>
      container.querySelector<HTMLOptionElement>(
        `li[data-cheie="${cheie}"] option[value="implicit"]`,
      );

    expect(caLaRol("payroll:read")?.disabled).toBe(true);
    expect(container.querySelector('li[data-cheie="payroll:read"]')?.textContent ?? "").toContain(
      "Revenirea la rol i-ar da mai mult decât aveți dumneavoastră",
    );
    expect(caLaRol("leave:approve")?.disabled).toBe(false);
    expect(
      container.querySelector('li[data-cheie="leave:approve"]')?.textContent ?? "",
    ).not.toContain("Revenirea la rol");
  });

  it("fără suprascriere, „Ca la rol” rămâne activă (e chiar valoarea curentă)", () => {
    const { container } = render(
      <MatricePermisiuni
        memberId="11111111-1111-4111-8111-111111111111"
        randuri={[rand("payroll:read", "all", null, "none")]}
        poateScrie
      />,
    );
    expect(
      container.querySelector<HTMLOptionElement>(
        'li[data-cheie="payroll:read"] option[value="implicit"]',
      )?.disabled,
    ).toBe(false);
  });

  it("o suprascriere existentă peste plafon rămâne afișată ca valoare", () => {
    render(
      <MatricePermisiuni
        memberId="11111111-1111-4111-8111-111111111111"
        randuri={[rand("payroll:read", null, "all", "none")]}
        poateScrie
      />,
    );
    expect((screen.getByLabelText("Citire") as HTMLSelectElement).value).toBe("all");
  });
});
