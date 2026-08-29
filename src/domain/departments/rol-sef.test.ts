// src/domain/departments/rol-sef.test.ts
import { describe, expect, it } from "vitest";

import { decideRolulSefului, type Sef } from "./rol-sef";

/**
 * Cazurile vin din matricea reală de permisiuni, nu din imaginație: `hr` are
 * `departments:update = all`, deci POATE desemna un șef, dar politica de pe
 * `organization_members` cere `app.has_role(org, ['org_admin'])` — rol, nu
 * permisiune. Fără ramura `autor_fara_drept`, scrierea ar pleca spre bază și
 * s-ar întoarce ca UPDATE cu zero rânduri, fără eroare.
 */

const MEMBRU = "m-pop-radu";

const angajat: Sef = { fel: "membru", memberId: MEMBRU, rol: "employee" };
const manager: Sef = { fel: "membru", memberId: MEMBRU, rol: "manager" };
const nedesemnat: Sef = { fel: "nedesemnat" };

/** Intrarea implicită: administrator, șef schimbat, nimeni înainte. */
function intrare(peste: Partial<Parameters<typeof decideRolulSefului>[0]> = {}) {
  return {
    autorEsteAdministrator: true,
    sefSchimbat: true,
    sefNou: nedesemnat,
    sefAnterior: nedesemnat,
    anteriorMaiConduce: false,
    ...peste,
  };
}

describe("decideRolulSefului — promovarea", () => {
  it("promovează angajatul desemnat șef", () => {
    expect(decideRolulSefului(intrare({ sefNou: angajat })).promovare).toEqual({
      fel: "scrie",
      memberId: MEMBRU,
      rol: "manager",
    });
  });

  it("nu atinge pe cineva care e deja manager", () => {
    expect(decideRolulSefului(intrare({ sefNou: manager })).promovare).toEqual({
      fel: "nimic",
      motiv: "deja_potrivit",
    });
  });

  it.each(["org_admin", "hr"] as const)("nu atinge rolul protejat %s", (rol) => {
    expect(
      decideRolulSefului(intrare({ sefNou: { fel: "membru", memberId: MEMBRU, rol } })).promovare,
    ).toEqual({ fel: "nimic", motiv: "rol_protejat" });
  });

  it("nu scrie nimic când autorul nu e administrator, dar spune de ce", () => {
    // Cazul HR-ului. Motivul e distinct tocmai ca ecranul să-l poată traduce în
    // „cere unui administrator", în loc să tacă.
    const decizie = decideRolulSefului(intrare({ sefNou: angajat, autorEsteAdministrator: false }));
    expect(decizie.promovare).toEqual({ fel: "nimic", motiv: "autor_fara_drept" });
    expect(decizie.retrogradare).toEqual({ fel: "nimic", motiv: "autor_fara_drept" });
  });

  it("nu are ce promova când omul n-are cont în aplicație", () => {
    // Majoritar pe date reale: 5 din 12 fișe active n-aveau `user_id`.
    expect(decideRolulSefului(intrare({ sefNou: { fel: "fara_cont" } })).promovare).toEqual({
      fel: "nimic",
      motiv: "fara_cont",
    });
  });

  it("nu face nimic când șeful n-a fost schimbat la această salvare", () => {
    // O redenumire de departament NU trebuie să rescrie roluri.
    const decizie = decideRolulSefului(
      intrare({ sefNou: angajat, sefAnterior: manager, sefSchimbat: false }),
    );
    expect(decizie.promovare).toEqual({ fel: "nimic", motiv: "sef_neschimbat" });
    expect(decizie.retrogradare).toEqual({ fel: "nimic", motiv: "sef_neschimbat" });
  });
});

describe("decideRolulSefului — retrogradarea", () => {
  it("retrogradează fostul șef care nu mai conduce nimic", () => {
    expect(decideRolulSefului(intrare({ sefAnterior: manager })).retrogradare).toEqual({
      fel: "scrie",
      memberId: MEMBRU,
      rol: "employee",
    });
  });

  it("îl lasă manager dacă mai conduce alt departament", () => {
    expect(
      decideRolulSefului(intrare({ sefAnterior: manager, anteriorMaiConduce: true })).retrogradare,
    ).toEqual({ fel: "nimic", motiv: "mai_conduce" });
  });

  it.each(["org_admin", "hr"] as const)("nu retrogradează niciodată un %s", (rol) => {
    // Patronul care s-a autodesemnat șef și apoi a dat departamentul altcuiva NU
    // trebuie să rămână fără drepturi pe firma lui.
    expect(
      decideRolulSefului(intrare({ sefAnterior: { fel: "membru", memberId: MEMBRU, rol } }))
        .retrogradare,
    ).toEqual({ fel: "nimic", motiv: "rol_protejat" });
  });

  it("nu retrogradează un angajat care oricum nu era manager", () => {
    expect(decideRolulSefului(intrare({ sefAnterior: angajat })).retrogradare).toEqual({
      fel: "nimic",
      motiv: "deja_potrivit",
    });
  });

  it("promovează și retrogradează în aceeași salvare, la înlocuire", () => {
    const decizie = decideRolulSefului(
      intrare({
        sefNou: { fel: "membru", memberId: "m-nou", rol: "employee" },
        sefAnterior: { fel: "membru", memberId: "m-vechi", rol: "manager" },
      }),
    );
    expect(decizie.promovare).toEqual({ fel: "scrie", memberId: "m-nou", rol: "manager" });
    expect(decizie.retrogradare).toEqual({ fel: "scrie", memberId: "m-vechi", rol: "employee" });
  });

  it("nu retrogradează omul care tocmai a fost repus, sub altă fișă", () => {
    // Aceeași apartenență și înainte, și după: o schimbare de fișă care duce la
    // același cont nu e o înlocuire, deci n-are ce retrograda.
    const decizie = decideRolulSefului(
      intrare({ sefNou: manager, sefAnterior: manager, sefSchimbat: true }),
    );
    expect(decizie.retrogradare).toEqual({ fel: "nimic", motiv: "acelasi_om" });
  });
});
