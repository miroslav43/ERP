type Ton = "neutru" | "bun" | "atentie";

type Props = Readonly<{
  eticheta: string;
  valoare: number;
  nota?: string;
  ton?: Ton;
}>;

const DUNGA: Readonly<Record<Ton, string>> = {
  neutru: "bg-border",
  bun: "bg-success",
  atentie: "bg-accent",
};

/**
 * Cartela din banda de stări.
 *
 * Starea e codificată și în FORMĂ, nu doar în cifră: dunga de sus se citește
 * periferic, fără să compari numere între ele. Un panou de control se scanează,
 * nu se citește — iar diferența se vede abia când sunt patru cartele alăturate.
 */
export function Cifra({ eticheta, valoare, nota, ton = "neutru" }: Props) {
  return (
    <div
      className={`border-border relative overflow-hidden rounded-lg border p-4 ${
        ton === "atentie" ? "bg-accent/8" : "bg-surface"
      }`}
    >
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-0.5 ${DUNGA[ton]}`} />
      <dt className="text-muted-foreground text-sm font-medium">{eticheta}</dt>
      <dd className="text-primary mt-0.5 text-3xl font-semibold tabular-nums">{valoare}</dd>
      {nota ? (
        <span className="text-muted-foreground mt-0.5 block font-mono text-[0.66rem]">{nota}</span>
      ) : null}
    </div>
  );
}
