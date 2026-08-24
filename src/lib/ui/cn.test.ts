// src/lib/ui/cn.test.ts
import { describe, expect, it } from "vitest";

import { cn } from "./cn";

/**
 * Testul acesta apără o clasă de defecte care nu produce nicio eroare nicăieri.
 *
 * `tailwind-merge` clasifică o clasă după prefix și după valoare. Tokenii
 * proprii ai proiectului (`text-corp`, `rounded-panou`, `z-antet`, …) nu-i sunt
 * cunoscuți, deci fără configurare îi nimerește greșit: `text-corp` ajunge
 * „culoare de text”, intră în conflict cu `text-foreground`, iar una dintre ele
 * DISPARE din atribut. Nici compilatorul, nici linterul, nici build-ul nu văd
 * asta — s-a descoperit abia când o pastilă și-a pierdut mărimea într-un test
 * de randare.
 *
 * Regula de întreținere: orice token nou în `@theme inline` sau orice
 * `@utility` nou din `globals.css` primește o pereche în `cn.ts` ȘI un rând
 * aici.
 */

describe("cn — tokenii proprii nu se confundă cu culorile", () => {
  it.each([
    ["text-cifra", "text-primary"],
    ["text-titlu", "text-foreground"],
    ["text-sectiune", "text-foreground"],
    ["text-corp", "text-foreground"],
    ["text-nota", "text-muted-foreground"],
    ["text-eticheta", "text-danger"],
  ])("%s și %s coexistă, în ambele ordini", (marime, culoare) => {
    expect(cn(marime, culoare).split(" ").sort()).toEqual([culoare, marime].sort());
    expect(cn(culoare, marime).split(" ").sort()).toEqual([culoare, marime].sort());
  });
});

describe("cn — tokenii proprii se anulează între ei", () => {
  it.each([
    ["mărimi de text", "text-corp", "text-nota"],
    ["mărimi, veche și nouă", "text-sm", "text-corp"],
    ["raze", "rounded-control", "rounded-panou"],
    ["raze, veche și nouă", "rounded-md", "rounded-panou"],
    ["umbre", "shadow-ridicat", "shadow-plutitor"],
    ["niveluri de stivuire", "z-antet", "z-meniu"],
    ["niveluri, vechi și nou", "z-10", "z-sertar"],
    ["durate", "durata-lent", "duration-150"],
  ])("%s: câștigă ultima", (_nume, prima, adoua) => {
    expect(cn(prima, adoua)).toBe(adoua);
  });
});

describe("cn — comportamentul de bază", () => {
  it("rezolvă conflictele obișnuite ale lui Tailwind", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("bg-primary", "bg-surface")).toBe("bg-surface");
  });

  it("nu confundă utilitare care doar seamănă", () => {
    // `mx-auto` începe cu `m`, dar nu e o margine care să anuleze `m-4`.
    expect(cn("mx-auto", "max-w-3xl")).toBe("mx-auto max-w-3xl");
    // Variantele sunt spații de nume separate: dezactivat nu anulează repausul.
    expect(cn("border-foreground/60", "disabled:border-border")).toBe(
      "border-foreground/60 disabled:border-border",
    );
  });

  it("acceptă condiționale, tablouri și valori absente, ca `clsx`", () => {
    expect(cn("a", false, null, undefined, ["b", "c"], { d: true, e: false })).toBe("a b c d");
  });

  it("întoarce șir gol pentru nimic", () => {
    expect(cn()).toBe("");
    expect(cn(undefined, null, false)).toBe("");
  });
});
