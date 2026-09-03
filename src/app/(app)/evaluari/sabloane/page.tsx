// src/app/(app)/evaluari/sabloane/page.tsx
import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { StareGoala } from "@/components/ui/stare-goala";
import { valideazaPonderi, type CriteriuSablon } from "@/domain/evaluations/criterii";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { listeazaSabloane } from "@/lib/queries/evaluari";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { ButonSablonNou } from "../_components/constructor-sablon";
import { FileEvaluari } from "../_components/file-evaluari";
import { ActiuniSablonEvaluare } from "./actiuni-sablon-evaluare";

export const metadata: Metadata = { title: "Șabloane de evaluare" };

/** „Scală 1-5”, „Da / Nu”, „Răspuns liber” — ce vede omul pe pastilă. */
function descrieTip(c: CriteriuSablon): string {
  if (c.tip === "text") return "răspuns liber";
  if (c.tip === "da_nu") return "da / nu";
  return `1 - ${String(c.scala_max)}`;
}

export default async function PaginaSabloaneEvaluare() {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "evaluations"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  // Citirea urmează cheia modulului, nu pe cea a fișelor de angajat: `0070` a
  // mutat modulul pe `evaluations:*`, iar pagina rămăsese pe `employees:read`.
  if (!can(permisiuni, "evaluations:read", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta șabloanele de evaluare." />;
  }

  // Șablonul e artefact pe toată firma, deci scrierea lui cere scope `all` —
  // aceeași condiție ca în politica RLS din `0071`. Textul paginii spunea până
  // acum că „poate fi creat de manageri"; nu era adevărat, iar butonul nici
  // nu le apărea.
  const poateScrie = can(permisiuni, "evaluations:update", "all");
  const sabloane = await listeazaSabloane(tenant.organizationId);
  const aleFirmei = sabloane.filter((s) => !s.dePlatforma);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Șabloane de evaluare"
        descriere="Seturi de criterii reutilizabile. Se aplică unui angajat de pe fișa lui, iar evaluarea păstrează criteriile de la momentul completării."
        file={<FileEvaluari activa="sabloane" nrSabloane={sabloane.length} />}
        {...(poateScrie ? { actiuni: <ButonSablonNou /> } : {})}
      />

      {sabloane.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={ClipboardCheck}
          titlu="Niciun șablon de evaluare"
          descriere="Un șablon strânge criteriile după care se notează un angajat. Începeți cu unul scurt: patru sau cinci criterii sunt de ajuns."
        />
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2">
          {sabloane.map((sablon) => {
            const ponderi = valideazaPonderi(sablon.criterii);
            return (
              <li
                key={sablon.id}
                className="border-border rounded-panou bg-surface shadow-ridicat flex flex-col border"
              >
                <div className="flex flex-wrap items-start gap-3 p-4">
                  <span className="bg-background rounded-control flex size-9 shrink-0 items-center justify-center">
                    <ClipboardCheck aria-hidden="true" className="text-primary size-4.5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-corp text-foreground font-semibold">{sablon.denumire}</h2>
                      {sablon.dePlatforma ? (
                        <Badge ton="neutru">Șablon de platformă</Badge>
                      ) : (
                        <span className="text-muted-foreground text-nota tabular-nums">
                          v{sablon.versiune}
                        </span>
                      )}
                      {sablon.activ ? null : <Badge ton="ciorna">Arhivat</Badge>}
                    </div>

                    {sablon.descriere === null ? null : (
                      <p className="text-muted-foreground text-corp mt-1 text-pretty">
                        {sablon.descriere}
                      </p>
                    )}

                    {/* Criteriile, cu scala și ponderea lor. Lista dinainte
                        arăta doar denumirile, deci două șabloane cu aceleași
                        criterii pe scale diferite erau imposibil de deosebit. */}
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {sablon.criterii.map((c) => (
                        <li
                          key={c.cod}
                          className="border-border bg-background text-nota text-foreground rounded-full border px-2.5 py-1"
                        >
                          {c.denumire}
                          <span className="text-muted-foreground tabular-nums">
                            {" · "}
                            {descrieTip(c)}
                            {c.pondere === null ? "" : ` · ${String(c.pondere)} %`}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <p className="text-muted-foreground text-nota mt-3 tabular-nums">
                      {sablon.criterii.length}{" "}
                      {sablon.criterii.length === 1 ? "criteriu" : "criterii"}
                      {ponderi.arePonderi ? " · cu ponderi" : " · criterii egale"}
                      {" · "}
                      {sablon.nrEvaluari === 0
                        ? "nefolosit încă"
                        : sablon.nrEvaluari === 1
                          ? "folosit într-o evaluare"
                          : `folosit în ${String(sablon.nrEvaluari)} evaluări`}
                    </p>
                  </div>
                </div>

                {poateScrie ? (
                  <div className="border-border bg-background rounded-b-panou mt-auto border-t px-4 py-3">
                    <ActiuniSablonEvaluare sablon={sablon} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {poateScrie && aleFirmei.length === 0 && sabloane.length > 0 ? (
        <p className="text-muted-foreground text-nota">
          Firma nu are încă niciun șablon propriu. Șablonul de platformă se poate folosi așa cum e,
          sau personalizat: butonul face o copie editabilă în firma dumneavoastră.
        </p>
      ) : null}
    </div>
  );
}
