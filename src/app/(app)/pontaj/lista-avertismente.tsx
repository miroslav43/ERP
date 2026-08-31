// src/app/(app)/pontaj/lista-avertismente.tsx
/**
 * Cum arată pe ecran limitele legale depășite.
 *
 * Un singur loc pentru toate cele trei ecrane care le afișează — formularul
 * zilei din portal, planul săptămânii, foaia colectivă — fiindcă altfel același
 * avertisment ar fi arătat a eroare într-unul și a notă de subsol în altul, iar
 * omul n-ar fi știut care dintre ele e serios.
 *
 * ── DE CE „ATENȚIE" ȘI NU „EROARE" ────────────────────────────────────────
 * Ce s-a scris, s-a scris: ziua e salvată, planul e trimis. Un bloc roșu de
 * eroare ar spune că operațiunea a eșuat, ceea ce e fals, și l-ar învăța pe om
 * să rescrie cifra până dispare culoarea — adică exact să ascundă faptul pe care
 * angajatorul trebuie să-l vadă.
 *
 * Cele informative — săptămâna peste normă, dar sub plafon — rămân neutre:
 * sunt orele suplimentare, care sunt legale. Dacă ar arăta ca depășirile
 * serioase, le-ar îneca, fiind mult mai numeroase.
 */
import type { ReactElement } from "react";

import type { AvertismentPontaj } from "@/domain/attendance/limite-legale";
import { Callout } from "@/components/ui/callout";

export function ListaAvertismente({
  avertismente,
  titlu = "Verificarea regulilor firmei",
  className,
}: {
  readonly avertismente: readonly AvertismentPontaj[];
  readonly titlu?: string;
  readonly className?: string;
}): ReactElement | null {
  if (avertismente.length === 0) return null;

  const serioase = avertismente.filter((a) => a.severitate === "avertisment");
  const informative = avertismente.filter((a) => a.severitate === "informativ");

  return (
    <div className={className}>
      {serioase.length === 0 ? null : (
        <Callout fel="atentie" titlu={titlu}>
          <ul className="list-disc space-y-1 pl-4">
            {serioase.map((a) => (
              <li key={`${a.cod}-${a.zi}`}>{a.mesaj}</li>
            ))}
          </ul>
          <p className="text-muted-foreground text-nota mt-2">
            Înregistrarea a fost salvată așa cum ați completat-o. Avertismentul rămâne ca să poată
            fi corectat programul, nu cifra.
          </p>
        </Callout>
      )}
      {informative.length === 0 ? null : (
        // `exactOptionalPropertyTypes` e pornit: `className={undefined}` nu e
        // același lucru cu absența proprietății, deci se dă prin răspândire.
        <Callout fel="informativ" {...(serioase.length === 0 ? {} : { className: "mt-2" })}>
          <ul className="list-disc space-y-1 pl-4">
            {informative.map((a) => (
              <li key={`${a.cod}-${a.zi}`}>{a.mesaj}</li>
            ))}
          </ul>
        </Callout>
      )}
    </div>
  );
}
