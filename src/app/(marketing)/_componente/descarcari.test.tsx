import { readFileSync } from "node:fs";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Descarcari } from "./descarcari";

/**
 * Revizuirea finală: descărcările erau `<a href>` construite pe server din
 * parametrii ultimului submit. Cine completa formularul și apăsa direct
 * „Descarcă” primea documentul gol, cu luna curentă. Acum sunt butoane de
 * trimitere în interiorul formularului, cu `formaction` spre ruta de API —
 * iau mereu valorile din câmpuri, tot fără JavaScript.
 */
describe("descărcările uneltelor", () => {
  it("sunt butoane de trimitere cu formaction și format, nu linkuri", () => {
    const { container } = render(
      <form>
        <Descarcari actiune="/api/unelte/condica-de-prezenta" eveniment="condica" />
      </form>,
    );
    const butoane = [...container.querySelectorAll("button")];
    expect(butoane).toHaveLength(3);
    for (const b of butoane) {
      expect(b.getAttribute("type")).toBe("submit");
      expect(b.getAttribute("formaction")).toBe("/api/unelte/condica-de-prezenta");
      expect(b.getAttribute("name")).toBe("format");
    }
    expect(butoane.map((b) => b.getAttribute("value"))).toEqual(["pdf", "docx", "xlsx"]);
    expect(container.querySelector("a")).toBeNull();
  });

  it("fiecare pagină de unealtă pune descărcările ÎN formular", () => {
    for (const unealta of [
      "foaie-de-pontaj",
      "condica-de-prezenta",
      "cerere-concediu-de-odihna",
      "foaie-de-parcurs",
      "fisa-instruire-ssm",
      "fisa-evaluare",
    ]) {
      const sursa = readFileSync(`src/app/(marketing)/unelte/${unealta}/page.tsx`, "utf8");
      const descarcari = sursa.indexOf("<Descarcari");
      expect(descarcari, unealta).toBeGreaterThan(-1);
      expect(sursa.lastIndexOf("<form", descarcari), unealta).toBeGreaterThan(-1);
      expect(sursa.lastIndexOf("</form>", descarcari), unealta).toBeLessThan(
        sursa.lastIndexOf("<form", descarcari),
      );
    }
  });
});
