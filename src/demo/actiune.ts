/**
 * Acțiunile demonstrației.
 *
 * `Formular` primește acțiunea ca PROP — `actiune: (date: FormData) =>
 * Promise<ActionResult<TData>>` (`src/components/ui/formular.tsx:61`). E
 * singurul punct din tot proiectul prin care scrierea se poate devia spre
 * memorie fără să atingi componentele-frunză, iar fabrica de aici produce exact
 * forma aia.
 *
 * Nu există `"use server"` aici și nu există niciun apel de rețea: forma e
 * aceeași, drumul e altul. Un vizitator anonim nu poate declanșa nimic pe
 * server din vitrină, nici din greșeală.
 */
import type { ActionResult } from "@/lib/actions/types";

export type MesajDeRefuz = Readonly<{
  refuz: string;
  campuri?: Readonly<Record<string, readonly string[]>>;
}>;

export function esteRefuz(x: unknown): x is MesajDeRefuz {
  return typeof x === "object" && x !== null && "refuz" in x;
}

/**
 * `requestId` există fiindcă `ActionError` îl cere, și fiindcă ecranele îl
 * afișează. În vitrină nu leagă nimic de niciun log — de aceea poartă prefixul
 * `demo-`, ca să nu fie căutat degeaba într-o stivă care nu există.
 */
let contor = 0;
function idCerere(): string {
  contor += 1;
  return `demo-${String(contor).padStart(4, "0")}`;
}

export function actiuneDemo<TData>(
  scrie: (date: FormData) => TData | MesajDeRefuz,
): (date: FormData) => Promise<ActionResult<TData>> {
  return (date: FormData) => {
    try {
      const rezultat = scrie(date);
      if (esteRefuz(rezultat)) {
        const refuz: ActionResult<TData> = {
          ok: false,
          error: {
            code: "VALIDARE",
            message: rezultat.refuz,
            fieldErrors: rezultat.campuri ?? null,
            requestId: idCerere(),
          },
        };
        return Promise.resolve(refuz);
      }
      return Promise.resolve({ ok: true, data: rezultat });
    } catch {
      const eroare: ActionResult<TData> = {
        ok: false,
        error: {
          code: "EROARE_INTERNA",
          message: "Demonstrația nu a putut înregistra cererea.",
          fieldErrors: null,
          requestId: idCerere(),
        },
      };
      return Promise.resolve(eroare);
    }
  };
}
