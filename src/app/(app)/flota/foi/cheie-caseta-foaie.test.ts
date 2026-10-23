import { describe, expect, it } from "vitest";

import { cheieCasetaFoaie } from "./cheie-caseta-foaie";

/*
 * F12e: asistentul propune o foaie nouă prin `?foaie=noua&vehicul=<id>`. A doua
 * propunere, pe ALT vehicul, venea cu aceeași cheie („foaie-noua”), deci React
 * păstra caseta montată: vehiculul ales și kilometrajul rămâneau ale primei
 * propuneri, iar caseta închisă după prima salvare nu se mai deschidea.
 */
describe("cheieCasetaFoaie", () => {
  it("se schimbă odată cu vehiculul propus, ca a doua propunere să remonteze caseta", () => {
    expect(cheieCasetaFoaie(true, "v-1")).not.toBe(cheieCasetaFoaie(true, "v-2"));
  });

  it("deosebește caseta deschisă fără vehicul de cea deschisă pe un vehicul", () => {
    expect(cheieCasetaFoaie(true, null)).not.toBe(cheieCasetaFoaie(true, "v-1"));
  });

  it("deosebește lista de caseta deschisă", () => {
    expect(cheieCasetaFoaie(false, null)).not.toBe(cheieCasetaFoaie(true, null));
  });

  it("e stabilă pentru aceeași propunere (nu remontează la fiecare randare)", () => {
    expect(cheieCasetaFoaie(true, "v-1")).toBe(cheieCasetaFoaie(true, "v-1"));
    expect(cheieCasetaFoaie(false, "v-1")).toBe(cheieCasetaFoaie(false, "v-1"));
  });
});
