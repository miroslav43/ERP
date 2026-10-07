import { describe, expect, it } from "vitest";

import { textSincronizare } from "./buton-sincronizare-concedii";

describe("textSincronizare", () => {
  it("spune câte zile pontate au trecut pe concediu", () => {
    expect(textSincronizare({ create: 2, actualizate: 1, inlocuite: 1, pastrate: 0 })).toBe(
      "2 zile noi, 1 actualizate, 1 zile pontate trecute pe concediu.",
    );
  });

  it("zilele păstrate apar doar când există", () => {
    expect(textSincronizare({ create: 0, actualizate: 0, inlocuite: 0, pastrate: 3 })).toBe(
      "0 zile noi, 0 actualizate, 0 zile pontate trecute pe concediu, 3 păstrate neschimbate.",
    );
  });
});
