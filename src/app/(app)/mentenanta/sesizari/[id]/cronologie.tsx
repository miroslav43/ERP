// src/app/(app)/mentenanta/sesizari/[id]/cronologie.tsx
import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format/date";
import type {
  AngajatRezumat,
  ComentariuSesizare,
  IstoricSesizare,
} from "@/lib/queries/maintenance";
import { STATUSURI_SESIZARE, URGENTE_SESIZARE } from "@/schemas/maintenance";

import {
  ETICHETE_CAMP_ISTORIC,
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_URGENTA_SESIZARE,
} from "../../etichete";

interface Proprietati {
  readonly istoric: readonly IstoricSesizare[];
  readonly comentarii: readonly ComentariuSesizare[];
  readonly numeAngajati: ReadonlyMap<string, AngajatRezumat>;
  readonly numeUtilizatori: ReadonlyMap<string, AngajatRezumat>;
  /** Contul apelantului — rândurile lui spun „dvs.”, nu numele propriu. */
  readonly userId: string;
}

type Element =
  | Readonly<{ fel: "istoric"; la: string; rand: IstoricSesizare }>
  | Readonly<{ fel: "comentariu"; la: string; rand: ComentariuSesizare }>;

const ECHIPA = "Echipa de mentenanță";

function esteStatus(v: string): v is (typeof STATUSURI_SESIZARE)[number] {
  return (STATUSURI_SESIZARE as readonly string[]).includes(v);
}
function esteUrgenta(v: string): v is (typeof URGENTE_SESIZARE)[number] {
  return (URGENTE_SESIZARE as readonly string[]).includes(v);
}

/**
 * Cronologia sesizării: istoricul scris de gardă (stări, atribuiri, urgență)
 * și comentariile, în aceeași listă, în ordinea în care s-au întâmplat.
 *
 * Numele colegilor pot lipsi: sub RLS, un `employee` își vede doar fișa lui,
 * deci pentru el ceilalți sunt „Echipa de mentenanță" — corect, nu o pană. Un
 * rând fără actor (închiderea automată, jobul zilnic) e „Sistem".
 */
export function Cronologie({
  istoric,
  comentarii,
  numeAngajati,
  numeUtilizatori,
  userId,
}: Proprietati): ReactElement {
  const elemente: Element[] = [
    ...istoric.map((rand): Element => ({ fel: "istoric", la: rand.created_at, rand })),
    ...comentarii.map((rand): Element => ({ fel: "comentariu", la: rand.created_at, rand })),
  ].sort((a, b) => a.la.localeCompare(b.la));

  function numeleContului(idCont: string | null): string {
    if (idCont === null) return "Sistem";
    if (idCont === userId) return "Dvs.";
    return numeUtilizatori.get(idCont)?.full_name ?? ECHIPA;
  }

  function numeleFisei(idFisa: string | null): string {
    if (idFisa === null) return "—";
    return numeAngajati.get(idFisa)?.full_name ?? ECHIPA;
  }

  function valoare(camp: string, v: string | null): string {
    if (v === null) return "—";
    if (camp === "status" && esteStatus(v)) return ETICHETE_STATUS_SESIZARE[v];
    if (camp === "urgenta" && esteUrgenta(v)) return ETICHETE_URGENTA_SESIZARE[v];
    if (camp === "atribuit_employee_id") return numeleFisei(v);
    return v;
  }

  if (elemente.length === 0) {
    return (
      <p className="border-border text-muted-foreground rounded-panou text-corp border p-4">
        Încă nimic: sesizarea așteaptă primul pas.
      </p>
    );
  }

  return (
    <ol className="border-border divide-border rounded-panou divide-y border">
      {elemente.map((el) =>
        el.fel === "istoric" ? (
          <li key={`i-${el.rand.id}`} className="flex flex-col gap-1 p-3">
            <p className="text-muted-foreground text-nota">
              {formatDateTime(el.la)} · {numeleContului(el.rand.actor_user_id)}
            </p>
            <p className="text-corp">
              <span className="font-medium">
                {ETICHETE_CAMP_ISTORIC[el.rand.camp] ?? el.rand.camp}
              </span>
              : {valoare(el.rand.camp, el.rand.valoare_veche)} <span aria-hidden="true">→</span>
              <span className="sr-only">devine</span> {valoare(el.rand.camp, el.rand.valoare_noua)}
            </p>
            {el.rand.motiv === null ? null : (
              <p className="text-muted-foreground text-corp border-l-2 pl-3">{el.rand.motiv}</p>
            )}
          </li>
        ) : (
          <li key={`c-${el.rand.id}`} className="bg-surface flex flex-col gap-1 p-3">
            <p className="text-muted-foreground text-nota flex flex-wrap items-center gap-2">
              <span>
                {formatDateTime(el.la)} ·{" "}
                {el.rand.autor_employee_id !== null
                  ? el.rand.autor_user_id === userId ||
                    numeAngajati.get(el.rand.autor_employee_id) === undefined
                    ? numeleContului(el.rand.autor_user_id) === "Dvs."
                      ? "Dvs."
                      : numeleFisei(el.rand.autor_employee_id)
                    : numeleFisei(el.rand.autor_employee_id)
                  : numeleContului(el.rand.autor_user_id)}
              </span>
              {el.rand.intern ? <Badge ton="ciorna">Notă internă</Badge> : null}
            </p>
            <p className="text-corp whitespace-pre-wrap">{el.rand.continut}</p>
          </li>
        ),
      )}
    </ol>
  );
}
