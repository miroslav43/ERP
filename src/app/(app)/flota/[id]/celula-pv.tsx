// src/app/(app)/flota/[id]/celula-pv.tsx
//
// Celula „Proces-verbal” din tabelul de alocări al fișei vehiculului (0215,
// F12c): pentru fiecare capăt al alocării — predarea și, dacă a avut loc,
// restituirea — numărul PV-ului viu, „Ciornă”, sau „Fără PV” cu legătura
// „Întocmește PV” pentru cine administrează parcul. Server component: nu are
// stare, doar legături.
//
// PV-ul e opțional (decizia I-T2 / D3 (a)): rândul fără PV nu blochează nimic,
// doar se vede.
import Link from "next/link";
import type { ReactElement } from "react";

import type { CapatPv, CapeteAlocare } from "./capete-pv";
import { hrefPvNou } from "./capete-pv";

interface Proprietati {
  readonly vehiculId: string;
  readonly capete: CapeteAlocare | undefined;
  readonly poateAdministra: boolean;
}

function Capat({
  eticheta,
  capat,
  vehiculId,
  poateAdministra,
}: Readonly<{
  eticheta: string;
  capat: CapatPv;
  vehiculId: string;
  poateAdministra: boolean;
}>): ReactElement {
  if (capat.pv !== null) {
    const href = `/flota/${vehiculId}/pv/${capat.pv.id}`;
    return (
      <span className="block">
        <span className="text-muted-foreground">{eticheta}: </span>
        <Link href={href} className="underline-offset-2 hover:underline">
          {capat.pv.stare === "ciorna" ? "Ciornă" : capat.pv.numar}
        </Link>
        {capat.pv.tip === "transfer" ? (
          <span className="text-muted-foreground text-nota"> (transfer)</span>
        ) : null}
      </span>
    );
  }
  if (capat.acelasiSofer) {
    return (
      <span className="text-muted-foreground text-nota block">
        {eticheta}: același șofer — nu e o predare
      </span>
    );
  }
  return (
    <span className="block">
      <span className="text-muted-foreground">{eticheta}: Fără PV</span>
      {poateAdministra && capat.nou !== null ? (
        <>
          {" · "}
          <Link
            href={hrefPvNou(vehiculId, capat.nou)}
            className="underline-offset-2 hover:underline"
            aria-label={`Întocmește procesul-verbal de ${eticheta.toLowerCase()}${
              capat.transferCu === null ? "" : `, transfer cu ${capat.transferCu}`
            }`}
          >
            Întocmește PV
          </Link>
        </>
      ) : null}
    </span>
  );
}

export function CelulaPv({ vehiculId, capete, poateAdministra }: Proprietati): ReactElement {
  if (capete === undefined) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-corp">
      <Capat
        eticheta="Predare"
        capat={capete.predare}
        vehiculId={vehiculId}
        poateAdministra={poateAdministra}
      />
      {capete.restituire === null ? null : (
        <Capat
          eticheta="Restituire"
          capat={capete.restituire}
          vehiculId={vehiculId}
          poateAdministra={poateAdministra}
        />
      )}
    </span>
  );
}
