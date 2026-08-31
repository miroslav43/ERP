// src/lib/asistent/text.test.ts
import { describe, expect, it } from "vitest";

import { imparteParti, imparteText } from "./text";

describe("imparteParti", () => {
  it("lasă textul simplu într-o singură bucată", () => {
    expect(imparteParti("bună ziua")).toEqual([{ text: "bună ziua", ingrosat: false }]);
  });

  it("desprinde bucata îngroșată din mijloc", () => {
    expect(imparteParti("mergi la **Pontaj** acum")).toEqual([
      { text: "mergi la ", ingrosat: false },
      { text: "Pontaj", ingrosat: true },
      { text: " acum", ingrosat: false },
    ]);
  });

  it("acceptă mai multe bucăți îngroșate", () => {
    expect(imparteParti("**a** și **b**").filter((p) => p.ingrosat)).toHaveLength(2);
  });

  it("tratează asteriscurile neînchise ca text", () => {
    expect(imparteParti("2 ** 3 = 8")).toEqual([{ text: "2 ** 3 = 8", ingrosat: false }]);
  });
});

describe("imparteText", () => {
  it("face un paragraf dintr-un rând", () => {
    expect(imparteText("O frază.")).toEqual([
      { tip: "paragraf", parti: [{ text: "O frază.", ingrosat: false }] },
    ]);
  });

  it("lipește rândurile aceluiași paragraf cu spațiu", () => {
    const [bloc] = imparteText("prima parte\na doua parte");
    expect(bloc).toEqual({
      tip: "paragraf",
      parti: [{ text: "prima parte a doua parte", ingrosat: false }],
    });
  });

  it("separă paragrafele la rând gol", () => {
    expect(imparteText("unu\n\ndoi")).toHaveLength(2);
  });

  it("strânge rândurile cu liniuță într-o listă", () => {
    const blocuri = imparteText("Ai de făcut:\n- una\n- alta");
    expect(blocuri).toHaveLength(2);
    expect(blocuri[1]).toEqual({
      tip: "lista",
      elemente: [[{ text: "una", ingrosat: false }], [{ text: "alta", ingrosat: false }]],
    });
  });

  it("acceptă și asterisc sau bulină ca semn de listă", () => {
    for (const semn of ["-", "*", "•"]) {
      const [bloc] = imparteText(`${semn} element`);
      expect(bloc?.tip, semn).toBe("lista");
    }
  });

  it("închide lista când revine textul obișnuit", () => {
    expect(imparteText("- una\ngata").map((b) => b.tip)).toEqual(["lista", "paragraf"]);
  });

  it("păstrează îngroșarea în elementele de listă", () => {
    const [bloc] = imparteText("- **Pontaj**: zilnic");
    expect(bloc?.tip).toBe("lista");
    expect(bloc?.tip === "lista" ? bloc.elemente[0]?.[0] : null).toEqual({
      text: "Pontaj",
      ingrosat: true,
    });
  });

  it("întoarce lista goală pentru text gol sau doar spații", () => {
    expect(imparteText("")).toEqual([]);
    expect(imparteText("   \n\n  ")).toEqual([]);
  });

  it("nu produce niciodată HTML, oricât de ostil ar fi textul", () => {
    // Structura are un singur atribut de stil și nicio cale către markup: ce
    // intră ca `<img onerror>` iese ca text și se randează cu `{…}`.
    const blocuri = imparteText('<img src=x onerror="alert(1)">\n\n<script>rau()</script>');
    for (const bloc of blocuri) {
      expect(bloc.tip).toBe("paragraf");
      const chei = bloc.tip === "paragraf" ? Object.keys(bloc.parti[0] ?? {}) : [];
      expect(chei.sort()).toEqual(["ingrosat", "text"]);
    }
  });
});
