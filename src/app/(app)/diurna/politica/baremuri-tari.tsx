"use client";

import { useState, type ReactElement, type ReactNode } from "react";

import { DialogPortat } from "@/app/(app)/ssm/dialog-portat";
import { formatDate } from "@/lib/format/date";
import { formatAmount } from "@/lib/format/money";

/** Un rând de barem, deja ales pe server: categoria II, valabil azi. */
export interface RandBaremAfisat {
  readonly tara: string;
  readonly valoare: number;
  readonly moneda: string;
  readonly valabilDeLa: string;
}

/**
 * Textul „baremul legal al țării", apăsabil: deschide baremul pe țări și
 * regulile după care se împarte diurna externă. Dialogul e portat în
 * `document.body`, fiindcă textul apare și într-o celulă de `<Tabel>`, care pe
 * telefon devine `<p>` — vezi `ssm/dialog-portat.tsx`.
 */
export function BaremuriTari({
  baremuri,
  multiplu,
  children,
}: {
  readonly baremuri: readonly RandBaremAfisat[];
  /** Multiplul legal al plafonului neimpozabil (2,5). */
  readonly multiplu: number | null;
  readonly children: ReactNode;
}): ReactElement {
  const [deschis, setDeschis] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDeschis(true);
        }}
        className="text-primary underline underline-offset-2 hover:no-underline"
      >
        {children}
      </button>
      <DialogPortat
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu="Diurna în străinătate — baremul legal"
        marime="mare"
      >
        <ul className="text-corp list-disc space-y-1 pl-5">
          <li>
            Dacă politica nu are o sumă fixă pentru străinătate, angajatul primește baremul țării
            din tabelul de mai jos (HG 518/1995), pe zi.
          </li>
          <li>
            Dacă politica are o sumă fixă (ex. 50 EUR), se plătește suma fixă în orice țară, iar
            baremul contează doar pentru plafon. Suma fixă trebuie să fie în moneda baremului.
          </li>
          {multiplu === null ? null : (
            <li>
              Neimpozabil pe zi: {formatAmount(multiplu)} × baremul țării. Ce trece peste se
              impozitează ca salariu.
            </li>
          )}
          <li>
            Ziua în care se trece granița se plătește o singură dată, pentru o singură țară, după
            regula aleasă în politică.
          </li>
          <li>O țară fără barem în tabel nu se poate calcula până nu i se încarcă baremul.</li>
        </ul>

        {baremuri.length === 0 ? (
          <p className="text-muted-foreground text-corp mt-4">Niciun barem încărcat.</p>
        ) : (
          <table className="text-corp mt-4 w-full">
            <caption className="sr-only">Baremul legal de diurnă pe țări, valabil azi.</caption>
            <thead>
              <tr className="border-border border-b text-left">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Țara
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Barem / zi
                </th>
                {multiplu === null ? null : (
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Neimpozabil / zi
                  </th>
                )}
                <th scope="col" className="py-2 font-medium">
                  Valabil de la
                </th>
              </tr>
            </thead>
            <tbody>
              {baremuri.map((b) => (
                <tr key={b.tara} className="border-border border-b last:border-0">
                  <td className="py-2 pr-3">{b.tara}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatAmount(b.valoare, b.moneda)}
                  </td>
                  {multiplu === null ? null : (
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatAmount(b.valoare * multiplu, b.moneda)}
                    </td>
                  )}
                  <td className="py-2">{formatDate(b.valabilDeLa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DialogPortat>
    </>
  );
}
