// src/components/onboarding/progres-asistent.tsx
"use client";

export const ETICHETE_PASI = [
  "Date fiscale",
  "Reprezentant legal",
  "Date financiare",
  "Structură și locații",
  "SSM / PSI",
  "Cont proprietar",
  "Confirmare",
] as const;

interface ProprietatiProgres {
  readonly pasCurent: number;
}

export function ProgresAsistent({ pasCurent }: ProprietatiProgres) {
  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Pașii înrolării">
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
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium " +
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
