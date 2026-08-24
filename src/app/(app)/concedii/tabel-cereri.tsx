// src/app/(app)/concedii/tabel-cereri.tsx
// Tabelul de cereri, comun celor două rute care îl arată: `/concedii`
// („Cererile mele”) și `/concedii/echipa`. Diferă prin `vizualizare`, prin
// coloana „Angajat” și prin calea de paginare — restul e identic, iar o a doua
// copie ar fi divergat la primul câmp adăugat.
import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarRange } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { RandTabel } from "@/components/data/rand-tabel";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatAmount } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";
import { listeazaCereri, type RandCerere } from "@/lib/queries/leave";
import { filtreCereriSchema, type VizualizareCereri } from "@/schemas/leave";
import { filtreDinUrl } from "@/lib/rute/parametri";
import type { PermissionScope } from "@/config/permissions";

import { CLASE_STATUS_CERERE, ETICHETE_STATUS_CERERE } from "./etichete";

interface OptiuneTip {
  readonly id: string;
  readonly denumire: string;
  readonly culoare: string;
}

interface OptiuneAngajat {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

interface Proprietati {
  readonly organizationId: string;
  readonly vizualizare: VizualizareCereri;
  readonly tipuri: readonly OptiuneTip[];
  readonly parametri: Record<string, string | string[] | undefined>;
  readonly scope: PermissionScope;
  readonly fisaMea: string | null;
  /** Calea pe care se construiește linkul de paginare — ruta curentă. */
  readonly caleBaza: string;
  readonly gol: Readonly<{ titlu: string; descriere: string }>;
  readonly actiuneGol?: Readonly<{ label: string; href: string }> | undefined;
}

export async function TabelCereri({
  organizationId,
  vizualizare,
  tipuri,
  parametri,
  scope,
  fisaMea,
  caleBaza,
  gol,
  actiuneGol,
}: Proprietati) {
  const filtre = filtreDinUrl(filtreCereriSchema, parametri);
  const { randuri, urmatorulCursor } = await listeazaCereri(
    organizationId,
    scope,
    filtre,
    fisaMea,
    vizualizare,
  );

  if (randuri.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title={gol.titlu}
        description={gol.descriere}
        // `exactOptionalPropertyTypes` cere ca proprietatea opțională să
        // LIPSEASCĂ, nu să fie `undefined` — de aici răspândirea condiționată.
        {...(actiuneGol === undefined ? {} : { action: actiuneGol })}
      />
    );
  }

  const aratăAngajat = vizualizare !== "mele";

  const hartaTipuri = new Map(tipuri.map((t) => [t.id, t]));
  let hartaAngajati = new Map<string, OptiuneAngajat>();
  if (aratăAngajat) {
    const idAngajati = [...new Set(randuri.map((r) => r.employee_id))];
    const db = await createServerSupabase();
    const { data } = await db.from("employees").select("id, full_name, marca").in("id", idAngajati);
    hartaAngajati = new Map((data ?? []).map((a) => [a.id, a]));
  }

  const cautare = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && cheie !== "cursor") cautare.set(cheie, valoare);
  }
  if (urmatorulCursor !== null) cautare.set("cursor", urmatorulCursor);

  function randCa(cerere: RandCerere): ReactNode {
    const tip = hartaTipuri.get(cerere.leave_type_id);
    const angajat = hartaAngajati.get(cerere.employee_id);
    return (
      <RandTabel key={cerere.id} href={`/concedii/${cerere.id}`}>
        {aratăAngajat ? (
          <td className="px-4 py-3">
            {angajat === undefined ? "—" : `${angajat.full_name ?? "—"} (${angajat.marca})`}
          </td>
        ) : null}
        <td className="px-4 py-3">
          <span
            className="mr-2 inline-block size-2.5 rounded-full align-middle"
            style={{ backgroundColor: tip?.culoare ?? "#94a3b8" }}
            aria-hidden="true"
          />
          {tip?.denumire ?? "—"}
        </td>
        <td className="px-4 py-3">
          {formatDate(cerere.data_inceput)} – {formatDate(cerere.data_sfarsit)}
        </td>
        <td className="px-4 py-3 tabular-nums">{formatAmount(cerere.zile_lucratoare)} zile</td>
        <td className="px-4 py-3">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CLASE_STATUS_CERERE[cerere.status]}`}
          >
            {ETICHETE_STATUS_CERERE[cerere.status]}
          </span>
        </td>
        <td className="px-4 py-3">
          <Link
            href={`/concedii/${cerere.id}`}
            className="text-primary font-medium underline-offset-2 hover:underline"
          >
            Detalii
          </Link>
        </td>
      </RandTabel>
    );
  }

  return (
    <>
      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            {aratăAngajat ? "Cererile de concediu ale echipei" : "Cererile mele de concediu"}
          </caption>
          <thead className="bg-surface text-foreground">
            <tr>
              {aratăAngajat ? (
                <th scope="col" className="px-4 py-3 font-medium">
                  Angajat
                </th>
              ) : null}
              <th scope="col" className="px-4 py-3 font-medium">
                Tip
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Perioadă
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Zile lucrătoare
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stare
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                <span className="sr-only">Acțiuni</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">{randuri.map(randCa)}</tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="mt-4 flex justify-end">
        {urmatorulCursor === null ? (
          <p className="text-muted-foreground text-sm">Aceasta este ultima pagină.</p>
        ) : (
          <Link
            href={`${caleBaza}?${cautare.toString()}`}
            className="border-foreground/60 hover:bg-surface rounded-md border px-3 py-2 text-sm font-medium"
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}
