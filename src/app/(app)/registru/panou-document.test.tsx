// src/app/(app)/registru/panou-document.test.tsx
//
// Panoul deschis din URL: cât e `?doc=` în adresă, panoul e deschis; închiderea
// scoate DOAR `doc` din adresă, fără să deruleze pagina și fără să piardă
// filtrele, sortarea sau cursorul.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace, refresh: () => {}, prefetch: () => {} }),
  usePathname: () => "/registru",
  useSearchParams: () => new URLSearchParams("an=2026&sens=intrare&cursor=MTA&doc=abc"),
}));

import { PanouDocumentRegistru } from "./panou-document";
import { PrevizualizarePdf } from "./previzualizare-pdf";

/**
 * happy-dom ÎNCARCĂ pagina unui `<iframe>` ca un browser: ar cere
 * `http://localhost:3000/documente/…` și ar umple ieșirea cu erori de rețea.
 * Testul verifică marcajul (`src`, `title`), nu PDF-ul.
 */
type FereastraHappyDom = Window & {
  happyDOM?: {
    settings?: {
      disableIframePageLoading?: boolean;
      handleDisabledFileLoadingAsSuccess?: boolean;
    };
  };
};
const setari = (globalThis.window as FereastraHappyDom).happyDOM?.settings;
if (setari !== undefined) {
  setari.disableIframePageLoading = true;
  setari.handleDisabledFileLoadingAsSuccess = true;
}

function asiguraDialogNativ(): void {
  const proto = globalThis.HTMLDialogElement?.prototype;
  if (proto === undefined) return;
  if (typeof proto.showModal !== "function") {
    proto.showModal = function () {
      this.open = true;
    };
  }
  if (typeof proto.close !== "function") {
    proto.close = function () {
      this.open = false;
    };
  }
}
asiguraDialogNativ();

describe("PanouDocumentRegistru", () => {
  it("se deschide singur, cu titlul anunțat", () => {
    render(
      <PanouDocumentRegistru titlu="46/08.10.2026" descriere="Cerere de concediu">
        <p>Corp.</p>
      </PanouDocumentRegistru>,
    );
    const dialog = document.querySelector("dialog");
    expect(dialog?.open).toBe(true);
    expect(screen.getByText("46/08.10.2026")).toBeDefined();
    expect(screen.getByText("Corp.")).toBeDefined();
  });

  it("la închidere scoate doar `doc` din adresă și nu derulează", async () => {
    replace.mockClear();
    render(
      <PanouDocumentRegistru titlu="46/08.10.2026">
        <p>Corp.</p>
      </PanouDocumentRegistru>,
    );
    const dialog = document.querySelector("dialog") as HTMLDialogElement;
    await act(async () => {
      fireEvent(dialog, new Event("cancel", { cancelable: true }));
    });
    expect(replace).toHaveBeenCalledWith("/registru?an=2026&sens=intrare&cursor=MTA", {
      scroll: false,
    });
    expect(dialog.open).toBe(false);
  });
});

describe("PrevizualizarePdf", () => {
  it("nu montează cadrul până nu i se cere — PDF-ul se randează pe server la fiecare cerere", () => {
    render(<PrevizualizarePdf src="/documente/abc?format=pdf" />);
    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /previzualizează pdf/iu }));
    const cadru = document.querySelector("iframe");
    expect(cadru?.getAttribute("src")).toBe("/documente/abc?format=pdf");
    expect(cadru?.getAttribute("title")).toBeTruthy();
  });
});
