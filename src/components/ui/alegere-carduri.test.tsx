// src/components/ui/alegere-carduri.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { FileText, Film } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { AlegereCarduri, type OptiuneCard } from "./alegere-carduri";

const OPTIUNI: readonly OptiuneCard[] = [
  {
    valoare: "pdf",
    eticheta: "Document PDF",
    descriere: "Un regulament, o procedură, o fișă.",
    pictograma: FileText,
  },
  {
    valoare: "video_fisier",
    eticheta: "Film încărcat",
    descriere: "Urcă filmul în aplicație.",
    pictograma: Film,
  },
  {
    valoare: "video_link",
    eticheta: "Film din link",
    descriere: "YouTube, Vimeo sau Loom.",
    indisponibil: true,
    motiv: "Nu se poate măsura parcurgerea.",
  },
];

describe("AlegereCarduri", () => {
  it("e un grup de radio, nu butoane — aduce gratuit navigarea cu săgețile", () => {
    render(<AlegereCarduri nume="fel" eticheta="Ce fel de material?" optiuni={OPTIUNI} />);
    expect(screen.getByRole("group", { name: "Ce fel de material?" })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("fiecare card e etichetat cu numele lui, deci selectabil la nume", () => {
    render(<AlegereCarduri nume="fel" eticheta="Fel" optiuni={OPTIUNI} />);
    expect(screen.getByRole("radio", { name: /Document PDF/u })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Film încărcat/u })).toBeTruthy();
  });

  it("descrierea fiecărei opțiuni e vizibilă ÎNAINTE de alegere", () => {
    // Motivul pentru care primitiva există: într-un `<select>`, explicația
    // poate sta doar sub control, deci omul o vede după ce a ales.
    render(<AlegereCarduri nume="fel" eticheta="Fel" optiuni={OPTIUNI} />);
    expect(screen.getByText("Un regulament, o procedură, o fișă.")).toBeTruthy();
    expect(screen.getByText("Urcă filmul în aplicație.")).toBeTruthy();
    expect(screen.getByText("YouTube, Vimeo sau Loom.")).toBeTruthy();
  });

  it("o opțiune indisponibilă e dezactivată ȘI își arată motivul", () => {
    // Uniunea discriminată face imposibil `indisponibil` fără `motiv`; testul
    // fixează că motivul chiar ajunge pe ecran, nu doar în tip.
    render(<AlegereCarduri nume="fel" eticheta="Fel" optiuni={OPTIUNI} />);
    const stinsa = screen.getByRole("radio", { name: /Film din link/u });
    expect((stinsa as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("Nu se poate măsura parcurgerea.")).toBeTruthy();
  });

  it("controlată: reflectă `valoare` și anunță schimbarea", () => {
    const laSchimbare = vi.fn();
    render(
      <AlegereCarduri
        nume="fel"
        eticheta="Fel"
        optiuni={OPTIUNI}
        valoare="pdf"
        laSchimbare={laSchimbare}
      />,
    );
    expect((screen.getByRole("radio", { name: /Document PDF/u }) as HTMLInputElement).checked).toBe(
      true,
    );

    fireEvent.click(screen.getByRole("radio", { name: /Film încărcat/u }));
    expect(laSchimbare).toHaveBeenCalledWith("video_fisier");
  });

  it("necontrolată: `valoareInitiala` bifează, iar valoarea pleacă în FormData", () => {
    const { container } = render(
      <form>
        <AlegereCarduri
          nume="fel"
          eticheta="Fel"
          optiuni={OPTIUNI}
          valoareInitiala="video_fisier"
        />
      </form>,
    );
    expect(
      (screen.getByRole("radio", { name: /Film încărcat/u }) as HTMLInputElement).checked,
    ).toBe(true);

    const formular = container.querySelector("form");
    expect(formular).not.toBeNull();
    expect(new FormData(formular as HTMLFormElement).get("fel")).toBe("video_fisier");
  });

  it("o opțiune stinsă nu se poate alege", () => {
    const laSchimbare = vi.fn();
    render(
      <AlegereCarduri nume="fel" eticheta="Fel" optiuni={OPTIUNI} laSchimbare={laSchimbare} />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Film din link/u }));
    expect(laSchimbare).not.toHaveBeenCalled();
  });

  it("intrarea e ascunsă vizual, dar rămâne în arborele de accesibilitate", () => {
    // `sr-only`, nu `hidden`: un `hidden` ar scoate radioul din grup și ar rupe
    // exact navigarea pentru care s-a ales input nativ.
    render(<AlegereCarduri nume="fel" eticheta="Fel" optiuni={OPTIUNI} />);
    const radio = screen.getByRole("radio", { name: /Document PDF/u });
    expect(radio.className).toContain("sr-only");
  });
});
