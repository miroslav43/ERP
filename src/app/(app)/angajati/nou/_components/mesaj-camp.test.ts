// src/app/(app)/angajati/nou/_components/mesaj-camp.test.ts
//
// `mesajCamp` traduce eroarea unui câmp din react-hook-form în lista pe care o
// primește `Camp`. Marginile contează: o listă cu un șir gol randează un
// paragraf de eroare gol, iar un mesaj ne-șir ar ajunge pe ecran ca „[object
// Object]”.

import { describe, expect, it } from "vitest";

import { mesajCamp } from "./erori-formular";

describe("mesajCamp", () => {
  it.each([
    ["eroare absentă", undefined, []],
    ["eroare fără mesaj", {}, []],
    ["mesaj gol", { message: "" }, []],
    ["mesaj ne-șir (obiect)", { message: { cod: 1 } }, []],
    ["mesaj numeric", { message: 42 }, []],
    [
      "mesaj românesc",
      { message: "Câmpul „Nume” este obligatoriu." },
      ["Câmpul „Nume” este obligatoriu."],
    ],
    ["mesaj doar cu spații (se păstrează, e text)", { message: " " }, [" "]],
  ] as const)("%s", (_n, eroare, asteptat) => {
    expect(mesajCamp(eroare)).toEqual(asteptat);
  });
});
