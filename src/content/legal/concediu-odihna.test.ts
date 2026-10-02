import { describe, expect, it } from "vitest";

import { CONCEDIU_ODIHNA } from "./concediu-odihna";

const sectiune = (titlu: string) =>
  CONCEDIU_ODIHNA.sectiuni.find((s) => s.titlu === titlu)?.paragrafe.join(" ") ?? "";

describe("ghidul concediului de odihnă: citările", () => {
  it("nu pune regulamentul intern pe seama art. 145 alin. (2)", () => {
    // Revizuirea finală: alin. (2) vorbește de contractul individual, lege și
    // contractul colectiv — regulamentul intern nu apare în el.
    const vechime = sectiune("Zile în plus în funcție de vechime");
    const fraza =
      vechime.split(/(?<=\.)\s(?=[A-ZĂÂÎȘȚ„])/u).find((f) => f.includes("art. 145 alin. (2)")) ??
      "";
    expect(fraza).not.toBe("");
    expect(fraza).not.toMatch(/regulamentul intern/u);
  });

  it("preavizul numește și regula de la demisie, art. 81 alin. (6)", () => {
    const preaviz = sectiune("Concediul în perioada de preaviz");
    expect(preaviz).toMatch(/art\. 75 alin\. \(3\)/u);
    expect(preaviz).toMatch(/art\. 81 alin\. \(6\)/u);
  });
});
