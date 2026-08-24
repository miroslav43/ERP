// src/app/(app)/concedii/tabel-cereri.tsx
// Tabelul de cereri, comun celor două rute care îl arată: `/concedii`
// („Cererile mele”) și `/concedii/echipa`. Diferă prin `vizualizare`, prin
// coloana „Angajat” și prin calea pe care se construiesc adresele de sortare și
// paginare — restul e identic, iar o a doua copie ar fi divergat la primul câmp
// adăugat.
import { CalendarRange } from "lucide-react";

import { StareGoala, type ActiuneStareGoala } from "@/components/ui/stare-goala";
import { Badge } from "@/components/ui/badge";
import { Paginare } from "@/components/ui/paginare";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatAmount } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";
import { scrieSortare } from "@/lib/queries/cursor";
import { listeazaCereri, type RandCerere } from "@/lib/queries/leave";
import { filtreCereriSchema, type VizualizareCereri } from "@/schemas/leave";
import { filtreDinUrl } from "@/lib/rute/parametri";
import type { PermissionScope } from "@/config/permissions";

import { ETICHETE_STATUS_CERERE, TONURI_STATUS_CERERE } from "./etichete";

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
  /** Ruta curentă — pe ea se construiesc adresele de sortare și de paginare. */
  readonly caleBaza: string;
  /** Textul stării goale când NU e niciun filtru pus. */
  readonly gol: Readonly<{ titlu: string; descriere: string }>;
  /** Acțiunea stării goale inițiale. Absentă = fără buton. */
  readonly actiuneGol?: ActiuneStareGoala | undefined;
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
  const { randuri, urmatorulCursor, total, sortare } = await listeazaCereri(
    organizationId,
    scope,
    filtre,
    fisaMea,
    vizualizare,
  );

  const aratăAngajat = vizualizare !== "mele";

  if (randuri.length === 0) {
    // `vizualizare` NU intră în socoteală: nu mai e un filtru din adresă, ci
    // ruta însăși. „Șterge filtrele” duce înapoi pe aceeași rută, curată.
    const areFiltre =
      filtre.status !== null ||
      filtre.leave_type_id !== null ||
      filtre.employee_id !== null ||
      filtre.de_la !== null ||
      filtre.pana_la !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={CalendarRange}
        titlu={areFiltre ? "Nicio cerere pe filtrele alese" : gol.titlu}
        descriere={
          areFiltre
            ? "Nu există cereri care să corespundă filtrelor alese. Ștergeți filtrele sau lărgiți intervalul."
            : gol.descriere
        }
        {...(areFiltre
          ? { actiune: { eticheta: "Șterge filtrele", href: caleBaza } }
          : actiuneGol === undefined
            ? {}
            : { actiune: actiuneGol })}
      />
    );
  }

  const hartaTipuri = new Map(tipuri.map((t) => [t.id, t]));
  let hartaAngajati = new Map<string, OptiuneAngajat>();
  if (aratăAngajat) {
    const idAngajati = [...new Set(randuri.map((r) => r.employee_id))];
    const db = await createServerSupabase();
    const { data } = await db.from("employees").select("id, full_name, marca").in("id", idAngajati);
    hartaAngajati = new Map((data ?? []).map((a) => [a.id, a]));
  }

  /**
   * Adresele se construiesc din parametrii EXISTENȚI, nu dintr-un obiect gol:
   * altfel o sortare ar șterge filtrele, iar o schimbare de mărime a paginii ar
   * șterge sortarea.
   */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? caleBaza : `${caleBaza}?${p.toString()}`;
  }

  const coloaneAngajat: readonly Coloana<RandCerere>[] = aratăAngajat
    ? [
        {
          cheie: "angajat",
          antet: "Angajat",
          peTelefon: "titlu",
          celula: (cerere) => {
            const angajat = hartaAngajati.get(cerere.employee_id);
            return angajat === undefined ? "—" : `${angajat.full_name ?? "—"} (${angajat.marca})`;
          },
        },
      ]
    : [];

  const coloane: readonly Coloana<RandCerere>[] = [
    ...coloaneAngajat,
    {
      cheie: "tip",
      antet: "Tip",
      peTelefon: aratăAngajat ? "meta" : "titlu",
      celula: (cerere) => {
        const tip = hartaTipuri.get(cerere.leave_type_id);
        return (
          <>
            <span
              className="mr-2 inline-block size-2.5 rounded-full align-middle"
              style={{ backgroundColor: tip?.culoare ?? "var(--color-muted-foreground)" }}
              aria-hidden="true"
            />
            {tip?.denumire ?? "—"}
          </>
        );
      },
    },
    {
      cheie: "perioada",
      antet: "Perioadă",
      sortabil: true,
      peTelefon: "meta",
      celula: (cerere) => `${formatDate(cerere.data_inceput)} – ${formatDate(cerere.data_sfarsit)}`,
    },
    {
      cheie: "zile",
      antet: "Zile lucrătoare",
      numeric: true,
      peTelefon: "meta",
      celula: (cerere) => `${formatAmount(cerere.zile_lucratoare)} zile`,
    },
    {
      cheie: "stare",
      antet: "Stare",
      sortabil: true,
      peTelefon: "insigna",
      celula: (cerere) => (
        <Badge ton={TONURI_STATUS_CERERE[cerere.status]}>
          {ETICHETE_STATUS_CERERE[cerere.status]}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption={aratăAngajat ? "Cererile de concediu ale echipei" : "Cererile mele de concediu"}
        coloane={coloane}
        randuri={randuri}
        cheieRand={(cerere) => cerere.id}
        href={(cerere) => `/concedii/${cerere.id}`}
        sortare={sortare}
        hrefSortare={(s) =>
          adresa((p) => {
            p.set("sort", scrieSortare(s));
            // Cursorul nu supraviețuiește unei schimbări de sortare: ar continua
            // de la un rând care, în noua ordine, nu mai e acolo unde era.
            p.delete("cursor");
          })
        }
        gol={null}
      />
      <Paginare
        afisate={randuri.length}
        total={total}
        cursorUrmator={urmatorulCursor}
        limita={filtre.limita}
        construiesteHref={({ cursor, limita }) =>
          adresa((p) => {
            p.set("limita", String(limita));
            if (cursor === null) p.delete("cursor");
            else p.set("cursor", cursor);
          })
        }
      />
    </div>
  );
}
