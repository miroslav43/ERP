type Props = Readonly<{ active: number; total: number }>;

/**
 * Modulele ca pătrățele, nu ca fracție.
 *
 * „1/14" te obligă să citești și să compari; un rând aproape gol se vede din
 * reflex, periferic, la derularea listei. Exact asta vrei să observi fără efort:
 * firme înregistrate dar nepornite.
 *
 * Fracția rămâne alături, pentru cine vrea numărul exact — și pentru cititoarele
 * de ecran, care nu văd pătrățelele.
 */
export function ModuleMini({ active, total }: Props) {
  return (
    <span className="flex items-center gap-[3px]">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`size-2 rounded-[2px] ${i < active ? "bg-primary" : "bg-border"}`}
        />
      ))}
      <span className="text-muted-foreground ms-1.5 font-mono text-xs tabular-nums">
        {active}/{total}
      </span>
    </span>
  );
}
