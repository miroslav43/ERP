// src/app/(app)/flota/foi/[id]/link-bon.tsx

/**
 * Linkul spre poza bonului unei alimentări (0199), sub numărul bonului. URL
 * semnat pe server, zece minute, în tab nou. O cale fără URL înseamnă că
 * Storage n-a semnat-o (obiect lipsă sau fără drept): se spune, nu se lasă un
 * link care dă 404. Fără bon atașat, nu apare nimic — lipsa nu e o eroare.
 *
 * Folosit de `/flota/foi/[id]` și de foaia din portal; fără „use client”, e
 * randat pe server, în celula tabelului.
 */
export function LinkBon({
  cale,
  urluri,
}: Readonly<{ cale: string | null; urluri: ReadonlyMap<string, string> }>) {
  if (cale === null) return null;
  const url = urluri.get(cale);
  if (url === undefined) {
    return <span className="text-muted-foreground block text-xs">poza bonului, indisponibilă</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block text-xs underline-offset-2 hover:underline"
      // `aria-label`, nu `sr-only`: în tabelul derulabil, un `sr-only` fără
      // strămoș `relative` trage pagina lateral (memoria „sr-only în overflow”).
      aria-label="Poza bonului (filă nouă)"
    >
      Poza bonului
    </a>
  );
}
