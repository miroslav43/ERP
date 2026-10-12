// src/components/layout/sidebar-nav.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Sidebar, SidebarProvider } from "./sidebar";
import { SidebarNav, type NavGroupView } from "./sidebar-nav";

// `usePathname` cere contextul App Router, care într-un DOM simulat nu există.
const ruta = vi.hoisted(() => ({ cale: "/panou" }));
vi.mock("next/navigation", () => ({
  usePathname: () => ruta.cale,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const GRUPURI: readonly NavGroupView[] = [
  {
    id: "operatiuni",
    label: "Operațiuni",
    items: [
      { id: "panou", label: "Panou", href: "/panou", icon: null },
      { id: "pontaj", label: "Pontaj", href: "/pontaj", icon: null },
    ],
  },
  {
    id: "administrare",
    label: "Administrare",
    items: [{ id: "setari", label: "Setări", href: "/setari", icon: null }],
  },
];

/**
 * UX-041: etichetele de grup din rail erau `h2`, randate ÎNAINTEA `h1`-ului
 * paginii — lista de titluri a unui cititor de ecran începea cu „OPERAȚIUNI”,
 * „PERSONAL”, „RESURSE”… Numele grupului rămâne, dar ca nume al listei.
 */
describe("SidebarNav — etichetele de grup", () => {
  it("nu randează niciun titlu (heading)", () => {
    render(
      <SidebarProvider defaultCollapsed={false}>
        <SidebarNav groups={GRUPURI} />
      </SidebarProvider>,
    );

    expect(screen.queryAllByRole("heading")).toEqual([]);
  });

  it("fiecare listă de grup e numită după eticheta ei", () => {
    render(
      <SidebarProvider defaultCollapsed={false}>
        <SidebarNav groups={GRUPURI} />
      </SidebarProvider>,
    );

    expect(screen.getByRole("list", { name: "Operațiuni" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Administrare" })).toBeTruthy();
  });
});

/**
 * Cu „Sporuri și prime” și „Popriri” mutate sub „Salarizare” (UX-001), pe
 * `/salarizare/popriri` se aprind și părintele, și copilul. Doar unul poate fi
 * `aria-current="page"` — altfel cititorul de ecran anunță două pagini curente,
 * defectul pe care `hrefulActiv` îl reparase pentru aceleași rute.
 */
describe("SidebarNav — o singură pagină curentă când e activ un copil", () => {
  const FINANCIAR: readonly NavGroupView[] = [
    {
      id: "financiar",
      label: "Financiar",
      items: [
        {
          id: "salarizare",
          label: "Salarizare",
          href: "/salarizare",
          icon: null,
          children: [
            {
              id: "componente-salariale",
              label: "Sporuri și prime",
              href: "/salarizare/componente",
            },
            { id: "popriri", label: "Popriri", href: "/salarizare/popriri" },
          ],
        },
      ],
    },
  ];

  it("pe pagina copilului, doar copilul e pagina curentă; părintele rămâne marcat", () => {
    ruta.cale = "/salarizare/popriri";
    try {
      const { container } = render(
        <SidebarProvider defaultCollapsed={false}>
          <SidebarNav groups={FINANCIAR} />
        </SidebarProvider>,
      );

      const curente = container.querySelectorAll('[aria-current="page"]');
      expect(Array.from(curente, (element) => element.textContent)).toEqual(["Popriri"]);
      expect(screen.getByRole("link", { name: "Salarizare" }).getAttribute("aria-current")).toBe(
        "true",
      );
      expect(screen.getByRole("link", { name: "Sporuri și prime" })).toBeTruthy();
    } finally {
      ruta.cale = "/panou";
    }
  });

  it("pe pagina părintelui, părintele e pagina curentă", () => {
    ruta.cale = "/salarizare";
    try {
      render(
        <SidebarProvider defaultCollapsed={false}>
          <SidebarNav groups={FINANCIAR} />
        </SidebarProvider>,
      );

      expect(screen.getByRole("link", { name: "Salarizare" }).getAttribute("aria-current")).toBe(
        "page",
      );
    } finally {
      ruta.cale = "/panou";
    }
  });
});

/**
 * UX-002 și UX-001: numele firmei e tăiat cu puncte de suspensie în capul
 * railului, iar lista derulabilă n-avea niciun indiciu că mai are conținut.
 */
describe("Sidebar — capul și zona derulabilă", () => {
  const FIRMA = "SOLEMTRIX HARDWARE & SOFTWARE SOLUTIONS S.R.L.";

  it("numele firmei are valoarea întreagă în title", () => {
    render(
      <SidebarProvider defaultCollapsed={false}>
        <Sidebar organizationName={FIRMA}>
          <SidebarNav groups={GRUPURI} />
        </Sidebar>
      </SidebarProvider>,
    );

    expect(screen.getByText(FIRMA).getAttribute("title")).toBe(FIRMA);
  });

  it("containerul derulabil poartă umbra de derulare", () => {
    render(
      <SidebarProvider defaultCollapsed={false}>
        <Sidebar organizationName={FIRMA}>
          <SidebarNav groups={GRUPURI} />
        </Sidebar>
      </SidebarProvider>,
    );

    const derulabil = screen.getByRole("navigation", { name: "Navigare principală" }).parentElement;
    expect(derulabil?.className).toContain("overflow-y-auto");
    expect(derulabil?.className).toContain("umbra-derulare");
  });
});
