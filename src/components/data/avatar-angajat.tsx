// src/components/data/avatar-angajat.tsx
import { User } from "lucide-react";

const DIMENSIUNI = {
  sm: "size-6",
  md: "size-9",
  lg: "size-20",
} as const;

interface ProprietatiAvatarAngajat {
  readonly url: string | null;
  /** Doar pentru `alt` — un cerc gol nu are nevoie de text vizibil. */
  readonly nume: string;
  readonly marime?: keyof typeof DIMENSIUNI;
}

/** Cerc cu fotografia angajatului, sau un contur gol dacă nu are una încărcată. */
export function AvatarAngajat({ url, nume, marime = "md" }: ProprietatiAvatarAngajat) {
  const clasaDimensiune = DIMENSIUNI[marime];
  if (url !== null) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imagine din Storage extern, fără loader Next
      <img
        src={url}
        alt={nume}
        className={`${clasaDimensiune} border-border shrink-0 rounded-full border object-cover`}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={nume}
      className={`${clasaDimensiune} border-border bg-surface text-muted-foreground inline-flex shrink-0 items-center justify-center rounded-full border`}
    >
      <User aria-hidden="true" className="size-1/2" />
    </span>
  );
}
