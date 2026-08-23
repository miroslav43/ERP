// src/components/audit/filtre-audit.tsx
import { Search } from "lucide-react";

import { Buton, buton } from "@/components/ui/buton";
import { OPTIUNI_ACTIUNI, OPTIUNI_ENTITATI, OPTIUNI_STATUS } from "@/lib/audit/etichete";
import type { FiltreAudit, OptiuneOrganizatie } from "@/lib/queries/audit";

type Props = Readonly<{
  /** Ruta paginii; formularul trimite prin GET, deci filtrele rămân în URL. */
  cale: string;
  filtre: FiltreAudit;
  /** `null` pentru organizații: nu au voie să filtreze după alt tenant (S1). */
  organizatii: readonly OptiuneOrganizatie[] | null;
}>;

const clasaCamp =
  "w-full rounded-control border border-border bg-background px-3 py-2 text-corp text-foreground";
const clasaEticheta = "mb-1 block text-nota font-medium text-muted-foreground";

export function FiltreAuditForm({ cale, filtre, organizatii }: Props) {
  return (
    <form method="get" action={cale} className="border-border bg-surface rounded-panou border p-4">
      <fieldset className="border-0 p-0">
        <legend className="text-foreground text-corp mb-3 font-semibold">Filtrează jurnalul</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="filtru-de-la" className={clasaEticheta}>
              De la data
            </label>
            <input
              id="filtru-de-la"
              name="de_la"
              type="date"
              defaultValue={filtre.deLa ?? ""}
              className={clasaCamp}
            />
          </div>
          <div>
            <label htmlFor="filtru-pana-la" className={clasaEticheta}>
              Până la data (inclusiv)
            </label>
            <input
              id="filtru-pana-la"
              name="pana_la"
              type="date"
              defaultValue={filtre.panaLa ?? ""}
              className={clasaCamp}
            />
          </div>
          {organizatii !== null ? (
            <div>
              <label htmlFor="filtru-org" className={clasaEticheta}>
                Organizație
              </label>
              <select
                id="filtru-org"
                name="org"
                defaultValue={filtre.organizationId ?? ""}
                className={clasaCamp}
              >
                <option value="">Toate organizațiile</option>
                {organizatii.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label htmlFor="filtru-actor" className={clasaEticheta}>
              Autor (e-mail sau identificator)
            </label>
            <input
              id="filtru-actor"
              name="actor"
              type="text"
              inputMode="email"
              placeholder="ex. maria@firma.ro"
              defaultValue={filtre.actor ?? ""}
              className={clasaCamp}
            />
          </div>
          <div>
            <label htmlFor="filtru-actiune" className={clasaEticheta}>
              Acțiune
            </label>
            <select
              id="filtru-actiune"
              name="actiune"
              defaultValue={filtre.actiune ?? ""}
              className={clasaCamp}
            >
              <option value="">Toate acțiunile</option>
              {OPTIUNI_ACTIUNI.map((optiune) => (
                <option key={optiune.valoare} value={optiune.valoare}>
                  {optiune.eticheta}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filtru-status" className={clasaEticheta}>
              Rezultat
            </label>
            <select
              id="filtru-status"
              name="status"
              defaultValue={filtre.status ?? ""}
              className={clasaCamp}
            >
              <option value="">Toate rezultatele</option>
              {OPTIUNI_STATUS.map((optiune) => (
                <option key={optiune.valoare} value={optiune.valoare}>
                  {optiune.eticheta}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filtru-entitate" className={clasaEticheta}>
              Tip de entitate
            </label>
            <select
              id="filtru-entitate"
              name="entitate"
              defaultValue={filtre.entitate ?? ""}
              className={clasaCamp}
            >
              <option value="">Toate tipurile</option>
              {OPTIUNI_ENTITATI.map((optiune) => (
                <option key={optiune.valoare} value={optiune.valoare}>
                  {optiune.eticheta}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filtru-entity-id" className={clasaEticheta}>
              Caută în identificatorul entității
            </label>
            <input
              id="filtru-entity-id"
              name="entity_id"
              type="search"
              placeholder="fragment din ID"
              defaultValue={filtre.entityId ?? ""}
              className={clasaCamp}
            />
          </div>
        </div>
      </fieldset>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Buton varianta="primar" type="submit">
          <Search aria-hidden="true" className="size-4" />
          Filtrează
        </Buton>
        <a href={cale} className={buton({ varianta: "link" })}>
          Golește filtrele
        </a>
      </div>
    </form>
  );
}
