import { describe, expect, it } from "vitest";

import { urmatoareaZiLibera, zilePanaLa, type CerereCitita } from "./urmatoarea-zi-libera";

function cerere(data_inceput: string, status = "aprobata"): CerereCitita {
  return { data_inceput, status };
}

describe("urmatoareaZiLibera", () => {
  it("fără nicio cerere, întoarce următoarea sărbătoare legală", () => {
    // După 12 septembrie 2026, prima sărbătoare e Sfântul Andrei, 30 noiembrie.
    expect(urmatoareaZiLibera("2026-09-12", [])).toEqual({
      data: "2026-11-30",
      denumire: "Sfântul Andrei",
      sursa: "sarbatoare",
    });
  });

  it("concediul aprobat mai apropiat bate sărbătoarea", () => {
    const gasita = urmatoareaZiLibera("2026-09-12", [cerere("2026-10-05")]);
    expect(gasita?.sursa).toBe("concediu");
    expect(gasita?.data).toBe("2026-10-05");
  });

  it("sărbătoarea mai apropiată bate concediul îndepărtat", () => {
    const gasita = urmatoareaZiLibera("2026-09-12", [cerere("2027-03-01")]);
    expect(gasita?.data).toBe("2026-11-30");
  });

  it("cererile neaprobate nu produc zile libere", () => {
    const gasita = urmatoareaZiLibera("2026-09-12", [
      cerere("2026-09-20", "trimisa"),
      cerere("2026-09-21", "respinsa"),
      cerere("2026-09-22", "ciorna"),
    ]);
    expect(gasita?.data).toBe("2026-11-30");
  });

  it("trece în anul următor când decembrie s-a consumat", () => {
    // Pe 27 decembrie, Crăciunul a trecut; urmează Anul Nou.
    expect(urmatoareaZiLibera("2026-12-27", [])).toEqual({
      data: "2027-01-01",
      denumire: "Anul Nou",
      sursa: "sarbatoare",
    });
  });

  it("ziua de azi nu e „următoarea”, nici ca sărbătoare, nici ca concediu", () => {
    // 1 decembrie 2026 e sărbătoare; cerută chiar în acea zi, se sare la
    // următoarea, fiindcă omul e deja liber.
    expect(urmatoareaZiLibera("2026-12-01", [])?.data).toBe("2026-12-25");
    expect(urmatoareaZiLibera("2026-10-05", [cerere("2026-10-05")])?.sursa).toBe("sarbatoare");
  });

  it("la aceeași zi câștigă concediul", () => {
    // 30 noiembrie 2026 e Sfântul Andrei; concediul începe tot atunci.
    expect(urmatoareaZiLibera("2026-09-12", [cerere("2026-11-30")])?.sursa).toBe("concediu");
  });

  it("o dată scrisă aiurea nu produce nimic", () => {
    expect(urmatoareaZiLibera("maine", [])).toBeNull();
    expect(urmatoareaZiLibera("2026-09-12", [cerere("candva")])?.sursa).toBe("sarbatoare");
  });
});

describe("zilePanaLa", () => {
  it("numără calendaristic, nu în zile lucrătoare", () => {
    expect(zilePanaLa("2026-09-12", "2026-09-13")).toBe(1);
    expect(zilePanaLa("2026-09-12", "2026-11-30")).toBe(79);
  });

  it("aceeași zi înseamnă zero", () => {
    expect(zilePanaLa("2026-09-12", "2026-09-12")).toBe(0);
  });

  it("o dată scrisă aiurea nu produce un număr", () => {
    expect(zilePanaLa("2026-09-12", "candva")).toBeNull();
  });
});
