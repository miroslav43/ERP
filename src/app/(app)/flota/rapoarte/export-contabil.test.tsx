// src/app/(app)/flota/rapoarte/export-contabil.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { citesteMemoria, ExportContabil } from "./export-contabil";

/** `<dialog>` nativ: happy-dom nu are mereu `showModal`; îl completăm să pună `open`. */
const proto = globalThis.HTMLDialogElement?.prototype;
if (proto !== undefined && typeof proto.showModal !== "function") {
  proto.showModal = function () {
    this.open = true;
  };
  proto.close = function () {
    this.open = false;
  };
}

const ORG = "11111111-1111-4111-8111-111111111111";
const CHEIE = `administrativo:flota:export-contabil:${ORG}`;

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

function deschide() {
  const r = render(
    <ExportContabil organizationId={ORG} azi="2026-10-22" lunaImplicita="2026-09" />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Export pentru contabilitate/u }));
  const formular = r.container.ownerDocument.querySelector("form");
  if (formular === null) throw new Error("formularul lipsește");
  return formular;
}

describe("ExportContabil", () => {
  it("trimite prin GET la ruta de export, cu luna trecută aleasă implicit", () => {
    const formular = deschide();
    expect(formular.getAttribute("method")).toBe("get");
    expect(formular.getAttribute("action")).toBe("/api/export/flota/contabil");
    const date = new FormData(formular);
    expect(date.get("luna")).toBe("2026-09");
    expect(date.get("format")).toBe("saga");
    expect(date.get("cont_combustibil")).toBe("6022");
    expect(date.get("cont_decontare")).toBe("542");
    // Nicio lună viitoare în listă.
    const luni = [...formular.querySelectorAll('select[name="luna"] option')].map((o) =>
      o.getAttribute("value"),
    );
    expect(luni[0]).toBe("2026-10");
    expect(luni).not.toContain("2026-11");
  });

  it("bifele da/nu sunt perechi de radio, deci „nu” ajunge în cerere (nu lipsește)", () => {
    const formular = deschide();
    const nu = formular.querySelector<HTMLInputElement>('input[name="doar_aprobate"][value="nu"]');
    expect(nu?.type).toBe("radio");
    expect(formular.querySelector('input[type="checkbox"]')).toBeNull();
    if (nu === null) throw new Error("lipsește");
    fireEvent.click(nu);
    expect(new FormData(formular).get("doar_aprobate")).toBe("nu");
  });

  it("partenerul după CUI apare doar la WinMentor; separatorul CSV doar la formatele CSV", () => {
    const formular = deschide();
    expect(formular.querySelector('[name="wm_partener_dupa_cui"]')).toBeNull();
    fireEvent.click(screen.getByLabelText(/WinMentor/u));
    expect(formular.querySelector('[name="wm_partener_dupa_cui"]')).not.toBeNull();
    expect(formular.querySelector('[name="csv_separator"]')).toBeNull();
    fireEvent.click(screen.getByLabelText(/Jurnal de verificat/u));
    expect(formular.querySelector('[name="csv_separator"]')).not.toBeNull();
  });

  it("textul de sub buton: propunerea, dezarhivarea la arhive, eticheta „neîncercat”", () => {
    deschide();
    expect(screen.getByText(/Fișierul e o propunere/u).textContent).toContain(
      "Dezarhivați fișierul înainte de import.",
    );
    expect(screen.getByText(/nu a fost încercată/u)).toBeTruthy();
  });

  it("la trimitere ține minte conturile per firmă; la redeschidere le pune înapoi", () => {
    const formular = deschide();
    const cont = formular.querySelector<HTMLInputElement>('input[name="cont_combustibil"]');
    if (cont === null) throw new Error("lipsește");
    fireEvent.change(cont, { target: { value: "6022.01" } });
    fireEvent.submit(formular);
    expect(JSON.parse(localStorage.getItem(CHEIE) ?? "{}")).toMatchObject({
      cont_combustibil: "6022.01",
      format: "saga",
    });
    expect(citesteMemoria(ORG, "2026-10-22", "2026-09")).toMatchObject({
      cont_combustibil: "6022.01",
    });
  });

  it("o memorie care nu trece schema e ignorată, iar o stocare blocată nu strică formularul", () => {
    localStorage.setItem(CHEIE, JSON.stringify({ cont_combustibil: "60 22" }));
    expect(citesteMemoria(ORG, "2026-10-22", "2026-09")).toBeNull();
    localStorage.setItem(CHEIE, "{nu e json");
    expect(citesteMemoria(ORG, "2026-10-22", "2026-09")).toBeNull();

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocat");
    });
    const formular = deschide();
    expect(new FormData(formular).get("cont_combustibil")).toBe("6022");
  });
});
