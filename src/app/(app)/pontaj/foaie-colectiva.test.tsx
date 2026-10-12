// src/app/(app)/pontaj/foaie-colectiva.test.tsx
/**
 * Gardă de randare pentru UX-005: `/pontaj` se derula lateral pe tabletă și pe
 * telefon — PAGINA întreagă, nu doar tabelul (`scrollWidth` 1231 la 820 și 967
 * la 390).
 *
 * Cauza: spanurile `sr-only` din celulele de zi („(zi respinsă)”, „(așteaptă
 * decizia)”) sunt `position: absolute`. Doar antetul și prima coloană sunt
 * `sticky`; o celulă de zi n-are niciun strămoș poziționat, deci blocul
 * conținător al spanului e cel inițial, iar poziția lui statică, adânc în
 * tabelul de ~2000 px, întinde `documentElement`. `overflow` pe container nu
 * ajută: decupează doar descendenții al căror bloc conținător e el sau e în el.
 * Leacul e `relative` pe containerul derulabil (memoria `erp-sronly-in-overflow`,
 * reparat în 3f3d915 pe planificator).
 *
 * happy-dom nu calculează stil: garda apără CLASA, nu măsoară. A fost văzută
 * roșie (fără `relative`) înainte de corecție. Măsurătoarea reală e în
 * `e2e/responsive.spec.ts`, pe staging.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { configZiDin } from "@/domain/attendance/calcul-ore";

import { FoaieColectiva } from "./foaie-colectiva";

/*
  Aceleași două margini tăiate ca în `celula-zi.test.tsx`: `./actions` e un
  modul `"use server"` care trage după el `server-only`, iar `useRouter` cere
  contextul App Router.
*/
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("./actions", () => ({
  salveazaZiPontaj: vi.fn(),
  decideZiPontaj: vi.fn(),
  stergeZiPontaj: vi.fn(),
}));

describe("foaia colectivă, containerul derulabil", () => {
  it("e poziționat (relative), ca spanurile sr-only din celule să nu întindă pagina", () => {
    const { container } = render(
      <FoaieColectiva
        dataInceput="2026-10-01"
        dataSfarsit="2026-10-31"
        statusPerioada="deschisa"
        blocataLa={null}
        randuri={[{ angajatId: "e1", eticheta: "Ionescu Ana", intrari: {} }]}
        sarbatoriNationale={{}}
        zileRecuperare={[]}
        liberSuplimentar={[]}
        poateEdita={false}
        poateAproba={false}
        poateVedeaConcedii={false}
        poateDeschideFisa={false}
        fisaProprieId={null}
        poateDeschideConcediiProprii={false}
        hrefPerioade={null}
        hrefAprobare={null}
        poateDeschideSaptamana={false}
        config={configZiDin(null)}
        limite={null}
        oreAsteptateLuna={176}
        azi="2026-10-08"
        sedii={[]}
        alegeSediul={false}
      />,
    );
    const derulabil = container.querySelector(".overflow-auto");
    expect(derulabil).not.toBeNull();
    expect(derulabil?.classList.contains("relative")).toBe(true);
    expect(derulabil?.contains(screen.getByRole("table"))).toBe(true);
  });
});
