import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRAGURI_IMPLICITE } from "./calcul";
import { GrilaEvaluare } from "./grila-evaluare";
import { setDupaCheie } from "./seturi";

/**
 * Grila e partea fișei care calculează pe loc. Ce trimite ea în formular e ce
 * citește `parametriFisaEvaluare`: aceleași nume, în aceeași ordine, deci
 * fișierul descărcat are exact cifrele de pe ecran.
 */
const GRILA = [
  { criteriu: "Cunoștințe profesionale", pondere: 20, nota: null },
  { criteriu: "Calitatea muncii", pondere: 20, nota: null },
  { criteriu: "Respectarea termenelor", pondere: 15, nota: null },
  { criteriu: "Comunicare", pondere: 15, nota: null },
  { criteriu: "Inițiativă", pondere: 15, nota: null },
  { criteriu: "Respectarea procedurilor", pondere: 15, nota: null },
] as const;

function randeaza(
  grila: readonly { criteriu: string; pondere: number | null; nota: number | null }[] = GRILA,
) {
  const { container } = render(
    <form>
      <GrilaEvaluare grila={grila} set="general" praguri={PRAGURI_IMPLICITE} />
    </form>,
  );
  const form = container.querySelector("form");
  if (form === null) throw new Error("Formularul lipsește.");
  return { form, stare: () => screen.getByRole("status").textContent ?? "" };
}

const campuri = (nume: string) => [
  ...document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[name="${nume}"]`),
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("grila fișei de evaluare", () => {
  it("trimite criteriul, ponderea și nota pe fiecare rând, aliniate", () => {
    const { form } = randeaza();
    const date = new FormData(form);
    expect(date.getAll("criteriu")).toEqual(GRILA.map((r) => r.criteriu));
    expect(date.getAll("pondere")).toEqual(["20", "20", "15", "15", "15", "15"]);
    expect(date.getAll("nota")).toEqual(["", "", "", "", "", ""]);
    expect(date.get("set")).toBe("general");
    expect(date.get("prag_fb")).toBe("4,50");
  });

  it("notele completate dau nota finală și calificativul pe loc", async () => {
    const { stare } = randeaza();
    expect(stare()).toContain("Total ponderi: 100%");
    expect(stare()).toContain(
      "Nota finală se calculează când fiecare criteriu are pondere și notă.",
    );
    const note = ["4", "5", "3", "4", "3", "4"];
    for (const [i, select] of campuri("nota").entries()) {
      await userEvent.selectOptions(select as HTMLSelectElement, note[i] ?? "");
    }
    expect(stare()).toContain("Nota finală: 3,90 — Bine");
  });

  it("ponderile care nu fac 100 se spun imediat", async () => {
    const { stare } = randeaza();
    const prima = campuri("pondere")[0] as HTMLInputElement;
    await userEvent.clear(prima);
    await userEvent.type(prima, "10");
    expect(stare()).toContain("Total ponderi: 90%");
    expect(stare()).toContain("Ponderile însumează 90%, nu 100%: nota finală nu se poate calcula.");
  });

  it("„Împarte ponderile egal” dă 100 pe criteriile scrise", async () => {
    randeaza(GRILA.map((r) => ({ ...r, pondere: null })));
    await userEvent.click(screen.getByRole("button", { name: "Împarte ponderile egal" }));
    expect(campuri("pondere").map((c) => c.value)).toEqual(["17", "17", "17", "17", "16", "16"]);
  });

  it("adaugă și șterge rânduri, cel mult 15", async () => {
    randeaza([{ criteriu: "Unu", pondere: 100, nota: null }]);
    const sterge = screen.getByRole("button", { name: "Șterge criteriul 1" });
    expect(sterge).toHaveProperty("disabled", true);
    const adauga = screen.getByRole("button", { name: "Adaugă un criteriu" });
    for (let i = 0; i < 20; i += 1) await userEvent.click(adauga);
    expect(campuri("criteriu")).toHaveLength(15);
    expect(adauga).toHaveProperty("disabled", true);
    await userEvent.click(screen.getByRole("button", { name: "Șterge criteriul 2" }));
    expect(campuri("criteriu")).toHaveLength(14);
  });

  it("un rând fără criteriu nu intră în calcul", async () => {
    const { stare } = randeaza([{ criteriu: "Unu", pondere: 100, nota: 4 }]);
    await userEvent.click(screen.getByRole("button", { name: "Adaugă un criteriu" }));
    expect(stare()).toContain("Nota finală: 4,00 — Bine");
  });

  it("alt set înlocuiește rândurile, după confirmare dacă era ceva scris", async () => {
    // happy-dom nu are `window.confirm`; îl punem noi, ca browserul.
    const confirmare = vi.fn(() => false);
    vi.stubGlobal("confirm", confirmare);
    randeaza(GRILA.map((r) => ({ ...r, nota: 3 })));
    await userEvent.selectOptions(screen.getByLabelText("Set de criterii, după post"), "productie");
    expect(confirmare).toHaveBeenCalledOnce();
    expect(campuri("criteriu")[0]?.value).toBe("Cunoștințe profesionale");

    confirmare.mockReturnValue(true);
    await userEvent.selectOptions(screen.getByLabelText("Set de criterii, după post"), "productie");
    expect(campuri("criteriu").map((c) => c.value)).toEqual(
      setDupaCheie("productie").criterii.map((c) => c.criteriu),
    );
    expect(campuri("nota").every((c) => c.value === "")).toBe(true);
  });

  it("setul neatins se schimbă fără întrebare", async () => {
    const confirmare = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmare);
    randeaza(setDupaCheie("general").criterii.map((c) => ({ ...c, nota: null })));
    await userEvent.selectOptions(screen.getByLabelText("Set de criterii, după post"), "vanzari");
    expect(confirmare).not.toHaveBeenCalled();
    expect(campuri("criteriu")[0]?.value).toBe(setDupaCheie("vanzari").criterii[0]?.criteriu);
  });

  it("„Încarcă setul” cere confirmare când s-ar pierde ceva scris", async () => {
    const confirmare = vi.fn(() => false);
    vi.stubGlobal("confirm", confirmare);
    const { form } = randeaza(GRILA.map((r) => ({ ...r, nota: 3 })));
    const trimiteri = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener("submit", trimiteri);
    const incarca = screen.getByRole("button", { name: "Încarcă setul" });
    await userEvent.click(incarca);
    expect(confirmare).toHaveBeenCalledOnce();
    expect(trimiteri).not.toHaveBeenCalled();

    confirmare.mockReturnValue(true);
    await userEvent.click(incarca);
    expect(trimiteri).toHaveBeenCalledOnce();
  });

  it("„Încarcă setul” pe setul neatins trimite fără întrebare", async () => {
    const confirmare = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmare);
    const { form } = randeaza(setDupaCheie("general").criterii.map((c) => ({ ...c, nota: null })));
    const trimiteri = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener("submit", trimiteri);
    await userEvent.click(screen.getByRole("button", { name: "Încarcă setul" }));
    expect(confirmare).not.toHaveBeenCalled();
    expect(trimiteri).toHaveBeenCalledOnce();
  });

  it("pragurile greșite se spun, iar calculul folosește implicitele", async () => {
    const { stare } = randeaza(GRILA.map((r) => ({ ...r, nota: 4 })));
    const fb = campuri("prag_fb")[0] as HTMLInputElement;
    await userEvent.clear(fb);
    await userEvent.type(fb, "2");
    expect(stare()).toContain("Pragurile trebuie să scadă");
    expect(stare()).toContain("Nota finală: 4,00 — Bine");
    // Avizul se vede și lângă praguri, chiar cu `<details>` închis.
    expect(document.querySelector("details > summary")?.textContent).toContain(
      "greșite, se folosesc cele implicite",
    );
  });
});
