/**
 * Marca.
 *
 * Nu e o inițială într-un pătrat colorat. E o coloană de ore care se închide pe
 * linia de total — patru bare de înălțimi diferite așezate pe o riglă groasă,
 * adică exact obiectul pe care îl vinde pagina. Se desenează cu `currentColor`,
 * deci merge la fel pe hârtie și pe cerneală, și nu are nevoie de niciun fișier
 * în `public/`.
 */
export function Marca({ clasa = "h-6 w-6" }: { clasa?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={clasa} aria-hidden="true" focusable="false">
      <rect x="3" y="9" width="3" height="9" fill="currentColor" />
      <rect x="8" y="4" width="3" height="14" fill="currentColor" />
      <rect x="13" y="11" width="3" height="7" fill="currentColor" />
      <rect x="18" y="7" width="3" height="11" fill="currentColor" />
      <rect x="3" y="20" width="18" height="2" fill="currentColor" />
    </svg>
  );
}
