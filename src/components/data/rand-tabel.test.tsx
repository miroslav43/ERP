// src/components/data/rand-tabel.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `push` întoarce o promisiune care NU se rezolvă, deliberat. React 19 ține
 * tranziția deschisă cât timp promisiunea întoarsă de callback e în curs, iar
 * fără asta `inCurs` ar trece true→false într-un singur ciclu de randare și
 * n-ar rămâne nimic de observat. În aplicație `router.push` întoarce `void`
 * (`app-router-context.shared-runtime.d.ts:37`) și tranziția e ținută deschisă
 * de randarea rutei noi — mecanism diferit, aceeași stare vizibilă.
 *
 * `push` e o variabilă partajată (nu inline în mock), ca să-i putem număra
 * apelurile din teste — vezi testul de mai jos care apără garda `if (inCurs)
 * return`.
 */
const push = vi.fn(() => new Promise(() => {}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    replace: () => {},
    refresh: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/angajati",
  useSearchParams: () => new URLSearchParams(),
}));

import { RandTabel } from "./rand-tabel";
import { goleste, surseCurente } from "@/lib/incarcare/depozit";

/**
 * Ce apără fișierul: clicul pe un rând producea `router.push` gol, în afara
 * oricărei tranziții. Nici voalul global nu se aprindea, nici rândul nu se
 * schimba — pe 22 de rute, apăsarea părea pur și simplu ignorată până sosea
 * pagina nouă, la 1,2–2,5 secunde.
 *
 * Cele două straturi verificate aici au roluri diferite: sursa din depozitar
 * aprinde voalul global la `PRAG_VOAL` (400 ms), iar `aria-busy` pe `<tr>` se
 * vede în același cadru cu clicul și spune PE CARE rând s-a apăsat — singura
 * informație pe care un voal peste tot ecranul nu o poate da.
 */
function randeaza(href: string | null) {
  return render(
    <table>
      <tbody>
        <RandTabel href={href}>
          <td>Ionescu Ana</td>
        </RandTabel>
      </tbody>
    </table>,
  );
}

describe("RandTabel", () => {
  beforeEach(() => {
    goleste();
    push.mockClear();
  });
  afterEach(() => {
    goleste();
  });

  it("nu are nicio sursă aprinsă înainte de clic", () => {
    randeaza("/angajati/1");
    expect(surseCurente()).toHaveLength(0);
  });

  it("aprinde o sursă de încărcare la clic pe rând", () => {
    randeaza("/angajati/1");
    fireEvent.click(screen.getByText("Ionescu Ana"));
    expect(surseCurente()).toHaveLength(1);
  });

  it("marchează rândul apăsat cu aria-busy", () => {
    randeaza("/angajati/1");
    const rand = screen.getByRole("row");
    expect(rand.getAttribute("aria-busy")).toBeNull();

    fireEvent.click(screen.getByText("Ionescu Ana"));
    expect(rand.getAttribute("aria-busy")).toBe("true");
  });

  it("nu declanșează a doua navigare la un al doilea clic pe același rând", () => {
    randeaza("/angajati/1");
    const celula = screen.getByText("Ionescu Ana");
    fireEvent.click(celula);
    fireEvent.click(celula);
    // A doua sursă ar rămâne aprinsă după demontare: componenta care pornește
    // navigarea e exact cea pe care navigarea o demontează. Dar testul pe
    // `surseCurente()` singur n-ar dovedi garda `if (inCurs) return`, fiindcă
    // `useSemnalIncarcare` pornește oricum o singură sursă cât timp `activ`
    // rămâne `true` — garda previne al doilea `router.push`, nu a doua sursă.
    // De-aia numărăm și apelurile lui `push`.
    expect(surseCurente()).toHaveLength(1);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("nu navighează pentru un rând fără destinație și nu aprinde nimic", () => {
    randeaza(null);
    fireEvent.click(screen.getByText("Ionescu Ana"));
    expect(surseCurente()).toHaveLength(0);
    expect(screen.getByRole("row").getAttribute("aria-busy")).toBeNull();
  });
});
