// src/app/(app)/angajati/nou/_components/progres-asistent.tsx
"use client";

export const ETICHETE_PASI = [
  "Identitate",
  "Contact și adrese",
  "Angajare și contract",
  "Fișa postului",
  "Bunuri și certificări",
  "Confirmare",
] as const;

interface ProprietatiProgres {
  readonly pasCurent: number;
}

export function ProgresAsistent({ pasCurent }: ProprietatiProgres) {
  return (
    <ol
      className="text-corp flex flex-wrap gap-x-4 gap-y-2"
      aria-label="Pașii înrolării angajatului"
    >
      {ETICHETE_PASI.map((eticheta, index) => {
        const numarPas = index + 1;
        const activ = numarPas === pasCurent;
        const parcurs = numarPas < pasCurent;
        return (
          <li
            key={eticheta}
            aria-current={activ ? "step" : undefined}
            className="flex items-center gap-2"
          >
            <span
              className={
                "text-nota flex size-6 shrink-0 items-center justify-center rounded-full font-medium " +
                (activ
                  ? "bg-primary text-primary-foreground"
                  : parcurs
                    ? "bg-primary/20 text-primary"
                    : "bg-surface text-muted-foreground border-border border")
              }
            >
              {numarPas}
            </span>
            <span className={activ ? "text-foreground font-medium" : "text-muted-foreground"}>
              {eticheta}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
