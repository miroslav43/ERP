// src/lib/asistent/sse.test.ts
/**
 * Testele astea hrănesc parserul cu bucăți tăiate INTENȚIONAT prost, fiindcă
 * asta face rețeaua. Un flux care sosește pe evenimente întregi e o coincidență
 * de mediu local, nu un contract.
 */
import { describe, expect, it } from "vitest";

import { creeazaCititorSse, SEMNAL_FINAL } from "./sse";

/** Trece textul prin cititor tăiat la fiecare `n` caractere. */
function prinBucatiDe(text: string, n: number): readonly string[] {
  const cititor = creeazaCititorSse();
  const iesire: string[] = [];
  for (let i = 0; i < text.length; i += n) iesire.push(...cititor.adauga(text.slice(i, i + n)));
  iesire.push(...cititor.incheie());
  return iesire;
}

const FLUX =
  'data: {"a":1}\n\n' +
  ": OPENROUTER PROCESSING\n\n" +
  'data: {"a":2}\n\n' +
  `data: ${SEMNAL_FINAL}\n\n`;

describe("cititorul de flux SSE", () => {
  it("citește evenimente întregi când sosesc întregi", () => {
    const cititor = creeazaCititorSse();
    expect(cititor.adauga('data: {"a":1}\n\n')).toEqual(['{"a":1}']);
  });

  it("nu emite nimic cât timp evenimentul e neterminat", () => {
    const cititor = creeazaCititorSse();
    expect(cititor.adauga('data: {"a":')).toEqual([]);
    expect(cititor.adauga("1}")).toEqual([]);
    // Abia rândul gol încheie evenimentul.
    expect(cititor.adauga("\n\n")).toEqual(['{"a":1}']);
  });

  it("dă același rezultat oricum ar fi tăiat fluxul", () => {
    const asteptat = ['{"a":1}', '{"a":2}', SEMNAL_FINAL];
    // 1 caracter pe bucată e cazul patologic; 3, 7, 13 taie prin `data:`, prin
    // JSON și prin separatorul de evenimente, la offseturi care nu se aliniază.
    for (const marime of [1, 3, 7, 13, 64, 4096]) {
      expect(prinBucatiDe(FLUX, marime), `bucăți de ${marime}`).toEqual(asteptat);
    }
  });

  it("sare peste comentariile de menținere a conexiunii", () => {
    const cititor = creeazaCititorSse();
    expect(cititor.adauga(": OPENROUTER PROCESSING\n\n")).toEqual([]);
    // Comentariul nu are voie nici să încheie un eveniment început înainte.
    expect(cititor.adauga('data: {"a":1}\n')).toEqual([]);
    expect(cititor.adauga(": ping\n")).toEqual([]);
    expect(cititor.adauga("\n")).toEqual(['{"a":1}']);
  });

  it("acceptă terminatorul \\r\\n", () => {
    const cititor = creeazaCititorSse();
    expect(cititor.adauga('data: {"a":1}\r\n\r\n')).toEqual(['{"a":1}']);
  });

  it("concatenează mai multe linii `data` din același eveniment", () => {
    const cititor = creeazaCititorSse();
    expect(cititor.adauga("data: prima\ndata: a doua\n\n")).toEqual(["prima\na doua"]);
  });

  it("taie exact un spațiu după două puncte, nu tot spațiul", () => {
    const cititor = creeazaCititorSse();
    expect(cititor.adauga("data:  două spații\n\n")).toEqual([" două spații"]);
  });

  it("ignoră câmpurile care nu sunt `data`", () => {
    const cititor = creeazaCititorSse();
    expect(cititor.adauga('event: mesaj\nid: 7\nretry: 100\ndata: {"a":1}\n\n')).toEqual([
      '{"a":1}',
    ]);
  });

  it("recuperează ultimul eveniment dintr-un flux tăiat fără rând gol final", () => {
    // Conexiune închisă brusc: fără `incheie()`, ultima bucată de text a
    // răspunsului s-ar pierde tăcut, iar omul ar vedea o frază retezată.
    const cititor = creeazaCititorSse();
    expect(cititor.adauga('data: {"a":1}')).toEqual([]);
    expect(cititor.incheie()).toEqual(['{"a":1}']);
  });

  it("nu inventează evenimente dintr-un flux gol", () => {
    const cititor = creeazaCititorSse();
    expect(cititor.adauga("")).toEqual([]);
    expect(cititor.incheie()).toEqual([]);
  });

  it("nu emite un eveniment gol pentru rânduri goale succesive", () => {
    const cititor = creeazaCititorSse();
    expect(cititor.adauga("\n\n\n\n")).toEqual([]);
  });
});
