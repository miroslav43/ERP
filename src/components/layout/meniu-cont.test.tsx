// src/components/layout/meniu-cont.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MeniuCont } from "./meniu-cont";

/*
  `@/app/(app)/actions` e un modul `"use server"`: importat, trage `server-only`,
  care aruncă la import în proiectul `ui`. Aici contează doar cum se închide
  panoul, nu ce pleacă din formulare. `usePathname` cere contextul App Router.
*/
vi.mock("next/navigation", () => ({
  usePathname: () => "/panou",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/app/(app)/actions", () => ({
  comutaOrganizatiaDirect: vi.fn(),
  deconecteaza: vi.fn(),
}));

const UTILIZATOR = {
  email: "maria.popescu-foarte-lunga@exemplu-de-firma.ro",
  fullName: "Maria Popescu-Ionescu de la Contabilitate",
};

function randeaza(): HTMLDetailsElement {
  const { container } = render(
    <div>
      <h1>Angajați</h1>
      <MeniuCont
        utilizator={UTILIZATOR}
        rol="org_admin"
        organizatii={[{ id: "o1", slug: "firma", name: "Firma SRL", role: "org_admin" }]}
        organizatiaCurentaId="o1"
      />
    </div>,
  );
  const details = container.querySelector("details");
  if (details === null) throw new Error("Meniul contului nu are <details>.");
  details.open = true;
  return details;
}

/**
 * UX-041: meniul contului e un `<details>` care rămânea deschis după Escape și
 * după un clic pe titlul paginii (`details.open === true` în ambele, măsurat în
 * QA), peste butoanele „Import din Excel” și „Angajat nou”.
 */
describe("MeniuCont — închiderea panoului", () => {
  it("se închide la Escape", () => {
    const details = randeaza();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(details.open).toBe(false);
  });

  it("se închide la un clic în afara lui", () => {
    const details = randeaza();

    fireEvent.pointerDown(screen.getByRole("heading", { name: "Angajați" }));

    expect(details.open).toBe(false);
  });

  it("rămâne deschis la un clic în panou", () => {
    const details = randeaza();

    fireEvent.pointerDown(screen.getByText("Profilul meu"));

    expect(details.open).toBe(true);
  });
});

/**
 * UX-002: numele și e-mailul sunt tăiate cu puncte de suspensie; valoarea
 * întreagă trebuie să fie disponibilă măcar ca `title`.
 */
describe("MeniuCont — textele trunchiate au valoarea întreagă în title", () => {
  it("numele din antet și din panou, plus e-mailul", () => {
    const { container } = render(
      <MeniuCont
        utilizator={UTILIZATOR}
        rol="org_admin"
        organizatii={[]}
        organizatiaCurentaId="o1"
      />,
    );

    const trunchiate = Array.from(container.querySelectorAll(".truncate"));
    const titluri = trunchiate.map((element) => element.getAttribute("title"));

    expect(titluri.filter((titlu) => titlu === UTILIZATOR.fullName)).toHaveLength(2);
    expect(titluri).toContain(UTILIZATOR.email);
  });
});
