import { describe, expect, it } from "vitest";

import { cuVirgula, faraCaractereDeControl } from "./text-curat";

describe("textul curățat pentru documente", () => {
  it("caracterele de control devin spații, restul rămâne neatins", () => {
    expect(faraCaractereDeControl("Popa\u000BIon\u0001\u001FSRL\u007F")).toBe("Popa Ion  SRL ");
    expect(faraCaractereDeControl("Ștefan Țepeș — „Ână”")).toBe("Ștefan Țepeș — „Ână”");
  });

  it("emoji-urile și literele din afara BMP nu se rup în două", () => {
    expect(faraCaractereDeControl("a😀b")).toBe("a😀b");
  });

  it("tot ce rupe XML-ul iese, prin regula comună din B2 (curataText)", () => {
    expect(faraCaractereDeControl("A\u{FFFE}B\u{200B}C\u{FEFF}")).toBe("ABC");
  });

  it("sedila devine virgulă, pe litere mici și mari", () => {
    expect(cuVirgula("şef de ţară, ŞTEFAN ŢEPEŞ")).toBe("șef de țară, ȘTEFAN ȚEPEȘ");
    expect(cuVirgula("șef corect")).toBe("șef corect");
  });
});
