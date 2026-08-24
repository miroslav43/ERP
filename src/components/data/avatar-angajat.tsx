// src/components/data/avatar-angajat.tsx
import { User } from "lucide-react";

/**
 * Clasa dă dimensiunea FINALĂ (în `rem`, deci scalează cu zoom-ul de text);
 * cifra de lângă ea dă browserului raportul de aspect ÎNAINTE ca foaia de stil
 * să fie aplicată sau imaginea descărcată.
 *
 * Fără `width`/`height`, un `<img>` are înălțime zero până la primul octet:
 * lista de angajați randează câte unul pe rând, deci fiecare fotografie sosită
 * împinge în jos tot ce e sub ea. Cu ele, browserul rezervă un pătrat de la
 * prima randare și nu mai sare nimic — cifrele sunt egale fiindcă avatarul e
 * rotund, iar 1:1 e singurul lucru care contează aici.
 */
const DIMENSIUNI = {
  sm: { clasa: "size-6", px: 24 },
  md: { clasa: "size-9", px: 36 },
  lg: { clasa: "size-20", px: 80 },
} as const;

interface ProprietatiAvatarAngajat {
  readonly url: string | null;
  /** Doar pentru `alt` — un cerc gol nu are nevoie de text vizibil. */
  readonly nume: string;
  readonly marime?: keyof typeof DIMENSIUNI;
}

/** Cerc cu fotografia angajatului, sau un contur gol dacă nu are una încărcată. */
export function AvatarAngajat({ url, nume, marime = "md" }: ProprietatiAvatarAngajat) {
  const { clasa, px } = DIMENSIUNI[marime];
  if (url !== null) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imagine din Storage extern, fără loader Next
      <img
        src={url}
        alt={nume}
        width={px}
        height={px}
        // Avatarele stau în liste lungi (94 de angajați pe o pagină de
        // `/angajati`), deci majoritatea sunt sub linia de plutire; `lazy` le
        // scoate din calea primei randări. `async` scoate decodarea din firul
        // principal — altfel 94 de decodări se fac sincron, la derulare.
        loading="lazy"
        decoding="async"
        className={`${clasa} border-border shrink-0 rounded-full border object-cover`}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={nume}
      className={`${clasa} border-border bg-surface text-muted-foreground inline-flex shrink-0 items-center justify-center rounded-full border`}
    >
      <User aria-hidden="true" className="size-1/2" />
    </span>
  );
}
