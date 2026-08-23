// src/app/(portal)/portal/instruirile-mele/page.tsx
import { treaptaSsm } from "@/domain/ssm/scadente";
import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { Scadenta } from "@/components/ui/scadenta";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import {
  autorizatiiNominaleAngajat,
  eipAngajatului,
  fiseAptitudineAngajat,
  instruirileAngajatului,
  restrictiiActiveAngajat,
} from "@/lib/queries/ssm";
import { fisaMea } from "@/lib/queries/portal";
import { stareScadentaSsm } from "@/domain/ssm/scadente";
import { nomenclatorInstruiri } from "@/app/(app)/ssm/actions";
import {
  ETICHETE_REZULTAT_EXAMEN,
  ETICHETE_SCADENTA,
  ETICHETE_TIP_EXAMEN,
} from "@/app/(app)/ssm/etichete";

import { FaraFisa } from "../fara-fisa";

export const metadata: Metadata = { title: "Instruirile mele" };

export default async function PaginaInstruirileMele() {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "ssm:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta instruirile de securitate a muncii." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  // Tot dosarul, nu doar instruirile: în aplicația mare, ecranul `/ssm` îi arăta
  // angajatului și fișa de aptitudine, restricțiile și echipamentul primit.
  // Fără ele aici, trecerea în portal ar fi însemnat o pierdere tăcută de date.
  const [instruiri, fise, restrictii, echipamente, autorizatii] = await Promise.all([
    instruirileAngajatului(tenant.organizationId, stare.fisa.id),
    fiseAptitudineAngajat(tenant.organizationId, stare.fisa.id),
    restrictiiActiveAngajat(tenant.organizationId, stare.fisa.id),
    eipAngajatului(tenant.organizationId, stare.fisa.id),
    autorizatiiNominaleAngajat(tenant.organizationId, stare.fisa.id),
  ]);

  // Denumirile tipurilor NU se pot citi cu clientul angajatului
  // (`ssm_training_types` cere `ssm:read >= team`). Nomenclatorul vine printr-o
  // acțiune cu client admin, apelată DOAR dacă există ce eticheta — altfel ar
  // scrie un rând de audit „view" pe fiecare randare a unui ecran gol.
  const nomenclator = instruiri.length === 0 ? null : await nomenclatorInstruiri({});
  const denumiri = new Map<string, string>(
    nomenclator?.ok === true ? nomenclator.data.map((t) => [t.id, t.denumire]) : [],
  );

  const azi = todayInBucharest();
  const randuri = instruiri.map((instruire) => {
    const scadenta = stareScadentaSsm(true, instruire.urmatoarea_scadenta, azi);
    return {
      ...instruire,
      scadenta,
      treapta: treaptaSsm(scadenta, instruire.urmatoarea_scadenta),
    };
  });

  const totulGol =
    randuri.length === 0 &&
    fise.length === 0 &&
    restrictii.length === 0 &&
    echipamente.length === 0 &&
    autorizatii.length === 0;

  return (
    <div className={`${LATIMI.lista} space-y-6 p-4`}>
      <AntetPagina
        titlu="Dosarul meu SSM"
        descriere="Instruirile, fișa de aptitudine și echipamentul de protecție înregistrate pe numele dumneavoastră."
      />

      {totulGol ? (
        <StareGoala
          fel="initiala"
          pictograma={GraduationCap}
          titlu="Dosarul dumneavoastră SSM e gol"
          descriere="Instruirile, fișa de aptitudine și echipamentul primit apar aici după ce sunt consemnate. Dacă ați participat la o instruire și nu o vedeți, anunțați responsabilul SSM al firmei."
        />
      ) : (
        <ul className="space-y-2">
          {randuri.map((instruire) => (
            <li key={instruire.id} className="bg-surface border-border rounded-panou border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-foreground text-corp font-medium">
                    {/* Fără nomenclator, un identificator brut n-ar spune nimic
                        nimănui — mai bine o formulare onestă. */}
                    {denumiri.get(instruire.training_type_id) ?? "Tip de instruire indisponibil"}
                  </p>
                  <p className="text-muted-foreground text-corp mt-0.5">
                    Efectuată {formatDate(instruire.data_instruirii)}
                    {instruire.durata_ore === null
                      ? null
                      : ` · ${instruire.durata_ore.toLocaleString("ro-RO")} ore`}
                  </p>
                  {instruire.urmatoarea_scadenta === null ? (
                    <p className="text-muted-foreground text-nota mt-1">
                      Fără termen de reînnoire.
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-nota mt-1">
                      Următorul termen: {formatDate(instruire.urmatoarea_scadenta)}
                    </p>
                  )}
                </div>
                {/* Pastilă cu TEXT și cu formă proprie, nu doar culoare: culoarea
                    nu poartă niciodată singură sensul. */}
                <Scadenta treapta={instruire.treapta} className="shrink-0">
                  {ETICHETE_SCADENTA[instruire.scadenta]}
                </Scadenta>
              </div>
              {instruire.semnatura_confirmata ? null : (
                <p className="text-muted-foreground border-border text-nota mt-3 border-t pt-3">
                  Semnătura de confirmare nu a fost înregistrată. Verificați cu responsabilul SSM.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {restrictii.length === 0 ? null : (
        <section aria-labelledby="restrictii" className="space-y-2">
          <h2 id="restrictii" className="text-foreground text-corp font-semibold">
            Restricții de lucru în vigoare
          </h2>
          <ul className="space-y-2">
            {restrictii.map((restrictie) => (
              <li
                key={restrictie.id}
                className="border-warning/40 bg-warning/10 rounded-panou border p-4"
              >
                <p className="text-foreground text-corp">{restrictie.restrictie}</p>
                <p className="text-muted-foreground text-nota mt-1">
                  Din {formatDate(restrictie.valabil_de_la)}
                  {restrictie.valabil_pana === null
                    ? " · fără termen"
                    : ` până la ${formatDate(restrictie.valabil_pana)}`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {fise.length === 0 ? null : (
        <section aria-labelledby="fise" className="space-y-2">
          <h2 id="fise" className="text-foreground text-corp font-semibold">
            Fișa de aptitudine
          </h2>
          <ul className="space-y-2">
            {fise.map((fisa) => (
              <li key={fisa.id} className="bg-surface border-border rounded-panou border p-4">
                <p className="text-foreground text-corp font-medium">
                  {ETICHETE_TIP_EXAMEN[fisa.tip]} · {formatDate(fisa.data_examinarii)}
                </p>
                <p className="text-muted-foreground text-corp mt-0.5">
                  Rezultat: {ETICHETE_REZULTAT_EXAMEN[fisa.rezultat]}
                  {fisa.valabil_pana === null
                    ? null
                    : ` · valabilă până la ${formatDate(fisa.valabil_pana)}`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {echipamente.length === 0 ? null : (
        <section aria-labelledby="eip" className="space-y-2">
          <h2 id="eip" className="text-foreground text-corp font-semibold">
            Echipament de protecție primit
          </h2>
          <ul className="divide-border border-border bg-surface rounded-panou divide-y border">
            {echipamente.map((articol) => (
              <li key={articol.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-foreground text-corp">{articol.articol}</p>
                  <p className="text-muted-foreground text-nota">
                    Predat {formatDate(articol.data_predarii)}
                    {articol.data_inlocuirii === null
                      ? null
                      : ` · de înlocuit la ${formatDate(articol.data_inlocuirii)}`}
                  </p>
                </div>
                <span className="text-muted-foreground text-corp shrink-0 tabular-nums">
                  {articol.cantitate.toLocaleString("ro-RO")} {articol.unitate}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {autorizatii.length === 0 ? null : (
        <section aria-labelledby="autorizatii" className="space-y-2">
          <h2 id="autorizatii" className="text-foreground text-corp font-semibold">
            Autorizații nominale
          </h2>
          <ul className="divide-border border-border bg-surface rounded-panou divide-y border">
            {autorizatii.map((autorizatie) => (
              <li key={autorizatie.id} className="p-3">
                <p className="text-foreground text-corp">
                  {autorizatie.tip}
                  {autorizatie.grupa === null ? null : ` · grupa ${autorizatie.grupa}`}
                </p>
                <p className="text-muted-foreground text-nota">
                  <span className="font-mono">{autorizatie.numar}</span> · valabilă până la{" "}
                  {formatDate(autorizatie.valabil_pana)}
                  {autorizatie.suspendata_la === null ? null : " · SUSPENDATĂ"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
