import { serializeaza } from "./noduri-json-ld";

/**
 * Un nod JSON-LD al unei pagini, randat pe server.
 *
 * Nodurile se construiesc în `noduri-json-ld.ts`, exclusiv din constante de
 * conținut — nicio intrare de utilizator, nicio valoare din baza de date — iar `<`
 * e escapat de `serializeaza`. De aceea `dangerouslySetInnerHTML` e sigur aici;
 * dacă vreodată ajunge într-un nod o valoare din afară, afirmația trebuie
 * rescrisă. Vezi și `date-structurate.tsx`, pentru de ce `<script>` și nu
 * `next/script`.
 */
export function JsonLd({ date }: { date: object }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeaza(date) }} />
  );
}
