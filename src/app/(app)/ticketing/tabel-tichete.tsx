// src/app/(app)/ticketing/tabel-tichete.tsx
import { Badge } from "@/components/ui/badge";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { formatDateTime } from "@/lib/format/date";
import type { RandTichet } from "@/lib/queries/ticketing";

import {
  ETICHETE_PRIORITATE,
  ETICHETE_STATUS,
  ETICHETE_TIP,
  TONURI_PRIORITATE,
  TONURI_STATUS,
} from "./etichete";

/**
 * Tabelul e același pe „Tichetele mele” și pe „Coada echipei”; diferă doar ce
 * întoarce RLS-ul pentru fiecare. `aratSolicitantul` și `aratAsignatul` sunt
 * singurele deosebiri de afișare: în lista proprie, prima coloană ar repeta
 * același nume pe fiecare rând, iar a doua nu-l privește pe solicitant.
 *
 * Fără `sortare`: paginarea tichetelor are cursor, dar el trăiește în cele două
 * pagini care folosesc componenta, nu aici, iar `listeazaTichete` ordonează
 * fix după `created_at`. Un antet care pare sortabil și nu face nimic e mai rău
 * decât unul care nu pare.
 */
export function TabelTichete({
  randuri,
  aratSolicitantul = false,
  aratAsignatul = false,
}: Readonly<{
  randuri: readonly RandTichet[];
  aratSolicitantul?: boolean;
  aratAsignatul?: boolean;
}>) {
  const coloanaSolicitant: Coloana<RandTichet> = {
    cheie: "solicitant",
    antet: "Solicitant",
    peTelefon: "meta",
    celula: (tichet) => tichet.solicitant?.full_name ?? "—",
  };

  /*
   * `asignat` era CITIT de `listeazaTichete` — e în `COLOANE_LISTA`, cu embed
   * pe cheia străină, și în tipul `RandTichet` — și nu apărea în niciun tabel.
   * Pe coadă, asta însemna că un operator nu putea deosebi tichetele lui de ale
   * colegului, nici pe cele nerepartizate de restul: exact întrebarea pentru
   * care se deschide ecranul. „Nerepartizat" e scris ca atare, nu „—": e o
   * stare de lucru, nu o valoare lipsă.
   */
  const coloanaAsignat: Coloana<RandTichet> = {
    cheie: "asignat",
    antet: "Asignat",
    peTelefon: "meta",
    celula: (tichet) =>
      tichet.asignat === null ? (
        <span className="text-muted-foreground">Nerepartizat</span>
      ) : (
        tichet.asignat.full_name
      ),
  };

  const coloane: readonly Coloana<RandTichet>[] = [
    {
      cheie: "numar",
      antet: "Număr",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (tichet) => <span className="text-nota font-mono">{tichet.numar_afisat}</span>,
    },
    {
      cheie: "tip",
      antet: "Tip",
      peTelefon: "meta",
      celula: (tichet) => <span className="text-muted-foreground">{ETICHETE_TIP[tichet.tip]}</span>,
    },
    {
      cheie: "titlu",
      antet: "Titlu",
      peTelefon: "titlu",
      celula: (tichet) => tichet.titlu,
    },
    ...(aratSolicitantul ? [coloanaSolicitant] : []),
    ...(aratAsignatul ? [coloanaAsignat] : []),
    {
      cheie: "prioritate",
      antet: "Prioritate",
      peTelefon: "insigna",
      celula: (tichet) => (
        <Badge ton={TONURI_PRIORITATE[tichet.prioritate]}>
          {ETICHETE_PRIORITATE[tichet.prioritate]}
        </Badge>
      ),
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (tichet) => (
        <Badge ton={TONURI_STATUS[tichet.status]}>{ETICHETE_STATUS[tichet.status]}</Badge>
      ),
    },
    {
      cheie: "deschis_la",
      antet: "Deschis la",
      peTelefon: "meta",
      celula: (tichet) => (
        <span className="text-muted-foreground text-nota">{formatDateTime(tichet.created_at)}</span>
      ),
    },
  ];

  return (
    <Tabel
      caption="Lista tichetelor, cu starea și prioritatea lor."
      coloane={coloane}
      randuri={randuri}
      cheieRand={(tichet) => tichet.id}
      href={(tichet) => `/ticketing/${tichet.id}`}
      // Golul e tratat de fiecare dintre cele două pagini care folosesc
      // componenta, cu propriul text: „Niciun tichet deschis” pe lista proprie,
      // „Nimic în coadă” pe coada echipei.
      gol={null}
    />
  );
}
