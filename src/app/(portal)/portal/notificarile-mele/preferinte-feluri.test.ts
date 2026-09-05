import { describe, expect, it } from "vitest";

import type { Database } from "@/types/database";

import { FELURI_NOTIFICARE } from "./actions";

type FelGenerat = Database["public"]["Enums"]["notification_kind"];

/**
 * Poarta pentru lista scrisă de mână din `actions.ts`.
 *
 * `notification_preferences` are un rând PE FEL, iar „oprește notificările pe
 * telefon" înseamnă toate felurile. Dacă cineva adaugă o valoare în enumul
 * `public.notification_kind` și uită lista, felul nou rămâne PORNIT pentru
 * oameni care au apăsat „oprește" — un consimțământ retras doar pe jumătate,
 * fără nicio eroare nicăieri.
 *
 * Aceeași clasă cu `src/lib/queries/coloane.test.ts`: un tip scris de mână care
 * poate diverge tăcut de bază.
 */
describe("FELURI_NOTIFICARE", () => {
  it("acoperă exact enumul generat din bază", () => {
    // Verificarea de TIP: dacă lista conține o valoare care nu e în enum, sau
    // dacă enumul crește peste ce acoperă lista, atribuirea de mai jos nu mai
    // compilează. `satisfies` prinde surplusul; `Exclude` de mai jos, lipsa.
    const acoperite: readonly FelGenerat[] = FELURI_NOTIFICARE;
    expect(acoperite.length).toBe(FELURI_NOTIFICARE.length);

    // Verificarea de VALOARE, la rulare: enumul generat nu există ca valoare în
    // TypeScript (tipurile se șterg), deci lista de referință se scrie o dată,
    // aici, din `0001_kernel.sql:89-91`. Cele două trebuie să rămână identice.
    const dinMigrare = [
      "info",
      "success",
      "warning",
      "error",
      "task",
      "reminder",
      "approval",
      "announcement",
    ];
    expect([...FELURI_NOTIFICARE].sort()).toEqual([...dinMigrare].sort());
  });

  it("nu are duplicate", () => {
    expect(new Set(FELURI_NOTIFICARE).size).toBe(FELURI_NOTIFICARE.length);
  });
});

/**
 * Garda de compilare care prinde LIPSA: dacă enumul capătă un fel nou pe care
 * `FELURI_NOTIFICARE` nu-l acoperă, `Lipsa` încetează să fie `never` și linia
 * de mai jos nu mai compilează. Un test la rulare n-ar putea prinde asta —
 * enumul nu există ca valoare.
 */
type Lipsa = Exclude<FelGenerat, (typeof FELURI_NOTIFICARE)[number]>;
const _fara_lipsa: Lipsa extends never ? true : never = true;
void _fara_lipsa;
